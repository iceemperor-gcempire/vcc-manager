const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  tagId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag',
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coverImage: {
    url: String,
    imageId: mongoose.Schema.Types.ObjectId,
    imageType: { type: String, enum: ['uploaded', 'generated'] }
  },
  // 프로젝트에 속한 작업판 목록 (#396).
  // 단방향 참조 — 작업판은 자기가 어떤 프로젝트에 속하는지 모름. 한 작업판이 여러 프로젝트에 들어갈 수 있음.
  workboardIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workboard'
  }]
}, {
  timestamps: true
});

projectSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Project', projectSchema);
