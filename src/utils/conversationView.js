// 대화 기록을 읽는 쪽이 함께 쓰는 판정·가공 (#1282).
//
// 채팅 화면의 대화(kind: 'chat')에는 도구 메시지가 섞인다. 기존 독자(작업 히스토리 목록,
// AI 프롬프트 생성 이어가기, 텍스트 저장)가 그 형태를 만나도 깨지지 않게 하는 규칙을 한 곳에 둔다.

/** 목록 응답에서 도구 결과 한 건에 남기는 글자 수 — 도구 결과는 건당 최대 2만 자다 (llmToolLoop) */
const LIST_TOOL_CONTENT_CHARS = 200;

/** 채팅 화면의 대화인가 — mongoose 문서·lean 객체 모두 받는다. kind 가 없는 옛 문서는 아니다 */
const isChatConversation = (conversation) => !!conversation && conversation.kind === 'chat';

/**
 * 목록 응답용으로 대화를 줄인다. 도구 결과 본문만 자르고, 메시지 수와 순서는 그대로 둔다 —
 * 화면이 목록에서 받은 메시지의 순번(messageIndex)으로 텍스트 저장을 부르기 때문이다.
 * 전체 본문은 상세(GET /conversations/:id)에서 읽는다.
 */
function toConversationListItem(conversation) {
  if (!conversation || !Array.isArray(conversation.messages)) return conversation;
  let trimmed = false;
  const messages = conversation.messages.map((m) => {
    if (!m || m.role !== 'tool' || typeof m.content !== 'string' || m.content.length <= LIST_TOOL_CONTENT_CHARS) return m;
    trimmed = true;
    return { ...m, content: `${m.content.slice(0, LIST_TOOL_CONTENT_CHARS)}…`, contentTruncated: true };
  });
  return trimmed ? { ...conversation, messages } : conversation;
}

/** 채팅 턴이 processing 에 머문 지 이만큼 지나면 죽은 턴으로 본다 (서버 재시작 등) — 다시 보내기·삭제를 받는다 */
const STALE_TURN_MS = 10 * 60 * 1000;

/** 채팅 턴이 돌고 있는가 — 오래된 processing 은 죽은 턴으로 본다. mongoose 문서·lean 객체 모두 받는다 */
function isTurnInProgress(conversation, now = Date.now()) {
  if (!conversation || conversation.status !== 'processing') return false;
  const touched = new Date(conversation.updatedAt || conversation.createdAt || 0).getTime();
  return now - touched < STALE_TURN_MS;
}

/**
 * isTurnInProgress 가 거짓인 대화만 고르는 DB 조건. 턴을 잡거나 대화를 지울 때 조회 조건에 섞어 쓴다 —
 * "읽고 → 판정하고 → 쓰기" 사이에 다른 요청이 턴을 잡으면 판정이 틀어지므로, 판정과 쓰기를 한 번에 한다.
 */
const idleTurnFilter = (now = Date.now()) => {
  const cutoff = new Date(now - STALE_TURN_MS);
  // isTurnInProgress 와 같은 판정: 기준 시각은 updatedAt, 없으면 createdAt, 둘 다 없으면 아주 오래된 것으로 본다.
  // 경계(딱 STALE_TURN_MS 지난 것)는 죽은 턴이다
  return {
    $or: [
      { status: { $ne: 'processing' } },
      { updatedAt: { $lte: cutoff } },
      { updatedAt: null, $or: [{ createdAt: null }, { createdAt: { $lte: cutoff } }] },
    ],
  };
};

module.exports = { isChatConversation, toConversationListItem, isTurnInProgress, idleTurnFilter, LIST_TOOL_CONTENT_CHARS, STALE_TURN_MS };
