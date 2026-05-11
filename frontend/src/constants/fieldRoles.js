// Frontend mirror of src/constants/fieldRoles.js (#199).
// Backend / frontend 가 별도 패키지라 require 공유 불가 — 수동 동기화.
// role 추가 / 변경 시 양쪽 파일 모두 업데이트 필요.

export const FIELD_ROLES = Object.freeze({
  MODEL: 'model',
  PROMPT: 'prompt',
  NEGATIVE_PROMPT: 'negativePrompt',
  SYSTEM_PROMPT: 'systemPrompt',
  IMAGE_SIZE: 'imageSize',
  SEED: 'seed',
  TEMPERATURE: 'temperature',
  MAX_TOKENS: 'maxTokens',
  LORA: 'lora',
  REFERENCE_IMAGE: 'referenceImage',
  REFERENCE_IMAGE_METHOD: 'referenceImageMethod',
  STYLE_PRESET: 'stylePreset',
  UPSCALE_METHOD: 'upscaleMethod'
});

export const FIELD_ROLE_VALUES = Object.freeze(Object.values(FIELD_ROLES));

export const FIELD_ROLE_LABELS = Object.freeze({
  [FIELD_ROLES.MODEL]: '모델',
  [FIELD_ROLES.PROMPT]: '프롬프트',
  [FIELD_ROLES.NEGATIVE_PROMPT]: '네거티브 프롬프트',
  [FIELD_ROLES.SYSTEM_PROMPT]: '시스템 프롬프트',
  [FIELD_ROLES.IMAGE_SIZE]: '이미지 크기',
  [FIELD_ROLES.SEED]: '시드',
  [FIELD_ROLES.TEMPERATURE]: 'Temperature',
  [FIELD_ROLES.MAX_TOKENS]: 'Max Tokens',
  [FIELD_ROLES.LORA]: 'LoRA',
  [FIELD_ROLES.REFERENCE_IMAGE]: '참조 이미지',
  [FIELD_ROLES.REFERENCE_IMAGE_METHOD]: '참조 이미지 처리 방식',
  [FIELD_ROLES.STYLE_PRESET]: '스타일 프리셋',
  [FIELD_ROLES.UPSCALE_METHOD]: '업스케일 방식'
});
