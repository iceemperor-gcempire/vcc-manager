const mongoose = require('mongoose');

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
    enum: ['ComfyUI', 'OpenAI Compatible'],
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
  outputType: {
    type: String,
    enum: ['Image', 'Text'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // 서버별 추가 설정
  configuration: {
    // ComfyUI 서버 설정
    apiKey: String,
    timeout: {
      type: Number,
      default: 300000 // 5분
    },
    maxRetries: {
      type: Number,
      default: 3
    },
    
    // OpenAI Compatible 서버 설정
    model: String,
    temperature: Number,
    maxTokens: Number
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
    let healthEndpoint;
    let timeout = this.configuration?.timeout || 30000;
    
    // 서버 타입별 헬스체크 엔드포인트
    switch (this.serverType) {
      case 'ComfyUI':
        healthEndpoint = `${this.serverUrl}/system_stats`;
        break;
      case 'OpenAI Compatible':
        healthEndpoint = `${this.serverUrl}/v1/models`;
        break;
      default:
        healthEndpoint = this.serverUrl;
    }
    
    const response = await axios.get(healthEndpoint, {
      timeout: Math.min(timeout, 10000), // 최대 10초
      headers: this.configuration?.apiKey ? {
        'Authorization': `Bearer ${this.configuration.apiKey}`
      } : {}
    });
    
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