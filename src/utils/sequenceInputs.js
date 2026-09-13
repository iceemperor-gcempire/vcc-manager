const { ATTACHMENT_FIELD_TYPES } = require('../constants/mediaTypes');
const { FIELD_ROLES, WELL_KNOWN_FIELD_NAME_TO_ROLE } = require('../constants/fieldRoles');
const { idOf } = require('./runSteps');

// 작업 절차 단계의 입력 출처 (#953).
//
// 필드마다 노출(실행자가 입력) · 잠금(작성자 값 고정) · 앞 단계(직전 단계 출력 자동) 중 하나다.
// 분류·출처·값 결정은 전부 이 모듈이 한다 — 실행 화면·관리 편집기는 서버가 계산한 결과를 그리고,
// 실행 요청 검증과 실행 루프도 같은 함수를 쓴다. 화면이 보여준 것과 실제로 도는 것이 어긋나지 않게.
//
// 저장은 작성자가 고른 것만(steps[].inputSources[name] = { mode }). 지정이 없으면 아래 타입 기반 기본
// 분류를 따르므로 1단계에 만든 작업 절차도 그대로 돈다. 값을 객체로 두는 이유는 향후 N번째 단계 출력·
// 문서 같은 출처({ mode: 'step', stepId })를 같은 자리에 넣기 위해서다.

const INPUT_MODES = Object.freeze(['exposed', 'locked', 'previous']);

// 작업판 필드가 아니지만 실행기가 읽는 입력 — 생성 화면이 필드와 따로 그리는 것들
const PROMPT_FIELD = Object.freeze({ name: 'prompt', label: '프롬프트', type: 'string', required: true, implicit: true });
const NEGATIVE_PROMPT_FIELD = Object.freeze({ name: 'negativePrompt', label: '부정 프롬프트', type: 'string', implicit: true });
const SEED_FIELD = Object.freeze({ name: 'seed', label: '시드', type: 'number', implicit: true });

const HIDDEN_FIELD_NAMES = new Set(['conversation_mode']);
const PROMPT_SLOT_NAMES = new Set(['prompt', 'userPrompt']);

const TUNING_ROLES = new Set([
  FIELD_ROLES.MODEL, FIELD_ROLES.LORA, FIELD_ROLES.SYSTEM_PROMPT, FIELD_ROLES.NEGATIVE_PROMPT, FIELD_ROLES.SEED,
  FIELD_ROLES.TEMPERATURE, FIELD_ROLES.MAX_TOKENS, FIELD_ROLES.REFERENCE_IMAGE_METHOD, FIELD_ROLES.STYLE_PRESET,
  FIELD_ROLES.UPSCALE_METHOD,
]);
// 필드에 분류 메타데이터가 없어(role 은 F4 에서 제거) 이름으로 추론한다. 조율값을 먼저 본다 — lora_strength 같은 이름.
const TUNING_NAME_RE = /(^|_)(steps?|cfg|sampler|scheduler|shift|denoise|strength|guidance|loras?|negative|system|temperature|top_p|top_k|seed|sigmas?|eta)(_|$)/i;
const OUTPUT_NAME_RE = /(^|_)(size|width|height|resolution|aspect|ratio|length|duration|seconds|frames?|fps|codec|format|quality|background|compression|count|batch|n)(_|$)/i;

const MAX_TEXT_LENGTH = 100_000;
const ID_KEY_BY_TYPE = { image: 'imageId', video: 'videoId', audio: 'audioId' };
const MAX_ITEMS_BY_TYPE = { image: ['imageConfig', 'maxImages'], video: ['videoConfig', 'maxVideos'], audio: ['audioConfig', 'maxAudios'] };

const isAttachment = (field) => ATTACHMENT_FIELD_TYPES.includes(field.type);
const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

