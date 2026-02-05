const express = require('express');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const router = express.Router();

router.get('/profile', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      nickname: req.user.nickname,
      avatar: req.user.avatar,
      isAdmin: req.user.isAdmin,
      preferences: req.user.preferences,
      lastLogin: req.user.lastLogin,
      createdAt: req.user.createdAt
    }
  });
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { nickname, preferences } = req.body;
    
    if (nickname) {
      req.user.nickname = nickname.trim();
    }
    
    if (preferences) {
      if (preferences.language) {
        req.user.preferences.language = preferences.language;
      }
      if (preferences.theme) {
        req.user.preferences.theme = preferences.theme;
      }
      if (typeof preferences.deleteContentWithHistory === 'boolean') {
        req.user.preferences.deleteContentWithHistory = preferences.deleteContentWithHistory;
      }
      if (typeof preferences.deleteHistoryWithContent === 'boolean') {
        req.user.preferences.deleteHistoryWithContent = preferences.deleteHistoryWithContent;
      }
      if (typeof preferences.useRandomSeedOnContinue === 'boolean') {
        req.user.preferences.useRandomSeedOnContinue = preferences.useRandomSeedOnContinue;
      }
      if (typeof preferences.nsfwLoraFilter === 'boolean') {
        req.user.preferences.nsfwLoraFilter = preferences.nsfwLoraFilter;
      }
      if (typeof preferences.nsfwImageFilter === 'boolean') {
        req.user.preferences.nsfwImageFilter = preferences.nsfwImageFilter;
      }
    }
    
    await req.user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: req.user._id,
        email: req.user.email,
        nickname: req.user.nickname,
        avatar: req.user.avatar,
        isAdmin: req.user.isAdmin,
        preferences: req.user.preferences
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const ImageGenerationJob = require('../models/ImageGenerationJob');
    const GeneratedImage = require('../models/GeneratedImage');
    const UploadedImage = require('../models/UploadedImage');
    
    const [jobStats, generatedImageCount, uploadedImageCount] = await Promise.all([
      ImageGenerationJob.aggregate([
        { $match: { userId: req.user._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      GeneratedImage.countDocuments({ userId: req.user._id }),
      UploadedImage.countDocuments({ userId: req.user._id })
    ]);
    
    const stats = {
      jobs: {
        total: jobStats.reduce((sum, stat) => sum + stat.count, 0),
        pending: jobStats.find(s => s._id === 'pending')?.count || 0,
        processing: jobStats.find(s => s._id === 'processing')?.count || 0,
        completed: jobStats.find(s => s._id === 'completed')?.count || 0,
        failed: jobStats.find(s => s._id === 'failed')?.count || 0
      },
      images: {
        generated: generatedImageCount,
        uploaded: uploadedImageCount
      }
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/account', requireAuth, async (req, res) => {
  try {
    const ImageGenerationJob = require('../models/ImageGenerationJob');
    const GeneratedImage = require('../models/GeneratedImage');
    const UploadedImage = require('../models/UploadedImage');
    
    await Promise.all([
      ImageGenerationJob.deleteMany({ userId: req.user._id }),
      GeneratedImage.deleteMany({ userId: req.user._id }),
      UploadedImage.deleteMany({ userId: req.user._id }),
      User.findByIdAndDelete(req.user._id)
    ]);
    
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: 'Account deleted but logout failed' });
      }
      res.json({ message: 'Account deleted successfully' });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;