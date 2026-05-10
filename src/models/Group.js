const mongoose = require('mongoose');

// 사용자 그룹 — 작업판 단위 접근 권한 + capability flag (#198 Phase A).
// admin 은 implicit all-access 라 그룹 무관. 일반 사용자만 그룹 소속 → 작업판 접근 매핑.
const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  // capability flag (예: 'workboard:create', 'admin:userManagement') — 향후 세밀화 위한 슬롯.
  // Phase A 에서는 빈 배열로만 동작. 권한 평가 미들웨어 (Phase C) 가 사용 시작.
  permissions: {
    type: [String],
    default: []
  },
  // 신규 사용자 자동 가입 + 마이그레이션 시 기존 작업판 자동 할당의 기본값.
  // 시스템 전체에 isDefault=true 그룹은 0 또는 1 개 (코드 가드).
  isDefault: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

groupSchema.index({ isDefault: 1 });

// 기본 그룹 1 개만 허용 — 다중 default 방지.
groupSchema.pre('save', async function(next) {
  if (this.isDefault) {
    const existing = await this.constructor.findOne({
      isDefault: true,
      _id: { $ne: this._id }
    });
    if (existing) {
      return next(new Error('isDefault 그룹은 시스템에 하나만 존재할 수 있습니다.'));
    }
  }
  next();
});

groupSchema.statics.findDefault = function() {
  return this.findOne({ isDefault: true });
};

module.exports = mongoose.model('Group', groupSchema);
