const express = require('express');
const router = express.Router();
const Server = require('../models/Server');
const ServerLoraCache = require('../models/ServerLoraCache');
const ServerModelCache = require('../models/ServerModelCache');
const Workboard = require('../models/Workboard');
const { verifyJWT, requireAdmin, userHasWorkboardAccess } = require('../middleware/auth');
const loraMetadataService = require('../services/loraMetadataService');
const modelMetadataService = require('../services/modelMetadataService');
const comfyUIService = require('../services/comfyUIService');

// 서버 목록 조회 (일반 사용자도 접근 가능)
router.get('/', verifyJWT, async (req, res) => {
  try {
    const { serverType, includeInactive = false } = req.query;

    let filter = {};

    if (serverType) {
      filter.serverType = serverType;
    }

    if (!includeInactive || includeInactive === 'false') {
      filter.isActive = true;
    }
    
    const servers = await Server.find(filter)
      .populate('createdBy', 'email nickname')
      .select('-configuration.apiKey') // API 키는 보안상 제외
      .sort({ name: 1 });
    
    res.json({
      success: true,
      data: { servers }
    });
  } catch (error) {
    console.error('서버 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 목록을 불러오는데 실패했습니다.'
    });
  }
});

// 서버 상세 조회 (관리자만)
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id)
      .populate('createdBy', 'email nickname');
    
    if (!server) {
      return res.status(404).json({
        success: false,
        message: '서버를 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data: { server }
    });
  } catch (error) {
    console.error('서버 상세 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 정보를 불러오는데 실패했습니다.'
    });
  }
});

// 서버 생성 (관리자만)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      serverType,
      serverUrl,
      configuration = {}
    } = req.body;

    // 필수 필드 검증
    if (!name || !serverType || !serverUrl) {
      return res.status(400).json({
        success: false,
        message: '필수 필드가 누락되었습니다.'
      });
    }

    // 서버 타입 검증 ('GPT Image' 는 deprecated — 신규 생성 차단)
    if (!['ComfyUI', 'OpenAI', 'OpenAI Compatible', 'Gemini'].includes(serverType)) {
      return res.status(400).json({
        success: false,
        message: '지원하지 않는 서버 타입입니다.'
      });
    }

    // 중복 이름 검증
    const existingServer = await Server.findOne({ name });
    if (existingServer) {
      return res.status(400).json({
        success: false,
        message: '같은 이름의 서버가 이미 존재합니다.'
      });
    }

    const server = new Server({
      name,
      description,
      serverType,
      serverUrl,
      configuration,
      createdBy: req.user.id
    });
    
    await server.save();
    
    // 생성 후 헬스체크 수행
    try {
      await server.checkHealth();
    } catch (error) {
      console.warn('서버 생성 후 헬스체크 실패:', error.message);
    }
    
    await server.populate('createdBy', 'email nickname');
    
    res.status(201).json({
      success: true,
      data: { server },
      message: '서버가 성공적으로 생성되었습니다.'
    });
  } catch (error) {
    console.error('서버 생성 오류:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: '입력 데이터가 올바르지 않습니다.',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: '서버 생성에 실패했습니다.'
    });
  }
});

// 서버 수정 (관리자만)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      serverType,
      serverUrl,
      configuration,
      isActive
    } = req.body;
    
    const server = await Server.findById(req.params.id);
    
    if (!server) {
      return res.status(404).json({
        success: false,
        message: '서버를 찾을 수 없습니다.'
      });
    }
    
    // 이름 중복 검증 (자기 자신 제외)
    if (name && name !== server.name) {
      const existingServer = await Server.findOne({ 
        name, 
        _id: { $ne: req.params.id } 
      });
      if (existingServer) {
        return res.status(400).json({
          success: false,
          message: '같은 이름의 서버가 이미 존재합니다.'
        });
      }
    }
    
    // 업데이트할 필드들
    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (serverType !== undefined) updateFields.serverType = serverType;
    if (serverUrl !== undefined) updateFields.serverUrl = serverUrl;
    if (configuration !== undefined) {
      // API 키가 비어있으면 기존 값을 유지
      if (!configuration.apiKey && server.configuration?.apiKey) {
        configuration.apiKey = server.configuration.apiKey;
      }
      updateFields.configuration = configuration;
    }
    if (isActive !== undefined) updateFields.isActive = isActive;
    
    Object.assign(server, updateFields);
    await server.save();
    
    // 주요 설정이 변경되었으면 헬스체크 수행
    if (serverUrl !== undefined || configuration !== undefined) {
      try {
        await server.checkHealth();
      } catch (error) {
        console.warn('서버 수정 후 헬스체크 실패:', error.message);
      }
    }
    
    await server.populate('createdBy', 'email nickname');
    
    res.json({
      success: true,
      data: { server },
      message: '서버가 성공적으로 수정되었습니다.'
    });
  } catch (error) {
    console.error('서버 수정 오류:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: '입력 데이터가 올바르지 않습니다.',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: '서버 수정에 실패했습니다.'
    });
  }
});

