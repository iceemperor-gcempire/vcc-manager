const { idOf } = require('./runSteps');
const {
  INPUT_MODES, stepFields, outputTypeOf, acceptsOutput,
} = require('./sequenceInputs');

// 작업 절차 단계의 정규화·점검 (#952). 라우트가 DB 에서 읽은 작업판·문서를 넘기면 순수하게 판정한다.

// 작업 절차 사전 입력에 저장하지 않는 필드 타입. 값이 운영자 개인 소유 업로드를 가리키므로
// 실행자에게 넘기면 남의 개인 자산을 쓰게 된다. 실행자 입력은 노출 출처(#953)로 받는다.
const MEDIA_FIELD_TYPES = new Set(['image', 'video', 'audio', 'file']);

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const isObjectIdLike = (v) => v != null && OBJECT_ID_RE.test(idOf(v));

/**
 * 요청 본문의 steps 를 저장 가능한 모양으로 만든다.
 * @param {Array} rawSteps
 * @param {{ workboardsById: Map<string, Object>, existingDocIds: Set<string> }} refs
 *   workboardsById — 단계가 가리키는 작업판 (name · outputFormat · additionalInputFields)
 *   existingDocIds — 존재하는 SequenceDoc id
 * @returns {{ ok: true, steps: Array, warnings: string[] } | { ok: false, message: string }}
 */
function normalizeSequenceSteps(rawSteps, { workboardsById, existingDocIds }) {
  if (!Array.isArray(rawSteps)) return { ok: false, message: 'steps 는 배열이어야 합니다' };
  const warnings = [];
  const steps = [];
  const seenStepIds = new Set();

  for (let i = 0; i < rawSteps.length; i++) {
    const s = rawSteps[i] || {};
    const label = `${i + 1}단계`;
    if (!isObjectIdLike(s.workboardId)) return { ok: false, message: `${label}: 작업판을 지정하세요` };
    const workboardId = idOf(s.workboardId);
    const wb = workboardsById.get(workboardId);
    if (!wb) return { ok: false, message: `${label}: 존재하지 않는 작업판입니다` };

    const contextDocIds = [...new Set((Array.isArray(s.contextDocIds) ? s.contextDocIds : [])
      .filter((d) => d != null && d !== '')
      .map(idOf))];
    const systemPromptDocId = s.systemPromptDocId ? idOf(s.systemPromptDocId) : null;
    const referenced = systemPromptDocId ? [...contextDocIds, systemPromptDocId] : contextDocIds;
    if (referenced.some((id) => !existingDocIds.has(id))) {
      return { ok: false, message: `${label}: 존재하지 않는 문서가 있습니다` };
    }
    if (referenced.length > 0 && wb.outputFormat !== 'text') {
      warnings.push(`${label}(${wb.name}): 문서는 텍스트 단계에만 주입됩니다 — 이 단계에서는 쓰이지 않습니다`);
    }

    const fieldTypes = new Map((wb.additionalInputFields || []).map((f) => [f.name, f.type]));
    const rawInputs = s.inputs && typeof s.inputs === 'object' && !Array.isArray(s.inputs) ? s.inputs : {};
    const inputs = {};
    const dropped = [];
    for (const [name, value] of Object.entries(rawInputs)) {
      if (MEDIA_FIELD_TYPES.has(fieldTypes.get(name))) {
        dropped.push(name);
        continue;
      }
      inputs[name] = value;
    }
    if (dropped.length > 0) {
      warnings.push(`${label}(${wb.name}): 미디어 필드 사전 입력은 저장하지 않습니다 — ${dropped.join(', ')}`);
    }

    // 입력 출처 (#953) — 작업판에 있는 필드·올바른 출처만 저장한다
    const previousWorkboard = i > 0 ? workboardsById.get(idOf(rawSteps[i - 1]?.workboardId)) : null;
    const fieldsByName = new Map(stepFields(wb).map((f) => [f.name, f]));
    const rawSources = s.inputSources && typeof s.inputSources === 'object' && !Array.isArray(s.inputSources)
      ? s.inputSources : {};
    const inputSources = {};
    for (const [name, source] of Object.entries(rawSources)) {
      const mode = source && typeof source === 'object' ? source.mode : source;
      const field = fieldsByName.get(name);
      if (!field) {
        warnings.push(`${label}(${wb.name}): 작업판에 없는 입력 ${name} 의 출처는 저장하지 않습니다`);
        continue;
      }
      if (!INPUT_MODES.includes(mode)) {
        warnings.push(`${label}(${wb.name}): ${field.label} 의 출처 값이 올바르지 않아 저장하지 않습니다`);
        continue;
      }
      if (mode === 'previous' && i === 0) {
        warnings.push(`${label}(${wb.name}): 첫 단계는 앞 단계 결과를 받을 수 없습니다 — ${field.label}`);
        continue;
      }
      if (mode === 'exposed' && field.type === 'file') {
        warnings.push(`${label}(${wb.name}): 파일 입력은 실행 화면에 노출할 수 없습니다 — ${field.label}`);
        continue;
      }
      if (mode === 'previous' && !acceptsOutput(field, outputTypeOf(previousWorkboard))) {
        warnings.push(`${label}(${wb.name}): ${field.label} 은 앞 단계 결과와 형식이 맞지 않아 실행 때 비어 있게 됩니다`);
      }
      inputSources[name] = { mode };
    }

    const step = {
      workboardId,
      autoInject: s.autoInject !== false,
      inputs,
      inputSources,
      contextDocIds,
      systemPromptDocId: systemPromptDocId || undefined,
      note: typeof s.note === 'string' ? s.note.trim().slice(0, 500) : '',
    };
    if (isObjectIdLike(s._id) && !seenStepIds.has(idOf(s._id))) {
      step._id = idOf(s._id);
      seenStepIds.add(step._id);
    }
    steps.push(step);
  }
  return { ok: true, steps, warnings };
}