function plainField(f) {
  const o = typeof f.toObject === 'function' ? f.toObject() : f;
  return {
    name: o.name,
    label: o.label || o.name,
    type: o.type,
    required: !!o.required,
    options: (o.options || []).map((opt) => ({ key: opt.key, value: opt.value })),
    defaultValue: o.defaultValue,
    placeholder: o.placeholder,
    description: o.description,
    validation: o.validation,
    imageConfig: o.imageConfig,
    videoConfig: o.videoConfig,
    audioConfig: o.audioConfig,
  };
}

function maxItemsOf(field) {
  const [configKey, maxKey] = MAX_ITEMS_BY_TYPE[field.type] || [];
  return (configKey && field[configKey]?.[maxKey]) || 1;
}

/** 단계에서 다룰 수 있는 입력 — 실행기가 읽는 암묵 입력 + 작업판 필드(관리용 제외) */
function stepFields(workboard) {
  const custom = (workboard?.additionalInputFields || [])
    .filter((f) => f?.name && !HIDDEN_FIELD_NAMES.has(f.name))
    .map(plainField);
  const names = new Set(custom.map((f) => f.name));
  const implicit = [];
  if (![...PROMPT_SLOT_NAMES].some((n) => names.has(n))) implicit.push({ ...PROMPT_FIELD });
  if (workboard && workboard.outputFormat !== 'text') {
    if (!names.has('negativePrompt') && !names.has('negative_prompt')) implicit.push({ ...NEGATIVE_PROMPT_FIELD });
    if (!names.has('seed')) implicit.push({ ...SEED_FIELD });
  }
  return [...implicit, ...custom];
}

/** @returns {'content'|'tuning'|'output'|'other'} */
function classifyField(field) {
  if (PROMPT_SLOT_NAMES.has(field.name) || isAttachment(field)) return 'content';
  if (field.type === 'baseModel' || field.type === 'lora') return 'tuning';
  const role = WELL_KNOWN_FIELD_NAME_TO_ROLE[field.name];
  if (role === FIELD_ROLES.IMAGE_SIZE) return 'output';
  if (role && TUNING_ROLES.has(role)) return 'tuning';
  if (TUNING_NAME_RE.test(field.name)) return 'tuning';
  if (OUTPUT_NAME_RE.test(field.name)) return 'output';
  return 'other';
}

/** 앞 단계 작업판이 넘겨주는 출력 형식 — 실행 루프의 output.type 과 같은 값 */
function outputTypeOf(workboard) {
  if (!workboard) return null;
  if (workboard.outputFormat === 'text') return 'text';
  if (workboard.outputFormat === 'image') return 'image';
  return null;
}

function acceptsOutput(field, outputType) {
  if (outputType === 'text') return field.type === 'string';
  if (outputType === 'image') return field.type === 'image';
  return false;
}

/**
 * 단계 필드별 출처.
 * @returns {Array<{ field, kind, defaultMode, mode }>}
 */
function resolveStepInputs({ workboard, step, stepIndex, previousWorkboard }) {
  const fields = stepFields(workboard);
  const prevType = stepIndex > 0 ? outputTypeOf(previousWorkboard) : null;
  const autoInject = stepIndex > 0 && step?.autoInject !== false;
  const firstImage = fields.find((f) => f.type === 'image');
  const sources = step?.inputSources && typeof step.inputSources === 'object' ? step.inputSources : {};

  return fields.map((field) => {
    const kind = classifyField(field);
    let defaultMode;
    if (kind === 'content') {
      const inherits = autoInject && (
        (prevType === 'text' && PROMPT_SLOT_NAMES.has(field.name))
        || (prevType === 'image' && field === firstImage)
      );
      defaultMode = inherits ? 'previous' : 'exposed';
    } else {
      defaultMode = kind === 'output' ? 'exposed' : 'locked';
    }
    const chosen = sources[field.name]?.mode;
    const usable = INPUT_MODES.includes(chosen) && !(chosen === 'previous' && stepIndex === 0);
    return { field, kind, defaultMode, mode: usable ? chosen : defaultMode };
  });
}

