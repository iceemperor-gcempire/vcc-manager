// 작업 절차 화면의 판정·변환 (#952). 관리 편집기, 사용자 목록, 실행 기록이 같은 규칙을 쓴다.
// 입력 출처(노출·잠금·앞 단계)의 분류 자체는 서버(utils/sequenceInputs)가 계산하고, 여기는 그 결과를
// 화면 값으로 옮기고 요청 본문으로 되돌리는 일만 한다 (#953).

const idOf = (v) => String(v && typeof v === 'object' && v._id ? v._id : v);

const ATTACHMENT_TYPES = ['image', 'video', 'audio'];
const ATTACHMENT_ID_KEY = { image: 'imageId', video: 'videoId', audio: 'audioId' };
const isAttachmentType = (type) => ATTACHMENT_TYPES.includes(type);
const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

export const RUN_STATUS_META = {
  pending: { label: '대기', tone: 'info' },
  running: { label: '진행 중', tone: 'info' },
  completed: { label: '완료', tone: 'success' },
  failed: { label: '실패', tone: 'error' },
  cancelled: { label: '취소', tone: 'neutral' },
};

export function runStatusMeta(status) {
  return RUN_STATUS_META[status] || { label: status || '-', tone: 'neutral' };
}

export const isRunInProgress = (run) => !!run && (run.status === 'pending' || run.status === 'running');

export function runProgress(run) {
  const steps = run?.steps || [];
  const done = steps.filter((s) => s.status === 'completed').length;
  return { done, total: steps.length, pct: steps.length ? Math.round((done / steps.length) * 100) : 0 };
}

/**
 * 실패한 실행을 다시 시작할 단계. 완료되지 않은 첫 단계 — 접근 권한 문제로 멈춘 실행은
 * 실패 단계 없이 전부 건너뜀이라, "실패한 단계" 로 찾으면 다시 시작할 방법이 사라진다.
 * @returns {number} 다시 시작할 수 없으면 -1
 */
export function retryStartIndex(run) {
  if (!run || run.status !== 'failed') return -1;
  return (run.steps || []).findIndex((s) => s.status !== 'completed');
}

export const BLOCK_REASON_LABEL = {
  missing: '작업판이 삭제됨',
  inactive: '작업판 비활성',
  no_access: '작업판 접근 권한 없음',
};

/** 사용자 목록 항목이 실행 불가일 때 보여줄 한 줄 */
export function blockedSummary(sequence) {
  const blocked = (sequence?.steps || [])
    .map((s, i) => (s.blocked ? `${i + 1}단계 ${BLOCK_REASON_LABEL[s.blocked] || s.blocked}` : null))
    .filter(Boolean);
  if (blocked.length > 0) return blocked.join(', ');
  if ((sequence?.steps || []).length === 0) return '단계가 없습니다';
  return '';
}

/**
 * 작업 절차를 연 그룹 중 이 작업판이 열려 있지 않은 그룹 id.
 * 작업판 접근은 작업 절차와 따로 판정되므로(#802) 그 그룹 사용자는 이 단계에서 막힌다.
 * 작업판 목록의 allowedGroupIds 는 populate 돼 있을 수 있다.
 */
export function stepGroupGaps(workboard, allowedGroupIds) {
  // 접근 그룹이 응답에 없으면 판단하지 않는다 — 전부 빠진 것으로 보면 거짓 경고가 뜬다
  if (!workboard || !Array.isArray(workboard.allowedGroupIds)) return [];
  const open = new Set((workboard.allowedGroupIds || []).map(idOf));
  return (allowedGroupIds || []).map(idOf).filter((g) => !open.has(g));
}

// ── 입력 출처 (#953) ──────────────────────────────────────────────

export const INPUT_MODE_LABEL = { exposed: '노출', locked: '잠금', previous: '앞 단계' };
export const FIELD_KIND_LABEL = { content: '내용', tuning: '조율값', output: '출력 설정', other: '기타' };

/**
 * 편집기에서 필드 출처를 바꾼다. 기본 출처와 같으면 저장하지 않는다 — 기본 분류가 나중에 바뀌어도 따라가게.
 * @param {Object} step 편집기 단계
 * @param {{ name: string, defaultMode: string }} fieldMode 서버가 계산한 필드 출처
 */
export function setFieldMode(step, fieldMode, mode) {
  const sources = { ...(step.inputSources || {}) };
  if (mode === fieldMode.defaultMode) delete sources[fieldMode.name];
  else sources[fieldMode.name] = { mode };
  return { ...step, inputSources: sources };
}

/** 실행 화면 초기값 — 서버가 준 노출 필드 기본값. { [단계 _id]: { [필드]: 값 } } */
export function initialRunValues(steps) {
  const values = {};
  (steps || []).forEach((step) => {
    const stepValues = {};
    (step.fields || []).forEach((f) => {
      if (f.mode !== 'exposed') return;
      stepValues[f.name] = f.defaultValue ?? (isAttachmentType(f.type) ? [] : '');
    });
    values[step._id] = stepValues;
  });
  return values;
}

/**
 * "같은 입력으로 새로 실행" — 이전 실행 입력을 초기값 위에 얹는다. 지금도 노출인 필드만,
 * 첨부는 미리보기 정보가 없어 다시 고르게 둔다. 옛 실행 기록은 첫 단계 프롬프트만 있다.
 */
