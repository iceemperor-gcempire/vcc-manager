const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, userHasWorkboardAccess, buildWorkboardAccessFilter } = require('../middleware/auth');
const ConversationJob = require('../models/ConversationJob');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const Workboard = require('../models/Workboard');
const UploadedImage = require('../models/UploadedImage');
const GeneratedImage = require('../models/GeneratedImage');
const { MAX_IMAGES } = require('../utils/visionImages');
const { isChatConversation, idleTurnFilter } = require('../utils/conversationView');
const {
  runChatTurn, buildSystemPrompt, defaultModelOf, titleFrom,
  isChatCapableWorkboard, isTurnInProgress,
} = require('../services/chatService');

const router = express.Router();

// 채팅 화면 (#1284, 에픽 #1267).
//
// 대화는 ConversationJob(kind: 'chat')이고, 대화에서 만든 생성 작업은 보통 작업(ImageGenerationJob)에
// conversationId 로 이어진다. 둘 다 작업 히스토리에 그대로 보인다.

const MAX_MESSAGE_CHARS = 20000;
const isId = (v) => typeof v === 'string' && v.length === 24 && mongoose.isValidObjectId(v);

/** 내 채팅 대화 하나. 없거나 남의 것이면 같은 404 */
async function loadMyChat(req, res, id = req.params.id) {
  if (!isId(id)) { res.status(404).json({ message: '대화를 찾을 수 없습니다.' }); return null; }
  const conversation = await ConversationJob.findById(id);
  if (!conversation || !isChatConversation(conversation) || String(conversation.userId) !== String(req.user._id)) {
    res.status(404).json({ message: '대화를 찾을 수 없습니다.' });
    return null;
  }
  return conversation;
}

/** 내 이미지(올린 것·만든 것)를 받은 순서대로. 내 것이 아닌 id 는 빠진다 */
async function findMyImages(imageIds, userId) {
  const [uploaded, generated] = await Promise.all([
    UploadedImage.find({ _id: { $in: imageIds }, userId }).select('url').lean(),
    GeneratedImage.find({ _id: { $in: imageIds }, userId }).select('url').lean(),
  ]);
  const byId = new Map([...uploaded, ...generated].map((d) => [String(d._id), d]));
  return imageIds.filter((id) => byId.has(String(id))).map((id) => ({ imageId: id, url: byId.get(String(id)).url }));
}

