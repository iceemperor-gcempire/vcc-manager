const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
    nsfwLoraFilter: {
      type: Boolean,
      default: true
    },
    nsfwImageFilter: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Pre-save middleware to hash password
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

module.exports = mongoose.model('User', userSchema);