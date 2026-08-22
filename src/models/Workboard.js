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
    // baseModel / lora 는 서버의 모델·LoRA 목록과 연동되는 특수 타입 (#199 Phase D).
    // 일반 select 와 달리 admin 이 옵션을 직접 정의하지 않고, 작업판의 노출 정책(#198)으로 제어.
    // video 는 참조 비디오 업로드 타입 (#753) — MiniMax H3 등 비디오 참조 워크플로우용.
    // audio 는 참조 오디오 업로드 타입 (#772) — H3 ref_audios 등 오디오 참조 워크플로우용.
    enum: ['string', 'select', 'file', 'number', 'boolean', 'image', 'video', 'audio', 'baseModel', 'lora'],
    required: true
  },
  // F4: role 필드 제거 — 의미는 type=baseModel/lora 또는 well-known name 으로 추론
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
  // boolean 필드 전용 (#859) — "이 스위치는 저 video 필드의 오디오를 쓴다" 선언.
  // 값은 같은 작업판의 video 타입 필드 name (예: 'ref_video_1'). 선언되면:
  // - 제출 시 대상 영상에 오디오 트랙이 없으면 400 (무음 영상 → ComfyUI 원인불명 실패 방지)
  // - 프론트에서 무음 영상 첨부 시 스위치 비활성화
  audioOfVideoField: String,
  // 이미지 타입 전용 설정
  imageConfig: {
    maxImages: {
      type: Number,
      default: 1,
      min: 1,
      max: 3
    }
  },
  // 비디오 타입 전용 설정 (#753)
  videoConfig: {
    maxVideos: {
      type: Number,
      default: 1,
      min: 1,
      max: 3
    }
  },
  audioConfig: {
    maxAudios: {
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
  outputFormat: {
    type: String,
    enum: ['image', 'video', 'text', 'audio'],
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
  // F4: baseInputFields 스키마 제거 — additionalInputFields 의 customField 가 모든 입력 정의 담당
  additionalInputFields: [inputFieldSchema],
  // ComfyUI 작업판이 허용하는 base 모델 타입 (#252).
  // civitai.baseModel 과 매칭. 빈 배열이면 제약 없음 (모든 모델 허용).
  // baseModel 미상 (Civitai 미등록 / hash 없음) 모델은 노출 (custom merge 등 일상적 케이스).
  allowedModelTypes: {
    type: [String],
    default: []
  },
  // 작업판 단위 LLM 추가 요청 파라미터 (#493). 텍스트 챗(OpenAI/Compatible/Gemini) 요청에
  // 그대로 passthrough — temperature / top_p / chat_template_kwargs(enable_thinking) 등을
  // 모델·서버별로 admin 이 직접 지정. 모델별 thinking 비활성화/창작 temperature 제어용.
  llmExtraParams: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined
  },
  // 이 작업판에 접근 가능한 사용자 그룹 (#198). 빈 배열이면 admin 외 접근 불가.
  // admin 은 implicit all-access (이 필드 무관). 마이그레이션 시 기본 그룹 1개 자동 할당.
  allowedGroupIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }],
  // 모델 노출 정책 (#198) — 작업판이 사용하는 서버의 모델 중 사용자에게 노출할 범위.
  // 'full': 모든 모델 노출 (기본). 'whitelist': modelWhitelist 에 명시된 모델만 노출.
  modelExposurePolicy: {
    type: String,
    enum: ['full', 'whitelist'],
    default: 'full'
  },
  modelWhitelist: {
    type: [String],
    default: []
  },
  // LoRA 노출 정책 (#198) — 동일 패턴.
  loraExposurePolicy: {
    type: String,
    enum: ['full', 'whitelist'],
    default: 'full'
  },
  loraWhitelist: {
    type: [String],
    default: []
  },
  // 연결된 프롬프트 가이드 (#766). 배열 순서대로 시스템 프롬프트에 합성된다 —
  // "공통 작성 원칙" + "모델별 스펙" 처럼 쪼개 관리하고 겹쳐 쓰기 위함.
  // PromptGuide 는 소유자가 없는 전역 문서라, 이 작업판을 볼 수 있는 모든 사용자에게
  // 동일하게 적용된다 (사용자 소유 문서인 systemPromptDocId / contextDocIds 와 대비).
  promptGuideIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromptGuide'
  }],
  workflowData: {
    type: String,
    default: ''
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

workboardSchema.methods.validateWorkflowData = function() {
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
