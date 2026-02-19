const mongoose = require('mongoose');

const restoreJobSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'validating', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  backupFileName: {
    type: String,
    required: true
  },
  tempFilePath: {
    type: String
  },
  backupMetadata: {
    version: String,
    createdAt: Date,
    collections: {
      type: Map,
      of: Number
    },
    files: {
      generated: Number,
      reference: Number,
      videos: Number
    }
  },
  options: {
    overwriteExisting: { type: Boolean, default: false },
    skipFiles: { type: Boolean, default: false },
    skipDatabase: { type: Boolean, default: false }
  },
  progress: {
    current: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    stage: { type: String, default: '' }
  },
  statistics: {
    collectionsRestored: {
      type: Map,
      of: Number
    },
    filesRestored: {
      generated: { type: Number, default: 0 },
      reference: { type: Number, default: 0 },
      videos: { type: Number, default: 0 }
    },
    skipped: { type: Number, default: 0 },
    errors: { type: Number, default: 0 }
  },
  validationResult: {
    isValid: Boolean,
    errors: [String],
    warnings: [String]
  },
  error: {
    message: String,
    stack: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// 인덱스
restoreJobSchema.index({ status: 1 });
restoreJobSchema.index({ createdBy: 1 });
restoreJobSchema.index({ createdAt: -1 });

// 진행 상태 업데이트 메서드
restoreJobSchema.methods.updateProgress = function(current, total, stage) {
  this.progress.current = current;
  this.progress.total = total;
  this.progress.stage = stage;
  return this.save();
};

// 검증 완료 메서드
restoreJobSchema.methods.setValidationResult = function(isValid, errors = [], warnings = []) {
  this.status = isValid ? 'pending' : 'failed';
  this.validationResult = { isValid, errors, warnings };
  return this.save();
};

// 완료 처리 메서드
restoreJobSchema.methods.complete = function(statistics) {
  this.status = 'completed';
  this.statistics = statistics;
  this.completedAt = new Date();
  return this.save();
};

// 실패 처리 메서드
restoreJobSchema.methods.fail = function(error) {
  this.status = 'failed';
  this.error = {
    message: error.message,
    stack: error.stack
  };
  this.completedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('RestoreJob', restoreJobSchema);
