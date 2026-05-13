// 공통 메타데이터 아이템 인터페이스 (#260 Phase 1).
// LoRA / ComfyUI checkpoint / SaaS provider 모델을 동일 shape 로 정규화하여
// UI 컴포넌트 (카드 / 그리드 / picker / admin 페이지) 가 kind 별 분기 없이
// 공통 렌더링 로직 사용 가능하게 함.
//
// 정규화 대상 raw shape:
//   - LoRA item: ServerLoraCache.loraModels[*]
//       { filename, hash, hashError, civitai: {...} }
//   - Checkpoint item: ServerModelCache.models[*] (ComfyUI 서버)
//       { filename, hash, hashError, civitai: {...}, provider: {...} }
//   - SaaS provider model: ServerModelCache.models[*] (OpenAI/Gemini)
//       { filename, civitai: {found:false}, provider: {...} }

/**
 * 공통 MetadataItem shape (TS interface 가 없으니 JSDoc 으로 명시)
 *
 * @typedef {Object} MetadataItem
 * @property {string} id              — 고유 키 (filename 또는 model id)
 * @property {string} filename        — 원본 식별자 (저장 시 사용)
 * @property {'lora'|'checkpoint'|'provider-model'} kind
 * @property {string} displayName     — UI 표시 이름 (civitai → provider → filename 우선순위)
 * @property {string} description     — 설명 (HTML 가능)
 * @property {string|null} baseModel  — 베이스 모델 (Civitai)
 * @property {string[]} trainedWords  — 트리거 워드 (LoRA / Civitai)
 * @property {string[]} capabilities  — capability flags (SaaS provider)
 * @property {number|null} contextWindow — token 수 (SaaS provider)
 * @property {string|null} hash       — SHA256
 * @property {string|null} hashError  — hash 계산 실패 사유
 * @property {boolean} hasMetadata    — civitai.found || provider.found
 * @property {'civitai'|'provider'|null} metadataSource
 * @property {boolean} nsfw           — Civitai nsfw flag
 * @property {Array<{url:string, nsfw:boolean, type:'image'|'video'}>} images
 * @property {string|null} modelUrl   — 외부 링크 (Civitai 모델 페이지)
 * @property {Object} raw             — 원본 데이터 (kind 별 추가 정보 접근)
 */

const VALID_KINDS = new Set(['lora', 'checkpoint', 'provider-model']);

function pickDisplayName(raw) {
  return raw?.civitai?.name
    || raw?.provider?.name
    || (raw?.filename || '').replace(/\.[^/.]+$/, '');
}

function pickDescription(raw) {
  return raw?.civitai?.description || raw?.provider?.description || '';
}

function pickMetadataSource(raw) {
  if (raw?.civitai?.found) return 'civitai';
  if (raw?.provider?.found) return 'provider';
  return null;
}

/**
 * LoRA 아이템 → MetadataItem
 * @param {Object} raw — ServerLoraCache.loraModels[*]
 * @returns {MetadataItem}
 */
export function normalizeLora(raw) {
  if (!raw) return null;
  const civ = raw.civitai || {};
  return {
    id: raw.filename,
    filename: raw.filename,
    kind: 'lora',
    displayName: pickDisplayName(raw),
    description: pickDescription(raw),
    baseModel: civ.baseModel || null,
    trainedWords: civ.trainedWords || [],
    capabilities: [],
    contextWindow: null,
    hash: raw.hash || null,
    hashError: raw.hashError || null,
    hasMetadata: civ.found === true,
    metadataSource: civ.found ? 'civitai' : null,
    nsfw: civ.nsfw === true,
    images: civ.images || [],
    modelUrl: civ.modelUrl || null,
    raw
  };
}

/**
 * Model 아이템 (checkpoint 또는 SaaS provider) → MetadataItem
 * @param {Object} raw — ServerModelCache.models[*]
 * @param {Object} [options]
 * @param {string} [options.serverType] — 명시적 hint. 미제공 시 provider/civitai 기반 추론
 * @returns {MetadataItem}
 */
export function normalizeModel(raw, { serverType } = {}) {
  if (!raw) return null;
  const civ = raw.civitai || {};
  const prov = raw.provider || {};

  // kind 추론: serverType 가 ComfyUI 면 checkpoint, 그 외는 provider-model
  // serverType 미제공 시 provider.found 면 provider-model, 아니면 checkpoint (ComfyUI default)
  let kind = 'checkpoint';
  if (serverType === 'ComfyUI') {
    kind = 'checkpoint';
  } else if (serverType && serverType !== 'ComfyUI') {
    kind = 'provider-model';
  } else if (prov.found) {
    kind = 'provider-model';
  }

  return {
    id: raw.filename,
    filename: raw.filename,
    kind,
    displayName: pickDisplayName(raw),
    description: pickDescription(raw),
    baseModel: civ.baseModel || null,
    trainedWords: civ.trainedWords || [],
    capabilities: prov.capabilities || [],
    contextWindow: prov.contextWindow || null,
    hash: raw.hash || null,
    hashError: raw.hashError || null,
    hasMetadata: pickMetadataSource(raw) !== null,
    metadataSource: pickMetadataSource(raw),
    nsfw: civ.nsfw === true,
    images: civ.images || [],
    modelUrl: civ.modelUrl || null,
    raw
  };
}

/**
 * 배열 normalize 편의 함수.
 */
export function normalizeLoraList(rawList) {
  return (rawList || []).map(normalizeLora).filter(Boolean);
}

export function normalizeModelList(rawList, options) {
  return (rawList || []).map(r => normalizeModel(r, options)).filter(Boolean);
}

/**
 * kind 별 표시 라벨 (badge 등에 사용)
 */
export function getKindLabel(kind) {
  switch (kind) {
    case 'lora': return 'LoRA';
    case 'checkpoint': return '베이스 모델';
    case 'provider-model': return 'API Model';
    default: return kind || '';
  }
}

/**
 * MetadataItem 검증 — 잘못된 데이터 빠르게 감지 (개발 편의용).
 * 운영 코드에서 호출하지 말 것 (성능).
 */
export function isValidMetadataItem(item) {
  return !!item
    && typeof item.id === 'string'
    && VALID_KINDS.has(item.kind)
    && typeof item.displayName === 'string';
}
