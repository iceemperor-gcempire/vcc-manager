// OpenAI Responses API (`/v1/responses`) 호출 (#1293, 에픽 #1267).
//
// OpenAI 공식 서버의 일부 모델(gpt-6.2-sol 등)은 Chat Completions 에서 function tools 를 거부하고
// Responses API 를 쓰라고 한다 (#769 댓글). 채팅 화면은 매 턴 도구를 싣기 때문에 OpenAI 서버는 이 경로로 부른다.
//
// 메시지·도구·반환은 openAIChatService 와 같은 내부 형식이다 (그 파일 머리말 참고) — 여기서는 Responses 의
// 입력 항목으로 옮기고, 응답을 다시 { content, toolCalls, usage } 로 되돌린다. 대화 상태는 서버에 두지 않는다
// (`store: false`) — 기록은 우리 DB 가 갖고, 매번 전체를 다시 보낸다.

const axios = require('axios');
const { StringDecoder } = require('string_decoder');
const { readErrorMessage } = require('./openAIChatService');

// 스트림 조각 사이에 허용하는 침묵. 추론 모델은 첫 글이 나오기까지 오래 조용할 수 있어 넉넉히 둔다
const STREAM_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const extractValue = (input) => (input && typeof input === 'object' && input.value !== undefined ? input.value : input);

/**
 * 내부 메시지를 Responses 입력 항목으로.
 * - assistant 의 도구 호출은 메시지에 딸린 것이 아니라 별도 항목(function_call)이다 — 글이 있으면 글 항목 뒤에 호출을 잇는다
 * - 호출과 결과는 `call_id` 로 짝을 맞춘다. 항목 id(fc_…)는 보내지 않는다 — 보내면 서버가 그 호출에 딸린
 *   reasoning 항목까지 요구한다. call_id 만 있는 꼴로 왕복이 되는 것을 실호출로 확인했다 (#1293)
 */
const toResponsesInput = (messages) => (messages || []).flatMap((m) => {
  if (m.role === 'tool') {
    return [{ type: 'function_call_output', call_id: m.toolCallId, output: m.content || '' }];
  }
  if (m.role === 'assistant' && Array.isArray(m.toolCalls) && m.toolCalls.length > 0) {
    return [
      ...(m.content ? [{ role: 'assistant', content: m.content }] : []),
      ...m.toolCalls.map((c) => ({ type: 'function_call', call_id: c.id, name: c.name, arguments: c.arguments || '{}' })),
    ];
  }
  if (Array.isArray(m.images) && m.images.length > 0) {
    return [{
      role: m.role,
      content: [
        ...(m.content ? [{ type: 'input_text', text: m.content }] : []),
        ...m.images.map((img) => ({ type: 'input_image', image_url: `data:${img.mimeType || 'image/jpeg'};base64,${img.base64}` })),
      ],
    }];
  }
  return [{ role: m.role, content: m.content || '' }];
});

/**
 * 도구 정의. Chat Completions 와 달리 `function` 아래에 넣지 않고 평평하게 둔다.
 * `strict: false` 를 명시한다 — 생략하면 서버가 strict 로 받는데, strict 는 모든 속성이 required 여야 해서
 * 선택 인자가 있는 도구 정의와 맞지 않는다.
 */
const toResponsesTools = (tools) => (Array.isArray(tools) && tools.length > 0
  ? {
      tools: tools.map((t) => ({
        type: 'function',
        name: t.name,
        description: t.description || '',
        parameters: t.parameters || { type: 'object', properties: {} },
        strict: false,
      })),
    }
  : {});

// 보내지 않는 키.
// - Chat Completions 에만 있거나 이 서비스가 직접 정하는 키 (model·input·tools·stream·store 는 뒤에서 덮는다)
// - 서버에 대화 상태를 잇는 키 — 작업판 설정 하나가 모든 사용자의 요청을 같은 서버 쪽 대화에 붙이게 된다.
//   기록은 우리 DB 가 갖고 매번 전체를 보낸다
const DROPPED_PARAMS = new Set([
  'messages', 'stream', 'stream_options', 'n', 'stop',
  'tools', 'tool_choice', 'functions', 'function_call', 'input', 'store',
  'conversation', 'previous_response_id', 'background', 'prompt',
]);

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Chat Completions 의 response_format 을 Responses 의 text.format 으로
function toTextFormat(responseFormat) {
  if (!responseFormat || typeof responseFormat !== 'object') return null;
  if (responseFormat.type === 'json_schema' && responseFormat.json_schema && typeof responseFormat.json_schema === 'object') {
    return { type: 'json_schema', ...responseFormat.json_schema };
  }
  return responseFormat.type ? { type: responseFormat.type } : null;
}

