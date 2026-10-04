/**
 * HTTP client factory for VCC Manager API.
 *
 * Creates a bound apiRequest function with the given API key.
 * - HTTP mode: API key comes from client's Bearer token (per-session)
 * - stdio mode: API key comes from VCC_API_KEY environment variable
 */

const API_URL = process.env.VCC_API_URL || 'http://localhost:3000';

/**
 * SSE 본문 → [{ event, data }]. 주석 줄(`:`)은 버리고, data 가 JSON 이면 파싱한다.
 * @param {string} text
 */
export function parseSseEvents(text) {
  const events = [];
  for (const block of String(text || '').split(/\r?\n\r?\n/)) {
    let event = 'message';
    const dataLines = [];
    for (const line of block.split(/\r?\n/)) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    if (dataLines.length === 0) continue;
    const raw = dataLines.join('\n');
    let data = raw;
    try { data = JSON.parse(raw); } catch { /* 문자열 그대로 */ }
    events.push({ event, data });
  }
  return events;
}

/** generate-prompt 의 SSE 를 결과로 바꾼다 — done 이면 그 데이터, error 면 예외. */
export function resultFromSse(text) {
  const events = parseSseEvents(text);
  const failed = events.find((e) => e.event === 'error');
  if (failed) throw new Error(`생성 실패: ${failed.data?.message || failed.data}`);
  const done = events.find((e) => e.event === 'done');
  if (!done) throw new Error(`생성 결과를 받지 못했습니다 (받은 이벤트 ${events.length}개, 완료 없음)`);
  return done.data;
}

/**
 * Create an API request function bound to a specific API key.
 *
 * @param {string} apiKey - VCC Manager API Key
 * @returns {(path: string, options?: object) => Promise<any>}
 */
export function createApiClient(apiKey, { onAuthFailure } = {}) {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  return async function apiRequest(path, options = {}) {
    const { method = 'GET', body, params, responseType, formData } = options;

    const url = new URL(`${API_URL}/api${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const fetchOptions = {
      method,
      headers: {
        'X-API-Key': apiKey,
        // formData일 때는 Content-Type 헤더를 설정하지 않음 (fetch가 boundary 자동 생성)
        ...(body && !formData ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(formData ? { body: formData } : body ? { body: JSON.stringify(body) } : {}),
    };

    const res = await fetch(url.toString(), fetchOptions);

    // 키가 폐기·교체되면 백엔드가 401 을 준다. 세션이 그 키를 계속 붙잡지 않도록 알린다 (#993)
    if (res.status === 401 && onAuthFailure) onAuthFailure();

    if (responseType === 'buffer') {
      if (!res.ok) {
        throw new Error(`API request failed (${res.status}): ${res.statusText}`);
      }
      return {
        buffer: Buffer.from(await res.arrayBuffer()),
        headers: res.headers,
      };
    }

    const rawText = await res.text();

    // 텍스트 작업판 생성(/jobs/generate-prompt)은 SSE 로 흘려보낸다 (#1015). 끝까지 읽고 결과만 돌려준다.
    // 생성 전 검증 실패(400/403/404)는 SSE 가 아니라 JSON 이므로 아래 기존 경로로 간다.
    if (res.ok && (res.headers.get('content-type') || '').includes('text/event-stream')) {
      return resultFromSse(rawText);
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error(`[MCP] JSON parse error on ${method} ${path} (${res.status}):`, rawText.slice(0, 500));
      throw new Error(`API response is not valid JSON (${res.status} ${method} ${path})`);
    }

    if (!res.ok) {
      throw new Error(`API request failed (${res.status}): ${data.message || res.statusText}`);
    }

    return data;
  };
}

/**
 * 세션을 열기 전에 키가 백엔드에서 통하는지 본다 (#993).
 * MCP 키·범용 키 모두 허용되는 가벼운 조회로 확인한다.
 *
 * @returns {Promise<'ok' | 'invalid' | 'unknown'>} 'invalid' 는 백엔드가 401 을 준 경우뿐이다.
 *   백엔드가 안 닿는 등 판단할 수 없으면 'unknown' — 연결을 막지 않는다.
 */
export async function checkApiKey(apiKey) {
  try {
    const res = await fetch(`${API_URL}/api/workboards?limit=1`, { headers: { 'X-API-Key': apiKey } });
    if (res.status === 401) return 'invalid';
    return res.ok ? 'ok' : 'unknown';
  } catch {
    return 'unknown';
  }
}
