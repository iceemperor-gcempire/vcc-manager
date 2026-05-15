// 작업판 필드 role 정의 (#199 작업판 풀 커스텀화)
//
// 작업판의 입력 필드 (additionalInputFields) 가 어떤 의미로 서비스 코드에 사용되는지를
// 명시하는 메타데이터. 서비스 코드는 필드 이름 (e.g. inputData.aiModel) 대신 role 로
// 필드를 찾아 의미적 분리를 달성한다 — 작업판마다 같은 의미를 다른 필드명으로 사용 가능.
//
// 호환성: 모든 role 은 optional. role 이 지정되지 않은 필드는 단순 사용자 입력으로 처리.
// 한 작업판 안에서 같은 role 을 갖는 필드는 0개 또는 1개여야 함 (소프트 컨벤션 — 첫 매치 우선).

const FIELD_ROLES = Object.freeze({
  MODEL: 'model',                                  // AI 모델 식별자 (filename or model id)
  PROMPT: 'prompt',                                // 주 prompt
  NEGATIVE_PROMPT: 'negativePrompt',               // negative prompt (image gen)
  SYSTEM_PROMPT: 'systemPrompt',                   // system prompt (text gen)
  IMAGE_SIZE: 'imageSize',                         // 이미지 크기 / aspect ratio
  SEED: 'seed',                                    // random seed
  TEMPERATURE: 'temperature',                      // sampling temperature
  MAX_TOKENS: 'maxTokens',                         // 토큰 상한 (text gen)
  LORA: 'lora',                                    // LoRA 선택 (ComfyUI)
  REFERENCE_IMAGE: 'referenceImage',               // 참조 이미지 input
  REFERENCE_IMAGE_METHOD: 'referenceImageMethod',  // 참조 이미지 처리 방식
  STYLE_PRESET: 'stylePreset',                     // 스타일 프리셋
  UPSCALE_METHOD: 'upscaleMethod'                  // 업스케일 방식
});

const FIELD_ROLE_VALUES = Object.freeze(Object.values(FIELD_ROLES));

// role → 한국어 라벨 (admin UI 표시용)
const FIELD_ROLE_LABELS = Object.freeze({
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

// 기존 baseInputFields well-known 키 → role 매핑 (Phase B 마이그레이션에서 사용)
const LEGACY_BASE_FIELD_TO_ROLE = Object.freeze({
  aiModel: FIELD_ROLES.MODEL,
  imageSizes: FIELD_ROLES.IMAGE_SIZE,
  referenceImageMethods: FIELD_ROLES.REFERENCE_IMAGE_METHOD,
  stylePresets: FIELD_ROLES.STYLE_PRESET,
  upscaleMethods: FIELD_ROLES.UPSCALE_METHOD,
  systemPrompt: FIELD_ROLES.SYSTEM_PROMPT,
  referenceImages: FIELD_ROLES.REFERENCE_IMAGE,
  temperature: FIELD_ROLES.TEMPERATURE,
  maxTokens: FIELD_ROLES.MAX_TOKENS
});

// well-known 필드 이름 → role 매핑 — snake_case 단일 컨벤션 (v2.1.1+).
// 서비스 코드 fallback 에서 customField 이름이 well-known 인 경우 자동으로 role 인식.
// LEGACY_BASE_FIELD_TO_ROLE 는 마이그레이션 전용으로 분리 — 신규 런타임 lookup 에는 미사용.
const WELL_KNOWN_FIELD_NAME_TO_ROLE = Object.freeze({
  prompt: FIELD_ROLES.PROMPT,
  negative_prompt: FIELD_ROLES.NEGATIVE_PROMPT,
  base_model: FIELD_ROLES.MODEL,
  system_prompt: FIELD_ROLES.SYSTEM_PROMPT,
  image_size: FIELD_ROLES.IMAGE_SIZE,
  seed: FIELD_ROLES.SEED,
  temperature: FIELD_ROLES.TEMPERATURE,
  max_tokens: FIELD_ROLES.MAX_TOKENS,
  reference_image: FIELD_ROLES.REFERENCE_IMAGE,
  reference_image_method: FIELD_ROLES.REFERENCE_IMAGE_METHOD,
  style_preset: FIELD_ROLES.STYLE_PRESET,
  upscale_method: FIELD_ROLES.UPSCALE_METHOD
});

module.exports = {
  FIELD_ROLES,
  FIELD_ROLE_VALUES,
  FIELD_ROLE_LABELS,
  LEGACY_BASE_FIELD_TO_ROLE,
  WELL_KNOWN_FIELD_NAME_TO_ROLE
};
