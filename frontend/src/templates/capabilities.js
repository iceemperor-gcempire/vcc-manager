// generated — 수정 금지. source: src/constants/serverTypes.js (#745)
// 재생성: node scripts/sync-server-type-mirrors.js
// 이 파일은 backend 단일 source 의 mirror 이며, 동기화는 serverTypesMirror.test.js 가 검증한다.

// 서버 등록을 허용하는 활성 serverType 목록
export const SERVER_TYPES = [
  "ComfyUI",
  "OpenAI",
  "OpenAI Compatible",
  "Gemini",
  "d-ice-all"
];

// 각 server type 이 지원하는 outputFormat 목록.
// frontend/src/templates/index.js 의 TEMPLATES 키와 일치해야 함 (테스트로 검증).
export const CAPABILITIES = {
  "ComfyUI": [
    "image",
    "video"
  ],
  "OpenAI": [
    "image",
    "text"
  ],
  "OpenAI Compatible": [
    "text"
  ],
  "Gemini": [
    "image",
    "text"
  ],
  "d-ice-all": [
    "image"
  ]
};

const OUTPUT_FORMAT_LABELS = {
  image: '이미지',
  video: '비디오',
  text: '텍스트',
};

const SERVER_TYPE_LABELS = {
  "ComfyUI": "ComfyUI",
  "OpenAI": "OpenAI",
  "OpenAI Compatible": "OpenAI Compatible",
  "Gemini": "Gemini",
  "d-ice-all": "d-ice-all"
};

// serverType 별 distinct hex. brand-친화적 색상 사용 (시맨틱 컬러와 분리).
// chip 은 클릭/disabled 처리 없는 표시용이라 hover state 미고려.
// (CLAUDE.md hex 리터럴 금지 규칙의 문서화된 예외)
const SERVER_TYPE_COLORS = {
  "ComfyUI": "#7e57c2",
  "OpenAI": "#10a37f",
  "OpenAI Compatible": "#607d8b",
  "Gemini": "#4285f4",
  "d-ice-all": "#00acc1"
};

// 공식 base URL 이 알려진 provider — 서버 추가 시 자동 입력 (사용자 입력 우선)
export const KNOWN_SERVER_URLS = {
  "OpenAI": "https://api.openai.com",
  "Gemini": "https://generativelanguage.googleapis.com"
};

// 서버 카드 아이콘 키 — MUI 컴포넌트 매핑은 소비처(ServerManagement)에서 수행
const SERVER_TYPE_ICON_KEYS = {
  "ComfyUI": "computer",
  "OpenAI": "text",
  "OpenAI Compatible": "text",
  "Gemini": "storage",
  "d-ice-all": "storage"
};

// deprecated 타입 표시 메타 (stale 데이터 렌더용 — 신규 생성 불가)
export const DEPRECATED_SERVER_TYPES = {
  "GPT Image": {
    "label": "GPT Image",
    "icon": "text"
  }
};

// 모델 목록 동기화 지원 타입 / LoRA(checkpoint 기반) 지원 타입
export const MODEL_SYNC_SERVER_TYPES = [
  "ComfyUI",
  "OpenAI",
  "OpenAI Compatible",
  "Gemini"
];
export const LORA_SERVER_TYPES = [
  "ComfyUI"
];

export function getCapableOutputFormats(serverType) {
  return CAPABILITIES[serverType] || [];
}

export function getOutputFormatLabel(outputFormat) {
  return OUTPUT_FORMAT_LABELS[outputFormat] || outputFormat;
}

export function getServerTypeLabel(serverType) {
  return SERVER_TYPE_LABELS[serverType] || serverType;
}

export function getServerTypeColor(serverType) {
  return SERVER_TYPE_COLORS[serverType] || '#9e9e9e';
}

export function getServerTypeIconKey(serverType) {
  return (
    SERVER_TYPE_ICON_KEYS[serverType] ||
    DEPRECATED_SERVER_TYPES[serverType]?.icon ||
    'storage'
  );
}
