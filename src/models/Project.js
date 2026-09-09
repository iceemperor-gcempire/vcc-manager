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
  }],
  // 프로젝트의 범위 (#924, Epic #922). 'server' 는 서버 전체가 쓰는 공용 프로젝트 —
  // 검증된 파이프라인·문서를 담아 두는 자리다. 생성·편집·삭제는 admin 만 하고,
  // 소유자(userId)는 만든 admin 이지만 그 계정을 지우려면 먼저 소유권을 옮겨야 한다
  // (userDeletionService 가 막는다). 개인 프로젝트와 구조는 같다 — 확산 범위와 권한만 다르다.
  scope: {
    type: String,
    enum: ['personal', 'server'],
    default: 'personal'
  },
  // 모든 승인된 사용자에게 읽기 + 실행을 연다 (#924). allowedGroupIds 와 같은 축의 "전체" 옵션 —
  // 새 그룹이 생겨도 자동으로 포함된다. admin 만 켤 수 있다.
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

projectSchema.index({ userId: 1, createdAt: -1 });
projectSchema.index({ scope: 1, isPublic: 1 });

module.exports = mongoose.model('Project', projectSchema);
