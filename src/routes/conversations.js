const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ConversationJob = require('../models/ConversationJob');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const { excludeSequenceStepJobs } = require('../utils/historyFilters');
const { toConversationListItem, isChatConversation, isTurnInProgress, idleTurnFilter } = require('../utils/conversationView');

const router = express.Router();

// 텍스트(LLM) 대화 히스토리 (#373).
// Phase 1: 단문 Q&A 조회 / 삭제. Phase 2 에서 멀티턴 append 추가 예정.

// GET /my — 내 대화 히스토리 (페이징)
router.get('/my', requireAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = excludeSequenceStepJobs({ userId: req.user._id });
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
        conversations: items.map(toConversationListItem), // 도구 결과 본문은 목록에서 줄인다 (#1282)
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

// (admin) GET /all — 전체 대화 (페이징)
// 주의: `/:id` 보다 먼저 등록해야 함 — 뒤에 두면 `/all` 이 `/:id` 에 잡혀 도달 불가 (#687)
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
        conversations: items.map(toConversationListItem), // 도구 결과 본문은 목록에서 줄인다 (#1282)
        pagination: { current: page, pages: Math.ceil(total / limit), total },
      },
    });
  } catch (error) {
    console.error('Conversation admin list error:', error);
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
    // 응답을 받는 중인 채팅 대화는 못 지운다 — 지우면 도는 턴이 답을 저장할 곳이 없어진다. 채팅 화면의 삭제와 같다 (#1288)
    if (isChatConversation(item) && isTurnInProgress(item)) {
      return res.status(409).json({ message: '응답을 받는 중인 대화는 지울 수 없습니다. 잠시 뒤 다시 시도하세요.' });
    }
    if (isChatConversation(item)) {
      // 판정과 삭제를 한 번에 — 위 검사 뒤에 다른 요청이 턴을 잡았으면 지우지 않는다
      const removed = await ConversationJob.deleteOne({ _id: item._id, ...idleTurnFilter() });
      if (!removed.deletedCount) {
        // 0건 — 다른 요청이 그 사이 지웠으면 없는 대화, 아직 있으면 턴을 잡힌 것이다
        const still = await ConversationJob.countDocuments({ _id: item._id });
        if (!still) return res.status(404).json({ message: '대화를 찾을 수 없습니다.' });
        return res.status(409).json({ message: '응답을 받는 중인 대화는 지울 수 없습니다. 잠시 뒤 다시 시도하세요.' });
      }
      // 채팅 대화에서 만든 작업은 남긴다 — 연결만 끊는다 (#1284). 채팅 화면의 삭제(routes/chat.js)와 같다.
      // 대화는 이미 지워졌으므로 연결 끊기가 실패해도 삭제는 성공이다
      try {
        await ImageGenerationJob.updateMany({ conversationId: item._id }, { $unset: { conversationId: 1 } });
      } catch (e) {
        console.error(`Conversation delete — 작업 연결 끊기 실패 conversation=${item._id}: ${e.message}`);
      }
    } else {
      await item.deleteOne();
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Conversation delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
