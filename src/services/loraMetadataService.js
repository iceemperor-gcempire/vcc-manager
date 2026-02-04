const axios = require('axios');
const ServerLoraCache = require('../models/ServerLoraCache');
const SystemSettings = require('../models/SystemSettings');

// Rate limiting을 위한 딜레이 함수
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Civitai API rate limit 간격
const CIVITAI_RATE_LIMIT_MS_NO_KEY = 1000;  // API 키 없음: 1초
const CIVITAI_RATE_LIMIT_MS_WITH_KEY = 200; // API 키 있음: 200ms

// Rate limit 에러 시 재시도 대기 시간
const CIVITAI_RETRY_DELAY_MS = 5000;

// 최대 재시도 횟수
const CIVITAI_MAX_RETRIES = 2;

// 최대 미리보기 이미지 수
const MAX_PREVIEW_IMAGES = 5;

// 해시 요청 타임아웃 (단일 파일)
const HASH_REQUEST_TIMEOUT = 60000; // 1분

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
 * ComfyUI 서버에서 LoRA 파일명 목록 조회 (기본 API)
 */
const getLoraFilenames = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/object_info/LoraLoader`, {
      timeout: 30000
    });
    const loraLoader = response.data?.LoraLoader;

    if (loraLoader && loraLoader.input && loraLoader.input.required && loraLoader.input.required.lora_name) {
      return loraLoader.input.required.lora_name[0] || [];
    }

    return [];
  } catch (error) {
    throw new Error(`Failed to get LoRA list from ComfyUI: ${error.message}`);
  }
};

/**
 * VCC LoRA Hash 커스텀 노드 설치 여부 확인
 */
const checkVccLoraHashNodeAvailable = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/api/vcc/lora-hash/ping`, {
      timeout: 5000
    });
    return response.data?.success === true;
  } catch (error) {
    return false;
  }
};

/**
 * 단일 LoRA 파일의 해시 조회
 */
const getLoraHash = async (serverUrl, filename) => {
  try {
    const encodedFilename = encodeURIComponent(filename);
    const response = await axios.get(`${serverUrl}/api/vcc/lora-hash/${encodedFilename}`, {
      timeout: HASH_REQUEST_TIMEOUT
    });

    if (response.data?.success && response.data?.sha256) {
      return response.data.sha256;
    }
    return null;
  } catch (error) {
    console.error(`Failed to get hash for ${filename}:`, error.message);
    return null;
  }
};

/**
 * Civitai API를 통해 해시로 모델 정보 조회 (재시도 로직 포함)
 * @param {string} hash - SHA256 해시
 * @param {string|null} apiKey - Civitai API 키
 * @param {number} retryCount - 재시도 횟수
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

    if (!data) {
      return { found: false };
    }

    // 미리보기 이미지 처리 (최대 5개, NSFW 정보 포함)
    const images = (data.images || [])
      .slice(0, MAX_PREVIEW_IMAGES)
      .map(img => ({
        url: img.url,
        nsfw: img.nsfw !== 'None' && img.nsfw !== false,
        nsfwLevel: img.nsfwLevel || (img.nsfw !== 'None' && img.nsfw !== false ? 'nsfw' : 'safe')
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
    // 404: Civitai에 등록되지 않은 모델
    if (error.response?.status === 404) {
      return { found: false };
    }

    // 429: Rate limit - 재시도
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
 * 서버의 LoRA 목록 및 메타데이터 동기화
 */
