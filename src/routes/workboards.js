const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Workboard = require('../models/Workboard');
const LoraCache = require('../models/LoraCache');
const { getLoraModels } = require('../services/comfyUIService');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', workboardType, includeAll, includeInactive } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};

    // 비활성 작업판 포함 여부 (관리자용)
    if (includeInactive !== 'true') {
      filter.isActive = true;
    }

    if (includeAll === 'true') {
      // 관리자용: 모든 타입 조회
    } else if (workboardType) {
      filter.workboardType = workboardType;
    } else {
      filter.workboardType = { $in: ['image', null, undefined] };
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
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
      workboardType = 'image',
      baseInputFields,
      additionalInputFields,
      workflowData
    } = req.body;
    
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
    const Server = require('../models/Server');
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
      workboardType,
      baseInputFields,
      additionalInputFields: additionalInputFields || [],
      workflowData: workboardType === 'prompt' ? '' : workflowData,
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
      const Server = require('../models/Server');
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
    if (workboardType) workboard.workboardType = workboardType;
    if (baseInputFields) workboard.baseInputFields = baseInputFields;
    if (additionalInputFields !== undefined) workboard.additionalInputFields = additionalInputFields;
    if (workflowData !== undefined) {
      workboard.workflowData = workboard.workboardType === 'prompt' ? '' : workflowData;
      if (workboard.workboardType === 'image' && workflowData && !workboard.validateWorkflowData()) {
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

// LoRA 모델 목록 조회 (캐시된 데이터 우선, 없으면 ComfyUI 서버에서 fetch)
router.get('/:id/lora-models', requireAuth, async (req, res) => {
  try {
    const workboard = await Workboard.findById(req.params.id);
    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }

    if (!workboard.isActive) {
      return res.status(403).json({ message: 'Workboard is not active' });
    }

    // 캐시된 LoRA 모델 데이터 확인
    let loraCache = await LoraCache.findOne({ workboardId: req.params.id });
    
    if (loraCache) {
      return res.json({
        loraModels: loraCache.loraModels,
        lastFetched: loraCache.lastFetched,
        fromCache: true
      });
    }

    // 캐시가 없으면 ComfyUI 서버에서 fetch
    try {
      const loraModels = await getLoraModels(workboard.serverUrl);
      
      // 캐시에 저장
      loraCache = new LoraCache({
        workboardId: req.params.id,
        serverUrl: workboard.serverUrl,
        loraModels: loraModels
      });
      await loraCache.save();

      res.json({
        loraModels: loraModels,
        lastFetched: loraCache.lastFetched,
        fromCache: false
      });
    } catch (comfyError) {
      console.error('Failed to fetch LoRA models from ComfyUI:', comfyError);
      res.status(503).json({ 
        message: 'Failed to fetch LoRA models from ComfyUI server',
        error: comfyError.message 
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// LoRA 모델 캐시 갱신
router.post('/:id/lora-models/refresh', requireAuth, async (req, res) => {
  try {
    const workboard = await Workboard.findById(req.params.id);
    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }

    if (!workboard.isActive) {
      return res.status(403).json({ message: 'Workboard is not active' });
    }

    try {
      const loraModels = await getLoraModels(workboard.serverUrl);
      
      // 캐시 업데이트 또는 생성
      await LoraCache.findOneAndUpdate(
        { workboardId: req.params.id },
        {
          workboardId: req.params.id,
          serverUrl: workboard.serverUrl,
          loraModels: loraModels,
          lastFetched: new Date()
        },
        { 
          upsert: true, 
          new: true 
        }
      );

      res.json({
        message: 'LoRA models cache refreshed successfully',
        loraModels: loraModels,
        lastFetched: new Date(),
        fromCache: false
      });
    } catch (comfyError) {
      console.error('Failed to refresh LoRA models from ComfyUI:', comfyError);
      res.status(503).json({ 
        message: 'Failed to refresh LoRA models from ComfyUI server',
        error: comfyError.message 
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;