const axios = require('axios');
const ServerLoraCache = require('../models/ServerLoraCache');

// Rate limiting을 위한 딜레이 함수
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Civitai API rate limit 간격 (1초 - 보수적 설정)
const CIVITAI_RATE_LIMIT_MS = 1000;

// Rate limit 에러 시 재시도 대기 시간
const CIVITAI_RETRY_DELAY_MS = 5000;

// 최대 재시도 횟수
const CIVITAI_MAX_RETRIES = 2;

// 최대 미리보기 이미지 수
const MAX_PREVIEW_IMAGES = 5;

// Civitai API 키 (환경변수에서 로드, 선택사항)
const CIVITAI_API_KEY = process.env.CIVITAI_API_KEY || null;

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
    const response = await axios.get(`${serverUrl}/api/vcc/lora-hashes`, {
      timeout: 10000
    });
    return response.data?.success === true;
  } catch (error) {
    // 404 또는 연결 실패 = 노드 미설치
    return false;
  }
};

/**
 * VCC LoRA Hash 노드에서 모든 LoRA 해시 조회
 */
const getLoraHashesFromVccNode = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/api/vcc/lora-hashes`, {
      timeout: 120000 // 해시 계산에 시간이 걸릴 수 있음
    });

    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to get LoRA hashes');
    }

    // filename -> sha256 매핑 생성
    const hashMap = {};
    const loras = response.data.loras || [];

    for (const lora of loras) {
      // relative_path와 filename 모두 매핑
      if (lora.sha256) {
        hashMap[lora.filename] = lora.sha256;
        if (lora.relative_path && lora.relative_path !== lora.filename) {
          hashMap[lora.relative_path] = lora.sha256;
        }
      }
    }

    return {
      hashMap,
      loras: loras.map(l => ({
        filename: l.filename,
        relativePath: l.relative_path,
        hash: l.sha256
      }))
    };
  } catch (error) {
    console.error('Failed to get LoRA hashes from VCC node:', error.message);
    return { hashMap: {}, loras: [] };
  }
};

/**
 * Civitai API를 통해 해시로 모델 정보 조회 (재시도 로직 포함)
 */
const getCivitaiMetadataByHash = async (hash, retryCount = 0) => {
  if (!hash) {
    return { found: false, error: 'No hash provided' };
  }

  try {
    const headers = {};
    if (CIVITAI_API_KEY) {
      headers['Authorization'] = `Bearer ${CIVITAI_API_KEY}`;
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

    // 미리보기 이미지 처리 (최대 5개)
    const images = (data.images || [])
      .slice(0, MAX_PREVIEW_IMAGES)
      .map(img => ({
        url: img.url,
        nsfw: img.nsfw !== 'None' && img.nsfw !== false
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
      return getCivitaiMetadataByHash(hash, retryCount + 1);
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
const syncServerLoras = async (serverId, serverUrl, progressCallback = null) => {
  const cache = await ServerLoraCache.findOrCreateByServerId(serverId, serverUrl);

  // 이미 동기화 중이면 건너뛰기
  if (cache.status === 'fetching') {
    throw new Error('Sync already in progress');
  }

  try {
    // 동기화 시작
    await cache.startSync();

    // 1단계: VCC LoRA Hash 노드 확인
    if (progressCallback) progressCallback('checking_node', 0, 0);

    const vccNodeAvailable = await checkVccLoraHashNodeAvailable(serverUrl);
    cache.loraInfoNodeAvailable = vccNodeAvailable;
    console.log(`VCC LoRA Hash node available: ${vccNodeAvailable}`);

    // 2단계: LoRA 목록 및 해시 조회
    let filenames = [];
    let hashMap = {};
    let lorasFromNode = [];

    if (vccNodeAvailable) {
      // VCC 노드가 있으면 해시 포함된 목록 조회
      if (progressCallback) progressCallback('fetching_hashes', 0, 0);

      const hashResult = await getLoraHashesFromVccNode(serverUrl);
      hashMap = hashResult.hashMap;
      lorasFromNode = hashResult.loras;
      filenames = lorasFromNode.map(l => l.filename);

      console.log(`Got ${filenames.length} LoRA files with hashes from VCC node`);
    } else {
      // VCC 노드가 없으면 기본 API로 파일명만 조회
      if (progressCallback) progressCallback('fetching_list', 0, 0);

      filenames = await getLoraFilenames(serverUrl);
      console.log(`Got ${filenames.length} LoRA files from basic API (no hashes)`);
    }

    if (filenames.length === 0) {
      cache.loraModels = [];
      await cache.completeSync();
      return cache;
    }

    // 기존 모델 매핑 (이미 가져온 메타데이터 재사용)
    const existingModels = {};
    for (const model of cache.loraModels) {
      existingModels[model.filename] = model;
    }

    // 3단계: Civitai 메타데이터 조회
    if (progressCallback) progressCallback('fetching_civitai', 0, filenames.length);
    await cache.updateProgress(0, filenames.length, 'fetching_civitai');

    const newLoraModels = [];
    let civitaiCount = 0;

    for (let i = 0; i < filenames.length; i++) {
      const filename = filenames[i];
      const loraFromNode = lorasFromNode.find(l => l.filename === filename);
      const hash = loraFromNode?.hash || hashMap[filename] || null;

      if (progressCallback) {
        progressCallback('fetching_civitai', i + 1, filenames.length);
      }
      await cache.updateProgress(i + 1, filenames.length, 'fetching_civitai');

      // 기존 모델 데이터 확인 (해시가 같으면 재사용)
      const existing = existingModels[filename];
      if (existing && existing.hash === hash && existing.civitai?.fetchedAt) {
        newLoraModels.push(existing);
        if (existing.civitai?.found) civitaiCount++;
        continue;
      }

      // 새 모델 데이터 구성
      const loraModel = {
        filename,
        relativePath: loraFromNode?.relativePath || filename,
        hash,
        hashError: hash ? null : (vccNodeAvailable ? 'Hash calculation failed' : 'VCC LoRA Hash node not installed'),
        civitai: { found: false }
      };

      // Civitai 메타데이터 조회 (해시가 있을 경우)
      if (hash) {
        const civitaiData = await getCivitaiMetadataByHash(hash);
        loraModel.civitai = civitaiData;

        if (civitaiData.found) {
          civitaiCount++;
        }

        // Rate limiting
        await delay(CIVITAI_RATE_LIMIT_MS);
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
      // VCC 노드 확인
      const vccNodeAvailable = await checkVccLoraHashNodeAvailable(serverUrl);

      let loraModels = [];

      if (vccNodeAvailable) {
        const hashResult = await getLoraHashesFromVccNode(serverUrl);
        loraModels = hashResult.loras.map(l => ({
          filename: l.filename,
          relativePath: l.relativePath,
          hash: l.hash,
          civitai: { found: false }
        }));
      } else {
        const filenames = await getLoraFilenames(serverUrl);
        loraModels = filenames.map(filename => ({
          filename,
          hash: null,
          civitai: { found: false }
        }));
      }

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
  getLoraHashesFromVccNode,
  getCivitaiMetadataByHash,
  syncServerLoras,
  getServerLoras,
  getSyncStatus,
  searchServerLoras
};
