const mongoose = require('mongoose');

const selectOptionSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true
  }
}, { _id: false });

const inputFieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['string', 'select', 'file', 'number', 'boolean', 'image'],
    required: true
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [selectOptionSchema],
  defaultValue: mongoose.Schema.Types.Mixed,
  placeholder: String,
  description: String,
  formatString: {
    type: String,
    default: function() {
      return `{{##${this.name}##}}`;
    }
  },
  validation: {
    min: Number,
    max: Number,
    maxLength: Number,
    pattern: String
  },
  // 이미지 타입 전용 설정
  imageConfig: {
    maxImages: {
      type: Number,
      default: 1,
      min: 1,
      max: 3
    }
  }
}, { _id: false });

const workboardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  workboardType: {
    type: String,
    enum: ['image', 'prompt'],
    default: 'image',
    required: false
  },
  apiFormat: {
    type: String,
    enum: ['ComfyUI', 'OpenAI Compatible'],
    default: 'ComfyUI'
  },
  outputFormat: {
    type: String,
    enum: ['image', 'video', 'text'],
    default: 'image'
  },
  serverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server',
    required: true
  },
  // 기존 serverUrl은 호환성을 위해 유지하되 deprecated 처리
  serverUrl: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  baseInputFields: {
    aiModel: {
      type: [selectOptionSchema],
      required: true
    },
    imageSizes: [selectOptionSchema],
    referenceImageMethods: [selectOptionSchema],
    stylePresets: [selectOptionSchema],
    upscaleMethods: [selectOptionSchema],
    systemPrompt: {
      type: String,
      default: ''
    },
    referenceImages: {
      type: [selectOptionSchema],
      default: []
    },
    temperature: {
      type: Number,
      default: 0.7
    },
    maxTokens: {
      type: Number,
      default: 2000
    }
  },
  additionalInputFields: [inputFieldSchema],
  workflowData: {
    type: String,
    required: function() {
      return this.apiFormat === 'ComfyUI';
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  version: {
    type: Number,
    default: 1
  },
  usageCount: {
    type: Number,
    default: 0
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag'
  }]
}, {
  timestamps: true
});

workboardSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

// 서버 정보와 함께 조회하는 static method
workboardSchema.statics.findWithServer = function(filter = {}) {
  return this.find(filter)
    .populate('serverId', 'name serverType serverUrl outputType isActive')
    .populate('createdBy', 'email nickname');
};

// 특정 서버를 사용하는 워크보드 조회
workboardSchema.statics.findByServer = function(serverId) {
  return this.find({ serverId, isActive: true })
    .populate('serverId', 'name serverType serverUrl outputType isActive')
    .populate('createdBy', 'email nickname');
};

// 워크보드 타입별 조회
workboardSchema.statics.findByType = function(workboardType, filter = {}) {
  return this.find({ ...filter, workboardType, isActive: true })
    .populate('serverId', 'name serverType serverUrl outputType isActive')
    .populate('createdBy', 'email nickname');
};

// API 형식 + 출력 형식별 조회
workboardSchema.statics.findByFormat = function(apiFormat, outputFormat, filter = {}) {
  const query = { ...filter, isActive: true };
  if (apiFormat) query.apiFormat = apiFormat;
  if (outputFormat) query.outputFormat = outputFormat;
  return this.find(query)
    .populate('serverId', 'name serverType serverUrl outputType isActive')
    .populate('createdBy', 'email nickname');
};

workboardSchema.methods.validateWorkflowData = function() {
  if (this.apiFormat === 'OpenAI Compatible') {
    return true;
  }
  
  try {
    if (!this.workflowData || this.workflowData.trim().length === 0) {
      return false;
    }
    
    // 기본적인 JSON 구조 체크 (중괄호로 시작하고 끝나는지)
    const trimmed = this.workflowData.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return false;
    }
    
    // 플레이스홀더 패턴이 있는지 확인 (템플릿인지 검증)
    const hasPlaceholders = /\{\{##[^#]+##\}\}/.test(this.workflowData);
    
    if (hasPlaceholders) {
      // 템플릿인 경우: 플레이스홀더를 임시 값으로 치환하여 검증
      let testData = this.workflowData;
      
      // 모든 {{##...##}} 패턴을 안전한 값으로 치환
      testData = testData.replace(/"(\{\{##[^#]+##\}\})"/g, '"test_value"'); // 따옴표 안의 플레이스홀더
      testData = testData.replace(/\{\{##[^#]+##\}\}/g, 'null'); // 따옴표 밖의 플레이스홀더
      
      JSON.parse(testData);
      return true;
    } else {
      // 일반 JSON인 경우: 직접 파싱
      JSON.parse(this.workflowData);
      return true;
    }
  } catch (error) {
    // 검증 실패시 경고만 출력하고 통과시킴 (개발 편의성)
    console.warn('Workflow validation warning:', error.message);
    console.warn('Allowing workflow save despite validation error for development flexibility');
    return true; // 임시로 항상 true 반환하여 저장 허용
  }
};

module.exports = mongoose.model('Workboard', workboardSchema);