/**
 * 작업판의 추가 LLM 파라미터(Chat Completions 꼴, docs/LLM_EXTRA_PARAMS.md)를 Responses 꼴로.
 * 이름이 다른 것만 옮기고 나머지는 그대로 둔다 — 서버가 모르는 키는 서버가 오류로 알려 준다.
 * 같은 뜻의 키가 겹치면 Responses 이름이 이긴다 (키 순서와 무관): max_output_tokens > max_completion_tokens > max_tokens,
 * reasoning.effort > reasoning_effort, text.format > response_format.
 */
function toResponsesParams(extraParams) {
  const src = isPlainObject(extraParams) ? extraParams : {};
  const out = {};
  for (const [key, value] of Object.entries(src)) {
    if (DROPPED_PARAMS.has(key)) continue;
    if (['reasoning_effort', 'max_tokens', 'max_completion_tokens', 'response_format'].includes(key)) continue;
    out[key] = value;
  }
  const cap = [src.max_output_tokens, src.max_completion_tokens, src.max_tokens].find((v) => v !== undefined && v !== null);
  if (cap !== undefined) out.max_output_tokens = cap;
  if (src.reasoning_effort !== undefined) {
    const given = isPlainObject(src.reasoning) ? src.reasoning : {};
    out.reasoning = { effort: src.reasoning_effort, ...given };
  }
  const format = toTextFormat(src.response_format);
  if (format) {
    const given = isPlainObject(src.text) ? src.text : {};
    out.text = { format, ...given };
  }
  return out;
}

/**
 * 완료된 응답 본문(response.output)을 내부 형식으로.
 * 내부 toolCalls 의 id 는 `call_id` 다 — 도구 결과가 이 값으로 짝을 맞춘다 (항목 id 가 아니다).
 */
function fromResponsesOutput(output, { wantsTools }) {
  const items = Array.isArray(output) ? output : [];
  const texts = [];
  const refusals = [];
  for (const item of items) {
    if (item?.type !== 'message') continue;
    for (const part of (Array.isArray(item.content) ? item.content : [])) {
      if (part?.type === 'output_text' && part.text) texts.push(part.text);
      else if (part?.type === 'refusal' && part.refusal) refusals.push(part.refusal);
    }
  }
  const toolCalls = wantsTools
    ? items
        .filter((item) => item?.type === 'function_call' && item.name)
        .map((item, i) => ({
          id: item.call_id || item.id || `call_${i}`,
          name: item.name,
          arguments: typeof item.arguments === 'string' ? (item.arguments || '{}') : JSON.stringify(item.arguments || {}),
        }))
    : [];
  return { content: texts.join('\n\n') || refusals.join('\n\n'), toolCalls };
}

const normalizeUsage = (usage) => ({
  promptTokens: usage?.input_tokens || 0,
  completionTokens: usage?.output_tokens || 0,
  totalTokens: usage?.total_tokens || 0,
});

/**
 * `/v1/responses` 를 스트리밍으로 부른다. 글 조각은 onToken 으로 흘리고, 결과는 완료 이벤트에 실려 오는
 * 전체 출력에서 만든다 (조각을 다시 조립하지 않는다).
 * 반환은 openAIChatService.completeStream 과 같다: { content, toolCalls, usage }
 */
