const mongoose = require('mongoose');

const imageGenerationJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  workboardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workboard',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: Number,
    default: 0
  },
  inputData: {
    prompt: {
      type: String,
      required: true
    },
    negativePrompt: String,
    aiModel: String,
    imageSize: String,
    referenceImages: [{
      imageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UploadedImage'
      },
      method: String,
      strength: Number
    }],
    referenceImageMethod: String,
    stylePreset: String,
    upscaleMethod: String,
    additionalParams: mongoose.Schema.Types.Mixed
  },
  workflowData: {
    type: String,
    required: true
  },
  comfyJobId: String,
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  resultImages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GeneratedImage'
  }],
  error: {
    message: String,
    code: String,
    details: mongoose.Schema.Types.Mixed
  },
  estimatedTime: Number,
  actualTime: Number,
  startedAt: Date,
  completedAt: Date,
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  }
}, {
  timestamps: true
});

imageGenerationJobSchema.methods.updateStatus = function(status, data = {}) {
  this.status = status;
  
  if (status === 'processing') {
    this.startedAt = new Date();
  } else if (status === 'completed' || status === 'failed') {
    this.completedAt = new Date();
    if (this.startedAt) {
      this.actualTime = this.completedAt - this.startedAt;
    }
  }
  
  if (data.progress !== undefined) {
    this.progress = data.progress;
  }
  
  if (data.error) {
    this.error = data.error;
  }
  
  if (data.comfyJobId) {
    this.comfyJobId = data.comfyJobId;
  }
  
  if (data.resultImages) {
    this.resultImages = data.resultImages;
  }
  
  return this.save();
};

imageGenerationJobSchema.methods.incrementRetry = function() {
  this.retryCount += 1;
  return this.save();
};

imageGenerationJobSchema.methods.canRetry = function() {
  return this.retryCount < this.maxRetries;
};

imageGenerationJobSchema.index({ userId: 1, createdAt: -1 });
imageGenerationJobSchema.index({ status: 1, priority: -1, createdAt: 1 });
imageGenerationJobSchema.index({ workboardId: 1 });

module.exports = mongoose.model('ImageGenerationJob', imageGenerationJobSchema);