const syncServerLoras = async (serverId, serverUrl, { progressCallback = null, forceRefresh = false } = {}) => {
  const cache = await ServerLoraCache.findOrCreateByServerId(serverId, serverUrl);

  // 이미 동기화 중이면 건너뛰기
  if (cache.status === 'fetching') {
    throw new Error('Sync already in progress');
  }

  // Civitai API 키 조회 (Rate limiting 결정용)
  const apiKey = await getCivitaiApiKey();
  const rateLimit = apiKey ? CIVITAI_RATE_LIMIT_MS_WITH_KEY : CIVITAI_RATE_LIMIT_MS_NO_KEY;
  console.log(`Using Civitai rate limit: ${rateLimit}ms (API key: ${apiKey ? 'present' : 'absent'})`);
  if (forceRefresh) {
    console.log('Force refresh enabled - will re-fetch all Civitai metadata');
  }

  try {
    // 동기화 시작
    await cache.startSync();

    // 1단계: VCC LoRA Hash 노드 확인
    if (progressCallback) progressCallback('checking_node', 0, 0);
    await cache.updateProgress(0, 0, 'checking_node');

    const vccNodeAvailable = await checkVccLoraHashNodeAvailable(serverUrl);
    cache.loraInfoNodeAvailable = vccNodeAvailable;
    console.log(`VCC LoRA Hash node available: ${vccNodeAvailable}`);

    // 2단계: ComfyUI에서 LoRA 파일명 목록 조회
    if (progressCallback) progressCallback('fetching_list', 0, 0);
    await cache.updateProgress(0, 0, 'fetching_list');

    const filenames = await getLoraFilenames(serverUrl);
    console.log(`Got ${filenames.length} LoRA files from ComfyUI`);

    if (filenames.length === 0) {
      cache.loraModels = [];
      await cache.completeSync();
      return cache;
    }

    // 기존 모델 매핑 (이미 가져온 해시와 메타데이터 재사용)
    const existingModels = {};
    for (const model of cache.loraModels) {
      existingModels[model.filename] = model;
    }

    // 3단계: 해시 조회 및 Civitai 메타데이터 조회
    const totalSteps = filenames.length;
    if (progressCallback) progressCallback('fetching_metadata', 0, totalSteps);
    await cache.updateProgress(0, totalSteps, 'fetching_metadata');

    const newLoraModels = [];
    let processedCount = 0;
    let civitaiCount = 0;

    for (const filename of filenames) {
      processedCount++;

      if (progressCallback) {
        progressCallback('fetching_metadata', processedCount, totalSteps);
      }
      await cache.updateProgress(processedCount, totalSteps, 'fetching_metadata');

      // 기존 데이터 확인
      const existing = existingModels[filename];

      // 이미 해시와 Civitai 메타데이터가 있으면 재사용 (강제 새로고침이 아닌 경우)
      if (!forceRefresh && existing && existing.hash && existing.civitai?.fetchedAt) {
        newLoraModels.push(existing);
        if (existing.civitai?.found) civitaiCount++;
        continue;
      }

      // 새 모델 데이터 구성
      const loraModel = {
        filename,
        relativePath: filename,
        hash: existing?.hash || null,  // 기존 해시 유지
        hashError: null,
        civitai: existing?.civitai || { found: false }
      };

      // VCC 노드가 있고 해시가 없으면 해시 조회
      if (vccNodeAvailable && !loraModel.hash) {
        const hash = await getLoraHash(serverUrl, filename);
        if (hash) {
          loraModel.hash = hash;
        } else {
          loraModel.hashError = 'Hash calculation failed';
        }
      } else if (!vccNodeAvailable && !loraModel.hash) {
        loraModel.hashError = 'VCC LoRA Hash node not installed';
      }

      // 해시가 있고 Civitai 메타데이터가 없으면 Civitai 조회 (강제 새로고침 시 항상 조회)
      if (loraModel.hash && (forceRefresh || !loraModel.civitai?.fetchedAt)) {
        const civitaiData = await fetchCivitaiMetadataByHash(loraModel.hash, apiKey);
        loraModel.civitai = civitaiData;

        if (civitaiData.found) {
          civitaiCount++;
        }

        // Civitai Rate limiting (API 키 유무에 따라 다른 간격)
        await delay(rateLimit);
      } else if (loraModel.civitai?.found) {
        civitaiCount++;
      }

      newLoraModels.push(loraModel);
    }

    // 결과 저장
    cache.loraModels = newLoraModels;
    cache.lastCivitaiSync = new Date();
    await cache.completeSync();

    console.log(`Sync completed: ${filenames.length} LoRAs, ${civitaiCount} with Civitai metadata`);

    return cache;
  } catch (error) {
    console.error('LoRA sync error:', error);
    await cache.failSync(error.message);
    throw error;
  }
};

