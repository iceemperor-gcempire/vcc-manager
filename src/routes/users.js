const express = require('express');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const { deleteUserAndContent } = require('../services/userDeletionService');
const { isValidPassword, PASSWORD_POLICY_MESSAGE } = require('../utils/passwordPolicy');
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
      if (typeof preferences.nsfwModelFilter === 'boolean') {
        req.user.preferences.nsfwModelFilter = preferences.nsfwModelFilter;
        // legacy 필드도 동기 (다른 곳에서 아직 읽을 가능성 대비)
        req.user.preferences.nsfwLoraFilter = preferences.nsfwModelFilter;
      } else if (typeof preferences.nsfwLoraFilter === 'boolean') {
        // legacy 단독 업데이트 — nsfwModelFilter 로 통합
        req.user.preferences.nsfwModelFilter = preferences.nsfwLoraFilter;
        req.user.preferences.nsfwLoraFilter = preferences.nsfwLoraFilter;
      }
      if (typeof preferences.nsfwImageFilter === 'boolean') {
        req.user.preferences.nsfwImageFilter = preferences.nsfwImageFilter;
      }
      if (typeof preferences.resetWorkboardOutputFormat === 'boolean') {
        req.user.preferences.resetWorkboardOutputFormat = preferences.resetWorkboardOutputFormat;
      }
      if (typeof preferences.resetWorkboardApiFormat === 'boolean') {
        req.user.preferences.resetWorkboardApiFormat = preferences.resetWorkboardApiFormat;
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

// 비밀번호 변경 (로그인 상태, 현재 비번 확인 → 새 비번) (#663)
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: '현재 비밀번호와 새 비밀번호를 입력해주세요' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }
    // 소셜 로그인 계정은 비밀번호가 없어 변경 불가
    if (user.authProvider !== 'local') {
      return res.status(400).json({ message: '소셜 로그인 계정은 비밀번호를 변경할 수 없습니다' });
    }

    const isCurrentValid = await user.comparePassword(currentPassword);
    if (!isCurrentValid) {
      return res.status(400).json({ message: '현재 비밀번호가 올바르지 않습니다' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: '새 비밀번호가 현재 비밀번호와 같습니다' });
    }
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
    }

    user.password = newPassword; // pre-save 미들웨어가 bcrypt 해시
    await user.save();

    res.json({ message: '비밀번호가 변경되었습니다' });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    // 개인 콘텐츠 cascade 삭제 — 단일 헬퍼로 통합 (영상/대화/텍스트 등 누락 방지, #660)
    await deleteUserAndContent(req.user._id);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;