const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  color: {
    type: String,
    default: '#1976d2'
  },
  usageCount: {
    type: Number,
    default: 0
  },
  isProjectTag: {
    type: Boolean,
    default: false
  },
  // 세계관 (사전 컨텍스트) 역할 태그 (#396).
  // 사용자별 1개 — UploadedText.tags 가 [projectTag, worldviewTag] 두 개를 모두 포함하면
  // 해당 프로젝트의 세계관 항목으로 인식해 LLM 호출 시 system 메시지의 [배경 / 사전 컨텍스트]
  // 섹션으로 주입됨.
  isWorldviewTag: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

tagSchema.index({ userId: 1, name: 1 }, { unique: true });
tagSchema.index({ userId: 1, usageCount: -1 });

tagSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

tagSchema.methods.decrementUsage = function() {
  if (this.usageCount > 0) {
    this.usageCount -= 1;
  }
  return this.save();
};

module.exports = mongoose.model('Tag', tagSchema);
