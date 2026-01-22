const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Workboard = require('../models/Workboard');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = { isActive: true };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const workboards = await Workboard.find(filter)
      .populate('createdBy', 'nickname email')
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
      .populate('createdBy', 'nickname email');
    
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
      .populate('createdBy', 'nickname email');
    
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
      serverUrl,
      baseInputFields,
      additionalInputFields,
      workflowData
    } = req.body;
    
    const workboard = new Workboard({
      name: name.trim(),
      description: description?.trim(),
      serverUrl: serverUrl.trim(),
      baseInputFields,
      additionalInputFields: additionalInputFields || [],
      workflowData,
      createdBy: req.user._id
    });
    
    if (!workboard.validateWorkflowData()) {
      return res.status(400).json({ message: 'Invalid workflow data format' });
    }
    
    await workboard.save();
    await workboard.populate('createdBy', 'nickname email');
    
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
      serverUrl,
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
    if (serverUrl) workboard.serverUrl = serverUrl.trim();
    if (baseInputFields) workboard.baseInputFields = baseInputFields;
    if (additionalInputFields !== undefined) workboard.additionalInputFields = additionalInputFields;
    if (workflowData !== undefined) {
      workboard.workflowData = workflowData;
      if (workflowData && !workboard.validateWorkflowData()) {
        return res.status(400).json({ message: 'Invalid workflow data format' });
      }
      workboard.version += 1;
    }
    if (isActive !== undefined) workboard.isActive = isActive;
    
    console.log('Before save:', workboard.toObject());
    await workboard.save();
    await workboard.populate('createdBy', 'nickname email');
    
    res.json({
      message: 'Workboard updated successfully',
      workboard
    });
  } catch (error) {
    console.error('Workboard update error:', error);
    res.status(400).json({ message: error.message });
  }
});

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
    
    workboard.isActive = false;
    await workboard.save();
    
    res.json({ message: 'Workboard deactivated successfully' });
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
      serverUrl: originalWorkboard.serverUrl,
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

module.exports = router;