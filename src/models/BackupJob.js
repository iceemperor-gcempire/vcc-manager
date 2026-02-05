const mongoose = require('mongoose');

const backupJobSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  type: {
    type: String,
    enum: ['full', 'database', 'files'],
    default: 'full'
  },
  fileName: {
    type: String
  },
  filePath: {
    type: String
  },
  fileSize: {
    type: Number
  },
  progress: {
    current: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    stage: { type: String, default: '' }
  },
  statistics: {
    collections: {
      type: Map,
      of: Number
    },
    files: {
      generated: { type: Number, default: 0 },
      reference: { type: Number, default: 0 },
      videos: { type: Number, default: 0 }
    },
    totalSize: { type: Number, default: 0 }
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
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7일 후
  }
}, {
  timestamps: true
});

// 인덱스
backupJobSchema.index({ status: 1 });
backupJobSchema.index({ createdBy: 1 });
backupJobSchema.index({ createdAt: -1 });
backupJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 진행 상태 업데이트 메서드
backupJobSchema.methods.updateProgress = function(current, total, stage) {
  this.progress.current = current;
  this.progress.total = total;
  this.progress.stage = stage;
  return this.save();
};

// 완료 처리 메서드
backupJobSchema.methods.complete = function(fileName, filePath, fileSize, statistics) {
  this.status = 'completed';
  this.fileName = fileName;
  this.filePath = filePath;
  this.fileSize = fileSize;
  this.statistics = statistics;
  this.completedAt = new Date();
  return this.save();
};

// 실패 처리 메서드
backupJobSchema.methods.fail = function(error) {
  this.status = 'failed';
  this.error = {
    message: error.message,
    stack: error.stack
  };
  this.completedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('BackupJob', backupJobSchema);
