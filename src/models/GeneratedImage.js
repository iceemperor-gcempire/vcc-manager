const mongoose = require('mongoose');

const generatedImageSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImageGenerationJob',
    required: false  // 히스토리 삭제 시 이미지 보존을 위해 optional로 변경
  },
  metadata: {
    width: Number,
    height: Number,
    format: String,
    colorSpace: String,
    hasAlpha: Boolean,
    orientation: Number
  },
  generationParams: {
    prompt: String,
    negativePrompt: String,
    model: mongoose.Schema.Types.Mixed, // 키-값 객체 또는 문자열 지원
    seed: mongoose.Schema.Types.Mixed, // 64비트 정수 지원
    steps: Number,
    cfg: Number,
    sampler: String,
    scheduler: String,
    imageSize: mongoose.Schema.Types.Mixed, // 키-값 객체 또는 문자열 지원
    stylePreset: mongoose.Schema.Types.Mixed, // 추가 파라미터들
    upscaleMethod: mongoose.Schema.Types.Mixed,
    referenceImageMethod: mongoose.Schema.Types.Mixed,
    additionalParams: mongoose.Schema.Types.Mixed
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag'
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  downloadCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

generatedImageSchema.methods.incrementDownloadCount = function() {
  this.downloadCount += 1;
  return this.save();
};

generatedImageSchema.index({ userId: 1, createdAt: -1 });
generatedImageSchema.index({ jobId: 1 });
generatedImageSchema.index({ tags: 1 });

module.exports = mongoose.model('GeneratedImage', generatedImageSchema);