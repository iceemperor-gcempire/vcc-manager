const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireAdmin, buildWorkboardAccessFilter, userHasWorkboardAccess } = require('../middleware/auth');
const Workboard = require('../models/Workboard');
const Server = require('../models/Server');
const Group = require('../models/Group');
const ServerLoraCache = require('../models/ServerLoraCache');
const loraMetadataService = require('../services/loraMetadataService');
const comfyUIService = require('../services/comfyUIService');
const workflowConverter = require('../services/workflowConverterService');
const openAIChatService = require('../services/openAIChatService');
const geminiService = require('../services/geminiService');
const { decryptSecret } = require('../utils/secretCrypto');
const { escapeRegex } = require('../utils/escapeRegex');
const router = express.Router();

const EXPORT_VERSION = 1;
const APP_VERSION = { major: 1, minor: 3 };

// 옛 환경에서 export 한 작업판 백업의 server.serverType 을 신규 enum 으로 폴백 매핑.
// Phase 2 (#181, #182) 마이그레이션과 동일 매핑. import 자동 매칭 1차 실패 시 시도.
const SERVER_TYPE_LEGACY_FALLBACK = {
  'GPT Image': 'OpenAI',
};

router.get('/', requireAuth, async (req, res) => {
  try {
    const { search = '', workboardType, serverType, outputFormat, includeAll, includeInactive } = req.query;

    const parsedPage = Number.parseInt(req.query.page, 10);
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 10;
    const skip = (page - 1) * limit;

    const filter = {};

    // 비활성 작업판 포함 여부 (관리자용)
    if (includeInactive !== 'true') {
      filter.isActive = true;
    }

    // 접근 권한 필터 (#198) — admin 은 모든 작업판, 일반 사용자는 자기 그룹 작업판만
    Object.assign(filter, buildWorkboardAccessFilter(req.user));

    if (outputFormat) filter.outputFormat = outputFormat;

    // serverType 필터: 매칭 서버 ID 들 사전 조회 후 serverId $in 으로 필터링
    if (serverType) {
      const matchingServers = await Server.find({ serverType }).select('_id');
      filter.serverId = { $in: matchingServers.map((s) => s._id) };
    }

    if (!serverType && !outputFormat) {
      if (includeAll === 'true') {
        // 관리자용: 모든 타입 조회
      } else if (workboardType) {
        // 하위호환: 기존 workboardType 파라미터 지원
        filter.workboardType = workboardType;
      }
    }
    if (search) {
      filter.$or = [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { description: { $regex: escapeRegex(search), $options: 'i' } }
      ];
    }
    
    const workboards = await Workboard.find(filter)
      .populate('createdBy', 'nickname email')
      .populate('serverId', 'name serverType serverUrl isActive')
      .populate('allowedGroupIds', 'name')
      .select('-workflowData')
      .sort({ usageCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Workboard.countDocuments(filter);
    const pages = Math.ceil(total / limit);
    
    res.json({
      workboards,
      pagination: {
        total,
        pages,
        page,
        limit,
        current: page
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ComfyUI 워크플로 분석 (관리자 전용) — 파싱 + 필요/빠진 커스텀 노드 감지 (#607)
router.post('/analyze-workflow', requireAdmin, async (req, res) => {
  try {
    const { workflow, serverId } = req.body;
    if (!workflow) {
      return res.status(400).json({ success: false, message: '워크플로 JSON 이 필요합니다.' });
    }

    // 1) 파싱 (서버 없이도 가능). 포맷/파싱 오류는 400.
    let parsed;
    try {
      parsed = workflowConverter.parseWorkflow(workflow);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    // 2) serverId 가 있으면 /object_info 로 빠진 노드 비교 (선택, 실패해도 분석은 반환)
    let objectInfo = null;
    let serverWarning = null;
    if (serverId) {
      const server = await Server.findById(serverId);
      if (!server) {
        return res.status(404).json({ success: false, message: '서버를 찾을 수 없습니다.' });
      }
      try {
        objectInfo = await comfyUIService.getObjectInfo(server.serverUrl);
      } catch (e) {
        serverWarning = `서버 노드 목록을 불러오지 못해 빠진 노드 검사를 건너뜁니다: ${e.message}`;
      }
    }

    const nodeAnalysis = workflowConverter.analyzeNodes(parsed, objectInfo);
    res.json({
      success: true,
      data: {
        format: parsed.format,
        nodeCount: parsed.nodes.length,
        literalInputCount: parsed.literalInputs.length,
        ...nodeAnalysis,
        literalInputs: parsed.literalInputs,
        serverWarning,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ComfyUI 워크플로 → 작업판 초안 생성 (관리자 전용) — 결정론적 역할 매핑 (#608)
router.post('/draft-from-workflow', requireAdmin, async (req, res) => {
  try {
    const { workflow, serverId, llmServerId, llmModel } = req.body;
    if (!workflow) {
      return res.status(400).json({ success: false, message: '워크플로 JSON 이 필요합니다.' });
    }

    let parsed;
    try {
      parsed = workflowConverter.parseWorkflow(workflow);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    // 빠진 노드 검사 (서버 연결 시, 선택)
    let objectInfo = null;
    let serverWarning = null;
    if (serverId) {
      const server = await Server.findById(serverId);
      if (server) {
        try {
          objectInfo = await comfyUIService.getObjectInfo(server.serverUrl);
        } catch (e) {
          serverWarning = `서버 노드 목록을 불러오지 못해 빠진 노드 검사를 건너뜁니다: ${e.message}`;
        }
      }
    }

    const nodeAnalysis = workflowConverter.analyzeNodes(parsed, objectInfo);

    // 변수 picks: 결정론적 + (선택) LLM 보조 (#P1)
    const detPicks = workflowConverter.collectDeterministicPicks(parsed);
    let allPicks = detPicks;
    let llmNote = null;
    if (llmServerId && llmModel) {
      const llmServer = await Server.findById(llmServerId);
      if (llmServer) {
        const svc = llmServer.serverType === 'Gemini' ? geminiService : openAIChatService;
        const apiKey = decryptSecret(llmServer.configuration?.apiKey);
        const llmComplete = async (messages) => {
          const { content } = await svc.complete(llmServer.serverUrl, apiKey, messages, { model: llmModel, temperature: 0.2 });
          return content;
        };
        try {
          const llmPicks = await workflowConverter.proposeLlmPicks({ parsed, existingPicks: detPicks, llmComplete });
          allPicks = [...detPicks, ...llmPicks];
          if (llmPicks.length) llmNote = `AI 보조로 변수 ${llmPicks.length}개를 추가 제안했습니다 (편집기에서 확인하세요).`;
        } catch (e) {
          llmNote = `AI 보조에 실패해 기본(결정론적) 추출만 적용했습니다: ${e.message}`;
        }
      }
    } else if (llmServerId && !llmModel) {
      llmNote = 'AI 보조를 쓰려면 LLM 모델도 지정해야 합니다 — 기본 추출만 적용했습니다.';
    }

    const draft = workflowConverter.buildDraftFromPicks(parsed, workflow, allPicks);
    if (llmNote) draft.notes = [llmNote, ...draft.notes];

    res.json({
      success: true,
      data: {
        // 작업판 편집기로 바로 넘길 수 있는 초안
        draft: {
          workflowData: draft.workflowData,
          additionalInputFields: draft.additionalInputFields,
        },
        notes: draft.notes,
        analysis: {
          requiredNodes: nodeAnalysis.requiredNodes,
          missingNodes: nodeAnalysis.missingNodes,
        },
        serverWarning,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 빠진 커스텀 노드 → repo 해석 / 설치 안내 (관리자 전용) (#614)
router.post('/resolve-nodes', requireAdmin, async (req, res) => {
  try {
    const { serverId, nodes } = req.body;
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return res.status(400).json({ success: false, message: '해석할 노드 목록(nodes)이 필요합니다.' });
    }
    if (!serverId) {
      return res.status(400).json({ success: false, message: 'serverId 가 필요합니다 (ComfyUI-Manager 매핑 조회용).' });
    }
    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ success: false, message: '서버를 찾을 수 없습니다.' });
    }

    const raw = await comfyUIService.fetchNodeRepoMap(server.serverUrl);
    const managerAvailable = !!raw;
    const nodeRepoMap = workflowConverter.normalizeManagerMap(raw);
    const { resolutions, unresolved } = workflowConverter.resolveMissingNodes(nodes, nodeRepoMap);

    res.json({
      success: true,
      data: {
        managerAvailable,
        resolutions,
        unresolved,
        ...(managerAvailable ? {} : { note: '대상 서버에서 ComfyUI-Manager 매핑을 조회하지 못했습니다. 노드 이름으로 직접 검색해 설치해야 할 수 있습니다.' }),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 작업판 가져오기 (관리자 전용)
router.post('/import', requireAdmin, async (req, res) => {
  try {
    const { data, serverId: overrideServerId } = req.body;

    if (!data || !data._exportVersion) {
      return res.status(400).json({ message: '올바른 작업판 백업 파일이 아닙니다.' });
    }

    if (data._exportVersion !== EXPORT_VERSION) {
      return res.status(400).json({ message: `지원하지 않는 내보내기 버전입니다. (v${data._exportVersion})` });
    }

    const warnings = [];

    // 앱 버전 호환성 경고
    if (data.appVersion && data.appVersion.major !== APP_VERSION.major) {
      warnings.push(`앱 메이저 버전이 다릅니다 (백업: v${data.appVersion.major}.${data.appVersion.minor}, 현재: v${APP_VERSION.major}.${APP_VERSION.minor}). 호환되지 않을 수 있습니다.`);
    }

    // 서버 매칭
    let matchedServerId = null;
    let serverMatchInfo = null;

    if (overrideServerId) {
      // 사용자가 직접 서버를 선택한 경우
      const server = await Server.findById(overrideServerId);
      if (!server) {
        return res.status(400).json({ message: '선택한 서버를 찾을 수 없습니다.' });
      }
      matchedServerId = server._id;
      serverMatchInfo = { name: server.name, matched: true, manual: true };
    } else if (data.server) {
      // 자동 매칭 시도
      let server = await Server.findOne({
        name: data.server.name,
        serverType: data.server.serverType
      });
      // Phase 2 마이그레이션으로 deprecated 된 serverType 의 자동 폴백 (옛 환경 export 호환)
      if (!server && SERVER_TYPE_LEGACY_FALLBACK[data.server.serverType]) {
        server = await Server.findOne({
          name: data.server.name,
          serverType: SERVER_TYPE_LEGACY_FALLBACK[data.server.serverType]
        });
      }
      if (server) {
        matchedServerId = server._id;
        serverMatchInfo = { name: server.name, matched: true, manual: false };
      } else {
        // 매칭 실패 - 서버 목록과 함께 반환
        const servers = await Server.find({ isActive: true }).select('name serverType');
        return res.json({
          needsServer: true,
          preview: {
            name: data.workboard?.name,
            description: data.workboard?.description,
            outputFormat: data.workboard?.outputFormat,
            server: data.server
          },
          servers,
          warnings
        });
      }
    } else {
      // 서버 정보가 없는 경우
      const servers = await Server.find({ isActive: true }).select('name serverType');
      return res.json({
        needsServer: true,
        preview: {
          name: data.workboard?.name,
          description: data.workboard?.description,
          outputFormat: data.workboard?.outputFormat,
          server: null
        },
        servers,
        warnings
      });
    }

    // 새 Workboard 생성
    const wb = data.workboard;
    const server = await Server.findById(matchedServerId);

    // import 시 allowedGroupIds 는 기본 그룹으로 자동 할당 (export 에는 미포함, ObjectId 매칭 불가)
    const defaultGroupForImport = await Group.findDefault();

    const newWorkboard = new Workboard({
      name: wb.name,
      description: wb.description,
      workboardType: wb.workboardType,
      outputFormat: wb.outputFormat || 'image',
      serverId: matchedServerId,
      serverUrl: server.serverUrl,
      baseInputFields: wb.baseInputFields,
      additionalInputFields: wb.additionalInputFields || [],
      workflowData: wb.workflowData || '',
      allowedModelTypes: wb.allowedModelTypes || [],
      allowedGroupIds: defaultGroupForImport ? [defaultGroupForImport._id] : [],
      modelExposurePolicy: wb.modelExposurePolicy === 'whitelist' ? 'whitelist' : 'full',
      modelWhitelist: Array.isArray(wb.modelWhitelist) ? wb.modelWhitelist : [],
      loraExposurePolicy: wb.loraExposurePolicy === 'whitelist' ? 'whitelist' : 'full',
      loraWhitelist: Array.isArray(wb.loraWhitelist) ? wb.loraWhitelist : [],
      createdBy: req.user._id,
      version: 1,
      usageCount: 0,
      isActive: true,
      tags: []
    });

    await newWorkboard.save();
    await newWorkboard.populate('createdBy', 'nickname email');
    await newWorkboard.populate('serverId', 'name serverType serverUrl isActive');

    res.status(201).json({
      message: '작업판을 가져왔습니다.',
      workboard: newWorkboard,
      serverMatch: serverMatchInfo,
      warnings
    });
  } catch (error) {
    console.error('Workboard import error:', error);
    res.status(400).json({ message: error.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const workboard = await Workboard.findById(req.params.id)
      .populate('createdBy', 'nickname email')
      .populate('serverId', 'name serverType serverUrl isActive');
    
    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }

    if (!workboard.isActive) {
      return res.status(403).json({ message: 'Workboard is not active' });
    }

    // 권한 검사 (#198) — admin 은 implicit all-access
    if (!userHasWorkboardAccess(req.user, workboard)) {
      return res.status(403).json({ message: '이 작업판에 접근할 권한이 없습니다.' });
    }

    res.json({ workboard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 관리자 전용 개별 조회 (workflowData 포함, 비활성 workboard도 조회 가능)
router.get('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const workboard = await Workboard.findById(req.params.id)
      .populate('createdBy', 'nickname email')
      .populate('serverId', 'name serverType serverUrl isActive');
    
    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }
    
    console.log('Admin fetching workboard:', {
      id: workboard._id,
      name: workboard.name,
      hasWorkflowData: !!workboard.workflowData,
      workflowDataLength: workboard.workflowData ? workboard.workflowData.length : 0
    });
    
    res.json({ workboard });
  } catch (error) {
    console.error('Error fetching workboard for admin:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      serverId,
      serverUrl,
      workboardType,
      outputFormat,
      baseInputFields,
      additionalInputFields,
      workflowData,
      allowedModelTypes,
      allowedGroupIds,
      modelExposurePolicy,
      modelWhitelist,
      loraExposurePolicy,
      loraWhitelist,
      llmExtraParams
    } = req.body;

    const resolvedOutputFormat = outputFormat || (workboardType === 'prompt' ? 'text' : 'image');
    const resolvedWorkboardType = workboardType || (resolvedOutputFormat === 'text' ? 'prompt' : 'image');

    // serverId가 제공되지 않았지만 serverUrl이 있는 경우 (기존 호환성)
    let finalServerId = serverId;
    if (!serverId && serverUrl) {
      // 기존 serverUrl 방식 지원 (deprecated)
      console.warn('Warning: Using deprecated serverUrl. Please use serverId instead.');
    }

    // serverId 필수 검증
    if (!finalServerId) {
      return res.status(400).json({
        message: 'serverId is required. Please select a server.'
      });
    }

    // 서버 존재 확인
    const server = await Server.findById(finalServerId);
    if (!server) {
      return res.status(400).json({
        message: 'Selected server not found.'
      });
    }

    if (!server.isActive) {
      return res.status(400).json({
        message: 'Selected server is not active.'
      });
    }

    const isComfyUI = server.serverType === 'ComfyUI';

    // 작업판 생성 시 allowedGroupIds 가 명시되지 않으면 기본 그룹 자동 할당 (#198)
    let resolvedAllowedGroupIds = Array.isArray(allowedGroupIds) ? allowedGroupIds : null;
    if (!resolvedAllowedGroupIds) {
      const defaultGroup = await Group.findDefault();
      resolvedAllowedGroupIds = defaultGroup ? [defaultGroup._id] : [];
    }

    const workboard = new Workboard({
      name: name.trim(),
      description: description?.trim(),
      serverId: finalServerId,
      serverUrl: server.serverUrl,
      workboardType: resolvedWorkboardType,
      outputFormat: resolvedOutputFormat,
      baseInputFields,
      additionalInputFields: additionalInputFields || [],
      workflowData: isComfyUI ? workflowData : '',
      allowedModelTypes: isComfyUI ? (allowedModelTypes || []) : [],
      allowedGroupIds: resolvedAllowedGroupIds,
      modelExposurePolicy: modelExposurePolicy === 'whitelist' ? 'whitelist' : 'full',
      modelWhitelist: Array.isArray(modelWhitelist) ? modelWhitelist : [],
      loraExposurePolicy: isComfyUI && loraExposurePolicy === 'whitelist' ? 'whitelist' : 'full',
      loraWhitelist: isComfyUI && Array.isArray(loraWhitelist) ? loraWhitelist : [],
      llmExtraParams: (llmExtraParams && Object.keys(llmExtraParams).length > 0) ? llmExtraParams : undefined,
      createdBy: req.user._id
    });

    if (isComfyUI && !workboard.validateWorkflowData()) {
      return res.status(400).json({ message: 'Invalid workflow data format' });
    }
    
    await workboard.save();
    await workboard.populate('createdBy', 'nickname email');
    await workboard.populate('serverId', 'name serverType serverUrl isActive');
    
    res.status(201).json({
      message: 'Workboard created successfully',
      workboard
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      serverId,
      serverUrl,
      workboardType,
      outputFormat,
      baseInputFields,
      additionalInputFields,
      workflowData,
      allowedModelTypes,
      allowedGroupIds,
      modelExposurePolicy,
      modelWhitelist,
      loraExposurePolicy,
      loraWhitelist,
      llmExtraParams,
      isActive
    } = req.body;

    console.log('Workboard update request:', {
      id: req.params.id,
      additionalInputFields,
      baseInputFields
    });
    
    const workboard = await Workboard.findById(req.params.id);
    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }
    
    if (name) workboard.name = name.trim();
    if (description !== undefined) workboard.description = description?.trim();
    
    // 서버 변경 처리
    if (serverId) {
      const server = await Server.findById(serverId);
      if (!server) {
        return res.status(400).json({ 
          message: 'Selected server not found.' 
        });
      }
      if (!server.isActive) {
        return res.status(400).json({ 
          message: 'Selected server is not active.' 
        });
      }
      workboard.serverId = serverId;
      workboard.serverUrl = server.serverUrl; // 서버에서 실제 URL 가져오기
    } else if (serverUrl) {
      // 기존 호환성 지원 (deprecated)
      console.warn('Warning: Using deprecated serverUrl. Please use serverId instead.');
      workboard.serverUrl = serverUrl.trim();
    }
    if (outputFormat) {
      workboard.outputFormat = outputFormat;
    }
    // workboardType 동기화: outputFormat=text → 'prompt', 그 외 → 'image' (deprecated 호환)
    if (workboardType) {
      workboard.workboardType = workboardType;
    } else if (outputFormat) {
      workboard.workboardType = outputFormat === 'text' ? 'prompt' : 'image';
    }
    if (baseInputFields) workboard.baseInputFields = baseInputFields;
    if (additionalInputFields !== undefined) workboard.additionalInputFields = additionalInputFields;
    if (workflowData !== undefined) {
      const wbServer = await Server.findById(workboard.serverId);
      const isComfyUI = wbServer?.serverType === 'ComfyUI';
      workboard.workflowData = isComfyUI ? workflowData : '';
      if (isComfyUI && workflowData && !workboard.validateWorkflowData()) {
        return res.status(400).json({ message: 'Invalid workflow data format' });
      }
      workboard.version += 1;
    }
    if (allowedModelTypes !== undefined) {
      // ComfyUI 작업판만 의미 있음 — 다른 serverType 은 빈 배열 강제
      const wbServer = await Server.findById(workboard.serverId);
      workboard.allowedModelTypes = wbServer?.serverType === 'ComfyUI' ? (allowedModelTypes || []) : [];
    }
    // 권한 / 노출 정책 (#198)
    if (Array.isArray(allowedGroupIds)) {
      workboard.allowedGroupIds = allowedGroupIds;
    }
    if (modelExposurePolicy === 'full' || modelExposurePolicy === 'whitelist') {
      workboard.modelExposurePolicy = modelExposurePolicy;
    }
    if (Array.isArray(modelWhitelist)) {
      workboard.modelWhitelist = modelWhitelist;
    }
    if (loraExposurePolicy === 'full' || loraExposurePolicy === 'whitelist') {
      // LoRA 정책은 ComfyUI 만 의미 있음
      const wbServer = await Server.findById(workboard.serverId);
      workboard.loraExposurePolicy = wbServer?.serverType === 'ComfyUI' ? loraExposurePolicy : 'full';
    }
    if (Array.isArray(loraWhitelist)) {
      const wbServer = await Server.findById(workboard.serverId);
      workboard.loraWhitelist = wbServer?.serverType === 'ComfyUI' ? loraWhitelist : [];
    }
    if (isActive !== undefined) workboard.isActive = isActive;
    // LLM 추가 파라미터 (#493) — 빈 객체/null 이면 미설정 처리. Mixed 라 markModified 필요.
    if (llmExtraParams !== undefined) {
      workboard.llmExtraParams = (llmExtraParams && Object.keys(llmExtraParams).length > 0) ? llmExtraParams : undefined;
      workboard.markModified('llmExtraParams');
    }

    console.log('Before save:', workboard.toObject());
    await workboard.save();
    await workboard.populate('createdBy', 'nickname email');
    await workboard.populate('serverId', 'name serverType serverUrl isActive');
    
    res.json({
      message: 'Workboard updated successfully',
      workboard
    });
  } catch (error) {
    console.error('Workboard update error:', error);
    res.status(400).json({ message: error.message });
  }
});

// 작업판 비활성화
router.patch('/:id/deactivate', requireAdmin, async (req, res) => {
  try {
    const workboard = await Workboard.findById(req.params.id);
    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }

    workboard.isActive = false;
    await workboard.save();

    res.json({ message: 'Workboard deactivated successfully', workboard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 작업판 활성화
router.patch('/:id/activate', requireAdmin, async (req, res) => {
  try {
    const workboard = await Workboard.findById(req.params.id);
    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }

    workboard.isActive = true;
    await workboard.save();

    res.json({ message: 'Workboard activated successfully', workboard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 작업판 삭제 (완전 삭제)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const workboard = await Workboard.findById(req.params.id);
    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }

    const ImageGenerationJob = require('../models/ImageGenerationJob');
    const activeJobs = await ImageGenerationJob.countDocuments({
      workboardId: req.params.id,
      status: { $in: ['pending', 'processing'] }
    });

    if (activeJobs > 0) {
      return res.status(400).json({
        message: 'Cannot delete workboard with active jobs'
      });
    }

    // 관련 작업 히스토리 수 확인 (경고용)
    const totalJobs = await ImageGenerationJob.countDocuments({
      workboardId: req.params.id
    });

    await Workboard.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Workboard deleted permanently',
      deletedJobsWarning: totalJobs > 0 ? `${totalJobs} related jobs exist in history` : null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/duplicate', requireAdmin, async (req, res) => {
  try {
    const originalWorkboard = await Workboard.findById(req.params.id);
    if (!originalWorkboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }
    
    const { name } = req.body;
    
    const duplicatedWorkboard = new Workboard({
      name: name?.trim() || `${originalWorkboard.name} (Copy)`,
      description: originalWorkboard.description,
      serverId: originalWorkboard.serverId,
      serverUrl: originalWorkboard.serverUrl,
      workboardType: originalWorkboard.workboardType,
      outputFormat: originalWorkboard.outputFormat,
      baseInputFields: originalWorkboard.baseInputFields,
      additionalInputFields: originalWorkboard.additionalInputFields,
      workflowData: originalWorkboard.workflowData,
      allowedModelTypes: originalWorkboard.allowedModelTypes || [],
      allowedGroupIds: originalWorkboard.allowedGroupIds || [],
      modelExposurePolicy: originalWorkboard.modelExposurePolicy || 'full',
      modelWhitelist: originalWorkboard.modelWhitelist || [],
      loraExposurePolicy: originalWorkboard.loraExposurePolicy || 'full',
      loraWhitelist: originalWorkboard.loraWhitelist || [],
      llmExtraParams: originalWorkboard.llmExtraParams,
      createdBy: req.user._id
    });
    
    await duplicatedWorkboard.save();
    await duplicatedWorkboard.populate('createdBy', 'nickname email');
    
    res.status(201).json({
      message: 'Workboard duplicated successfully',
      workboard: duplicatedWorkboard
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 작업판 내보내기 (관리자 전용)
router.get('/:id/export', requireAdmin, async (req, res) => {
  try {
    const workboard = await Workboard.findById(req.params.id);
    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }

    // 서버 정보 조회
    let serverInfo = null;
    if (workboard.serverId) {
      const server = await Server.findById(workboard.serverId);
      if (server) {
        serverInfo = {
          name: server.name,
          serverType: server.serverType
        };
      }
    }

    const exportData = {
      _exportVersion: EXPORT_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      workboard: {
        name: workboard.name,
        description: workboard.description,
        workboardType: workboard.workboardType,
        outputFormat: workboard.outputFormat,
        baseInputFields: workboard.baseInputFields,
        additionalInputFields: workboard.additionalInputFields,
        workflowData: workboard.workflowData,
        allowedModelTypes: workboard.allowedModelTypes || [],
        // allowedGroupIds 는 export 에서 제외 — ObjectId 가 instance 간 매칭 안 됨.
        // import 시 기본 그룹 자동 할당으로 안전한 default 적용.
        modelExposurePolicy: workboard.modelExposurePolicy || 'full',
        modelWhitelist: workboard.modelWhitelist || [],
        loraExposurePolicy: workboard.loraExposurePolicy || 'full',
        loraWhitelist: workboard.loraWhitelist || [],
        version: workboard.version
      },
      server: serverInfo
    };

    const filename = `${workboard.name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}_backup.json`;
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(exportData);
  } catch (error) {
    console.error('Workboard export error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id/stats', requireAdmin, async (req, res) => {
  try {
    const ImageGenerationJob = require('../models/ImageGenerationJob');
    
    const [jobStats, recentJobs] = await Promise.all([
      ImageGenerationJob.aggregate([
        { $match: { workboardId: mongoose.Types.ObjectId(req.params.id) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      ImageGenerationJob.find({ workboardId: req.params.id })
        .populate('userId', 'nickname email')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);
    
    const stats = {
      jobs: {
        total: jobStats.reduce((sum, stat) => sum + stat.count, 0),
        pending: jobStats.find(s => s._id === 'pending')?.count || 0,
        processing: jobStats.find(s => s._id === 'processing')?.count || 0,
        completed: jobStats.find(s => s._id === 'completed')?.count || 0,
        failed: jobStats.find(s => s._id === 'failed')?.count || 0
      },
      recentJobs
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// LoRA 모델 목록 조회 (서버 단위 캐시 사용)
router.get('/:id/lora-models', requireAuth, async (req, res) => {
  try {
    const workboard = await Workboard.findById(req.params.id)
      .populate('serverId', 'name serverType serverUrl');

    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }

    if (!workboard.isActive) {
      return res.status(403).json({ message: 'Workboard is not active' });
    }

    // 그룹 접근 권한 검사 — LoRA 직접 목록 제거 후, 사용자는 권한 있는 작업판의 LoRA 만 조회 가능 (admin 은 bypass)
    if (!userHasWorkboardAccess(req.user, workboard)) {
      return res.status(403).json({ message: '이 작업판에 접근할 권한이 없습니다.' });
    }

    // 서버 정보 확인
    if (!workboard.serverId) {
      return res.status(400).json({ message: 'Workboard has no server configured' });
    }

    const server = workboard.serverId;

    // ComfyUI 서버만 LoRA 지원
    if (server.serverType !== 'ComfyUI') {
      return res.json({
        loraModels: [],
        message: 'LoRA is only supported on ComfyUI servers'
      });
    }

    const { search, page = 1, limit = 50 } = req.query;

    // 작업판의 LoRA 노출 정책 / 화이트리스트 적용 (#198 Phase D — 이 경로에 누락돼 있던 것 보강)
    let whitelist;
    if (workboard.loraExposurePolicy === 'whitelist') {
      whitelist = workboard.loraWhitelist || [];
      if (whitelist.length === 0) whitelist = ['__no_loras_in_whitelist__'];
    }

    // 서버 단위 캐시에서 조회 (노출정책 화이트리스트 필터 적용)
    const result = await loraMetadataService.searchServerLoras(server._id, {
      search,
      whitelist,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    // 기존 API 응답 형식과 호환성 유지
    res.json({
      loraModels: result.loraModels,
      pagination: result.pagination,
      lastFetched: result.cacheInfo?.lastFetched,
      lastCivitaiSync: result.cacheInfo?.lastCivitaiSync,
      loraInfoNodeAvailable: result.cacheInfo?.loraInfoNodeAvailable,
      fromCache: true,
      serverId: server._id,
      serverName: server.name
    });
  } catch (error) {
    console.error('Failed to fetch LoRA models:', error);
    res.status(500).json({ message: error.message });
  }
});

// LoRA 모델 캐시 갱신 (서버 단위 동기화 트리거)
router.post('/:id/lora-models/refresh', requireAuth, async (req, res) => {
  try {
    const workboard = await Workboard.findById(req.params.id)
      .populate('serverId', 'name serverType serverUrl');

    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }

    if (!workboard.isActive) {
      return res.status(403).json({ message: 'Workboard is not active' });
    }

    if (!workboard.serverId) {
      return res.status(400).json({ message: 'Workboard has no server configured' });
    }

    const server = workboard.serverId;

    if (server.serverType !== 'ComfyUI') {
      return res.status(400).json({
        message: 'LoRA refresh is only supported on ComfyUI servers'
      });
    }

    // 서버 단위 동기화 시작 (비동기)
    loraMetadataService.syncServerLoras(server._id, server.serverUrl)
      .then(() => {
        console.log(`LoRA sync completed for server ${server.name}`);
      })
      .catch((err) => {
        console.error(`LoRA sync failed for server ${server.name}:`, err);
      });

    res.json({
      message: 'LoRA sync started. Check status via /servers/:id/loras/status',
      serverId: server._id,
      serverName: server.name
    });
  } catch (error) {
    console.error('Failed to start LoRA refresh:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
