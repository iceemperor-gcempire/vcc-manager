const mongoose = require('mongoose');

const promptDataSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  memo: {
    type: String,
    trim: true
  },
  representativeImage: {
    imageId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'representativeImage.imageType'
    },
    imageType: {
      type: String,
      enum: ['UploadedImage', 'GeneratedImage']
    },
    url: String
  },
  prompt: {
    type: String,
    required: true
  },
  negativePrompt: {
    type: String
  },
  seed: {
    type: Number
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

promptDataSchema.index({ createdBy: 1, createdAt: -1 });
promptDataSchema.index({ name: 'text', memo: 'text', prompt: 'text' });

promptDataSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

promptDataSchema.statics.findByUser = function(userId, options = {}) {
  const { page = 1, limit = 20, search } = options;
  const query = { createdBy: userId };
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { memo: { $regex: search, $options: 'i' } },
      { prompt: { $regex: search, $options: 'i' } }
    ];
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('createdBy', 'email nickname');
};

module.exports = mongoose.model('PromptData', promptDataSchema);
