const mongoose = require('mongoose');
const { version: APP_VERSION } = require('../../package.json');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  nickname: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password required only if not Google OAuth user
    }
  },
  googleId: {
    type: String,
    sparse: true, // Allow null values but ensure uniqueness when present
    unique: true
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  avatar: {
    type: String
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  lastLogin: {
    type: Date
  },
  preferences: {
    language: {
      type: String,
      default: 'en'
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    deleteContentWithHistory: {
      type: Boolean,
      default: false
    },
    deleteHistoryWithContent: {
      type: Boolean,
      default: false
    },
    useRandomSeedOnContinue: {
      type: Boolean,
      default: false
    },
    // 업데이트 공지를 어느 버전까지 봤는지 (#999). 기본값을 두지 않는다 — 기존 계정은 비어 있어야
    // 첫 공지를 받는다. 새 계정은 아래 pre('validate') 가 현재 버전으로 채운다
    lastSeenVersion: {
      type: String
    },
    // NSFW 모델 (베이스 모델 / LoRA) 숨김 (#346)
    nsfwModelFilter: {
      type: Boolean,
      default: true
    },
    // legacy — nsfwModelFilter 도입 전. fallback 으로 유지
    nsfwLoraFilter: {
      type: Boolean,
      default: true
    },
    nsfwImageFilter: {
      type: Boolean,
      default: true
    },
    resetWorkboardOutputFormat: {
      type: Boolean,
      default: false
    },
    resetWorkboardApiFormat: {
      type: Boolean,
      default: false
    }
  },
  favoriteProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  // 사용자 그룹 (#198) — 작업판 단위 접근 권한 매핑.
  // admin 은 implicit all-access (이 필드 무관). 일반 사용자는 신규 가입 시 isDefault 그룹 자동 추가.
  groupIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }],
  passwordResetToken: {
    type: String
  },
  passwordResetExpires: {
    type: Date
  }
}, {
  timestamps: true
});

// Pre-save middleware to hash password
// 새로 가입한 계정은 지난 공지를 받을 이유가 없다 — 현재 버전까지 본 것으로 시작 (#999).
// 가입 경로(로컬·OAuth)가 여럿이라 생성 지점마다 넣지 않고 여기서 한 번에.
userSchema.pre('validate', function(next) {
  if (this.isNew && this.preferences && !this.preferences.lastSeenVersion) {
    this.preferences.lastSeenVersion = APP_VERSION;
  }
  next();
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.updateAdminStatus = function() {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim());
  this.isAdmin = adminEmails.includes(this.email);
  // TEST_AUTO_ADMIN_DOMAIN 백도어 제거됨 (#379). dev 환경도 alpha 도메인으로 외부 노출되는 구조라
  // 도메인 기반 자동 admin 승격은 공격 표면이 됨. E2E 테스트는 후속 작업에서 별도 안전 경로로 재설계 필요.
  // 관리자는 자동으로 승인됨
  if (this.isAdmin && this.approvalStatus === 'pending') {
    this.approvalStatus = 'approved';
    this.approvedAt = new Date();
  }
  return this.save();
};

userSchema.methods.approve = function(approvedByUserId) {
  this.approvalStatus = 'approved';
  this.approvedBy = approvedByUserId;
  this.approvedAt = new Date();
  return this.save();
};

userSchema.methods.reject = function(rejectedByUserId) {
  this.approvalStatus = 'rejected';
  this.approvedBy = rejectedByUserId;
  this.approvedAt = new Date();
  return this.save();
};

userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isGoogleUser = function() {
  return this.authProvider === 'google' && !!this.googleId;
};

userSchema.methods.isLocalUser = function() {
  return this.authProvider === 'local' && !!this.password;
};

userSchema.methods.createPasswordResetToken = function() {
  // Generate a random token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash the token and store it in the database
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expiration to 1 hour from now
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;

  // Return the unhashed token to send via email
  return resetToken;
};

userSchema.methods.clearPasswordResetToken = function() {
  this.passwordResetToken = undefined;
  this.passwordResetExpires = undefined;
};

module.exports = mongoose.model('User', userSchema);