// 서버 헬스체크 (관리자만)
router.post('/:id/health-check', requireAdmin, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    
    if (!server) {
      return res.status(404).json({
        success: false,
        message: '서버를 찾을 수 없습니다.'
      });
    }
    
    await server.checkHealth();
    
    res.json({
      success: true,
      data: { 
        healthCheck: server.healthCheck 
      },
      message: '헬스체크가 완료되었습니다.'
    });
  } catch (error) {
    console.error('서버 헬스체크 오류:', error);
    res.status(500).json({
      success: false,
      message: '헬스체크에 실패했습니다.'
    });
  }
});

// 모든 서버 헬스체크 (관리자만)
router.post('/health-check/all', requireAdmin, async (req, res) => {
  try {
    const servers = await Server.find({ isActive: true });

    const results = await Promise.allSettled(
      servers.map(server => server.checkHealth())
    );

    const successCount = results.filter(result => result.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    res.json({
      success: true,
      data: {
        total: servers.length,
        success: successCount,
        failed: failureCount
      },
      message: `${servers.length}개 서버의 헬스체크가 완료되었습니다.`
    });
  } catch (error) {
    console.error('전체 서버 헬스체크 오류:', error);
    res.status(500).json({
      success: false,
      message: '헬스체크에 실패했습니다.'
    });
  }
});

// ===== LoRA 메타데이터 API =====

// Checkpoint 모델 목록 조회
// ComfyUI checkpoint 목록 조회 — frontend 의 ModelListModal / ModelPickerGrid 가 사용.
// Phase D 부터 신규 ServerModelCache (#200) 를 storage 로 사용.
// - 기본 응답 shape (`checkpointModels: string[]`) 은 backward-compat 유지 — frontend ModelListModal 호환
// - `?detailed=true` 파라미터: LoRA 와 동일 패턴의 rich 데이터 (search/pagination/baseModel 필터) 반환 — Phase E 의 ModelPickerGrid 가 사용
// - SaaS provider (OpenAI / Gemini) 의 모델 목록도 detailed 모드에서 동일 응답 구조로 노출 (hash 무관, provider subdoc 사용)
router.get('/:id/models', verifyJWT, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);

    if (!server) {
      return res.status(404).json({
        success: false,
        message: '서버를 찾을 수 없습니다.'
      });
    }

    const detailed = req.query.detailed === 'true';

    // detailed 모드: 4종 serverType 모두 동일 응답 구조로 처리 (LoRA `/loras` 와 동일 패턴)
    if (detailed) {
      const SUPPORTED = ['ComfyUI', 'OpenAI', 'OpenAI Compatible', 'Gemini'];
      if (!SUPPORTED.includes(server.serverType)) {
        return res.status(400).json({
          success: false,
          message: `상세 모델 목록은 ${SUPPORTED.join(' / ')} 서버에서만 조회할 수 있습니다.`
        });
      }

      const { search, hasMetadata, baseModel, workboardId, page = 1, limit = 50 } = req.query;
      // allowedBaseModels: query string 으로 array 또는 single 둘 다 받기.
      let allowedBaseModels = req.query.allowedBaseModels;
      if (typeof allowedBaseModels === 'string') {
        allowedBaseModels = [allowedBaseModels];
      } else if (!Array.isArray(allowedBaseModels)) {
        allowedBaseModels = undefined;
      }

      // 작업판 컨텍스트의 모델 노출 정책 적용 (#198 Phase D)
      let whitelist = undefined;
      if (workboardId) {
        const wb = await Workboard.findById(workboardId);
        if (!wb) {
          return res.status(404).json({ success: false, message: '작업판을 찾을 수 없습니다.' });
        }
        if (!userHasWorkboardAccess(req.user, wb)) {
          return res.status(403).json({ success: false, message: '이 작업판에 접근할 권한이 없습니다.' });
        }
        if (wb.modelExposurePolicy === 'whitelist') {
          whitelist = wb.modelWhitelist || [];
          // 빈 whitelist 면 정책상 0개 노출 — sentinel 로 빈 배열 대신 '__none__' 매칭 안 됨
          if (whitelist.length === 0) whitelist = ['__no_models_in_whitelist__'];
        }
      }

      const result = await modelMetadataService.searchServerModels(server._id, {
        search,
        hasMetadata: hasMetadata === 'true' ? true : hasMetadata === 'false' ? false : undefined,
        baseModel,
        allowedBaseModels,
        whitelist,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return res.json({
        success: true,
        data: result
      });
    }

    // 기본 모드 (backward-compat): ComfyUI 만, filename 배열만 반환
    if (server.serverType !== 'ComfyUI') {
      return res.status(400).json({
        success: false,
        message: '모델 목록은 ComfyUI 서버에서만 조회할 수 있습니다.'
      });
    }

    const forceRefresh = req.query.refresh === 'true';
    let cache = await ServerModelCache.findOne({ serverId: server._id });

    // 캐시가 없거나 forceRefresh 면 ComfyUI 에서 lightweight (filename only) 재조회.
    // 메타데이터 (hash / Civitai) 는 별도 POST /models/sync 로만 채워짐.
    if (!cache || forceRefresh) {
      const filenames = await modelMetadataService.getCheckpointFilenames(server.serverUrl);
      const existingByFilename = {};
      if (cache) {
        for (const m of cache.models) existingByFilename[m.filename] = m;
      }
      const updatedModels = filenames.map(filename => existingByFilename[filename] || {
        filename,
        hash: null,
        hashError: null,
        civitai: { found: false }
      });

      cache = await ServerModelCache.findOneAndUpdate(
        { serverId: server._id },
        {
          serverId: server._id,
          serverUrl: server.serverUrl,
          models: updatedModels,
          lastFetched: new Date()
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    res.json({
      success: true,
      data: {
        checkpointModels: cache.models.map(m => m.filename),
        lastFetched: cache.lastFetched,
        fromCache: !forceRefresh
      }
    });
  } catch (error) {
    console.error('모델 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '모델 목록을 불러오는데 실패했습니다.',
      error: error.message
    });
  }
});

// LoRA 목록 조회 (검색 지원)
router.get('/:id/loras', verifyJWT, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);

    if (!server) {
      return res.status(404).json({
        success: false,
        message: '서버를 찾을 수 없습니다.'
      });
    }

    // ComfyUI 서버만 지원
    if (server.serverType !== 'ComfyUI') {
      return res.status(400).json({
        success: false,
        message: 'LoRA 목록은 ComfyUI 서버에서만 조회할 수 있습니다.'
      });
    }

    const { search, hasMetadata, baseModel, workboardId, page = 1, limit = 50 } = req.query;

    // 작업판 컨텍스트의 LoRA 노출 정책 적용 (#198 Phase D)
    let whitelist = undefined;
    if (workboardId) {
      const wb = await Workboard.findById(workboardId);
      if (!wb) {
        return res.status(404).json({ success: false, message: '작업판을 찾을 수 없습니다.' });
      }
      if (!userHasWorkboardAccess(req.user, wb)) {
        return res.status(403).json({ success: false, message: '이 작업판에 접근할 권한이 없습니다.' });
      }
      if (wb.loraExposurePolicy === 'whitelist') {
        whitelist = wb.loraWhitelist || [];
        if (whitelist.length === 0) whitelist = ['__no_loras_in_whitelist__'];
      }
    }

    const result = await loraMetadataService.searchServerLoras(server._id, {
      search,
      hasMetadata: hasMetadata === 'true' ? true : hasMetadata === 'false' ? false : undefined,
      baseModel,
      whitelist,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('LoRA 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: 'LoRA 목록을 불러오는데 실패했습니다.',
      error: error.message
    });
  }
});

