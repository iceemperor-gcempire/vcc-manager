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
  // @deprecated — #400 에서 일반화. 이제는 name 으로 builtin 태그를 식별 (`'세계관'`).
  // 기존 데이터 호환 위해 필드 자체는 유지하되 새 코드에서 읽지 않음.
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
