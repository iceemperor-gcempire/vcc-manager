const mongoose = require('mongoose');

const uploadedImageSchema = new mongoose.Schema({
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
  metadata: {
    width: Number,
    height: Number,
    format: String,
    colorSpace: String,
    hasAlpha: Boolean,
    orientation: Number
  },
  tags: [String],
  isReferenced: {
    type: Boolean,
    default: false
  },
  referencedBy: [{
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImageGenerationJob'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

uploadedImageSchema.methods.addReference = function(jobId) {
  this.isReferenced = true;
  this.referencedBy.push({ jobId });
  return this.save();
};

uploadedImageSchema.methods.removeReference = function(jobId) {
  this.referencedBy = this.referencedBy.filter(ref => !ref.jobId.equals(jobId));
  this.isReferenced = this.referencedBy.length > 0;
  return this.save();
};

uploadedImageSchema.index({ userId: 1, createdAt: -1 });
uploadedImageSchema.index({ filename: 1 });

module.exports = mongoose.model('UploadedImage', uploadedImageSchema);