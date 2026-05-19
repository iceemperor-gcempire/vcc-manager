const mongoose = require('mongoose');

// 사용자가 직접 작성한 텍스트 컨텐츠 (#387).
// 이미지의 UploadedImage 와 대응. 세계관 / 메모 / 프롬프트 단편 등 보존.

const MAX_CONTENT_LENGTH = 1_000_000; // 100만자

const uploadedTextSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    trim: true,
    maxlength: 200,
    default: '',
  },
  content: {
    type: String,
    required: true,
    maxlength: MAX_CONTENT_LENGTH,
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag',
  }],
}, { timestamps: true });

uploadedTextSchema.index({ userId: 1, createdAt: -1 });
uploadedTextSchema.index({ userId: 1, tags: 1 });

module.exports = mongoose.model('UploadedText', uploadedTextSchema);
module.exports.MAX_CONTENT_LENGTH = MAX_CONTENT_LENGTH;