/**
 * 작업 절차를 열어준 그룹 중 단계 작업판이 열려 있지 않은 그룹. 그 그룹 사용자는 실행이 막힌다.
 * 작업 절차 권한이 작업판 권한을 열지 않으므로(#802) 관리자에게 미리 보여 주기 위한 점검이다.
 * @returns {Array<{ stepIndex, workboardId, workboardName, missingGroupIds: string[], inactive: boolean, missing: boolean }>}
 *   문제가 있는 단계만
 */
function computeGroupCoverage(sequence, workboardsById) {
  const groups = (sequence.allowedGroupIds || []).map(idOf);
  const out = [];
  (sequence.steps || []).forEach((s, stepIndex) => {
    const workboardId = idOf(s.workboardId);
    const wb = workboardsById.get(workboardId);
    if (!wb) {
      out.push({ stepIndex, workboardId, workboardName: null, missingGroupIds: groups, inactive: false, missing: true });
      return;
    }
    const open = new Set((wb.allowedGroupIds || []).map(idOf));
    const missingGroupIds = groups.filter((g) => !open.has(g));
    const inactive = wb.isActive === false;
    if (missingGroupIds.length > 0 || inactive) {
      out.push({ stepIndex, workboardId, workboardName: wb.name, missingGroupIds, inactive, missing: false });
    }
  });
  return out;
}

/**
 * 이 사용자가 지금 이 작업 절차를 실행할 수 있는지. 실행 시작 전 점검용이며, 실행 중에도
 * 단계마다 작업판 접근을 다시 본다 (pipelineRunService — 최종 방어선).
 * @param {Function} hasWorkboardAccess (user, workboard) => boolean — middleware/auth 의 판정 함수
 */
function checkRunnable(user, sequence, workboardsById, hasWorkboardAccess) {
  const steps = sequence.steps || [];
  const blockedSteps = [];
  steps.forEach((s, stepIndex) => {
    const wb = workboardsById.get(idOf(s.workboardId));
    if (!wb) blockedSteps.push({ stepIndex, reason: 'missing', workboardName: null });
    else if (wb.isActive === false) blockedSteps.push({ stepIndex, reason: 'inactive', workboardName: wb.name });
    else if (!hasWorkboardAccess(user, wb)) blockedSteps.push({ stepIndex, reason: 'no_access', workboardName: wb.name });
  });
  return { runnable: steps.length > 0 && blockedSteps.length === 0, blockedSteps };
}

const BLOCK_REASON_TEXT = {
  missing: '작업판이 삭제됨',
  inactive: '작업판이 비활성',
  no_access: '작업판 접근 권한 없음',
};

function describeBlockedSteps(blockedSteps) {
  const parts = blockedSteps.map((b) => {
    const name = b.workboardName ? ` (${b.workboardName})` : '';
    return `${b.stepIndex + 1}단계${name}: ${BLOCK_REASON_TEXT[b.reason] || b.reason}`;
  });
  return `실행할 수 없는 단계가 있습니다 — ${parts.join(', ')}`;
}

module.exports = {
  MEDIA_FIELD_TYPES,
  normalizeSequenceSteps,
  computeGroupCoverage,
  checkRunnable,
  describeBlockedSteps,
};
