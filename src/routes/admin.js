const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Workboard = require('../models/Workboard');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const GeneratedImage = require('../models/GeneratedImage');
const UploadedImage = require('../models/UploadedImage');
const SystemSettings = require('../models/SystemSettings');
const ApiKey = require('../models/ApiKey');
const router = express.Router();

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', approvalStatus = '' } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { nickname: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (approvalStatus) {
      filter.approvalStatus = approvalStatus;
    }
    
    const users = await User.find(filter)
      .select('-googleId')
      .populate('approvedBy', 'nickname email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(filter);
    
    res.json({
      users,
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

// 사용자 승인
router.post('/users/:id/approve', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.approvalStatus === 'approved') {
      return res.status(400).json({ message: 'User is already approved' });
    }
    
    await user.approve(req.user._id);
    await user.populate('approvedBy', 'nickname email');
    
    res.json({ 
      message: 'User approved successfully',
      user: {
        _id: user._id,
        email: user.email,
        nickname: user.nickname,
        approvalStatus: user.approvalStatus,
        approvedBy: user.approvedBy,
        approvedAt: user.approvedAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 사용자 승인 거절
router.post('/users/:id/reject', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.approvalStatus === 'rejected') {
      return res.status(400).json({ message: 'User is already rejected' });
    }
    
    await user.reject(req.user._id);
    await user.populate('approvedBy', 'nickname email');
    
    res.json({ 
      message: 'User access denied',
      user: {
        _id: user._id,
        email: user.email,
        nickname: user.nickname,
        approvalStatus: user.approvalStatus,
        approvedBy: user.approvedBy,
        approvedAt: user.approvedAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    await Promise.all([
      ImageGenerationJob.deleteMany({ userId }),
      GeneratedImage.deleteMany({ userId }),
      UploadedImage.deleteMany({ userId }),
      ApiKey.deleteMany({ userId }),
      User.findByIdAndDelete(userId)
    ]);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [
      userStats,
      jobStats,
      workboardStats,
      imageStats
    ] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ['$isActive', 1, 0] } },
            admins: { $sum: { $cond: ['$isAdmin', 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'pending'] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'approved'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'rejected'] }, 1, 0] } }
          }
        }
      ]),
      ImageGenerationJob.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Workboard.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ['$isActive', 1, 0] } }
          }
        }
      ]),
      GeneratedImage.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalSize: { $sum: '$size' }
          }
        }
      ])
    ]);
    
    const stats = {
      users: userStats[0] || { total: 0, active: 0, admins: 0, pending: 0, approved: 0, rejected: 0 },
      workboards: workboardStats[0] || { total: 0, active: 0 },
      jobs: {
        total: jobStats.reduce((sum, stat) => sum + stat.count, 0),
        pending: jobStats.find(s => s._id === 'pending')?.count || 0,
        processing: jobStats.find(s => s._id === 'processing')?.count || 0,
        completed: jobStats.find(s => s._id === 'completed')?.count || 0,
        failed: jobStats.find(s => s._id === 'failed')?.count || 0
      },
      images: imageStats[0] || { total: 0, totalSize: 0 }
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/jobs', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status = '', userId = '' } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    const jobs = await ImageGenerationJob.find(filter)
      .populate('userId', 'email nickname')
      .populate('workboardId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ImageGenerationJob.countDocuments(filter);

    res.json({
      jobs,
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

// LoRA 설정 조회
router.get('/settings/lora', requireAdmin, async (req, res) => {
  try {
    const settings = await SystemSettings.getGlobal();

    res.json({
      success: true,
      data: {
        nsfwFilter: settings.lora.nsfwFilter,
        nsfwLoraFilter: settings.lora.nsfwLoraFilter,
        hasCivitaiApiKey: !!settings.lora.civitaiApiKey
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// LoRA 설정 업데이트
router.put('/settings/lora', requireAdmin, async (req, res) => {
  try {
    const { nsfwFilter, nsfwLoraFilter, civitaiApiKey } = req.body;

    const updates = {};
    if (nsfwFilter !== undefined) {
      updates.nsfwFilter = nsfwFilter;
    }
    if (nsfwLoraFilter !== undefined) {
      updates.nsfwLoraFilter = nsfwLoraFilter;
    }
    if (civitaiApiKey !== undefined) {
      updates.civitaiApiKey = civitaiApiKey;
    }

    const settings = await SystemSettings.updateLoraSettings(updates);

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        nsfwFilter: settings.lora.nsfwFilter,
        nsfwLoraFilter: settings.lora.nsfwLoraFilter,
        hasCivitaiApiKey: !!settings.lora.civitaiApiKey
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;