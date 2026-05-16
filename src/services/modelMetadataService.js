const axios = require('axios');
const ServerModelCache = require('../models/ServerModelCache');
const SystemSettings = require('../models/SystemSettings');

// LoRA service 와 동일한 Civitai rate limit / 재시도 정책.
// 단순 재구현 (Phase B 에서는 두 서비스가 독립으로 진화할 여지를 두기 위해
// 공통화는 하지 않음 — Phase D 정리 시점에 재검토).

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const CIVITAI_RATE_LIMIT_MS_NO_KEY = 1000;
const CIVITAI_RATE_LIMIT_MS_WITH_KEY = 200;
const CIVITAI_RETRY_DELAY_MS = 5000;
const CIVITAI_MAX_RETRIES = 2;
const MAX_PREVIEW_IMAGES = 5;
const HASH_REQUEST_TIMEOUT = 60000;

/**
 * Civitai API 키 조회 (DB 우선, 환경변수 폴백)
 */
const getCivitaiApiKey = async () => {
  try {
    return await SystemSettings.getCivitaiApiKey();
  } catch (error) {
    console.error('Failed to get Civitai API key from DB:', error.message);
    return process.env.CIVITAI_API_KEY || null;
  }
};

/**
 * ComfyUI 서버에서 checkpoint 파일명 목록 조회.
 * `/object_info/CheckpointLoaderSimple` 의 ckpt_name 입력 후보를 사용.
 */
const getCheckpointFilenames = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/object_info/CheckpointLoaderSimple`, {
      timeout: 30000
    });
    const node = response.data?.CheckpointLoaderSimple;

    if (node && node.input && node.input.required && node.input.required.ckpt_name) {
      return node.input.required.ckpt_name[0] || [];
    }

    return [];
  } catch (error) {
    throw new Error(`Failed to get checkpoint list from ComfyUI: ${error.message}`);
  }
};

/**
 * VCC File Hash 커스텀 노드 설치 여부 확인.
 * 신규 `/file-hash/ping` 우선, 실패 시 legacy `/lora-hash/ping` 으로 fallback
 * (사용자가 아직 노드 업데이트 전인 경우라도 LoRA 가 동작하도록).
 */
const checkVccFileHashNodeAvailable = async (serverUrl) => {
  try {
    const r = await axios.get(`${serverUrl}/api/vcc/file-hash/ping`, { timeout: 5000 });
    if (r.data?.success === true) return true;
  } catch (_e) {
    // fallthrough
  }
  try {
    const r = await axios.get(`${serverUrl}/api/vcc/lora-hash/ping`, { timeout: 5000 });
    return r.data?.success === true;
  } catch (_e) {
    return false;
  }
};

/**
 * 단일 checkpoint 파일의 SHA256 해시 조회.
 * 신규 노드 (file-hash/checkpoints/{filename}) 사용. 구 노드는 checkpoint 미지원.
 */
const getCheckpointHash = async (serverUrl, filename) => {
  try {
    const encoded = encodeURIComponent(filename);
    const response = await axios.get(
      `${serverUrl}/api/vcc/file-hash/checkpoints/${encoded}`,
      { timeout: HASH_REQUEST_TIMEOUT }
    );
    if (response.data?.success && response.data?.sha256) {
      return response.data.sha256;
    }
    return null;
  } catch (error) {
    console.error(`Failed to get checkpoint hash for ${filename}:`, error.message);
    return null;
  }
};

/**
 * Civitai API 로 해시 기반 모델 메타데이터 조회.
 * loraMetadataService 와 동일 정책 (재시도, rate limit 핸들링).
 */
const fetchCivitaiMetadataByHash = async (hash, apiKey = null, retryCount = 0) => {
  if (!hash) {
    return { found: false, error: 'No hash provided' };
  }

  try {
    const headers = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await axios.get(
      `https://civitai.com/api/v1/model-versions/by-hash/${hash}`,
      {
        timeout: 15000,
        headers
      }
    );

    const data = response.data;
    if (!data) return { found: false };

    const images = (data.images || [])
      .slice(0, MAX_PREVIEW_IMAGES)
      .map(img => ({
        url: img.url,
        nsfw: img.nsfw !== 'None' && img.nsfw !== false,
        type: img.type === 'video' ? 'video' : 'image'
      }));

    return {
      found: true,
      modelId: data.modelId,
      modelVersionId: data.id,
      name: data.model?.name || data.name,
      description: data.description || data.model?.description,
      baseModel: data.baseModel,
      trainedWords: data.trainedWords || [],
      images,
      nsfw: data.model?.nsfw || false,
      modelUrl: `https://civitai.com/models/${data.modelId}?modelVersionId=${data.id}`,
      fetchedAt: new Date()
    };
  } catch (error) {
    if (error.response?.status === 404) return { found: false };

    if (error.response?.status === 429 && retryCount < CIVITAI_MAX_RETRIES) {
      console.warn(`Civitai rate limit hit, waiting ${CIVITAI_RETRY_DELAY_MS}ms before retry ${retryCount + 1}/${CIVITAI_MAX_RETRIES}`);
      await delay(CIVITAI_RETRY_DELAY_MS);
      return fetchCivitaiMetadataByHash(hash, apiKey, retryCount + 1);
    }

    console.error(`Civitai API error for hash ${hash}:`, error.message);
    return {
      found: false,
      error: error.response?.status === 429 ? 'Rate limit exceeded' : error.message
    };
  }
};

