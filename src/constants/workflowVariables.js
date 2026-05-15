// ComfyUI 워크플로우 placeholder 메타데이터.
//
// queueService 가 빌드하는 \`replacements\` 맵의 키 (placeholder) 와 frontend 의 \"사용 가능한 워크플로우 변수\"
// 표시 목록 단일 진실. 신규 placeholder 추가 시 여기 + queueService 의 replacements 빌드 + frontend mirror
// (frontend/src/constants/workflowVariables.js) 모두 갱신.

const BUILTIN_WORKFLOW_VARIABLES = Object.freeze([
  // 기본
  { key: '{{##prompt##}}', label: '프롬프트', valueType: 'string', category: 'basic' },
  { key: '{{##negative_prompt##}}', label: '네거티브 프롬프트', valueType: 'string', category: 'basic' },
  { key: '{{##base_model##}}', label: '베이스 모델 (filename / model id)', valueType: 'string', category: 'basic' },
  { key: '{{##width##}}', label: '이미지 너비', valueType: 'number', category: 'basic' },
  { key: '{{##height##}}', label: '이미지 높이', valueType: 'number', category: 'basic' },
  { key: '{{##seed##}}', label: '시드값 (64비트 UInt)', valueType: 'number', category: 'basic' },

  // 샘플링 (additionalParams 에서 가져옴, 기본값 있음)
  { key: '{{##steps##}}', label: '스텝 수', valueType: 'number', category: 'sampling', defaultValue: 20 },
  { key: '{{##cfg##}}', label: 'CFG 스케일', valueType: 'number', category: 'sampling', defaultValue: 7 },
  { key: '{{##sampler##}}', label: '샘플러', valueType: 'string', category: 'sampling', defaultValue: 'euler' },
  { key: '{{##scheduler##}}', label: '스케줄러', valueType: 'string', category: 'sampling', defaultValue: 'normal' },

  // 추가
  { key: '{{##reference_method##}}', label: '참조 이미지 방식', valueType: 'string', category: 'extra' },
  { key: '{{##upscale_method##}}', label: '업스케일 방식', valueType: 'string', category: 'extra' },
  { key: '{{##base_style##}}', label: '기본 스타일', valueType: 'string', category: 'extra' },
  { key: '{{##user_id##}}', label: '사용자 ID 해시 (8자리)', valueType: 'string', category: 'extra' }
]);

const WORKFLOW_VARIABLE_KEYS = Object.freeze(BUILTIN_WORKFLOW_VARIABLES.map((v) => v.key));

const WORKFLOW_VARIABLE_CATEGORIES = Object.freeze({
  basic: '기본 변수',
  sampling: '샘플링 파라미터',
  extra: '추가 기능'
});

module.exports = {
  BUILTIN_WORKFLOW_VARIABLES,
  WORKFLOW_VARIABLE_KEYS,
  WORKFLOW_VARIABLE_CATEGORIES
};