// GET /workboards — 대화 상대로 고를 수 있는 텍스트 판 (사용량 순). 비어 있으면 화면이 만들라고 안내한다
router.get('/workboards', requireAuth, async (req, res) => {
  try {
    const all = await Workboard.find({ ...buildWorkboardAccessFilter(req.user), isActive: true, outputFormat: 'text' })
      .sort({ usageCount: -1, name: 1 })
      .populate('serverId', 'name serverType isActive');
    // 채팅에는 판의 입력 화면이 없어 모델을 고를 곳이 없다 — 기본 모델이 없는 판은 대화 상대가 못 된다
    const capable = all.filter(isChatCapableWorkboard);
    const usable = capable.filter((wb) => defaultModelOf(wb));
    console.log(`[chat] workboards accessibleText=${all.length} chatCapable=${capable.length} withDefaultModel=${usable.length}`);
    res.json({
      success: true,
      data: {
        workboards: usable.map((wb) => ({
          _id: wb._id,
          name: wb.name,
          description: wb.description || '',
          usageCount: wb.usageCount || 0,
          model: defaultModelOf(wb),
          server: { name: wb.serverId.name, serverType: wb.serverId.serverType },
          acceptsImages: (wb.additionalInputFields || []).some((f) => f && f.type === 'image'),
        })),
        // 텍스트 판은 있는데 대화 상대로 못 쓰는 경우를 화면이 구분해 안내한다
        textWorkboards: all.length,
      },
    });
  } catch (error) {
    console.error('Chat workboards error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /sessions — 내 채팅 대화 목록 (최근에 쓴 순). 메시지는 싣지 않는다
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const filter = { userId: req.user._id, kind: 'chat' };
    const [items, total] = await Promise.all([
      ConversationJob.find(filter)
        .select('title status model workboardId createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('workboardId', 'name')
        .lean(),
      ConversationJob.countDocuments(filter),
    ]);
    // turnInProgress — 응답을 받는 중인지는 서버가 판정해 준다 (죽은 턴 기준이 여기 한 곳에만 있게)
    const sessions = items.map((s) => ({ ...s, turnInProgress: isTurnInProgress(s) }));
    res.json({ success: true, data: { sessions, pagination: { current: page, pages: Math.ceil(total / limit), total } } });
  } catch (error) {
    console.error('Chat sessions error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /sessions/:id — 대화 전체 + 이 대화에서 만든 작업 (작업 패널용, 결과 미디어 포함)
router.get('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const conversation = await loadMyChat(req, res);
    if (!conversation) return;
    await conversation.populate('workboardId', 'name isActive');
    const jobs = await ImageGenerationJob.find({ conversationId: conversation._id, userId: req.user._id })
      .sort({ createdAt: 1 })
      .select('-workflowData -resolvedWorkflowData')
      .populate('workboardId', 'name outputFormat')
      .populate('resultImages')
      .populate('resultVideos')
      .populate('resultAudios');
    res.json({ success: true, data: { session: conversation, jobs, turnInProgress: isTurnInProgress(conversation) } });
  } catch (error) {
    console.error('Chat session get error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PATCH /sessions/:id — 제목 변경
router.patch('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title || title.length > 200) return res.status(400).json({ message: '제목은 1~200자여야 합니다.' });
    const conversation = await loadMyChat(req, res);
    if (!conversation) return;
    // updateOne 으로 제목만 — 도는 턴이 있으면 문서 전체 저장이 그 턴의 메시지를 덮을 수 있다
    await ConversationJob.updateOne({ _id: conversation._id }, { $set: { title } }, { timestamps: false });
    res.json({ success: true, data: { _id: conversation._id, title } });
  } catch (error) {
    console.error('Chat session rename error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /sessions/:id — 대화 삭제. 만든 작업과 생성물은 남긴다 (사용자 것) — 연결만 끊는다
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const conversation = await loadMyChat(req, res);
    if (!conversation) return;
    if (isTurnInProgress(conversation)) return res.status(409).json({ message: '응답을 받는 중인 대화는 지울 수 없습니다. 잠시 뒤 다시 시도하세요.' });
    // 판정과 삭제를 한 번에 — 위 검사 뒤에 다른 탭이 턴을 잡았으면 지우지 않는다
    const removed = await ConversationJob.deleteOne({ _id: conversation._id, ...idleTurnFilter() });
    if (!removed.deletedCount) return res.status(409).json({ message: '응답을 받는 중인 대화는 지울 수 없습니다. 잠시 뒤 다시 시도하세요.' });
    const unlinked = await ImageGenerationJob.updateMany({ conversationId: conversation._id }, { $unset: { conversationId: 1 } });
    console.log(`[chat] session deleted conversation=${conversation._id} unlinkedJobs=${unlinked.modifiedCount || 0}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Chat session delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /messages — 메시지 보내기 (SSE). sessionId 가 없으면 새 대화를 연다
//   body: { sessionId?, workboardId? (새 대화에 필수), text, imageIds? }
//   events: session { sessionId, title } → token { delta } / tool_call / tool_result / round / job → done | error
router.post('/messages', requireAuth, async (req, res) => {
  let heartbeat = null;
  try {
    const { sessionId, workboardId } = req.body || {};
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const imageIds = Array.isArray(req.body?.imageIds) ? req.body.imageIds : [];
    if (!text) return res.status(400).json({ message: '메시지를 입력하세요.' });
    if (text.length > MAX_MESSAGE_CHARS) return res.status(400).json({ message: `메시지는 ${MAX_MESSAGE_CHARS}자까지 보낼 수 있습니다.` });
    if (imageIds.length > MAX_IMAGES || !imageIds.every(isId)) {
      return res.status(400).json({ message: `이미지는 ${MAX_IMAGES}장까지 붙일 수 있습니다.` });
    }

    let conversation = null;
    if (sessionId !== undefined && sessionId !== null) {
      conversation = await loadMyChat(req, res, String(sessionId));
      if (!conversation) return;
      if (isTurnInProgress(conversation)) return res.status(409).json({ message: '이 대화는 아직 응답을 받는 중입니다.' });
    } else if (!isId(workboardId)) {
      return res.status(400).json({ message: '대화 상대로 쓸 작업판을 고르세요.' });
    }

    // 대화 상대 판 — 이어가기는 대화에 저장된 판. 판이 그 뒤 꺼졌거나 권한이 빠졌으면 여기서 막는다
    const workboard = await Workboard.findById(conversation ? conversation.workboardId : workboardId).populate('serverId');
    if (!workboard || !userHasWorkboardAccess(req.user, workboard)) {
      return res.status(conversation ? 400 : 404).json({ message: '대화 상대 작업판을 쓸 수 없습니다.' });
    }
    if (!isChatCapableWorkboard(workboard)) {
      return res.status(400).json({ message: '이 작업판은 채팅 상대로 쓸 수 없습니다 (꺼져 있거나, 텍스트 작업판이 아니거나, 서버 종류가 지원되지 않습니다).' });
    }

    // 첨부 — 내 이미지(올린 것·만든 것)만. 하나라도 내 것이 아니면 조용히 빼지 않고 알린다.
    // 소유는 DB 로만 본다. 파일을 읽어 비전 입력으로 바꾸는 일은 턴 안에서 한다 (services/chatService)
    let attachments = [];
    if (imageIds.length > 0) {
      attachments = await findMyImages(imageIds, req.user._id);
      if (attachments.length !== imageIds.length) {
        console.log(`[chat] attachments rejected asked=${imageIds.length} mine=${attachments.length}`);
        return res.status(400).json({ message: '붙인 이미지 중 쓸 수 없는 것이 있습니다 — 내가 올리거나 만든 이미지만 붙일 수 있습니다.' });
      }
    }

    const userMessage = { role: 'user', content: text, attachments, createdAt: new Date() };
    if (conversation) {
      // 턴을 잡는 것과 메시지를 붙이는 것을 한 번의 갱신으로 한다 — 위의 isTurnInProgress 검사만으로는 동시에 온
      // 두 요청이 모두 통과한다 (실호출에서 확인). 조건에 맞는 요청 하나만 문서를 받는다.
      conversation = await ConversationJob.findOneAndUpdate(
        { _id: conversation._id, ...idleTurnFilter() },
        { $push: { messages: userMessage }, $set: { status: 'processing' }, $unset: { error: 1 } },
        { new: true },
      );
      if (!conversation) return res.status(409).json({ message: '이 대화는 아직 응답을 받는 중입니다.' });
    } else {
      const model = defaultModelOf(workboard);
      if (!model) return res.status(400).json({ message: '작업판에 기본 모델이 정해져 있지 않습니다.' });
      const systemPrompt = buildSystemPrompt(workboard);
      conversation = await ConversationJob.create({
        userId: req.user._id,
        workboardId: workboard._id,
        kind: 'chat',
        title: titleFrom(text),
        serverType: workboard.serverId.serverType,
        model,
        workboardSystemPrompt: systemPrompt,
        messages: [{ role: 'system', content: systemPrompt, createdAt: new Date() }, userMessage],
        status: 'processing',
      });
    }

    // ── 여기서부터 SSE (routes/jobs.js generate-prompt 와 같은 방식, #490) ──
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    res.write(': open\n\n');

    // 화면이 중간에 나가도 턴은 끝까지 돌려 저장한다 — 이미 등록한 생성 작업이 기록 없이 남지 않게
    let clientGone = false;
    let finished = false;
    res.on('close', () => { if (!finished) clientGone = true; });
    const emit = (event, data) => {
      if (clientGone || res.writableEnded) return;
      try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (_) { /* socket 닫힘 */ }
    };
    heartbeat = setInterval(() => {
      if (clientGone || res.writableEnded) return;
      try { res.write(': ping\n\n'); } catch (_) {}
    }, 15000);

    emit('session', { sessionId: String(conversation._id), title: conversation.title || '' });
    await runChatTurn({ user: req.user, conversation, workboard, emit });

    clearInterval(heartbeat);
    finished = true;
    res.end();
  } catch (error) {
    console.error('Chat message error:', error);
    if (heartbeat) clearInterval(heartbeat);
    if (res.headersSent) {
      try { res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`); } catch (_) {}
      return res.end();
    }
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
