import Cookies from 'js-cookie';
import { API_BASE_URL } from './api';

// 텍스트 챗 SSE 스트리밍 클라이언트 (#490).
// axios 는 브라우저에서 스트림 응답을 점진적으로 읽기 어려워 fetch + ReadableStream 사용.
// 백엔드 /api/jobs/generate-prompt 가 보내는 SSE 이벤트:
//   event: token  data: {"delta":"..."}   — 토큰 조각
//   event: done   data: {conversationId, result, usage, costEstimate, model}
//   event: error  data: {"message":"..."}
//
// callbacks: { onToken(delta), onDone(info), onError(error) }
// 반환: abort 가능한 AbortController. 호출자가 언마운트 시 .abort() 가능(선택).
export function streamPrompt(payload, { onToken, onDone, onError, signal } = {}) {
  const token = Cookies.get('token');
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  (async () => {
    let res;
    try {
      res = await fetch(`${API_BASE_URL}/jobs/generate-prompt`, {
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
      onError?.(new Error(message));
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
        buffer += decoder.decode(value, { stream: true });

        // SSE 프레임은 빈 줄(\n\n)로 구분
        let sep;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);

          let event = 'message';
          let dataStr = '';
          for (const rawLine of frame.split('\n')) {
            const line = rawLine.trimEnd();
            if (line.startsWith(':')) continue; // 코멘트(하트비트) 무시
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
          }
          if (!dataStr) continue;

          let data;
          try { data = JSON.parse(dataStr); } catch { data = dataStr; }

          if (event === 'token') onToken?.(data.delta ?? '');
          else if (event === 'done') onDone?.(data);
          else if (event === 'error') onError?.(new Error(data.message || '생성 중 오류가 발생했습니다.'));
        }
      }
    } catch (err) {
      if (err?.name !== 'AbortError') onError?.(err);
    }
  })();

  return signal;
}
