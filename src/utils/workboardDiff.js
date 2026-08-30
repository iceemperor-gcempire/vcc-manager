// 작업판 import 갱신 모드의 diff · 위험 경고 (#886).
//
// 프로덕션 작업판을 저장소 export 로 제자리 갱신할 때, "무엇이 바뀌는지" 와 "그 변경이
// 기존 작업·사용자에게 위험한지" 를 사람이 보고 승인할 수 있게 계산한다. 순수 함수 —
// DB·네트워크 없음. 라우트(dry-run / 409 승인 요구)와 CLI 가 같은 결과를 쓴다.
//
// 경고(warnings)는 **입력·출력 계약이 깨지는 변경**에만 붙인다. 라벨·설명·기본값 조정처럼
// 되돌릴 수 있고 기존 작업을 깨지 않는 변경은 changes 에만 기록한다.

const { WORKFLOW_VARIABLE_KEYS } = require('../constants/workflowVariables');
const { ATTACHMENT_FIELD_TYPES } = require('../constants/mediaTypes');

const SAVE_NODE_RE = /^(SaveImage|SaveVideo|SaveAudio|SaveAnimatedWEBP|SaveAnimatedPNG|VHS_VideoCombine|CreateVideo)$/;
const PLACEHOLDER_RE = /\{\{##([A-Za-z0-9_]+)##\}\}/g;

const norm = (v) => (v === undefined || v === null ? '' : v);
const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
const plain = (o) => (o && typeof o.toObject === 'function' ? o.toObject() : o);

function parseWorkflow(data) {
  if (!data) return {};
  if (typeof data !== 'string') return data;
  try { return JSON.parse(data); } catch { return null; }
}

function optionValues(field) {
  return (field.options || []).map((o) => String(o && o.value !== undefined ? o.value : o));
}

/** 워크플로 문자열에 등장하는 placeholder 이름 집합 */
function placeholdersIn(workflowData) {
  const names = new Set();
  const s = typeof workflowData === 'string' ? workflowData : JSON.stringify(workflowData || '');
  let m;
  while ((m = PLACEHOLDER_RE.exec(s)) !== null) names.add(m[1]);
  return names;
}

/**
 * @param {Object} existing — 현재 DB 의 작업판 (mongoose doc 또는 plain)
 * @param {Object} incoming — export 의 `workboard` 객체
 * @returns {{ identical: boolean, changes: Array<{kind:string, target:string, detail?:string}>,
 *             warnings: Array<{code:string, target:string, message:string}>, summary: Object }}
 */
function diffWorkboard(existingDoc, incoming) {
  const existing = plain(existingDoc) || {};
  const changes = [];
  const warnings = [];
  const change = (kind, target, detail) => changes.push(detail ? { kind, target, detail } : { kind, target });
  const warn = (code, target, message) => warnings.push({ code, target, message });

  // ---- 스칼라 ----
  if (!same(existing.description, incoming.description)) change('description', 'description');
  if (!same(existing.outputFormat || 'image', incoming.outputFormat || 'image')) {
    change('outputFormat', 'outputFormat', `${existing.outputFormat || 'image'} → ${incoming.outputFormat || 'image'}`);
    warn('OUTPUT_FORMAT_CHANGED', 'outputFormat',
      `출력 형식이 ${existing.outputFormat || 'image'} → ${incoming.outputFormat || 'image'} 로 바뀝니다. 히스토리·갤러리의 결과 종류가 달라집니다.`);
  }
  if (!same(existing.workboardType, incoming.workboardType)) {
    change('workboardType', 'workboardType', `${existing.workboardType} → ${incoming.workboardType}`);
    warn('WORKBOARD_TYPE_CHANGED', 'workboardType', `작업판 종류가 ${existing.workboardType} → ${incoming.workboardType} 로 바뀝니다.`);
  }
  for (const k of ['modelExposurePolicy', 'modelWhitelist', 'loraExposurePolicy', 'loraWhitelist', 'allowedModelTypes']) {
    if (!same(existing[k], incoming[k])) change('policy', k);
  }

  // ---- 입력 필드 ----
  const oldFields = (existing.additionalInputFields || []).map(plain);
  const newFields = (incoming.additionalInputFields || []).map(plain);
  const oldByName = new Map(oldFields.map((f) => [f.name, f]));
  const newByName = new Map(newFields.map((f) => [f.name, f]));

  const removed = oldFields.filter((f) => !newByName.has(f.name));
  const added = newFields.filter((f) => !oldByName.has(f.name));

  for (const f of removed) {
    change('field.removed', f.name);
    const renamedTo = added.find((a) => a.type === f.type && !removed.some((r) => r.name === a.name) && a.label === f.label);
    warn('FIELD_REMOVED', f.name,
      `입력 필드 "${f.label || f.name}" (${f.type}) 이 사라집니다. 이 필드 값을 가진 기존 작업의 계속하기·재시도가 값을 잃습니다.`
      + (renamedTo ? ` (같은 라벨·타입의 "${renamedTo.name}" 이 추가돼 이름 변경으로 보입니다 — 이름 변경도 기존 작업에는 삭제와 같습니다)` : ''));
  }
  for (const f of added) {
    change('field.added', f.name, f.type);
    if (f.required && ATTACHMENT_FIELD_TYPES.includes(f.type)) {
      warn('FIELD_REQUIRED_ADDED', f.name, `필수 첨부 필드 "${f.label || f.name}" 이 추가됩니다. 이 값이 없는 기존 작업은 재시도할 수 없습니다.`);
    }
  }
  for (const nf of newFields) {
    const of = oldByName.get(nf.name);
    if (!of) continue;
    if (of.type !== nf.type) {
      change('field.type', nf.name, `${of.type} → ${nf.type}`);
      warn('FIELD_TYPE_CHANGED', nf.name, `필드 "${nf.label || nf.name}" 의 타입이 ${of.type} → ${nf.type} 로 바뀝니다. 기존 값이 해석되지 않습니다.`);
    }
    if (!of.required && nf.required) {
      change('field.required', nf.name, 'false → true');
      warn('FIELD_REQUIRED_ADDED', nf.name, `필드 "${nf.label || nf.name}" 이 필수가 됩니다. 비워 둔 기존 작업은 재시도할 수 없습니다.`);
    }
    if (nf.type === 'select' || of.type === 'select') {
      const oldOpts = optionValues(of);
      const newOpts = optionValues(nf);
      const gone = oldOpts.filter((v) => !newOpts.includes(v));
      const fresh = newOpts.filter((v) => !oldOpts.includes(v));
      if (gone.length) {
        change('field.options.removed', nf.name, gone.join(', '));
        const loseDefault = gone.includes(String(norm(of.defaultValue)));
        warn('FIELD_OPTIONS_REMOVED', nf.name,
          `"${nf.label || nf.name}" 의 선택지 ${gone.length}개가 사라집니다 (${gone.slice(0, 3).join(', ')}${gone.length > 3 ? ' …' : ''}).`
          + (loseDefault ? ' 기존 기본값도 그중 하나입니다.' : '') + ' 그 값으로 만든 기존 작업은 계속하기 시 다른 값으로 바뀝니다.');
      }
      if (fresh.length) change('field.options.added', nf.name, fresh.join(', '));
    }
    if (!same(of.defaultValue, nf.defaultValue)) change('field.default', nf.name, `${norm(of.defaultValue)} → ${norm(nf.defaultValue)}`);
    if (!same(of.label, nf.label)) change('field.label', nf.name, `${norm(of.label)} → ${norm(nf.label)}`);
    if (!same(of.description, nf.description)) change('field.description', nf.name);
    for (const k of ['audioOfVideoField', 'anchorSizeField', 'anchorFitField', 'formatString', 'placeholder']) {
      if (!same(of[k], nf[k])) change('field.meta', `${nf.name}.${k}`);
    }
  }
  // 순서 변경 (필드 집합은 같은데 순서만 다름)
  const oldOrder = oldFields.filter((f) => newByName.has(f.name)).map((f) => f.name).join('|');
  const newOrder = newFields.filter((f) => oldByName.has(f.name)).map((f) => f.name).join('|');
  if (oldOrder !== newOrder) change('field.order', 'additionalInputFields');

  // ---- 워크플로 ----
  const oldWf = parseWorkflow(existing.workflowData);
  const newWf = parseWorkflow(incoming.workflowData);
  if (newWf === null) {
    warn('WORKFLOW_UNPARSABLE', 'workflowData', 'workflowData 가 JSON 으로 파싱되지 않습니다. _vcc 지시자가 동작하지 않는 fallback 경로입니다.');
  } else if (oldWf !== null) {
    const oldIds = new Set(Object.keys(oldWf || {}));
    const newIds = new Set(Object.keys(newWf || {}));
    for (const id of oldIds) {
      if (!newIds.has(id)) {
        const ct = oldWf[id] && oldWf[id].class_type;
        change('node.removed', id, ct);
        if (SAVE_NODE_RE.test(ct || '')) warn('SAVE_NODE_CHANGED', id, `저장 노드 ${ct} (#${id}) 가 사라집니다. 결과 수집 경로가 바뀔 수 있습니다.`);
      }
    }
    for (const id of newIds) {
      const n = newWf[id];
      if (!oldIds.has(id)) { change('node.added', id, n && n.class_type); continue; }
      const o = oldWf[id];
      if ((o && o.class_type) !== (n && n.class_type)) {
        change('node.class', id, `${o && o.class_type} → ${n && n.class_type}`);
        if (SAVE_NODE_RE.test((o && o.class_type) || '')) warn('SAVE_NODE_CHANGED', id, `저장 노드 #${id} 의 종류가 ${o.class_type} → ${n.class_type} 로 바뀝니다.`);
      } else if (!same(o && o.inputs, n && n.inputs) || !same(o && o._vcc, n && n._vcc)) {
        change('node.inputs', id, n && n.class_type);
      }
    }
  } else if (!same(existing.workflowData, incoming.workflowData)) {
    change('workflowData', 'workflowData');
  }

  // placeholder ↔ 필드 정합 (배포 산출물 가드 workboardExports.test.js 와 같은 규칙)
  const used = placeholdersIn(incoming.workflowData);
  const builtin = new Set(WORKFLOW_VARIABLE_KEYS.map((k) => k.replace(/^\{\{##|##\}\}$/g, '')));
  const declared = new Set();
  for (const f of newFields) {
    declared.add(f.name);
    if (ATTACHMENT_FIELD_TYPES.includes(f.type)) declared.add(`${f.name}_attached`);
  }
  for (const name of used) {
    if (builtin.has(name) || declared.has(name)) continue;
    warn('PLACEHOLDER_UNBOUND', name, `워크플로의 {{##${name}##}} 에 대응하는 입력 필드가 없습니다. ComfyUI 가 치환되지 않은 문자열을 받습니다.`);
  }

  const count = (prefix) => changes.filter((c) => c.kind.startsWith(prefix)).length;
  return {
    identical: changes.length === 0,
    changes,
    warnings,
    summary: {
      fieldsAdded: count('field.added'),
      fieldsRemoved: count('field.removed'),
      fieldsChanged: changes.filter((c) => c.kind.startsWith('field.') && !['field.added', 'field.removed'].includes(c.kind)).length,
      nodesAdded: count('node.added'),
      nodesRemoved: count('node.removed'),
      nodesChanged: changes.filter((c) => ['node.class', 'node.inputs'].includes(c.kind)).length,
      warnings: warnings.length,
    },
  };
}

/** 갱신 모드에서 export 로부터 덮어쓰는 필드 — 나머지(_id·serverId·allowedGroupIds·isActive·usageCount·createdBy)는 유지 */
const UPDATABLE_FIELDS = Object.freeze([
  'description', 'workboardType', 'outputFormat', 'additionalInputFields', 'workflowData',
  'allowedModelTypes', 'modelExposurePolicy', 'modelWhitelist', 'loraExposurePolicy', 'loraWhitelist',
]);

module.exports = { diffWorkboard, UPDATABLE_FIELDS, placeholdersIn };
