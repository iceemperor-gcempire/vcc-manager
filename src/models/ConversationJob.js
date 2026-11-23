const mongoose = require('mongoose');

// LLM 텍스트 작업판의 대화 히스토리 (#373).
// Phase 1 은 단문 Q&A 만 저장하지만 messages: [] 구조로 향후 멀티턴 호환.

// 'tool' 은 도구 결과 메시지 (#1282)
const CONVERSATION_MESSAGE_ROLES = ['system', 'user', 'assistant', 'tool'];
// 'prompt' — 텍스트 작업판·AI 프롬프트 생성의 대화 (기본). 'chat' — 채팅 화면의 대화 (#1267): 도구 메시지가 섞인다
const CONVERSATION_KINDS = ['prompt', 'chat'];

const conversationMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: CONVERSATION_MESSAGE_ROLES,
    required: true,
  },
  content: {
    type: String,
    default: '',
  },
  // 도구 호출 (#1282) — 채팅 대화(kind: 'chat')에서만 쓴다. 꼴은 services/llmToolLoop 의 내부 형식과 같다.
  // assistant 메시지: 모델이 요청한 도구 호출 목록 (arguments 는 JSON 문자열 그대로)
  // tool 메시지: 어느 호출의 결과인지(toolCallId)와 도구 이름. 결과 본문은 content
  // ⚠️ assistant(toolCalls) 와 그 id 전부의 tool 메시지는 한 묶음으로 저장한다 — 짝이 깨지면 다음 호출을 LLM 서버가 거절한다
  toolCalls: {
    type: [new mongoose.Schema({
      id: { type: String, required: true },
      name: { type: String, required: true },
      arguments: { type: String, default: '{}' },
    }, { _id: false })],
    default: undefined,
  },
  toolCallId: String,
  name: String,
  // 비전 LLM 첨부 이미지 (#517). imageId 참조 + 표시용 url 스냅샷.
  // LLM 호출 시엔 imageId 로 원본을 읽어 base64 로 변환해 전송, 다시보기는 url 로 표시.
  attachments: [new mongoose.Schema({
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: 'UploadedImage' },
    url: String,
  }, { _id: false })],
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const conversationJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  workboardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workboard',
    required: true,
  },
  // 채팅 화면의 대화인지 (#1282). 필드가 없는 옛 문서는 'prompt' 로 읽는다 — lean() 결과에는 기본값이
  // 안 붙으므로 판정은 utils/conversationView 의 isChatConversation 으로 한다.
  kind: {
    type: String,
    enum: CONVERSATION_KINDS,
    default: 'prompt',
  },
  // 대화 제목 — 채팅 화면의 대화 목록에 쓴다
  title: { type: String, trim: true, maxlength: 200 },
  serverType: String,
  model: String,
  // 프로젝트 컨텍스트 (#396). 실행 시 사용자가 지정한 프로젝트 ID. null 가능.
  // 프로젝트 작업 히스토리 / 사전 컨텍스트 표시에 사용. (#397 후속 — tags 와 함께 보존)
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  },
  // 태그 기반 필터링 (이미지 작업과 동일 메커니즘으로 통일). projectId 가 있으면 자동으로 프로젝트 태그 주입.
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag',
  }],
  // 작업 절차 실행의 단계로 만들어진 대화 (#952). 일반 대화 히스토리 목록에서 빠지고
  // 작업 절차 실행 기록 안에서 보인다 (utils/historyFilters).
  sequenceRunId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SequenceRun',
  },
  // 합성 전 원본을 분리 저장해 display / audit 용도로 사용 (#396).
  // 실제 LLM 호출엔 둘을 합쳐 system 메시지 1개로 전송하지만, 보존은 분리.
  workboardSystemPrompt: String,
  // AI 프롬프트 생성을 연 이미지·영상 판과, 그때 적용된 그 판의 지침 (#1109). 판 지침이 나중에 바뀌어도
  // 이 대화가 어떤 지침으로 만들어졌는지 남는다.
  targetWorkboardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workboard',
  },
  targetWorkboardInstructions: String,
  worldviewContext: String,
  messages: [conversationMessageSchema],
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  error: {
    message: String,
    code: String,
  },
  // 향후 Phase 3 에서 채움 (#373)
  usage: {
    promptTokens: Number,
    completionTokens: Number,
    totalTokens: Number,
  },
  costEstimate: {
    amount: Number,
    currency: String,
    pricingVersion: String,
  },
  completedAt: Date,
}, { timestamps: true });

conversationJobSchema.index({ userId: 1, createdAt: -1 });
conversationJobSchema.index({ workboardId: 1, createdAt: -1 });
conversationJobSchema.index({ projectId: 1, createdAt: -1 });

const ConversationJob = mongoose.model('ConversationJob', conversationJobSchema);

module.exports = ConversationJob;
module.exports.CONVERSATION_MESSAGE_ROLES = CONVERSATION_MESSAGE_ROLES;
module.exports.CONVERSATION_KINDS = CONVERSATION_KINDS;