export function applyRunPrefill(values, steps, { runInputs, initialPrompt } = {}) {
  const next = { ...values };
  (steps || []).forEach((step, i) => {
    const current = { ...(next[step._id] || {}) };
    const previous = runInputs?.[step._id] || {};
    (step.fields || []).forEach((f) => {
      if (f.mode !== 'exposed' || isAttachmentType(f.type)) return;
      if (previous[f.name] !== undefined) current[f.name] = previous[f.name];
      else if (i === 0 && f.name === 'prompt' && initialPrompt && isBlank(current[f.name])) current[f.name] = initialPrompt;
    });
    next[step._id] = current;
  });
  return next;
}

/** 필수 노출 필드 중 빈 것 — [{ stepIndex, label }] */
export function missingRequiredInputs(steps, values) {
  const missing = [];
  (steps || []).forEach((step, stepIndex) => {
    (step.fields || []).forEach((f) => {
      if (f.mode === 'exposed' && f.required && isBlank(values?.[step._id]?.[f.name])) {
        missing.push({ stepIndex, label: f.label });
      }
    });
  });
  return missing;
}

/** 실행 요청의 inputs — 노출 필드만, 첨부는 미리보기 정보를 빼고 id 만 */
export function buildRunInputs(steps, values) {
  const inputs = {};
  (steps || []).forEach((step) => {
    const out = {};
    (step.fields || []).forEach((f) => {
      if (f.mode !== 'exposed') return;
      const v = values?.[step._id]?.[f.name];
      if (v === undefined) return;
      if (isAttachmentType(f.type)) {
        const key = ATTACHMENT_ID_KEY[f.type];
        out[f.name] = (Array.isArray(v) ? v : [v]).map((entry) => ({ [key]: entry?.[key] || entry?._id || entry }));
      } else {
        out[f.name] = v;
      }
    });
    if (Object.keys(out).length > 0) inputs[step._id] = out;
  });
  return inputs;
}

/** 실행 기록에 보일 입력값 한 줄 */
export function describeRunInput(value, type) {
  if (isAttachmentType(type)) {
    const count = Array.isArray(value) ? value.length : (value ? 1 : 0);
    const noun = { image: '이미지', video: '영상', audio: '오디오' }[type];
    return count > 0 ? `${noun} ${count}개` : '첨부 없음';
  }
  if (type === 'boolean' || typeof value === 'boolean') return value === true || value === 'true' ? '켜짐' : '꺼짐';
  if (isBlank(value)) return '(비어 있음)';
  const text = String(value);
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

// ── 편집기 상태 ───────────────────────────────────────────────────

let clientKeySeq = 0;
const nextClientKey = () => `new-${Date.now()}-${clientKeySeq++}`;

/** 새 단계 (편집기 상태) */
export function newEditorStep(workboard) {
  return {
    clientKey: nextClientKey(),
    workboardId: workboard._id,
    workboard,
    autoInject: true,
    inputs: {},
    inputSources: {},
    contextDocIds: [],
    systemPromptDocId: null,
    note: '',
  };
}

/** 관리 보기 응답(`?view=manage`) → 편집기 상태 */
export function toEditorState(sequence) {
  return {
    name: sequence?.name || '',
    description: sequence?.description || '',
    isActive: sequence?.isActive !== false,
    allowedGroupIds: (sequence?.allowedGroupIds || []).map(idOf),
    steps: (sequence?.steps || []).map((s) => ({
      clientKey: s._id ? String(s._id) : nextClientKey(),
      _id: s._id,
      workboardId: idOf(s.workboardId),
      workboard: s.workboard || null,
      autoInject: s.autoInject !== false,
      inputs: s.inputs || {},
      inputSources: s.inputSources && typeof s.inputSources === 'object' ? s.inputSources : {},
      contextDocIds: (s.contextDocIds || []).map(idOf),
      systemPromptDocId: s.systemPromptDocId ? idOf(s.systemPromptDocId) : null,
      note: s.note || '',
    })),
  };
}

/**
 * 편집기 상태 → 저장 요청 본문. 표시용 workboard 객체와 clientKey 는 빼고, 단계 _id 는 돌려보낸다 —
 * 실행 입력이 단계 id 로 저장되므로 순서를 바꿔 저장해도 유지돼야 한다.
 */
export function buildSequencePayload(form) {
  return {
    name: (form.name || '').trim(),
    description: (form.description || '').trim(),
    isActive: form.isActive !== false,
    allowedGroupIds: form.allowedGroupIds || [],
    steps: (form.steps || []).map((s) => ({
      ...(s._id ? { _id: s._id } : {}),
      workboardId: s.workboardId,
      autoInject: s.autoInject !== false,
      inputs: s.inputs || {},
      inputSources: s.inputSources || {},
      contextDocIds: s.contextDocIds || [],
      systemPromptDocId: s.systemPromptDocId || undefined,
      note: s.note || '',
    })),
  };
}

/** 배열에서 한 항목을 옮긴 새 배열. 범위를 벗어나면 그대로 */
export function moveItem(list, from, to) {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
