const mongoose = require('mongoose');
const crypto = require('crypto');
const { API_KEY_SCOPES, DEFAULT_API_KEY_SCOPE, API_KEY_PREFIX } = require('../constants/apiKeyScopes');

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
  // 용도 (#995) — 'api' 범용 / 'mcp' MCP 전용. 기존 키는 기본값 'api' 라 동작이 그대로다
  scope: {
    type: String,
    enum: API_KEY_SCOPES,
    default: DEFAULT_API_KEY_SCOPE
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

apiKeySchema.statics.generateKey = function(scope = DEFAULT_API_KEY_SCOPE) {
  if (!API_KEY_SCOPES.includes(scope)) throw new Error(`Unknown API key scope: ${scope}`);
  const rawKey = crypto.randomBytes(20).toString('hex');
  const fullKey = `${API_KEY_PREFIX[scope]}${rawKey}`;
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
