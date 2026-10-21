// 작업판 준비 검사 (#1087) — 가져올 판이 대상 서버에서 실제로 돌 수 있는지 본다.
//
// 동기화 dry-run 의 diff 는 저장소 파일과 서버의 판이 같은지만 본다. 판이 쓰는 파일이 서버에 있는지는
// 보지 않아서, #1083 의 세 문제(없는 기본 모델·없는 패치 선택지·기본 모델을 숨기는 거름)가 모두
// 배포까지 갔다. 여기서 보는 것:
//
//  1. 노드·값 — 워크플로 노드마다 ComfyUI object_info 를 찾는다. 노드 클래스가 없으면 커스텀 노드
//     미설치. 선택형(COMBO) 입력의 값이 서버 목록에 없으면 파일 없음. 값이 `{{##placeholder##}}` 면
//     그 필드의 기본값과 선택지를 본다 (베이스 모델·LoRA 필드는 기본값만 — 나머지는 선택 목록이 준다)
//  2. 선택 목록 — 베이스 모델 기본값이 판의 제한을 통과해 모델 선택 목록에 나오는지
//     (utils/workboardModelFilters — 목록과 같은 판정)
//
// 값이 "끄는 값"(isFalsy — 업스케일 '없음' 의 "0" 등)이고 그 필드가 `_vcc` 조건으로 쓰이면 검사하지
// 않는다. 실행 때 그 노드를 우회해 소비자가 없어지고, ComfyUI 는 출력에 닿지 않는 노드를 검증하지 않는다.
//
// 결과는 diff 의 warnings 와 따로 둔다. warnings 는 409 승인을 걸지만 준비 상태는 막지 않는다 —
// 판을 먼저 넣고 모델을 나중에 받는 순서도 있다. 대신 검사 수를 0 이어도 함께 돌려준다.

const ServerModelCache = require('../models/ServerModelCache');
const comfyUIService = require('./comfyUIService');
const { ATTACHMENT_FIELD_TYPES } = require('../constants/mediaTypes');
const { comparableModelPath } = require('../utils/modelPath');
const { buildWorkboardModelFilters, workboardFilterReason } = require('../utils/workboardModelFilters');
const { getFieldByRole } = require('../utils/customFieldHelpers');
const { FIELD_ROLES } = require('../constants/fieldRoles');
const { isFalsy } = require('../utils/workflowDirectives');

const OBJECT_INFO_TTL_MS = 60 * 1000;
const objectInfoCache = new Map(); // serverUrl → { at, data }

