const mongoose = require('mongoose');

// 참조용 업로드 비디오 (#753) — UploadedImage 와 대칭.
// 워크플로우(MiniMax H3 등 비디오 참조 모델)의 video 필드 입력으로 사용된다.
const uploadedVideoSchema = new mongoose.Schema({
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
  thumbnailUrl: {
    type: String,
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  metadata: {
    width: Number,
    height: Number,
    duration: Number, // seconds
    frameRate: Number,
    codec: String,
    format: String
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag'
  }],
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

uploadedVideoSchema.methods.addReference = function(jobId) {
  this.isReferenced = true;
  this.referencedBy.push({ jobId });
  return this.save();
};

uploadedVideoSchema.methods.removeReference = function(jobId) {
  this.referencedBy = this.referencedBy.filter(ref => !ref.jobId.equals(jobId));
  this.isReferenced = this.referencedBy.length > 0;
  return this.save();
};

uploadedVideoSchema.index({ userId: 1, createdAt: -1 });
uploadedVideoSchema.index({ filename: 1 });

module.exports = mongoose.model('UploadedVideo', uploadedVideoSchema);
