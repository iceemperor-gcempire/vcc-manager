const mongoose = require('mongoose');

// 참조용 업로드 오디오 (#772) — UploadedVideo 와 대칭.
// 워크플로우(MiniMax H3 ref_audios 등 오디오 참조 모델)의 audio 필드 입력으로 사용된다.
//
// 비디오와 달리 썸네일이 없다 — 오디오는 시각 표현이 없으므로 목록에서 파일명·길이로 식별하고
// 미리듣기는 <audio> 재생으로 처리한다.
const uploadedAudioSchema = new mongoose.Schema({
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
    duration: Number, // seconds
    sampleRate: Number,
    channels: Number,
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

uploadedAudioSchema.methods.addReference = function(jobId) {
  this.isReferenced = true;
  this.referencedBy.push({ jobId });
  return this.save();
};

uploadedAudioSchema.methods.removeReference = function(jobId) {
  this.referencedBy = this.referencedBy.filter(ref => !ref.jobId.equals(jobId));
  this.isReferenced = this.referencedBy.length > 0;
  return this.save();
};

uploadedAudioSchema.index({ userId: 1, createdAt: -1 });
uploadedAudioSchema.index({ filename: 1 });

module.exports = mongoose.model('UploadedAudio', uploadedAudioSchema);