// Model 동기화 (메타데이터 포함) - 관리자만.
// Phase B: ComfyUI checkpoint. Phase C: OpenAI / OpenAI Compatible / Gemini provider 모델.
// 신규 ServerModelCache 기반. 기존 GET /:id/models 는 구 ModelCache 사용 중 (Phase D 에서 마이그레이션 예정).
router.post('/:id/models/sync', requireAdmin, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    const { forceRefresh = false } = req.body;

    if (!server) {
      return res.status(404).json({
        success: false,
        message: '서버를 찾을 수 없습니다.'
      });
    }

    const SUPPORTED = ['ComfyUI', 'OpenAI', 'OpenAI Compatible', 'Gemini'];
    if (!SUPPORTED.includes(server.serverType)) {
      return res.status(400).json({
        success: false,
        message: `모델 동기화는 ${SUPPORTED.join(' / ')} 서버에서만 사용할 수 있습니다.`
      });
    }

    modelMetadataService.syncServerModels(server, { forceRefresh })
      .then(() => {
        console.log(`Model sync completed for server ${server.name} (${server.serverType})`);
      })
      .catch((err) => {
        console.error(`Model sync failed for server ${server.name}:`, err);
      });

    res.json({
      success: true,
      message: '모델 동기화가 시작되었습니다. 상태는 /models/status 에서 확인하세요.'
    });
  } catch (error) {
    console.error('모델 동기화 시작 오류:', error);
    res.status(500).json({
      success: false,
      message: '모델 동기화를 시작하는데 실패했습니다.',
      error: error.message
    });
  }
});

