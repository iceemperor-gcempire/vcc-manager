// 신규 작업판 생성 시 사용되는 (serverType, outputFormat) 별 기본 템플릿.
// 각 JSON 파일은 { baseInputFields, additionalInputFields, workflowData } 구조.
// 신규 provider/capability 추가 시 새 JSON 파일을 만들고 아래 TEMPLATES 에 등록.

import comfyImage from './ComfyUI-image.json';
import comfyVideo from './ComfyUI-video.json';
import openAIImage from './OpenAI-image.json';
import geminiImage from './Gemini-image.json';
import openAICompatibleText from './OpenAI Compatible-text.json';

const TEMPLATES = {
  'ComfyUI:image': comfyImage,
  'ComfyUI:video': comfyVideo,
  'OpenAI:image': openAIImage,
  'Gemini:image': geminiImage,
  'OpenAI Compatible:text': openAICompatibleText,
};

// 매핑이 없을 때 사용하는 빈 폴백 (Workboard 가 항상 baseInputFields/additionalInputFields 를 갖도록 보장).
const EMPTY_TEMPLATE = {
  baseInputFields: {},
  additionalInputFields: [],
  workflowData: '',
};

export function getWorkboardTemplate(serverType, outputFormat) {
  return TEMPLATES[`${serverType}:${outputFormat}`] || EMPTY_TEMPLATE;
}

export { TEMPLATES };
