const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  prefix: {
    type: String,
    required: true
  },
  keyHash: {
    type: String,
    required: true,
    unique: true
  },
  lastUsedAt: {
    type: Date
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  revokedAt: {
    type: Date
  }
}, {
  timestamps: true
});

apiKeySchema.index({ userId: 1, isRevoked: 1 });

apiKeySchema.statics.generateKey = function() {
  const rawKey = crypto.randomBytes(20).toString('hex');
  const fullKey = `vcc_${rawKey}`;
  const prefix = fullKey.substring(0, 8);
  const keyHash = crypto
    .createHash('sha256')
    .update(fullKey)
    .digest('hex');

  return { fullKey, prefix, keyHash };
};

apiKeySchema.statics.hashKey = function(key) {
  return crypto
    .createHash('sha256')
    .update(key)
    .digest('hex');
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