// Model 동기화 상태 조회
router.get('/:id/models/status', verifyJWT, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);

    if (!server) {
      return res.status(404).json({
        success: false,
        message: '서버를 찾을 수 없습니다.'
      });
    }

    const status = await modelMetadataService.getSyncStatus(server._id);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('모델 동기화 상태 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '동기화 상태를 조회하는데 실패했습니다.',
      error: error.message
    });
  }
});

// LoRA 동기화 (메타데이터 포함) - 관리자만
router.post('/:id/loras/sync', requireAdmin, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    const { forceRefresh = false } = req.body;

    if (!server) {
      return res.status(404).json({
        success: false,
        message: '서버를 찾을 수 없습니다.'
      });
    }

    // ComfyUI 서버만 지원
    if (server.serverType !== 'ComfyUI') {
      return res.status(400).json({
        success: false,
        message: 'LoRA 동기화는 ComfyUI 서버에서만 사용할 수 있습니다.'
      });
    }

    // 비동기로 동기화 시작 (응답은 즉시 반환)
    loraMetadataService.syncServerLoras(server._id, server.serverUrl, { forceRefresh })
      .then(() => {
        console.log(`LoRA sync completed for server ${server.name}`);
      })
      .catch((err) => {
        console.error(`LoRA sync failed for server ${server.name}:`, err);
      });

    res.json({
      success: true,
      message: 'LoRA 동기화가 시작되었습니다. 상태는 /loras/status에서 확인하세요.'
    });
  } catch (error) {
    console.error('LoRA 동기화 시작 오류:', error);
    res.status(500).json({
      success: false,
      message: 'LoRA 동기화를 시작하는데 실패했습니다.',
      error: error.message
    });
  }
});

// LoRA 동기화 상태 조회
router.get('/:id/loras/status', verifyJWT, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);

    if (!server) {
      return res.status(404).json({
        success: false,
        message: '서버를 찾을 수 없습니다.'
      });
    }

    const status = await loraMetadataService.getSyncStatus(server._id);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('LoRA 동기화 상태 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '동기화 상태를 조회하는데 실패했습니다.',
      error: error.message
    });
  }
});

// LoRA 동기화 상태 강제 reset (#256) — stuck/failed 상태에서 다시 sync 가능하게 만들기
router.post('/:id/loras/sync/reset', requireAdmin, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, message: '서버를 찾을 수 없습니다.' });
    }
    const cache = await loraMetadataService.resetSyncStatus(server._id);
    res.json({
      success: true,
      data: cache ? { status: cache.status } : { status: 'idle' },
      message: 'LoRA 동기화 상태가 초기화되었습니다.'
    });
  } catch (error) {
    console.error('LoRA 동기화 reset 오류:', error);
    res.status(500).json({ success: false, message: 'reset 실패', error: error.message });
  }
});

// 모델 동기화 상태 강제 reset (#256)
router.post('/:id/models/sync/reset', requireAdmin, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, message: '서버를 찾을 수 없습니다.' });
    }
    const cache = await modelMetadataService.resetSyncStatus(server._id);
    res.json({
      success: true,
      data: cache ? { status: cache.status } : { status: 'idle' },
      message: '모델 동기화 상태가 초기화되었습니다.'
    });
  } catch (error) {
    console.error('모델 동기화 reset 오류:', error);
    res.status(500).json({ success: false, message: 'reset 실패', error: error.message });
  }
});

// 서버 삭제 시 LoRA 캐시도 함께 삭제
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);

    if (!server) {
      return res.status(404).json({
        success: false,
        message: '서버를 찾을 수 없습니다.'
      });
    }

    // 서버를 사용하는 워크보드가 있는지 확인
    const Workboard = require('../models/Workboard');
    const workboardCount = await Workboard.countDocuments({ serverId: server._id });

    if (workboardCount > 0) {
      return res.status(400).json({
        success: false,
        message: `이 서버를 사용하는 워크보드가 ${workboardCount}개 있어 삭제할 수 없습니다.`
      });
    }

    // 캐시 정리
    await ServerLoraCache.deleteOne({ serverId: server._id });
    await ServerModelCache.deleteOne({ serverId: server._id });

    await Server.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: '서버가 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('서버 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 삭제에 실패했습니다.'
    });
  }
});

module.exports = router;
