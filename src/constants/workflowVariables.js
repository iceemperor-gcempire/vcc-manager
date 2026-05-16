// ComfyUI 워크플로우 placeholder 메타데이터.
//
// queueService 가 빌드하는 \`replacements\` 맵의 키 (placeholder) 와 frontend 의 \"사용 가능한 워크플로우 변수\"
// 표시 목록 단일 진실. 신규 placeholder 추가 시 여기 + queueService 의 replacements 빌드 + frontend mirror
// (frontend/src/constants/workflowVariables.js) 모두 갱신.

const BUILTIN_WORKFLOW_VARIABLES = Object.freeze([
  { key: '{{##prompt##}}', label: '프롬프트', valueType: 'string', category: 'basic' },
  { key: '{{##negative_prompt##}}', label: '네거티브 프롬프트', valueType: 'string', category: 'basic' },
  { key: '{{##base_model##}}', label: '베이스 모델 (filename / model id)', valueType: 'string', category: 'basic' },
  { key: '{{##width##}}', label: '이미지 너비', valueType: 'number', category: 'basic', note: 'image_size 의 \"WxH\" 값에서 자동 추출 (기본 512)' },
  { key: '{{##height##}}', label: '이미지 높이', valueType: 'number', category: 'basic', note: 'image_size 의 \"WxH\" 값에서 자동 추출 (기본 512)' },
  { key: '{{##seed##}}', label: '시드값 (64비트 UInt)', valueType: 'number', category: 'basic' },
  { key: '{{##user_id##}}', label: '사용자 ID 해시 (8자리)', valueType: 'string', category: 'basic', note: '시스템 제공 — 사용자 _id 의 SHA-256 8자리' }
]);

const WORKFLOW_VARIABLE_KEYS = Object.freeze(BUILTIN_WORKFLOW_VARIABLES.map((v) => v.key));

const WORKFLOW_VARIABLE_CATEGORIES = Object.freeze({
  basic: '기본 변수'
});

module.exports = {
  BUILTIN_WORKFLOW_VARIABLES,
  WORKFLOW_VARIABLE_KEYS,
  WORKFLOW_VARIABLE_CATEGORIES
};
