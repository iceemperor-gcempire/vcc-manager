// 작업판이 베이스 모델에 거는 제한 (#1086, #1087).
//
// 모델 선택 목록(GET /servers/:id/models?workboardId=…)과 동기화 준비 검사(services/workboardReadiness)가
// 같은 제한·같은 판정을 쓴다. 따로 만들면 "목록에는 없는데 검사는 통과" 가 생긴다.
//
// 제한은 모두 겹쳐 적용된다 (AND):
//  - source         베이스 모델 로더가 읽는 폴더 (checkpoints / diffusion_models, #898)
//  - allowedFolders 허용 모델 폴더 (#1086) — 파일 경로로 판단
//  - allowedBaseModels 허용 모델 타입 (Civitai baseModel, #252) — Civitai 정보가 없으면 빠진다 (#320)
//  - whitelist      노출 목록 (modelExposurePolicy 'whitelist', #198)

const { getFieldByRole } = require('./customFieldHelpers');
const { FIELD_ROLES } = require('../constants/fieldRoles');
const { inferBaseModelSource } = require('./workboardModelSource');
const { isInModelFolders } = require('./modelFolders');

// 노출 목록 정책인데 목록이 비면 0개 노출 — 빈 배열은 "제약 없음" 이라 매칭 안 되는 값으로 막는다
const EMPTY_WHITELIST_SENTINEL = '__no_models_in_whitelist__';

/**
 * @param {Object} wb — 작업판 (DB 문서 또는 export 의 workboard)
 * @param {string} serverType
 * @returns {{ allowedBaseModels: string[], allowedFolders: string[], whitelist: string[]|undefined, source: string|undefined }}
 */
function buildWorkboardModelFilters(wb, serverType) {
  const filters = {
    allowedBaseModels: Array.isArray(wb.allowedModelTypes) ? [...wb.allowedModelTypes] : [],
    allowedFolders: Array.isArray(wb.allowedModelFolders) ? [...wb.allowedModelFolders] : [],
    whitelist: undefined,
    source: undefined,
  };
  if (wb.modelExposurePolicy === 'whitelist') {
    const list = wb.modelWhitelist || [];
    filters.whitelist = list.length === 0 ? [EMPTY_WHITELIST_SENTINEL] : [...list];
  }
  // 로더 폴더는 ComfyUI 작업판만 의미 있다
  if (serverType === 'ComfyUI') {
    const baseField = getFieldByRole(wb, FIELD_ROLES.MODEL);
    const placeholder = (baseField && baseField.formatString) || '{{##base_model##}}';
    filters.source = inferBaseModelSource(wb.workflowData, placeholder) || undefined;
  }
  return filters;
}

/**
 * 모델 캐시 항목이 작업판 제한에 걸리는가.
 * @returns {'source'|'folders'|'modelTypes'|'whitelist'|null} 걸린 제한, 통과면 null
 */
function workboardFilterReason(model, { source, allowedFolders, allowedBaseModels, whitelist } = {}) {
  // source 가 없는 옛 캐시 항목은 남긴다 (#898)
  if (source && model.source && model.source !== source) return 'source';
  if (Array.isArray(allowedFolders) && allowedFolders.length > 0 && !isInModelFolders(model.filename, allowedFolders)) return 'folders';
  if (Array.isArray(allowedBaseModels) && allowedBaseModels.length > 0 && !allowedBaseModels.includes(model.civitai?.baseModel)) return 'modelTypes';
  if (Array.isArray(whitelist) && whitelist.length > 0 && !whitelist.includes(model.filename)) return 'whitelist';
  return null;
}

module.exports = { buildWorkboardModelFilters, workboardFilterReason, EMPTY_WHITELIST_SENTINEL };
