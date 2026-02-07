const mongoose = require('mongoose');

// LoRA 모델 개별 아이템 스키마
const loraModelItemSchema = new mongoose.Schema({
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
  }
}, { _id: false });

const serverLoraCacheSchema = new mongoose.Schema({
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
  loraModels: [loraModelItemSchema],
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
  loraInfoNodeAvailable: {
    type: Boolean,
    default: false
  },
  lastFetched: {
    type: Date,
    default: null
  },
  lastCivitaiSync: {
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

// 인덱스 설정
serverLoraCacheSchema.index({ serverId: 1 });
serverLoraCacheSchema.index({ serverUrl: 1 });

// 정적 메서드: 서버 ID로 캐시 조회 또는 생성
serverLoraCacheSchema.statics.findOrCreateByServerId = async function(serverId, serverUrl) {
  let cache = await this.findOne({ serverId });
  if (!cache) {
    cache = new this({
      serverId,
      serverUrl,
      loraModels: [],
      status: 'idle'
    });
    await cache.save();
  }
  return cache;
};

// 인스턴스 메서드: 동기화 진행 상태 업데이트
serverLoraCacheSchema.methods.updateProgress = async function(current, total, stage) {
  this.progress = { current, total, stage };
  return this.save();
};

// 인스턴스 메서드: 동기화 시작
serverLoraCacheSchema.methods.startSync = async function() {
  this.status = 'fetching';
  this.progress = { current: 0, total: 0, stage: 'fetching_list' };
  this.errorMessage = null;
  return this.save();
};

// 인스턴스 메서드: 동기화 완료
serverLoraCacheSchema.methods.completeSync = async function() {
  this.status = 'completed';
  this.progress.stage = 'completed';
  this.lastFetched = new Date();
  return this.save();
};

// 인스턴스 메서드: 동기화 실패
serverLoraCacheSchema.methods.failSync = async function(errorMessage) {
  this.status = 'failed';
  this.progress.stage = 'failed';
  this.errorMessage = errorMessage;
  return this.save();
};

// 인스턴스 메서드: LoRA 모델 파일명으로 찾기
serverLoraCacheSchema.methods.findLoraByFilename = function(filename) {
  return this.loraModels.find(lora => lora.filename === filename);
};

module.exports = mongoose.model('ServerLoraCache', serverLoraCacheSchema);
