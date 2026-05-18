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

module.exports = mongoose.model('ConversationJob', conversationJobSchema);
