/**
 * 텍스트 작업판 입력 만들기 (#1015) — /jobs/generate-prompt 의 inputData.
 *
 * 웹 화면처럼 작업판 필드의 기본값을 채운다. 백엔드는 기본값을 대신 채우지 않으므로,
 * 안 채우면 모델처럼 기본값이 있는 필수 필드를 호출자가 매번 다시 적어야 한다.
 * 이미지는 imageId 문자열 배열로 이미지 필드에 넣는다 (생성 경로의 { imageId } 와 형식이 다르다).
 */

const isModelField = (f) => f.type === 'baseModel' || f.name === 'base_model';

/**
 * @param {{ additionalInputFields?: object[] }} workboard
 * @param {{ prompt: string, imageIds?: string[], model?: string, additionalParams?: Record<string, unknown> }} input
 * @returns {Record<string, unknown>} inputData
 */
export function buildTextInputData(workboard, { prompt, imageIds = [], model, additionalParams = {} }) {
  const fields = workboard?.additionalInputFields || [];
  const inputData = { userPrompt: prompt };

  for (const f of fields) {
    if (f.type === 'image') continue;
    if (Object.prototype.hasOwnProperty.call(additionalParams, f.name)) {
      const val = additionalParams[f.name];
      const option = f.type === 'select'
        ? (f.options || []).find((o) => o.key === String(val) || o.value === String(val))
        : null;
      inputData[f.name] = option ? { key: option.key, value: option.value } : val;
    } else if (f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== '') {
      inputData[f.name] = f.defaultValue;
    }
  }

  if (model) {
    const modelField = fields.find(isModelField);
    if (!modelField) throw new Error('이 작업판에는 모델을 고르는 칸이 없습니다. model 을 빼고 다시 호출하세요.');
    inputData[modelField.name] = model;
  }

  const ids = (imageIds || []).filter(Boolean).map(String);
  if (ids.length > 0) {
    const imageField = fields.find((f) => f.type === 'image');
    if (!imageField) throw new Error('이 작업판은 이미지를 받지 않습니다. imageIds 를 빼고 다시 호출하세요.');
    const max = imageField.imageConfig?.maxImages || 1;
    if (ids.length > max) throw new Error(`이 작업판은 이미지를 최대 ${max}장까지 받습니다 (보낸 수 ${ids.length}).`);
    inputData[imageField.name] = ids;
  }

  const missing = fields
    .filter((f) => f.required && f.type !== 'image' && (inputData[f.name] === undefined || inputData[f.name] === ''))
    .map((f) => `${f.name} ("${f.label}")`);
  if (missing.length > 0) {
    throw new Error(`필수 입력이 비어 있습니다: ${missing.join(', ')}. additionalParams 로 넣어 주세요.`);
  }

  return inputData;
}
