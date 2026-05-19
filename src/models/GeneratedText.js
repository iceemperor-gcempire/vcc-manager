const mongoose = require('mongoose');

// LLM 대화에서 사용자가 명시적으로 보존하기로 한 assistant 메시지 (#387).
// 이미지의 GeneratedImage 와 대응. ConversationJob 의 메시지 인덱스 / 모델명을 함께 저장해
// 후속에 대화 자체가 삭제돼도 텍스트만 독립적으로 남게.

const generatedTextSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  conversationJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConversationJob',
    // 원본 대화가 삭제될 수 있으므로 required: false
  },
  // 원본 대화 내 메시지 인덱스 (참조용. 대화 messages 가 append 되며 인덱스가 의미 가질 수 있음)
  messageIndex: Number,
  content: {
    type: String,
    required: true,
  },
  model: String,
  // 저장 시점에 함께 캡처 — 대화 삭제 후에도 어떤 작업판 / 프롬프트에서 나왔는지 추적
  workboardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workboard',
  },
  sourcePrompt: String, // 가장 최근 user 메시지 — 컨텍스트 표시용
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag',
  }],
}, { timestamps: true });

generatedTextSchema.index({ userId: 1, createdAt: -1 });
generatedTextSchema.index({ userId: 1, tags: 1 });
generatedTextSchema.index({ conversationJobId: 1 });

module.exports = mongoose.model('GeneratedText', generatedTextSchema);