/**
 * OpenAI / OpenAI Compatible 서버의 모델 목록 조회 (`GET /v1/models`).
 * 응답 스펙: { data: [{ id, object, created, owned_by, ... }] }
 */
const getOpenAIProviderModels = async (serverUrl, apiKey) => {
  const headers = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  try {
    const response = await axios.get(`${serverUrl}/v1/models`, {
      timeout: 30000,
      headers
    });
    const list = response.data?.data || [];
    return list.map(m => ({
      id: m.id,
      name: m.id,
      description: m.description || '',
      capabilities: [],
      contextWindow: m.context_window || null,
      ownedBy: m.owned_by || null
    }));
  } catch (error) {
    throw new Error(`Failed to fetch OpenAI models: ${error.message}`);
  }
};

/**
 * Gemini 서버의 모델 목록 조회 (`GET /v1beta/models`).
 * 응답 스펙: { models: [{ name, displayName, description, supportedGenerationMethods, inputTokenLimit, outputTokenLimit, ... }] }
 */
const getGeminiProviderModels = async (serverUrl, apiKey) => {
  try {
    const response = await axios.get(`${serverUrl}/v1beta/models`, {
      timeout: 30000,
      params: apiKey ? { key: apiKey } : undefined
    });
    const list = response.data?.models || [];
    return list.map(m => ({
      // name 형식이 'models/gemini-...' 라 prefix 제거
      id: typeof m.name === 'string' ? m.name.replace(/^models\//, '') : m.name,
      name: m.displayName || m.name,
      description: m.description || '',
      capabilities: m.supportedGenerationMethods || [],
      contextWindow: m.inputTokenLimit || null
    }));
  } catch (error) {
    throw new Error(`Failed to fetch Gemini models: ${error.message}`);
  }
};

/**
 * SaaS provider (OpenAI / OpenAI Compatible / Gemini) 모델 목록 동기화.
 * Civitai / hash 무관 — provider 의 `/models` 응답을 그대로 캐시.
 * @param {Object} server — Server document (serverType / serverUrl / configuration.apiKey 사용)
 */
const syncServerProviderModels = async (server, { progressCallback = null } = {}) => {
  const cache = await ServerModelCache.findOrCreateByServerId(server._id, server.serverUrl);

  if (cache.status === 'fetching') {
    throw new Error('Sync already in progress');
  }

  const apiKey = server.configuration?.apiKey;

  try {
    await cache.startSync();

    if (progressCallback) progressCallback('fetching_list', 0, 0);
    await cache.updateProgress(0, 0, 'fetching_list');

    let providerModels = [];
    if (server.serverType === 'OpenAI' || server.serverType === 'OpenAI Compatible') {
      providerModels = await getOpenAIProviderModels(server.serverUrl, apiKey);
    } else if (server.serverType === 'Gemini') {
      providerModels = await getGeminiProviderModels(server.serverUrl, apiKey);
    } else {
      throw new Error(`Unsupported serverType for provider sync: ${server.serverType}`);
    }

    console.log(`[ModelSync] ${server.serverType}: ${providerModels.length} models from /models endpoint`);

    const totalSteps = providerModels.length;
    if (progressCallback) progressCallback('fetching_metadata', totalSteps, totalSteps);
    await cache.updateProgress(totalSteps, totalSteps, 'fetching_metadata');

    cache.hashNodeAvailable = false; // SaaS provider 는 hash 무관
    cache.models = providerModels.map(pm => ({
      filename: pm.id, // SaaS 의 식별자는 모델 ID
      hash: null,
      hashError: null,
      civitai: { found: false },
      provider: {
        found: true,
        id: pm.id,
        name: pm.name,
        description: pm.description,
        capabilities: pm.capabilities,
        contextWindow: pm.contextWindow,
        fetchedAt: new Date()
      }
    }));
    cache.lastMetadataSync = new Date();
    await cache.completeSync();

    return cache;
  } catch (error) {
    console.error('[ModelSync] Provider sync error:', error);
    await cache.failSync(error.message);
    throw error;
  }
};

/**
 * server.serverType 에 따라 적절한 sync 함수로 분기.
 * 호출자는 이 단일 진입점만 알면 됨.
 */
const syncServerModels = async (server, opts = {}) => {
  if (server.serverType === 'ComfyUI') {
    return syncServerCheckpoints(server._id, server.serverUrl, opts);
  }
  if (server.serverType === 'OpenAI' || server.serverType === 'OpenAI Compatible' || server.serverType === 'Gemini') {
    return syncServerProviderModels(server, opts);
  }
  throw new Error(`Unsupported serverType for model sync: ${server.serverType}`);
};

/**
 * 서버의 checkpoint 목록 + 메타데이터 동기화.
 * ComfyUI 전용. SaaS provider 는 syncServerProviderModels 사용.
 */
const syncServerCheckpoints = async (serverId, serverUrl, { progressCallback = null, forceRefresh = false } = {}) => {
  const cache = await ServerModelCache.findOrCreateByServerId(serverId, serverUrl);

  if (cache.status === 'fetching') {
    throw new Error('Sync already in progress');
  }

  const apiKey = await getCivitaiApiKey();
  const rateLimit = apiKey ? CIVITAI_RATE_LIMIT_MS_WITH_KEY : CIVITAI_RATE_LIMIT_MS_NO_KEY;
  console.log(`[ModelSync] Civitai rate limit: ${rateLimit}ms (API key: ${apiKey ? 'present' : 'absent'})`);
  if (forceRefresh) {
    console.log('[ModelSync] Force refresh enabled');
  }

  try {
    await cache.startSync();

    if (progressCallback) progressCallback('checking_node', 0, 0);
    await cache.updateProgress(0, 0, 'checking_node');

    const hashNodeAvailable = await checkVccFileHashNodeAvailable(serverUrl);
    cache.hashNodeAvailable = hashNodeAvailable;
    console.log(`[ModelSync] VCC File Hash node available: ${hashNodeAvailable}`);

    if (progressCallback) progressCallback('fetching_list', 0, 0);
    await cache.updateProgress(0, 0, 'fetching_list');

    const filenames = await getCheckpointFilenames(serverUrl);
    console.log(`[ModelSync] Got ${filenames.length} checkpoints from ComfyUI`);

    if (filenames.length === 0) {
      cache.models = [];
      await cache.completeSync();
      return cache;
    }

    const existingModels = {};
    for (const m of cache.models) {
      existingModels[m.filename] = m;
    }

    const totalSteps = filenames.length;
    if (progressCallback) progressCallback('fetching_metadata', 0, totalSteps);
    await cache.updateProgress(0, totalSteps, 'fetching_metadata');

    const newModels = [];
    let processedCount = 0;
    let civitaiCount = 0;

    for (const filename of filenames) {
      processedCount++;

      if (progressCallback) progressCallback('fetching_metadata', processedCount, totalSteps);
      await cache.updateProgress(processedCount, totalSteps, 'fetching_metadata');

      const existing = existingModels[filename];

      if (!forceRefresh && existing && existing.hash && existing.civitai?.fetchedAt) {
        newModels.push(existing);
        if (existing.civitai?.found) civitaiCount++;
        continue;
      }

      // hash 재사용 정책 (#341):
      // existing.hash 가 있으면 재계산하지 않고 civitai 메타만 새로 받음. 체크포인트 SHA256 은
      // 파일당 수십 초~분 단위라 가장 큰 비용. 보통 파일 내용이 바뀌면 파일명도 같이 바뀌어 새 entry 로
      // 처리되므로 기존 hash 를 신뢰해도 충돌 가능성 낮음. hash 자체를 다시 받고 싶으면 admin 의
      // \"캐시 완전 삭제\" 버튼 (DELETE /api/servers/:id/models/cache) 으로 cache.models 를 비운 뒤 동기화.
      const item = {
        filename,
        hash: existing?.hash || null,
        hashError: null,
        civitai: existing?.civitai || { found: false }
      };

      if (hashNodeAvailable && !item.hash) {
        const hash = await getCheckpointHash(serverUrl, filename);
        if (hash) {
          item.hash = hash;
        } else {
          item.hashError = 'Hash calculation failed';
        }
      } else if (!hashNodeAvailable && !item.hash) {
        item.hashError = 'VCC File Hash node not installed';
      }

      if (item.hash && (forceRefresh || !item.civitai?.fetchedAt)) {
        const civitaiData = await fetchCivitaiMetadataByHash(item.hash, apiKey);
        item.civitai = civitaiData;
        if (civitaiData.found) civitaiCount++;
        await delay(rateLimit);
      } else if (item.civitai?.found) {
        civitaiCount++;
      }

      newModels.push(item);
    }

    cache.models = newModels;
    cache.lastMetadataSync = new Date();
    await cache.completeSync();

    console.log(`[ModelSync] Completed: ${filenames.length} checkpoints, ${civitaiCount} with Civitai metadata`);
    return cache;
  } catch (error) {
    console.error('[ModelSync] Error:', error);
    await cache.failSync(error.message);
    throw error;
  }
};

/**
 * 서버의 checkpoint 캐시 조회 (없으면 기본 목록만 fetch).
 */
const getServerCheckpoints = async (serverId, serverUrl) => {
  let cache = await ServerModelCache.findOne({ serverId });

  if (!cache) {
    try {
      const filenames = await getCheckpointFilenames(serverUrl);
      const models = filenames.map(filename => ({
        filename,
        hash: null,
        civitai: { found: false }
      }));

      const hashNodeAvailable = await checkVccFileHashNodeAvailable(serverUrl);

      cache = new ServerModelCache({
        serverId,
        serverUrl,
        models,
        hashNodeAvailable,
        status: 'idle',
        lastFetched: new Date()
      });

      await cache.save();
    } catch (error) {
      throw new Error(`Failed to get checkpoint list: ${error.message}`);
    }
  }

  return cache;
};

// #256: stale 감지 임계 — LoRA service 와 동일 정책.
const STALE_FETCHING_MS = 5 * 60 * 1000;

const getSyncStatus = async (serverId) => {
  let cache = await ServerModelCache.findOne({ serverId });

  if (!cache) {
    return {
      status: 'idle',
      progress: { current: 0, total: 0, stage: 'idle' },
      lastFetched: null
    };
  }

  if (cache.status === 'fetching' && cache.updatedAt) {
    const staleMs = Date.now() - new Date(cache.updatedAt).getTime();
    if (staleMs > STALE_FETCHING_MS) {
      cache.status = 'failed';
      cache.errorMessage = `Sync stalled (no progress for ${Math.round(staleMs / 1000)}s)`;
      try {
        await cache.save();
      } catch (e) {
        console.error('[Model stale cleanup] save error:', e.message);
      }
    }
  }

  return {
    status: cache.status,
    progress: cache.progress,
    lastFetched: cache.lastFetched,
    lastMetadataSync: cache.lastMetadataSync,
    hashNodeAvailable: cache.hashNodeAvailable,
    totalModels: cache.models.length,
    modelsWithMetadata: cache.models.filter(m => m.civitai?.found || m.provider?.found).length,
    modelsWithHash: cache.models.filter(m => m.hash).length,
    errorMessage: cache.errorMessage
  };
};

/**
 * 동기화 상태를 idle 로 강제 reset.
 */
const resetSyncStatus = async (serverId) => {
  const cache = await ServerModelCache.findOne({ serverId });
  if (!cache) return null;
  cache.status = 'idle';
  cache.progress = { current: 0, total: 0, stage: 'idle' };
  cache.errorMessage = null;
  await cache.save();
  return cache;
};

/**
 * 검색 / 페이지네이션 / baseModel 필터를 적용한 모델 목록 조회.
 * ComfyUI checkpoint (civitai 메타데이터) + SaaS provider 모델 (provider 메타데이터)
 * 양쪽을 통합 검색.
 *
 * @param {ObjectId} serverId
 * @param {Object} opts
 * @param {string} opts.search — filename / civitai 메타 / provider 메타 통합 검색
 * @param {boolean} opts.hasMetadata — civitai 또는 provider 메타데이터 보유 여부
 * @param {string} opts.baseModel — civitai.baseModel 단일 매칭 (사용자 dropdown 필터용)
 * @param {string[]} opts.allowedBaseModels — civitai.baseModel 다중 매칭
 *   (작업판의 allowedModelTypes 와 매핑 — 필터 활성 시 Civitai 미등록 모델은 제외, #320)
 */
const searchServerModels = async (serverId, { search, hasMetadata, baseModel, allowedBaseModels, whitelist, page = 1, limit = 50 } = {}) => {
  const cache = await ServerModelCache.findOne({ serverId });

  if (!cache) {
    return {
      models: [],
      pagination: { current: 1, pages: 0, total: 0 },
      availableBaseModels: []
    };
  }

  const availableBaseModels = [...new Set(
    cache.models
      .filter(m => m.civitai?.baseModel)
      .map(m => m.civitai.baseModel)
  )].sort();

  let filtered = [...cache.models];

  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(m => {
      const filename = (m.filename || '').toLowerCase();
      const civName = (m.civitai?.name || '').toLowerCase();
      const civDesc = (m.civitai?.description || '').toLowerCase();
      const civTrained = (m.civitai?.trainedWords || []).join(' ').toLowerCase();
      const provName = (m.provider?.name || '').toLowerCase();
      const provDesc = (m.provider?.description || '').toLowerCase();

      return filename.includes(s) ||
             civName.includes(s) ||
             civDesc.includes(s) ||
             civTrained.includes(s) ||
             provName.includes(s) ||
             provDesc.includes(s);
    });
  }

  if (hasMetadata !== undefined) {
    filtered = filtered.filter(m => {
      const has = (m.civitai?.found === true) || (m.provider?.found === true);
      return hasMetadata ? has : !has;
    });
  }

  if (baseModel) {
    filtered = filtered.filter(m => m.civitai?.baseModel === baseModel);
  }

  // allowedBaseModels: 작업판의 allowedModelTypes 적용. 빈 배열/미설정은 제약 없음.
  // 필터 활성 시 civitai 미등록 (baseModel 미상) 모델도 제외 (#320).
  if (Array.isArray(allowedBaseModels) && allowedBaseModels.length > 0) {
    filtered = filtered.filter(m => allowedBaseModels.includes(m.civitai?.baseModel));
  }

  // whitelist: 작업판의 modelExposurePolicy='whitelist' + modelWhitelist 적용 (#198 Phase D).
  // filename 정확 매칭. 빈 배열/미설정은 제약 없음.
  if (Array.isArray(whitelist) && whitelist.length > 0) {
    const wlSet = new Set(whitelist);
    filtered = filtered.filter(m => wlSet.has(m.filename));
  }

  const total = filtered.length;
  const pages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginatedModels = filtered.slice(offset, offset + limit);

  return {
    models: paginatedModels,
    pagination: { current: page, pages, total },
    availableBaseModels,
    cacheInfo: {
      status: cache.status,
      lastFetched: cache.lastFetched,
      lastMetadataSync: cache.lastMetadataSync,
      hashNodeAvailable: cache.hashNodeAvailable
    }
  };
};

module.exports = {
  getCheckpointFilenames,
  checkVccFileHashNodeAvailable,
  getCheckpointHash,
  fetchCivitaiMetadataByHash,
  getCivitaiApiKey,
  syncServerCheckpoints,
  getOpenAIProviderModels,
  getGeminiProviderModels,
  syncServerProviderModels,
  syncServerModels,
  getServerCheckpoints,
  getSyncStatus,
  resetSyncStatus,
  searchServerModels
};
