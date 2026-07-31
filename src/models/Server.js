const mongoose = require('mongoose');
const { SERVER_TYPES_WITH_DEPRECATED, getServerTypeSpec } = require('../constants/serverTypes');

const serverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  serverType: {
    type: String,
    // deprecated 타입('GPT Image' 등)도 포함 — stale 문서가 있어도 Mongoose 검증 실패가 안 나도록 함.
    // 타입 목록의 단일 source 는 constants/serverTypes.js (#745).
    enum: SERVER_TYPES_WITH_DEPRECATED,
    required: true
  },
  serverUrl: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        // URL 형식 검증
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      },
      message: '올바른 URL 형식이 아닙니다.'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  configuration: {
    apiKey: String,
    timeout: {
      type: Number,
      default: 300000 // 5분
    }
  },
  // 헬스체크 정보
  healthCheck: {
    lastChecked: Date,
    status: {
      type: String,
      enum: ['healthy', 'unhealthy', 'unknown'],
      default: 'unknown'
    },
    responseTime: Number, // ms
    errorMessage: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// 인덱스 설정
serverSchema.index({ serverType: 1, outputType: 1 });
serverSchema.index({ isActive: 1 });

// 서버 헬스체크 메서드
serverSchema.methods.checkHealth = async function() {
  const axios = require('axios');
  const startTime = Date.now();
  
  try {
    let timeout = this.configuration?.timeout || 30000;

    // 서버 타입별 헬스체크 엔드포인트 — spec 은 constants/serverTypes.js 단일 source (#745)
    const spec = getServerTypeSpec(this.serverType);
    const healthEndpoint = spec?.healthCheck?.path
      ? `${this.serverUrl}${spec.healthCheck.path}`
      : this.serverUrl;

    // at-rest 암호화된 apiKey 복호화 (#594)
    const { decryptSecret } = require('../utils/secretCrypto');
    const apiKey = decryptSecret(this.configuration?.apiKey);

    const requestConfig = {
      timeout: Math.min(timeout, 10000), // 최대 10초
      headers: apiKey ? {
        'Authorization': `Bearer ${apiKey}`
      } : {}
    };

    if (spec?.healthCheck?.auth === 'query-key' && apiKey) {
      requestConfig.params = { key: apiKey };
      requestConfig.headers = {};
    }

    const response = await axios.get(healthEndpoint, requestConfig);
    
    const responseTime = Date.now() - startTime;
    
    this.healthCheck = {
      lastChecked: new Date(),
      status: response.status === 200 ? 'healthy' : 'unhealthy',
      responseTime,
      errorMessage: null
    };
    
    return await this.save();
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    this.healthCheck = {
      lastChecked: new Date(),
      status: 'unhealthy',
      responseTime,
      errorMessage: error.message
    };
    
    return await this.save();
  }
};

// 활성화된 서버만 조회하는 static method
serverSchema.statics.findActive = function(filter = {}) {
  return this.find({ ...filter, isActive: true });
};

// 서버 타입별 조회 static method
serverSchema.statics.findByType = function(serverType, outputType = null) {
  const filter = { serverType, isActive: true };
  if (outputType) {
    filter.outputType = outputType;
  }
  return this.find(filter);
};

module.exports = mongoose.model('Server', serverSchema);
