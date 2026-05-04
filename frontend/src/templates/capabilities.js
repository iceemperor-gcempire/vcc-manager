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
  'GPT Image': 'GPT Image (deprecated)',
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

// MUI Chip color 매핑. 4개 serverType 이 distinct 한 색을 갖도록.
const SERVER_TYPE_COLORS = {
  ComfyUI: 'primary',
  OpenAI: 'error',
  'OpenAI Compatible': 'success',
  Gemini: 'warning',
  'GPT Image': 'default',
};

export function getServerTypeColor(serverType) {
  return SERVER_TYPE_COLORS[serverType] || 'default';
}

// (server, outputFormat) → workboard schema 의 apiFormat 으로 매핑.
// Phase 6 에서 apiFormat 필드가 제거되면 이 매핑도 함께 사라짐.
const SERVER_OUTPUT_TO_LEGACY_APIFORMAT = {
  'ComfyUI:image': 'ComfyUI',
  'ComfyUI:video': 'ComfyUI',
  'OpenAI:image': 'GPT Image',
  'OpenAI:text': 'OpenAI Compatible',
  'OpenAI Compatible:image': 'GPT Image',
  'OpenAI Compatible:text': 'OpenAI Compatible',
  'Gemini:image': 'Gemini',
  'Gemini:text': 'Gemini',
};

export function deriveLegacyApiFormat(serverType, outputFormat) {
  return SERVER_OUTPUT_TO_LEGACY_APIFORMAT[`${serverType}:${outputFormat}`] || 'ComfyUI';
}