/**
 * 필드의 기본값 — 작성자 사전 입력, 없으면 작업판 기본값(select 는 첫 옵션, 생성 화면과 같게).
 * 미디어는 사전 입력이 없으므로 빈 배열, 암묵 입력은 값이 없으면 넣지 않는다(undefined).
 */
function defaultValueOf(field, presets) {
  if (isAttachment(field)) return [];
  const preset = presets?.[field.name];
  if (preset !== undefined) return preset;
  if (field.implicit) return undefined;
  if (field.defaultValue !== undefined && field.defaultValue !== null) return field.defaultValue;
  if (field.type === 'select' && field.options?.length) return field.options[0].value;
  if (field.type === 'boolean') return false;
  return '';
}

/** 실행자가 보낸 값 하나를 검사하고 저장할 모양으로 */
function normalizeValue(field, value) {
  if (isAttachment(field)) {
    const list = Array.isArray(value) ? value : (value ? [value] : []);
    const key = ID_KEY_BY_TYPE[field.type];
    const out = [];
    for (const entry of list) {
      const id = typeof entry === 'string' ? entry : (entry && (entry[key] || entry._id || entry.id));
      if (!id || !/^[a-f0-9]{24}$/i.test(String(id))) return { error: '첨부 형식이 올바르지 않습니다' };
      out.push({ [key]: String(id) });
    }
    if (out.length > maxItemsOf(field)) return { error: `최대 ${maxItemsOf(field)}개까지 첨부할 수 있습니다` };
    return { value: out };
  }
  switch (field.type) {
    case 'select': {
      if (value === '' || value === null || value === undefined) return { value: '' };
      const v = String(value);
      return (field.options || []).some((o) => o.value === v) ? { value: v } : { error: '선택지에 없는 값입니다' };
    }
    case 'number': {
      if (value === '' || value === null || value === undefined) return { value: '' };
      const n = Number(value);
      if (!Number.isFinite(n)) return { error: '숫자가 아닙니다' };
      if (field.validation?.min != null && n < field.validation.min) return { error: `${field.validation.min} 이상이어야 합니다` };
      if (field.validation?.max != null && n > field.validation.max) return { error: `${field.validation.max} 이하여야 합니다` };
      return { value: n };
    }
    case 'boolean':
      if (value === true || value === 'true') return { value: true };
      if (value === false || value === 'false') return { value: false };
      return { error: '켜짐/꺼짐 값이 아닙니다' };
    case 'string':
    case 'baseModel':
    case 'lora':
      if (typeof value !== 'string') return { error: '글자가 아닙니다' };
      if (value.length > MAX_TEXT_LENGTH) return { error: '너무 깁니다' };
      return { value };
    default:
      return { error: '이 형식은 실행할 때 입력받을 수 없습니다' };
  }
}

/**
 * 실행 요청의 입력 검사.
 * @param {{ steps: Array, workboardsById: Map, inputs: Object, initialPrompt?: string }} args
 *   inputs — { [단계 _id]: { [필드 name]: 값 } }, initialPrompt — 첫 단계 프롬프트의 호환 별칭
 * @returns {{ ok: true, inputs: Object } | { ok: false, errors: string[] }}
 */
