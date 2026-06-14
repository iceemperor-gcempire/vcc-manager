const mongoose = require('mongoose');

// LLM 텍스트 작업판의 대화 히스토리 (#373).
// Phase 1 은 단문 Q&A 만 저장하지만 messages: [] 구조로 향후 멀티턴 호환.

const conversationMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['system', 'user', 'assistant'],
    required: true,
  },
  content: {
    type: String,
    default: '',
  },
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
  // 합성 전 원본을 분리 저장해 display / audit 용도로 사용 (#396).
  // 실제 LLM 호출엔 둘을 합쳐 system 메시지 1개로 전송하지만, 보존은 분리.
  workboardSystemPrompt: String,
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

module.exports = mongoose.model('ConversationJob', conversationJobSchema);
