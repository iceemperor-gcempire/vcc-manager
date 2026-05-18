const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ConversationJob = require('../models/ConversationJob');

const router = express.Router();

// 텍스트(LLM) 대화 히스토리 (#373).
// Phase 1: 단문 Q&A 조회 / 삭제. Phase 2 에서 멀티턴 append 추가 예정.

// GET /my — 내 대화 히스토리 (페이징)
router.get('/my', requireAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = { userId: req.user._id };
    const [items, total] = await Promise.all([
      ConversationJob.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('workboardId', 'name workboardType outputFormat')
        .lean(),
      ConversationJob.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        conversations: items,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Conversation list error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /:id — 단일 대화 상세
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const item = await ConversationJob.findById(req.params.id)
      .populate('workboardId', 'name workboardType outputFormat')
      .lean();
    if (!item) {
      return res.status(404).json({ message: '대화를 찾을 수 없습니다.' });
    }
    // 본인 또는 admin 만 조회 가능
    if (!req.user.isAdmin && String(item.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: '접근 권한이 없습니다.' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Conversation get error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /:id — 삭제 (본인 또는 admin)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const item = await ConversationJob.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: '대화를 찾을 수 없습니다.' });
    }
    if (!req.user.isAdmin && String(item.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: '삭제 권한이 없습니다.' });
    }
    await item.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error('Conversation delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// (admin) GET /all — 전체 대화 (페이징)
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      ConversationJob.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('workboardId', 'name workboardType outputFormat')
        .populate('userId', 'email nickname')
        .lean(),
      ConversationJob.countDocuments({}),
    ]);
    res.json({
      success: true,
      data: {
        conversations: items,
        pagination: { current: page, pages: Math.ceil(total / limit), total },
      },
    });
  } catch (error) {
    console.error('Conversation admin list error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