const PLACEHOLDER_ONLY_RE = /^\{\{##([A-Za-z0-9_]+)##\}\}$/;
const formatStringOf = (f) => (f && f.formatString != null && f.formatString !== '') ? f.formatString : `{{##${f && f.name}##}}`;
const valueOf = (o) => (o && typeof o === 'object' && o.value !== undefined ? o.value : o);

/** 동기화는 판마다 import 를 한 번씩 부른다 — 같은 서버의 object_info(수 MB)는 잠깐 재사용한다 */
async function getObjectInfoCached(serverUrl, now = Date.now()) {
  const hit = objectInfoCache.get(serverUrl);
  if (hit && now - hit.at < OBJECT_INFO_TTL_MS) return hit.data;
  const data = await comfyUIService.getObjectInfo(serverUrl);
  objectInfoCache.set(serverUrl, { at: now, data });
  return data;
}

/** 입력 스펙이 선택형이면 선택지 목록 — 옛 형식 `[[...]]` 과 `["COMBO", { options }]` 둘 다 */
function comboOptions(spec) {
  if (!Array.isArray(spec) || spec.length === 0) return null;
  if (Array.isArray(spec[0])) return spec[0];
  if (spec[0] === 'COMBO' && spec[1] && Array.isArray(spec[1].options)) return spec[1].options;
  return null;
}

function inputSpec(info, key) {
  const input = (info && info.input) || {};
  return (input.required && input.required[key]) || (input.optional && input.optional[key]) || null;
}

/** `_vcc` 조건(bypassUnless·omitInputsUnless)으로 쓰인 placeholder 들 */
function conditionPlaceholders(workflow) {
  const out = new Set();
  const add = (c) => { if (typeof c === 'string') out.add(c.trim()); };
  for (const node of Object.values(workflow || {})) {
    const d = node && node._vcc;
    if (!d || typeof d !== 'object') continue;
    if (d.bypassUnless) add(d.bypassUnless.condition);
    for (const c of Object.values(d.omitInputsUnless || {})) (Array.isArray(c) ? c : [c]).forEach(add);
  }
  return out;
}

/**
 * COMBO 입력에 들어갈 값들 — 리터럴 하나, 또는 placeholder 가 가리키는 필드의 기본값·선택지.
 * @param {Set<string>} [switches] — `_vcc` 조건으로 쓰인 placeholder. 그 필드의 끄는 값은 뺀다
 */
function candidateValues(raw, fields, switches = new Set()) {
  if (typeof raw !== 'string') return [];
  const m = raw.match(PLACEHOLDER_ONLY_RE);
  if (!m) return raw.includes('{{##') ? [] : [{ value: raw, via: null }];
  const field = fields.find((f) => formatStringOf(f) === raw);
  if (!field || ATTACHMENT_FIELD_TYPES.includes(field.type)) return [];
  const label = field.label || field.name;
  const isSwitchOff = (v) => switches.has(raw) && isFalsy(v);
  const out = [];
  const def = valueOf(field.defaultValue);
  if (typeof def === 'string' && def !== '' && !isSwitchOff(def)) out.push({ value: def, via: `필드 "${label}" 기본값` });
  if (field.type === 'select') {
    for (const o of field.options || []) {
      const v = valueOf(o);
      if (typeof v === 'string' && v !== '' && v !== def && !isSwitchOff(v)) out.push({ value: v, via: `필드 "${label}" 선택지` });
    }
  }
  return out;
}

const REASON_LABEL = {
  source: '로더 폴더',
  folders: '허용 모델 폴더',
  modelTypes: '허용 모델 타입',
  whitelist: '노출 목록',
};

function describeFilter(reason, filters, entry) {
  if (reason === 'folders') return `${REASON_LABEL.folders}(${filters.allowedFolders.join(', ')})`;
  if (reason === 'modelTypes') {
    const bm = entry.civitai && entry.civitai.baseModel;
    return `${REASON_LABEL.modelTypes}(${filters.allowedBaseModels.join(', ')} — 이 파일의 Civitai 분류: ${bm || '없음'})`;
  }
  if (reason === 'source') return `${REASON_LABEL.source}(${filters.source}, 이 파일은 ${entry.source})`;
  return REASON_LABEL[reason] || reason;
}

/**
 * @param {Object} params
 * @param {Object} params.workboard — 가져올 판 (export 의 workboard)
 * @param {Object} params.server — 대상 서버 (_id, serverType, serverUrl)
 * @returns {Promise<{ checked: { nodes: number, values: number, defaultModel: 'checked'|'missing'|false },
 *   issues: Array<{ code: string, target: string, message: string }>, unavailable: string|null, skipped: string|null }>}
 */
async function checkWorkboardReadiness({ workboard, server }) {
  // defaultModel: 'checked' 목록 확인 · 'missing' 기본 모델 파일이 서버에 없어 건너뜀 · false 해당 없음
  const result = { checked: { nodes: 0, values: 0, defaultModel: false }, issues: [], unavailable: null, skipped: null };
  if (!server || server.serverType !== 'ComfyUI') {
    result.skipped = `ComfyUI 작업판이 아님 (${(server && server.serverType) || '서버 없음'})`;
    return result;
  }
  let workflow;
  try {
    workflow = typeof workboard.workflowData === 'string' ? JSON.parse(workboard.workflowData || '{}') : (workboard.workflowData || {});
  } catch {
    result.issues.push({ code: 'WORKFLOW_PARSE_FAILED', target: 'workflowData', message: '워크플로를 JSON 으로 읽을 수 없습니다.' });
    return result;
  }

  let objectInfo;
  try {
    objectInfo = await getObjectInfoCached(server.serverUrl);
  } catch (e) {
    result.unavailable = `ComfyUI 에 닿지 못해 확인하지 못했습니다 — ${e.message}`;
    return result;
  }

  const fields = workboard.additionalInputFields || [];
  const issue = (code, target, message) => result.issues.push({ code, target, message });
  const missingValues = new Set(); // 아래 선택 목록 검사에서 같은 파일을 두 번 알리지 않게
  const switches = conditionPlaceholders(workflow);

  for (const [id, node] of Object.entries(workflow || {})) {
    if (!node || typeof node !== 'object' || !node.class_type) continue;
    result.checked.nodes += 1;
    const info = objectInfo[node.class_type];
    if (!info) {
      issue('NODE_MISSING', `node ${id}`, `노드 ${id} \`${node.class_type}\` 가 서버에 없습니다 — 커스텀 노드가 설치되지 않았거나 ComfyUI 버전이 낮습니다.`);
      continue;
    }
    for (const [key, raw] of Object.entries(node.inputs || {})) {
      const options = comboOptions(inputSpec(info, key));
      if (!options) continue;
      for (const { value, via } of candidateValues(raw, fields, switches)) {
        result.checked.values += 1;
        if (options.includes(value)) continue;
        const where = `노드 ${id} ${node.class_type}.${key}`;
        const suffix = via ? ` (${via})` : '';
        const sameButSeparator = options.find((o) => typeof o === 'string' && comparableModelPath(o) === comparableModelPath(value));
        if (sameButSeparator) {
          issue('VALUE_SEPARATOR_MISMATCH', where,
            `${where}: \`${value}\`${suffix} — 서버는 \`${sameButSeparator}\` 로 보고합니다. ComfyUI 는 정확히 같은 문자열만 받습니다.`);
        } else {
          issue('VALUE_NOT_ON_SERVER', where, `${where}: \`${value}\`${suffix} 가 서버 목록에 없습니다.`);
        }
        missingValues.add(value);
      }
    }
  }

  // 선택 목록 — 베이스 모델 기본값이 판의 제한을 통과하는가
  const baseField = getFieldByRole(workboard, FIELD_ROLES.MODEL);
  const def = baseField && valueOf(baseField.defaultValue);
  if (baseField && baseField.type === 'baseModel' && typeof def === 'string' && def !== '' && missingValues.has(def)) {
    result.checked.defaultModel = 'missing'; // 위에서 이미 "서버에 없음" 으로 알렸다
  } else if (baseField && baseField.type === 'baseModel' && typeof def === 'string' && def !== '') {
    result.checked.defaultModel = 'checked';
    const cache = await ServerModelCache.findOne({ serverId: server._id });
    const entry = cache && (cache.models || []).find((m) => m.filename === def);
    if (!entry) {
      issue('DEFAULT_MODEL_NOT_IN_LIST', `field ${baseField.name}`,
        `베이스 모델 기본값 \`${def}\` 이 모델 목록(캐시)에 없어 모델 선택 목록에 나오지 않습니다 — 서버 모델 동기화가 필요할 수 있습니다.`);
    } else {
      const filters = buildWorkboardModelFilters(workboard, server.serverType);
      const reason = workboardFilterReason(entry, filters);
      if (reason) {
        issue('DEFAULT_MODEL_FILTERED', `field ${baseField.name}`,
          `베이스 모델 기본값 \`${def}\` 이 판의 ${describeFilter(reason, filters, entry)} 에 걸려 모델 선택 목록에 나오지 않습니다.`);
      }
    }
  }

  return result;
}

module.exports = { checkWorkboardReadiness, comboOptions, candidateValues, conditionPlaceholders, _objectInfoCache: objectInfoCache };
