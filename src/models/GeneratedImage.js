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
    required: true
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
    model: String,
    seed: Number,
    steps: Number,
    cfg: Number,
    sampler: String,
    scheduler: String
  },
  tags: [String],
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