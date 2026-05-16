const mongoose = require('mongoose');

// 모델 개별 아이템 스키마.
// ComfyUI checkpoint: filename + hash + civitai 메타데이터
// SaaS provider (OpenAI / Gemini): filename 슬롯에 모델 ID, provider 메타데이터
const modelItemSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  hash: {
    type: String,
    default: null
  },
  hashError: {
    type: String,
    default: null
  },
  civitai: {
    found: {
      type: Boolean,
      default: false
    },
    modelId: Number,
    modelVersionId: Number,
    name: String,
    versionName: String,
    description: String,
    baseModel: String,
    trainedWords: [String],
    images: [{
      url: String,
      nsfw: Boolean,
      type: {
        type: String,
        enum: ['image', 'video'],
        default: 'image'
      }
    }],
    nsfw: {
      type: Boolean,
      default: false
    },
    modelUrl: String,
    fetchedAt: Date,
    error: String
  },
  provider: {
    found: {
      type: Boolean,
      default: false
    },
    id: String,
    name: String,
    description: String,
    capabilities: [String],
    contextWindow: Number,
    fetchedAt: Date,
    error: String
  }
}, { _id: false });

const serverModelCacheSchema = new mongoose.Schema({
  serverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server',
    required: true,
    unique: true
  },
  serverUrl: {
    type: String,
    required: true
  },
  models: [modelItemSchema],
  status: {
    type: String,
    enum: ['idle', 'fetching', 'completed', 'failed'],
    default: 'idle'
  },
  progress: {
    current: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    },
    stage: {
      type: String,
      enum: ['idle', 'checking_node', 'fetching_list', 'fetching_metadata', 'completed', 'failed'],
      default: 'idle'
    }
  },
  hashNodeAvailable: {
    type: Boolean,
    default: false
  },
  lastFetched: {
    type: Date,
    default: null
  },
  lastMetadataSync: {
    type: Date,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

serverModelCacheSchema.index({ serverId: 1 });
serverModelCacheSchema.index({ serverUrl: 1 });

serverModelCacheSchema.statics.findOrCreateByServerId = async function(serverId, serverUrl) {
  let cache = await this.findOne({ serverId });
  if (!cache) {
    cache = new this({
      serverId,
      serverUrl,
      models: [],
      status: 'idle'
    });
    await cache.save();
  }
  return cache;
};

serverModelCacheSchema.methods.updateProgress = async function(current, total, stage) {
  this.progress = { current, total, stage };
  return this.save();
};

serverModelCacheSchema.methods.startSync = async function() {
  this.status = 'fetching';
  this.progress = { current: 0, total: 0, stage: 'fetching_list' };
  this.errorMessage = null;
  return this.save();
};

serverModelCacheSchema.methods.completeSync = async function() {
  this.status = 'completed';
  this.progress.stage = 'completed';
  this.lastFetched = new Date();
  return this.save();
};

serverModelCacheSchema.methods.failSync = async function(errorMessage) {
  this.status = 'failed';
  this.progress.stage = 'failed';
  this.errorMessage = errorMessage;
  return this.save();
};

serverModelCacheSchema.methods.findModelByFilename = function(filename) {
  return this.models.find(model => model.filename === filename);
};

module.exports = mongoose.model('ServerModelCache', serverModelCacheSchema);
