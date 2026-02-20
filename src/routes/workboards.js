const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Workboard = require('../models/Workboard');
const Server = require('../models/Server');
const ServerLoraCache = require('../models/ServerLoraCache');
const loraMetadataService = require('../services/loraMetadataService');
const { escapeRegex } = require('../utils/escapeRegex');
const router = express.Router();

const EXPORT_VERSION = 1;
const APP_VERSION = { major: 1, minor: 3 };

router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', workboardType, apiFormat, outputFormat, includeAll, includeInactive } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};

    // 비활성 작업판 포함 여부 (관리자용)
    if (includeInactive !== 'true') {
      filter.isActive = true;
    }

    if (apiFormat) filter.apiFormat = apiFormat;
    if (outputFormat) filter.outputFormat = outputFormat;

    if (!apiFormat && !outputFormat) {
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
      .populate('serverId', 'name serverType serverUrl outputType isActive')
      .select('-workflowData')
      .sort({ usageCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Workboard.countDocuments(filter);
    
    res.json({
      workboards,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
      const server = await Server.findOne({
        name: data.server.name,
        serverType: data.server.serverType
      });
      if (server) {
        matchedServerId = server._id;
        serverMatchInfo = { name: server.name, matched: true, manual: false };
      } else {
        // 매칭 실패 - 서버 목록과 함께 반환
        const servers = await Server.find({ isActive: true }).select('name serverType outputType');
        return res.json({
          needsServer: true,
          preview: {
            name: data.workboard?.name,
            description: data.workboard?.description,
            apiFormat: data.workboard?.apiFormat,
            outputFormat: data.workboard?.outputFormat,
            server: data.server
          },
          servers,
          warnings
        });
      }
    } else {
      // 서버 정보가 없는 경우
      const servers = await Server.find({ isActive: true }).select('name serverType outputType');
      return res.json({
        needsServer: true,
        preview: {
          name: data.workboard?.name,
          description: data.workboard?.description,
          apiFormat: data.workboard?.apiFormat,
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

    const newWorkboard = new Workboard({
      name: wb.name,
      description: wb.description,
      workboardType: wb.workboardType,
      apiFormat: wb.apiFormat || 'ComfyUI',
      outputFormat: wb.outputFormat || 'image',
      serverId: matchedServerId,
      serverUrl: server.serverUrl,
      baseInputFields: wb.baseInputFields,
      additionalInputFields: wb.additionalInputFields || [],
      workflowData: wb.workflowData || '',
      createdBy: req.user._id,
      version: 1,
      usageCount: 0,
      isActive: true,
      tags: []
    });

    await newWorkboard.save();
    await newWorkboard.populate('createdBy', 'nickname email');
    await newWorkboard.populate('serverId', 'name serverType serverUrl outputType isActive');

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
      .populate('serverId', 'name serverType serverUrl outputType isActive');
    
    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }
    
    if (!workboard.isActive) {
      return res.status(403).json({ message: 'Workboard is not active' });
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
      .populate('serverId', 'name serverType serverUrl outputType isActive');
    
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
      apiFormat,
      outputFormat,
      baseInputFields,
      additionalInputFields,
      workflowData
    } = req.body;

    // apiFormat 기반으로 workboardType 자동 설정 (하위호환)
    const resolvedApiFormat = apiFormat || (workboardType === 'prompt' ? 'OpenAI Compatible' : 'ComfyUI');
    const resolvedOutputFormat = outputFormat || (workboardType === 'prompt' ? 'text' : 'image');
    const resolvedWorkboardType = workboardType || (resolvedApiFormat === 'OpenAI Compatible' ? 'prompt' : 'image');
    
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
    
    const workboard = new Workboard({
      name: name.trim(),
      description: description?.trim(),
      serverId: finalServerId,
      serverUrl: server.serverUrl,
      workboardType: resolvedWorkboardType,
      apiFormat: resolvedApiFormat,
      outputFormat: resolvedOutputFormat,
      baseInputFields,
      additionalInputFields: additionalInputFields || [],
      workflowData: resolvedApiFormat === 'OpenAI Compatible' ? '' : workflowData,
      createdBy: req.user._id
    });
    
    if (!workboard.validateWorkflowData()) {
      return res.status(400).json({ message: 'Invalid workflow data format' });
    }
    
    await workboard.save();
    await workboard.populate('createdBy', 'nickname email');
    await workboard.populate('serverId', 'name serverType serverUrl outputType isActive');
    
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
      apiFormat,
      outputFormat,
      baseInputFields,
      additionalInputFields,
      workflowData,
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
    if (apiFormat) {
      workboard.apiFormat = apiFormat;
      // workboardType도 동기화 (하위호환)
      workboard.workboardType = apiFormat === 'OpenAI Compatible' ? 'prompt' : 'image';
    } else if (workboardType) {
      workboard.workboardType = workboardType;
    }
    if (outputFormat) workboard.outputFormat = outputFormat;
    if (baseInputFields) workboard.baseInputFields = baseInputFields;
    if (additionalInputFields !== undefined) workboard.additionalInputFields = additionalInputFields;
    if (workflowData !== undefined) {
      workboard.workflowData = workboard.apiFormat === 'OpenAI Compatible' ? '' : workflowData;
      if (workboard.apiFormat === 'ComfyUI' && workflowData && !workboard.validateWorkflowData()) {
        return res.status(400).json({ message: 'Invalid workflow data format' });
      }
      workboard.version += 1;
    }
    if (isActive !== undefined) workboard.isActive = isActive;
    
    console.log('Before save:', workboard.toObject());
    await workboard.save();
    await workboard.populate('createdBy', 'nickname email');
    await workboard.populate('serverId', 'name serverType serverUrl outputType isActive');
    
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
      apiFormat: originalWorkboard.apiFormat,
      outputFormat: originalWorkboard.outputFormat,
      baseInputFields: originalWorkboard.baseInputFields,
      additionalInputFields: originalWorkboard.additionalInputFields,
      workflowData: originalWorkboard.workflowData,
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
          serverType: server.serverType,
          outputType: server.outputType
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
        apiFormat: workboard.apiFormat,
        outputFormat: workboard.outputFormat,
        baseInputFields: workboard.baseInputFields,
        additionalInputFields: workboard.additionalInputFields,
        workflowData: workboard.workflowData,
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

    // 서버 단위 캐시에서 조회
    const result = await loraMetadataService.searchServerLoras(server._id, {
      search,
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