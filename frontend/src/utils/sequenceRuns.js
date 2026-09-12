// 작업 절차 화면의 판정·변환 (#952). 관리 편집기, 사용자 목록, 실행 기록이 같은 규칙을 쓴다.

const idOf = (v) => String(v && typeof v === 'object' && v._id ? v._id : v);

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
      contextDocIds: (s.contextDocIds || []).map(idOf),
      systemPromptDocId: s.systemPromptDocId ? idOf(s.systemPromptDocId) : null,
      note: s.note || '',
    })),
  };
}

/**
 * 편집기 상태 → 저장 요청 본문. 표시용 workboard 객체와 clientKey 는 빼고, 단계 _id 는 돌려보낸다 —
 * 입력 노출(#953)·멀티인풋에서 단계를 id 로 가리키므로 순서를 바꿔 저장해도 유지돼야 한다.
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
