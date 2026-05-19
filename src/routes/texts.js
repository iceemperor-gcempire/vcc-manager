const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const UploadedText = require('../models/UploadedText');
const GeneratedText = require('../models/GeneratedText');
const ConversationJob = require('../models/ConversationJob');
const { MAX_CONTENT_LENGTH } = UploadedText;

const router = express.Router();

// 텍스트 컨텐츠 라우트 (#387).
// UploadedText: 직접 작성. GeneratedText: 대화에서 사용자 명시 저장.
// 이미지 라우트와 응답 shape 일치 (items + pagination).

function buildListFilter(req) {
  const filter = { userId: req.user._id };
  const { tag, search } = req.query;
  if (tag) filter.tags = tag;
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: re }, { content: re }];
  }
  return filter;
}

function paginate(req, defaultLimit = 20) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || defaultLimit, 100);
  return { page, limit, skip: (page - 1) * limit };
}

// ============================================================================
// UploadedText (직접 작성)
// ============================================================================

router.get('/uploaded', requireAuth, async (req, res) => {
  try {
    const filter = buildListFilter(req);
    const { page, limit, skip } = paginate(req);
    const [items, total] = await Promise.all([
      UploadedText.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('tags', 'name color isProjectTag')
        .lean(),
      UploadedText.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: {
        items,
        pagination: { current: page, pages: Math.ceil(total / limit), total },
      },
    });
  } catch (error) {
    console.error('UploadedText list error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/uploaded/:id', requireAuth, async (req, res) => {
  try {
    const item = await UploadedText.findById(req.params.id)
      .populate('tags', 'name color isProjectTag')
      .lean();
    if (!item) return res.status(404).json({ message: '찾을 수 없습니다.' });
    if (String(item.userId) !== String(req.user._id) && !req.user.isAdmin) {
      return res.status(403).json({ message: '접근 권한이 없습니다.' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('UploadedText get error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/uploaded', requireAuth, async (req, res) => {
  try {
    const { title, content, tags } = req.body;
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ message: '본문은 비울 수 없습니다.' });
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({ message: `본문은 ${MAX_CONTENT_LENGTH.toLocaleString()}자 이하여야 합니다.` });
    }
    const item = await UploadedText.create({
      userId: req.user._id,
      title: typeof title === 'string' ? title.trim() : '',
      content,
      tags: Array.isArray(tags) ? tags : [],
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('UploadedText create error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.patch('/uploaded/:id', requireAuth, async (req, res) => {
  try {
    const item = await UploadedText.findById(req.params.id);
    if (!item) return res.status(404).json({ message: '찾을 수 없습니다.' });
    if (String(item.userId) !== String(req.user._id) && !req.user.isAdmin) {
      return res.status(403).json({ message: '수정 권한이 없습니다.' });
    }
    const { title, content, tags } = req.body;
    if (typeof title === 'string') item.title = title.trim();
    if (typeof content === 'string') {
      if (!content.trim()) return res.status(400).json({ message: '본문은 비울 수 없습니다.' });
      if (content.length > MAX_CONTENT_LENGTH) {
        return res.status(400).json({ message: `본문은 ${MAX_CONTENT_LENGTH.toLocaleString()}자 이하여야 합니다.` });
      }
      item.content = content;
    }
    if (Array.isArray(tags)) item.tags = tags;
    await item.save();
    const populated = await item.populate('tags', 'name color isProjectTag');
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('UploadedText update error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/uploaded/:id', requireAuth, async (req, res) => {
  try {
    const item = await UploadedText.findById(req.params.id);
    if (!item) return res.status(404).json({ message: '찾을 수 없습니다.' });
    if (String(item.userId) !== String(req.user._id) && !req.user.isAdmin) {
      return res.status(403).json({ message: '삭제 권한이 없습니다.' });
    }
    await item.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error('UploadedText delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// GeneratedText (대화에서 저장)
// ============================================================================

router.get('/generated', requireAuth, async (req, res) => {
  try {
    const filter = buildListFilter(req);
    const { page, limit, skip } = paginate(req);
    const [items, total] = await Promise.all([
      GeneratedText.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('tags', 'name color isProjectTag')
        .populate('workboardId', 'name workboardType outputFormat')
        .lean(),
      GeneratedText.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: {
        items,
        pagination: { current: page, pages: Math.ceil(total / limit), total },
      },
    });
  } catch (error) {
    console.error('GeneratedText list error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/generated/:id', requireAuth, async (req, res) => {
  try {
    const item = await GeneratedText.findById(req.params.id)
      .populate('tags', 'name color isProjectTag')
      .populate('workboardId', 'name workboardType outputFormat')
      .lean();
    if (!item) return res.status(404).json({ message: '찾을 수 없습니다.' });
    if (String(item.userId) !== String(req.user._id) && !req.user.isAdmin) {
      return res.status(403).json({ message: '접근 권한이 없습니다.' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GeneratedText get error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 대화 메시지를 명시적으로 저장 → GeneratedText 생성.
// body: { conversationJobId, messageIndex } 또는 { content, model, ... } 직접 지정.
router.post('/generated', requireAuth, async (req, res) => {
  try {
    const { conversationJobId, messageIndex, tags } = req.body;
    let content, model, workboardId, sourcePrompt;

    if (conversationJobId && Number.isInteger(messageIndex)) {
      const conv = await ConversationJob.findById(conversationJobId).lean();
      if (!conv) return res.status(404).json({ message: '대화를 찾을 수 없습니다.' });
      if (String(conv.userId) !== String(req.user._id) && !req.user.isAdmin) {
        return res.status(403).json({ message: '대화에 접근 권한이 없습니다.' });
      }
      const msg = conv.messages?.[messageIndex];
      if (!msg) return res.status(400).json({ message: '메시지 인덱스가 유효하지 않습니다.' });
      if (msg.role !== 'assistant') return res.status(400).json({ message: 'assistant 메시지만 저장할 수 있습니다.' });
      content = msg.content;
      model = conv.model;
      workboardId = conv.workboardId;
      // 같은 인덱스 직전의 user 메시지를 sourcePrompt 로
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (conv.messages[i]?.role === 'user') { sourcePrompt = conv.messages[i].content; break; }
      }
    } else if (typeof req.body.content === 'string' && req.body.content.trim()) {
      content = req.body.content;
      model = req.body.model;
      workboardId = req.body.workboardId;
      sourcePrompt = req.body.sourcePrompt;
    } else {
      return res.status(400).json({ message: 'conversationJobId+messageIndex 또는 content 가 필요합니다.' });
    }

    const item = await GeneratedText.create({
      userId: req.user._id,
      conversationJobId: conversationJobId || undefined,
      messageIndex: Number.isInteger(messageIndex) ? messageIndex : undefined,
      content,
      model,
      workboardId: workboardId || undefined,
      sourcePrompt,
      tags: Array.isArray(tags) ? tags : [],
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('GeneratedText create error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.patch('/generated/:id', requireAuth, async (req, res) => {
  try {
    const item = await GeneratedText.findById(req.params.id);
    if (!item) return res.status(404).json({ message: '찾을 수 없습니다.' });
    if (String(item.userId) !== String(req.user._id) && !req.user.isAdmin) {
      return res.status(403).json({ message: '수정 권한이 없습니다.' });
    }
    const { tags } = req.body;
    if (Array.isArray(tags)) item.tags = tags;
    await item.save();
    const populated = await item.populate('tags', 'name color isProjectTag');
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('GeneratedText update error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/generated/:id', requireAuth, async (req, res) => {
  try {
    const item = await GeneratedText.findById(req.params.id);
    if (!item) return res.status(404).json({ message: '찾을 수 없습니다.' });
    if (String(item.userId) !== String(req.user._id) && !req.user.isAdmin) {
      return res.status(403).json({ message: '삭제 권한이 없습니다.' });
    }
    await item.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error('GeneratedText delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
