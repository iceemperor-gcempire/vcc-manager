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
  }],
  // 프로젝트를 열어줄 그룹 (#802). Workboard.allowedGroupIds 와 같은 축이다.
  //
  // **비어 있으면 개인 전용** — 소유자와 admin 만 접근한다. 기존 프로젝트는 전부 이 상태이므로
  // 필드 도입만으로 동작이 달라지지 않는다 (Workboard 와 정반대 규칙이니 주의:
  // 작업판은 빈 배열이 'admin 전용', 프로젝트는 '소유자 전용' 이다).
  //
  // 공유 범위는 **읽기 + 실행** 이다. 프로젝트 자체의 편집·삭제·내보내기는 소유자와 admin 만 한다.
  // 작업판 실행 권한은 여기서 나오지 않는다 — 각 작업판의 allowedGroupIds 가 따로 판정한다.
  // 프로젝트 공유가 작업판 접근을 대신 열어주면 #802 의 권한 우회가 재현된다.
  allowedGroupIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }]
}, {
  timestamps: true
});

projectSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Project', projectSchema);
