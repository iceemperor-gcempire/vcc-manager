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
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImageGenerationJob',
    required: true
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
generatedVideoSchema.index({ jobId: 1 });
generatedVideoSchema.index({ tags: 1 });

module.exports = mongoose.model('GeneratedVideo', generatedVideoSchema);
