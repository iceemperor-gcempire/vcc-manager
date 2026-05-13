// 각 server type 이 지원하는 outputFormat 목록.
// frontend/src/templates/index.js 의 TEMPLATES 키와 일치해야 함.
// 새 (serverType, outputFormat) 조합 지원 시 여기와 templates 양쪽을 함께 갱신.

export const CAPABILITIES = {
  ComfyUI: ['image', 'video'],
  OpenAI: ['image', 'text'],
  'OpenAI Compatible': ['text'],
  Gemini: ['image', 'text'],
};

const OUTPUT_FORMAT_LABELS = {
  image: '이미지',
  video: '비디오',
  text: '텍스트',
};

const SERVER_TYPE_LABELS = {
  ComfyUI: 'ComfyUI',
  OpenAI: 'OpenAI',
  'OpenAI Compatible': 'OpenAI Compatible',
  Gemini: 'Gemini',
};

export function getCapableOutputFormats(serverType) {
  return CAPABILITIES[serverType] || [];
}

export function getOutputFormatLabel(outputFormat) {
  return OUTPUT_FORMAT_LABELS[outputFormat] || outputFormat;
}

export function getServerTypeLabel(serverType) {
  return SERVER_TYPE_LABELS[serverType] || serverType;
}

// 4 serverType 별 distinct hex. brand-친화적 색상 사용 (시맨틱 컬러와 분리).
// chip 은 클릭/disabled 처리 없는 표시용이라 hover state 미고려.
const SERVER_TYPE_COLORS = {
  ComfyUI: '#7e57c2',          // 보라 — 서드파티/오픈소스 느낌
  OpenAI: '#10a37f',           // OpenAI brand teal
  'OpenAI Compatible': '#607d8b', // 회색-파랑 — 호환 레이어
  Gemini: '#4285f4',           // Google blue
};

export function getServerTypeColor(serverType) {
  return SERVER_TYPE_COLORS[serverType] || '#9e9e9e';
}