function validateRunInputs({ steps, workboardsById, inputs, initialPrompt }) {
  const given = inputs && typeof inputs === 'object' && !Array.isArray(inputs) ? inputs : {};
  const errors = [];
  const normalized = {};
  const stepIds = new Set((steps || []).map((s) => String(s._id)));
  if (Object.keys(given).some((k) => !stepIds.has(k))) errors.push('작업 절차에 없는 단계의 입력이 있습니다');

  (steps || []).forEach((step, i) => {
    const label = `${i + 1}단계`;
    const workboard = workboardsById.get(idOf(step.workboardId));
    if (!workboard) return;
    const previousWorkboard = i > 0 ? workboardsById.get(idOf(steps[i - 1].workboardId)) : null;
    const resolved = resolveStepInputs({ workboard, step, stepIndex: i, previousWorkboard });
    const byName = new Map(resolved.map((r) => [r.field.name, r]));
    const raw = given[String(step._id)];
    const provided = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const out = {};

    for (const [name, value] of Object.entries(provided)) {
      const r = byName.get(name);
      if (!r) { errors.push(`${label}: 알 수 없는 입력 ${name}`); continue; }
      if (r.mode !== 'exposed') { errors.push(`${label} ${r.field.label}: 실행할 때 바꿀 수 없는 입력입니다`); continue; }
      const checked = normalizeValue(r.field, value);
      if (checked.error) { errors.push(`${label} ${r.field.label}: ${checked.error}`); continue; }
      out[name] = checked.value;
    }

    for (const r of resolved) {
      if (r.mode !== 'exposed' || !r.field.required) continue;
      let effective = out[r.field.name] !== undefined ? out[r.field.name] : defaultValueOf(r.field, step.inputs);
      if (i === 0 && PROMPT_SLOT_NAMES.has(r.field.name) && isEmpty(effective)) effective = initialPrompt;
      if (isEmpty(effective)) errors.push(`${label} ${r.field.label}: ${isAttachment(r.field) ? '첨부하세요' : '입력하세요'}`);
    }

    if (Object.keys(out).length > 0) normalized[String(step._id)] = out;
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, inputs: normalized };
}

/**
 * 실행 루프가 단계에 넘길 입력.
 * @returns {{ values: Object, skippedPrevious: string[] }}
 */
function buildSequenceStepInput({ workboard, step, stepIndex, previousWorkboard, prevOutput, stepRunInputs, initialPrompt }) {
  const resolved = resolveStepInputs({ workboard, step, stepIndex, previousWorkboard });
  const presets = step?.inputs && typeof step.inputs === 'object' ? step.inputs : {};
  const provided = stepRunInputs && typeof stepRunInputs === 'object' ? stepRunInputs : {};
  const values = {};
  const skippedPrevious = [];

  for (const { field, mode } of resolved) {
    let value = defaultValueOf(field, presets);
    if (mode === 'exposed') {
      if (provided[field.name] !== undefined) value = provided[field.name];
      else if (stepIndex === 0 && PROMPT_SLOT_NAMES.has(field.name) && isEmpty(value) && initialPrompt) value = initialPrompt;
    } else if (mode === 'previous') {
      if (prevOutput?.type === 'text' && acceptsOutput(field, 'text')) {
        value = prevOutput.value;
      } else if (prevOutput?.type === 'image' && acceptsOutput(field, 'image') && prevOutput.imageIds?.length > 0) {
        value = prevOutput.imageIds.map((id) => ({ imageId: String(id) }));
      } else {
        skippedPrevious.push(field.name);
      }
    }
    if (value !== undefined) values[field.name] = value;
  }
  // 텍스트 단계는 userPrompt 를 사용자 메시지로, 이미지 단계는 prompt 를 쓴다
  values.userPrompt = values.prompt ?? values.userPrompt ?? '';
  return { values, skippedPrevious };
}

/** 실행 기록 목록에 보일 첫 단계 입력 */
function firstPromptOf({ steps, runInputs, initialPrompt }) {
  const first = steps?.[0];
  const provided = first ? runInputs?.[String(first._id)] : null;
  const v = provided?.prompt ?? provided?.userPrompt;
  return typeof v === 'string' && v.trim() ? v : (initialPrompt || '');
}

module.exports = {
  INPUT_MODES,
  PROMPT_SLOT_NAMES,
  stepFields,
  classifyField,
  outputTypeOf,
  acceptsOutput,
  resolveStepInputs,
  defaultValueOf,
  normalizeValue,
  validateRunInputs,
  buildSequenceStepInput,
  firstPromptOf,
  maxItemsOf,
};
