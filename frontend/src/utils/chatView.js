// 채팅 화면의 표시 변환 (#1288).
//
// 저장된 대화(ConversationJob.messages)에는 화면에 그대로 보이면 안 되는 것이 섞여 있다 — system 메시지,
// 도구만 부르고 글은 없는 assistant 메시지, JSON 덩어리인 tool 메시지. 여기서 화면 줄(row)로 바꾼다.
// 스트리밍 중인 턴도 같은 줄 모양으로 만들어 저장본과 똑같이 그린다.

const TOOL_LABELS = {
  find_workboards: '작업판 찾기',
  get_workboard: '작업판 살펴보기',
  generate: '생성 요청',
  get_job: '작업 상태 확인',
};

/** 도구 이름 → 화면 문구. 모르는 도구는 이름 그대로 (새 도구가 생겨도 줄은 보인다) */
export function toolLabel(name) {
  return TOOL_LABELS[name] || name || '도구';
}

/** 도구 결과 본문에서 실패 문구를 꺼낸다. 실패가 아니면 '' */
function toolErrorOf(content) {
  if (typeof content !== 'string' || !content.trim().startsWith('{')) return '';
  try {
    const parsed = JSON.parse(content);
    return typeof parsed?.error === 'string' ? parsed.error : '';
  } catch {
    return ''; // 목록용으로 잘린 본문 등 — 실패로 보지 않는다
  }
}

function pushStep(rows, step) {
  const last = rows[rows.length - 1];
  if (last && last.kind === 'tools') last.steps.push(step);
  else rows.push({ kind: 'tools', steps: [step] });
}

/**
 * 저장된 메시지 → 화면 줄.
 *   { kind: 'bubble', role: 'user'|'assistant', content, attachments }
 *   { kind: 'tools', steps: [{ id, name, label, status: 'running'|'ok'|'failed', error }] }
 * 연달아 나온 도구 호출은 한 줄로 묶는다. 결과가 아직 없는 호출은 'running'.
 */
export function toChatRows(messages) {
  const rows = [];
  const steps = new Map();
  for (const m of messages || []) {
    if (!m || m.role === 'system') continue;
    if (m.role === 'tool') {
      const step = steps.get(m.toolCallId);
      if (!step) continue; // 짝 없는 결과는 그리지 않는다
      const error = toolErrorOf(m.content);
      step.status = error ? 'failed' : 'ok';
      step.error = error;
      continue;
    }
    const content = typeof m.content === 'string' ? m.content : '';
    if (m.role === 'user' || content.trim()) {
      rows.push({ kind: 'bubble', role: m.role, content, attachments: m.attachments || [] });
    }
    for (const call of (m.role === 'assistant' && m.toolCalls) || []) {
      const step = { id: call.id, name: call.name, label: toolLabel(call.name), status: 'running', error: '' };
      steps.set(call.id, step);
      pushStep(rows, step);
    }
  }
  return rows;
}

/** 스트리밍 중인 턴의 빈 상태 */
export function emptyLiveTurn() {
  return { rows: [], jobs: [] };
}

/**
 * 스트림 이벤트 하나를 스트리밍 중인 턴에 반영한 새 턴을 돌려준다 (원본은 건드리지 않는다).
 * 글 조각은 마지막 assistant 말풍선에 붙고, 도구 호출이 끼면 그 뒤 글은 새 말풍선이 된다.
 */
export function applyChatEvent(turn, event, data) {
  const rows = turn.rows.map((r) => (r.kind === 'tools' ? { ...r, steps: r.steps.map((s) => ({ ...s })) } : { ...r }));
  const next = { rows, jobs: turn.jobs };
  if (event === 'token') {
    const delta = data?.delta || '';
    if (!delta) return turn;
    const last = rows[rows.length - 1];
    if (last && last.kind === 'bubble' && last.role === 'assistant') last.content += delta;
    else rows.push({ kind: 'bubble', role: 'assistant', content: delta, attachments: [] });
    return next;
  }
  if (event === 'tool_call') {
    pushStep(rows, { id: data?.id, name: data?.name, label: toolLabel(data?.name), status: 'running', error: '' });
    return next;
  }
  if (event === 'tool_result') {
    // 가장 최근의, 아직 결과가 없는 호출에 잇는다 — 라운드마다 같은 id(call_0)를 다시 쓰는 서버가 있다
    const running = rows.flatMap((row) => (row.kind === 'tools' ? row.steps : [])).filter((s) => s.id === data?.id && s.status === 'running');
    const step = running[running.length - 1];
    if (step) step.status = data?.outcome === 'ok' ? 'ok' : 'failed';
    return next;
  }
  if (event === 'job') {
    if (!data?.jobId || turn.jobs.some((j) => j._id === data.jobId)) return turn;
    next.jobs = [...turn.jobs, {
      _id: data.jobId,
      status: data.status || 'pending',
      workboardId: { _id: data.workboard?.id, name: data.workboard?.name, outputFormat: data.workboard?.output },
    }];
    return next;
  }
  return turn;
}

const ACTIVE_JOB_STATUSES = ['pending', 'processing'];

/** 아직 끝나지 않은 작업인지 */
export function isJobActive(job) {
  return !!job && ACTIVE_JOB_STATUSES.includes(job.status);
}

/** 서버가 준 작업 목록에, 스트림으로 먼저 알게 된 작업(아직 목록에 없는 것)을 뒤에 붙인다 */
export function mergeJobs(serverJobs, liveJobs) {
  const known = new Set((serverJobs || []).map((j) => String(j._id)));
  return [...(serverJobs || []), ...(liveJobs || []).filter((j) => !known.has(String(j._id)))];
}

/** 작업 결과물 목록 — 종류를 붙여 한 줄로 */
export function jobResults(job) {
  return [
    ...(job?.resultImages || []).map((m) => ({ type: 'image', media: m })),
    ...(job?.resultVideos || []).map((m) => ({ type: 'video', media: m })),
    ...(job?.resultAudios || []).map((m) => ({ type: 'audio', media: m })),
  ].filter((r) => r.media && typeof r.media === 'object');
}

/**
 * 대화가 서버에서 아직 도는 중인지 (화면을 떠났다 돌아온 경우 포함).
 * 서버가 준 turnInProgress 를 쓴다 — status 가 processing 이어도 오래 멈춘 턴(서버 재시작 등)은 서버가
 * 아니라고 답하고, 그때는 다시 보낼 수 있어야 한다. 기준 시간은 서버(utils/conversationView)에만 있다.
 */
export function isSessionBusy(detail) {
  return detail?.turnInProgress === true;
}