/**
 * 서버의 LoRA 목록만 조회 (메타데이터 동기화 없이)
 */
const getServerLoras = async (serverId, serverUrl) => {
  let cache = await ServerLoraCache.findOne({ serverId });

  // 캐시가 없으면 기본 목록만 조회
  if (!cache) {
    try {
      const filenames = await getLoraFilenames(serverUrl);
      const loraModels = filenames.map(filename => ({
        filename,
        relativePath: filename,
        hash: null,
        civitai: { found: false }
      }));

      // VCC 노드 확인
      const vccNodeAvailable = await checkVccLoraHashNodeAvailable(serverUrl);

      cache = new ServerLoraCache({
        serverId,
        serverUrl,
        loraModels,
        loraInfoNodeAvailable: vccNodeAvailable,
        status: 'idle',
        lastFetched: new Date()
      });

      await cache.save();
    } catch (error) {
      throw new Error(`Failed to get LoRA list: ${error.message}`);
    }
  }

  return cache;
};

/**
 * 동기화 상태 조회
 */
const getSyncStatus = async (serverId) => {
  const cache = await ServerLoraCache.findOne({ serverId });

  if (!cache) {
    return {
      status: 'idle',
      progress: { current: 0, total: 0, stage: 'idle' },
      lastFetched: null
    };
  }

  return {
    status: cache.status,
    progress: cache.progress,
    lastFetched: cache.lastFetched,
    lastCivitaiSync: cache.lastCivitaiSync,
    loraInfoNodeAvailable: cache.loraInfoNodeAvailable,
    totalLoras: cache.loraModels.length,
    lorasWithMetadata: cache.loraModels.filter(l => l.civitai?.found).length,
    lorasWithHash: cache.loraModels.filter(l => l.hash).length,
    errorMessage: cache.errorMessage
  };
};

/**
 * 검색 필터를 적용한 LoRA 목록 조회
 */
const searchServerLoras = async (serverId, { search, hasMetadata, baseModel, page = 1, limit = 50 } = {}) => {
  const cache = await ServerLoraCache.findOne({ serverId });

  if (!cache) {
    return {
      loraModels: [],
      pagination: { current: 1, pages: 0, total: 0 }
    };
  }

  let filtered = [...cache.loraModels];

  // 검색어 필터
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(lora => {
      const filename = lora.filename.toLowerCase();
      const name = (lora.civitai?.name || '').toLowerCase();
      const description = (lora.civitai?.description || '').toLowerCase();
      const trainedWords = (lora.civitai?.trainedWords || []).join(' ').toLowerCase();

      return filename.includes(searchLower) ||
             name.includes(searchLower) ||
             description.includes(searchLower) ||
             trainedWords.includes(searchLower);
    });
  }

  // 메타데이터 유무 필터
  if (hasMetadata !== undefined) {
    filtered = filtered.filter(lora =>
      hasMetadata ? lora.civitai?.found : !lora.civitai?.found
    );
  }

  // 기본 모델 필터
  if (baseModel) {
    filtered = filtered.filter(lora =>
      lora.civitai?.baseModel === baseModel
    );
  }

  // 페이지네이션
  const total = filtered.length;
  const pages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginatedModels = filtered.slice(offset, offset + limit);

  return {
    loraModels: paginatedModels,
    pagination: {
      current: page,
      pages,
      total
    },
    cacheInfo: {
      status: cache.status,
      lastFetched: cache.lastFetched,
      lastCivitaiSync: cache.lastCivitaiSync,
      loraInfoNodeAvailable: cache.loraInfoNodeAvailable
    }
  };
};

module.exports = {
  getLoraFilenames,
  checkVccLoraHashNodeAvailable,
  getLoraHash,
  fetchCivitaiMetadataByHash,
  getCivitaiApiKey,
  syncServerLoras,
  getServerLoras,
  getSyncStatus,
  searchServerLoras
};
