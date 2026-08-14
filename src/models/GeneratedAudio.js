const mongoose = require('mongoose');

// 생성된 오디오 (#805) — GeneratedVideo 와 대칭.
//
// 비디오와 두 가지가 다르다:
//  - **썸네일이 없다.** 오디오는 시각 표현이 없어 목록에서 제목·길이로 식별하고
//    인라인 플레이어로 확인한다 (UploadedAudio #772 와 같은 판단).
//  - **width/height 가 없다.** metadata 는 duration/sampleRate/channels/codec 이다.
const generatedAudioSchema = new mongoose.Schema({
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
  // 히스토리 삭제 시 콘텐츠를 보존하기 위해 required: false
  // (GeneratedImage / GeneratedVideo 와 동일한 설계)
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImageGenerationJob',
    required: false
  },
  metadata: {
    duration: Number,     // seconds
    sampleRate: Number,
    channels: Number,
    codec: String,
    format: String
  },
  generationParams: {
    prompt: String,
    negativePrompt: String,
    model: String,
    seed: mongoose.Schema.Types.Mixed,
    lyrics: String,       // 음악 생성 워크플로의 가사 (#805)
    duration: mongoose.Schema.Types.Mixed,
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

generatedAudioSchema.index({ userId: 1, createdAt: -1 });
generatedAudioSchema.index({ jobId: 1 });
generatedAudioSchema.index({ tags: 1 });

module.exports = mongoose.model('GeneratedAudio', generatedAudioSchema);
