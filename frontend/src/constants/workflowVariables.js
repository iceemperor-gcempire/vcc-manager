// ComfyUI 워크플로우 placeholder 메타데이터 — backend (src/constants/workflowVariables.js) 의 mirror.
// frontend 가 backend 디렉토리를 직접 import 못 해서 수동 동기화. 신규 placeholder 추가 시
// 양쪽 파일 + src/services/queueService.js 의 replacements 빌드 부분 모두 갱신.

export const BUILTIN_WORKFLOW_VARIABLES = Object.freeze([
  // 기본
  { key: '{{##prompt##}}', label: '프롬프트', valueType: 'string', category: 'basic' },
  { key: '{{##negative_prompt##}}', label: '네거티브 프롬프트', valueType: 'string', category: 'basic' },
  { key: '{{##base_model##}}', label: '베이스 모델 (filename / model id)', valueType: 'string', category: 'basic' },
  { key: '{{##width##}}', label: '이미지 너비', valueType: 'number', category: 'basic' },
  { key: '{{##height##}}', label: '이미지 높이', valueType: 'number', category: 'basic' },
  { key: '{{##seed##}}', label: '시드값 (64비트 UInt)', valueType: 'number', category: 'basic' },

  // 추가
  { key: '{{##reference_method##}}', label: '참조 이미지 방식', valueType: 'string', category: 'extra' },
  { key: '{{##upscale_method##}}', label: '업스케일 방식', valueType: 'string', category: 'extra' },
  { key: '{{##base_style##}}', label: '기본 스타일', valueType: 'string', category: 'extra' },
  { key: '{{##user_id##}}', label: '사용자 ID 해시 (8자리)', valueType: 'string', category: 'extra' }
]);

export const WORKFLOW_VARIABLE_CATEGORIES = Object.freeze({
  basic: '기본 변수',
  extra: '추가 기능'
});

const VALUE_TYPE_LABELS = {
  string: '문자열',
  number: '숫자',
  boolean: '체크박스',
  select: '선택',
  image: '이미지',
  baseModel: '베이스 모델',
  lora: 'LoRA'
};

export function formatValueType(valueType, defaultValue) {
  const base = VALUE_TYPE_LABELS[valueType] || valueType;
  return defaultValue !== undefined ? `${base}, 기본값: ${defaultValue}` : base;
}
