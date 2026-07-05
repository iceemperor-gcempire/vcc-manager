const mongoose = require('mongoose');

const generatedVideoSchema = new mongoose.Schema({
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
  // 첫 프레임 썸네일 (#672). /uploads/videos/*.jpg 원본 경로 저장 → 응답 시 signed URL 자동 변환.
  // 없으면(구 데이터/생성 실패) 프론트가 <video> 첫 프레임으로 fallback.
  thumbnailUrl: {
    type: String
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImageGenerationJob',
    required: false  // 히스토리 삭제 시 비디오 보존을 위해 optional로 변경
  },
  metadata: {
    width: Number,
    height: Number,
    format: String,
    duration: Number,
    frameRate: Number
  },
  generationParams: {
    prompt: String,
    negativePrompt: String,
    model: mongoose.Schema.Types.Mixed,
    seed: mongoose.Schema.Types.Mixed,
    steps: Number,
    cfg: Number,
    sampler: String,
    scheduler: String,
    imageSize: mongoose.Schema.Types.Mixed,
    stylePreset: mongoose.Schema.Types.Mixed,
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
  orderIndex: {
    type: Number,
    default: 0
  },
  downloadCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

generatedVideoSchema.methods.incrementDownloadCount = function() {
  this.downloadCount += 1;
  return this.save();
};

generatedVideoSchema.index({ userId: 1, createdAt: -1 });
generatedVideoSchema.index({ jobId: 1, orderIndex: 1 });
generatedVideoSchema.index({ tags: 1 });

module.exports = mongoose.model('GeneratedVideo', generatedVideoSchema);