const completeStream = async (serverUrl, apiKey, messages, options = {}, onToken) => {
  const resolvedServerUrl = (serverUrl || '').replace(/\/+$/, '');
  if (!resolvedServerUrl) throw new Error('OpenAI Responses: serverUrl is required');
  const model = extractValue(options.model);
  if (!model) throw new Error('OpenAI Responses: model is required');

  const wantsTools = Array.isArray(options.tools) && options.tools.length > 0;
  const requestBody = {
    ...toResponsesParams(options.extraParams),
    model,
    input: toResponsesInput(messages),
    ...toResponsesTools(options.tools),
    stream: true,
    store: false,
  };

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let response;
  try {
    response = await axios.post(
      `${resolvedServerUrl}/v1/responses`,
      requestBody,
      { headers, timeout: options.timeout || 60000, responseType: 'stream' },
    );
  } catch (err) {
    const apiMessage = await readErrorMessage(err);
    if (apiMessage && /organization must be verified/i.test(apiMessage)) {
      throw new Error(
        `${model} 모델 사용에는 OpenAI 조직 인증(Verify Organization)이 필요합니다. https://platform.openai.com/settings/organization/general 에서 인증 후 약 15분 대기하세요.`
      );
    }
    if (apiMessage) throw new Error(`OpenAI: ${apiMessage}`);
    throw err;
  }

  let buffer = '';
  let final = null; // 완료(또는 중단)된 응답 본문
  let failure = null; // 스트림 안에서 온 오류 — HTTP 는 200 이어도 실패일 수 있다

  const handleEvent = (json) => {
    switch (json?.type) {
      case 'response.output_text.delta':
        if (json.delta && typeof onToken === 'function') onToken(json.delta);
        break;
      case 'response.completed':
      case 'response.incomplete':
        final = json.response || {};
        break;
      case 'response.failed':
        failure = json.response?.error?.message || '응답 생성에 실패했습니다.';
        break;
      case 'error':
        failure = json.message || json.error?.message || '응답 생성에 실패했습니다.';
        break;
      default:
    }
  };

  // 청크 경계가 글자 중간(한글은 3바이트)에 올 수 있다 — 디코더가 남은 바이트를 다음 청크와 합친다
  const decoder = new StringDecoder('utf8');
  const stream = response.data;
  // axios 의 timeout 은 응답 머리까지만 본다. 본문이 오다 멈추면 영영 기다리게 되므로, 조각 사이의 침묵에 기한을 둔다
  const idleMs = options.streamIdleTimeout || STREAM_IDLE_TIMEOUT_MS;
  await new Promise((resolve, reject) => {
    let settled = false;
    let idle = null;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(idle);
      if (err) reject(err); else resolve();
    };
    const arm = () => {
      clearTimeout(idle);
      idle = setTimeout(() => {
        if (typeof stream.destroy === 'function') stream.destroy();
        finish(new Error(`OpenAI: ${Math.round(idleMs / 1000)}초 동안 응답이 오지 않아 중단했습니다.`));
      }, idleMs);
    };
    arm();
    stream.on('data', (chunk) => {
      if (settled) return;
      arm();
      buffer += typeof chunk === 'string' ? chunk : decoder.write(chunk);
      let nl;
      // SSE 는 줄 단위 — 청크 경계에서 잘린 줄은 buffer 에 남겨 다음 청크와 합친다. `event:` 줄은 안 본다
      // (같은 종류가 data 의 type 에 있다)
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let json;
        try { json = JSON.parse(data); } catch { continue; }
        handleEvent(json);
        // 끝을 알리는 이벤트를 받았으면 연결이 닫히기를 기다리지 않는다
        if (final || failure) {
          if (typeof stream.destroy === 'function') stream.destroy();
          finish();
          return;
        }
      }
    });
    stream.on('end', () => finish());
    stream.on('close', () => finish()); // 끝 이벤트 없이 닫혔으면 아래에서 "중간에 끊겼습니다"
    stream.on('error', (err) => finish(err));
  });

  if (failure) throw new Error(`OpenAI: ${failure}`);
  // 완료 이벤트 없이 닫혔다 — 빈 응답으로 넘기면 원인이 사라진다
  if (!final) throw new Error('OpenAI: 응답이 중간에 끊겼습니다.');

  const incomplete = final.status === 'incomplete';
  // 멈춘 응답의 도구 호출은 받지 않는다 — 인자가 잘렸을 수 있고, 빈 인자는 {} 로 읽혀 그대로 실행된다.
  // 실행하지도 기록에 남기지도 않는다
  const { content, toolCalls } = fromResponsesOutput(final.output, { wantsTools: wantsTools && !incomplete });
  if (incomplete && !content) {
    throw new Error(`OpenAI: 응답이 끝나기 전에 멈췄습니다 (${final.incomplete_details?.reason || '사유 없음'}).`);
  }
  return { content, toolCalls, usage: normalizeUsage(final.usage) };
};

module.exports = { completeStream, toResponsesInput, toResponsesTools, toResponsesParams, fromResponsesOutput };
