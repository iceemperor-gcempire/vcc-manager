import Cookies from 'js-cookie';
import { API_BASE_URL } from './api';

// SSE 스트리밍 클라이언트 (#490, 채팅 화면 #1288).
// axios 는 브라우저에서 스트림 응답을 점진적으로 읽기 어려워 fetch + ReadableStream 사용.

/**
 * SSE 프레임 하나(빈 줄로 끊긴 덩어리)를 { event, data } 로. data 가 없으면 null (하트비트 코멘트 등).
 * data 는 JSON 이면 파싱한 값, 아니면 문자열 그대로.
 */
export function parseSseFrame(frame) {
  let event = 'message';
  const dataLines = [];
  for (const rawLine of frame.split('\n')) {
    const line = rawLine.trimEnd();
    if (line.startsWith(':')) continue; // 코멘트(하트비트) 무시
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
  }
  // data 줄이 여럿이면 줄바꿈으로 잇는다 (SSE 규약)
  const dataStr = dataLines.join('\n');
  if (!dataStr.trim()) return null;
  let data;
  try { data = JSON.parse(dataStr); } catch { data = dataStr; }
  return { event, data };
}

/** 지금까지 받은 글자에서 끝난 프레임을 꺼낸다. 덜 온 꼬리는 rest 로 돌려준다 */
export function takeSseFrames(buffer) {
  const events = [];
  // CRLF 로 보내는 서버도 받는다. 조각 끝에 걸린 \r 하나는 rest 에 남았다가 다음 조각의 \n 과 만난다
  let rest = buffer.replace(/\r\n/g, '\n');
  let sep;
  while ((sep = rest.indexOf('\n\n')) !== -1) {
    const parsed = parseSseFrame(rest.slice(0, sep));
    rest = rest.slice(sep + 2);
    if (parsed) events.push(parsed);
  }
  return { events, rest };
}

/**
 * POST 로 SSE 를 열어 이벤트마다 onEvent(event, data) 를 부른다.
 * 스트림을 열기 전 실패(검증 단계의 JSON 응답)와 연결 오류는 onError(Error) — err.status 에 HTTP 상태.
 * 스트림이 끝나면 onClose().
 */
function postSse(path, payload, { onEvent, onError, onClose, signal } = {}) {
  const token = Cookies.get('token');
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  (async () => {
    let res;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      });
    } catch (err) {
      if (err?.name !== 'AbortError') onError?.(err);
      return;
    }

    // 스트리밍 시작 전(검증 단계) 실패는 JSON 으로 옴
    if (!res.ok || !res.body) {
      let message = `요청 실패 (HTTP ${res.status})`;
      try {
        const j = await res.json();
        message = j.message || message;
      } catch (_) { /* JSON 아님 */ }
      const error = new Error(message);
      error.status = res.status;
      onError?.(error);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const taken = takeSseFrames(buffer + decoder.decode(value, { stream: true }));
        buffer = taken.rest;
        for (const { event, data } of taken.events) onEvent?.(event, data);
      }
      onClose?.();
    } catch (err) {
      if (err?.name !== 'AbortError') onError?.(err);
    }
  })();

  return signal;
}

// 백엔드 /api/jobs/generate-prompt 가 보내는 SSE 이벤트:
//   event: token  data: {"delta":"..."}   — 토큰 조각
//   event: done   data: {conversationId, result, usage, costEstimate, model}
//   event: error  data: {"message":"..."}
//
// callbacks: { onToken(delta), onDone(info), onError(error) }
export function streamPrompt(payload, { onToken, onDone, onError, signal } = {}) {
  let finished = false;
  return postSse('/jobs/generate-prompt', payload, {
    signal,
    onError,
    onEvent: (event, data) => {
      if (event === 'token') onToken?.(data.delta ?? '');
      else if (event === 'done') { finished = true; onDone?.(data); }
      else if (event === 'error') { finished = true; onError?.(new Error(data.message || '생성 중 오류가 발생했습니다.')); }
    },
    // done·error 없이 스트림이 닫혔다 — 알리지 않으면 화면이 '받는 중'에 멈춘다
    onClose: () => { if (!finished) onError?.(new Error('응답이 중간에 끊겼습니다. 다시 시도해 주세요.')); },
  });
}

// 채팅 화면 (#1288) — POST /api/chat/messages.
//   payload: { sessionId?, workboardId? (새 대화에 필수), text, imageIds? }
//   onEvent(event, data): session { sessionId, title } → token { delta } / tool_call { id, name } /
//     tool_result { id, name, outcome } / round / job { jobId, status, workboard } → done | error { message }
//   onError 는 스트림을 열지 못한 경우(400·409 등)와 연결이 끊긴 경우. 턴 안의 오류는 'error' 이벤트로 온다
export function streamChatMessage(payload, handlers = {}) {
  return postSse('/chat/messages', payload, handlers);
}
