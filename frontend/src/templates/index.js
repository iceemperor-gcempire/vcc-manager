// 신규 작업판 생성 시 사용되는 (serverType, outputFormat) 별 기본 템플릿.
// 각 JSON 파일은 { baseInputFields, additionalInputFields, workflowData } 구조.
// 신규 provider/capability 추가 시 새 JSON 파일을 만들고 아래 TEMPLATES 에 등록.
//
// 같은 조합에 템플릿이 여럿이면 배열로 등록하고 만들기 화면이 고르게 한다 (#1142). 첫 항목이 기본.
// 배포용 판 파일에서 만든 템플릿(_template 메타가 있는 것)은 손으로 고치지 않는다 —
// 판 파일을 고친 뒤 `node scripts/sync-workboard-templates.js` 로 다시 만든다.

import comfyImage from './ComfyUI-image.json';
import comfyVideo from './ComfyUI-video.json';
import comfyAudio from './ComfyUI-audio.json';
import openAIImage from './OpenAI-image.json';
import openAIImage26 from './OpenAI-image-gpt-image-2.6.json';
import openAIImage26Gif from './OpenAI-image-gpt-image-2.6-gif.json';
import openAIText from './OpenAI-text.json';
import geminiImage from './Gemini-image.json';
import geminiText from './Gemini-text.json';
import openAICompatibleText from './OpenAI Compatible-text.json';
import dIceAllImage from './d-ice-all-image.json';

const TEMPLATES = {
  'ComfyUI:image': comfyImage,
  'ComfyUI:video': comfyVideo,
  'ComfyUI:audio': comfyAudio,
  'OpenAI:image': [openAIImage, openAIImage26, openAIImage26Gif],
  'OpenAI:text': openAIText,
  'Gemini:image': geminiImage,
  'Gemini:text': geminiText,
  'OpenAI Compatible:text': openAICompatibleText,
  'd-ice-all:image': dIceAllImage,
};

// 매핑이 없을 때 사용하는 빈 폴백 (Workboard 가 항상 baseInputFields/additionalInputFields 를 갖도록 보장).
const EMPTY_TEMPLATE = {
  baseInputFields: {},
  additionalInputFields: [],
  workflowData: '',
};

function variantsOf(serverType, outputFormat) {
  const entry = TEMPLATES[`${serverType}:${outputFormat}`];
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

// 만들기 화면의 템플릿 고르기 목록. 하나뿐인 조합은 화면이 고르기 칸을 그리지 않는다
export function getWorkboardTemplateOptions(serverType, outputFormat) {
  return variantsOf(serverType, outputFormat).map((t, i) => ({
    id: t._template?.id || `template-${i}`,
    label: t._template?.label || '기본',
  }));
}

// templateId 가 없거나 목록에 없으면 첫 템플릿. 생성 메타(_template)는 떼고 돌려준다 — 작업판 데이터가 아니다
export function getWorkboardTemplate(serverType, outputFormat, templateId) {
  const variants = variantsOf(serverType, outputFormat);
  const options = getWorkboardTemplateOptions(serverType, outputFormat);
  const index = Math.max(0, options.findIndex((o) => o.id === templateId));
  const picked = variants[index];
  if (!picked) return EMPTY_TEMPLATE;
  const { _template, ...template } = picked;
  return template;
}

export { TEMPLATES };
