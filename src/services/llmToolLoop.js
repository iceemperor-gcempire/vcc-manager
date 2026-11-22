// LLM 툴 콜 재호출 루프 (#769).
//
// 모델을 부르고, 모델이 도구를 부르면 실행해 결과를 `role: 'tool'` 메시지로 붙여 다시 부른다.
// 모델이 도구 없이 답하면 끝난다. provider 에 묶이지 않는다 — 호출은 `callModel` 이 하고,
// 메시지는 내부 형식(openAIChatService 머리말 참고)을 쓴다.
//
// 도구 실행은 `handlers[name](args, call)` 이 한다. 요청자 권한 경계는 핸들러를 만드는 쪽 책임이다
// (핸들러를 요청자에 묶어 만들어 넘긴다) — 이 루프는 누가 부르는지 모른다.
//
// 도구 쪽 실패는 전부 throw 하지 않고 도구 결과로 모델에게 돌려준다. 모델이 인자를 고쳐 다시
// 부를 수 있고, 대화가 중간에 끊기지 않는다. 모델 호출 자체의 실패(`callModel` throw)만 밖으로 나간다.

const DEFAULT_MAX_ROUNDS = 8;
// 도구 결과 하나의 글자 수 상한 — 목록형 도구가 컨텍스트를 다 채우지 못하게 한다
const DEFAULT_MAX_RESULT_CHARS = 20_000;

const addUsage = (a, b) => ({
  promptTokens: (a.promptTokens || 0) + (b?.promptTokens || 0),
  completionTokens: (a.completionTokens || 0) + (b?.completionTokens || 0),
  totalTokens: (a.totalTokens || 0) + (b?.totalTokens || 0),
});

// 도구 결과를 모델에게 줄 문자열로. 문자열은 그대로, 나머지는 JSON.
const serializeResult = (value, maxChars) => {
  let text;
  if (typeof value === 'string') text = value;
  else {
    try { text = JSON.stringify(value === undefined ? null : value); } catch (_) { text = String(value); }
  }
  if (text.length <= maxChars) return { text, truncated: false };
  return {
    text: `${text.slice(0, maxChars)}\n…(결과가 길어 ${text.length}자 중 ${maxChars}자만 실었습니다)`,
    truncated: true,
  };
};

const errorResult = (message) => JSON.stringify({ error: message });

/**
 * 도구 호출 하나를 실행해 도구 결과 문자열과 판정을 돌려준다. throw 하지 않는다.
 * outcome: 'ok' | 'unknown_tool' | 'bad_arguments' | 'handler_error'
 */
async function runToolCall(call, handlers, maxResultChars) {
  const handler = Object.prototype.hasOwnProperty.call(handlers, call.name) ? handlers[call.name] : null;
  if (typeof handler !== 'function') {
    return {
      outcome: 'unknown_tool',
      content: errorResult(`없는 도구입니다: ${call.name}. 쓸 수 있는 도구: ${Object.keys(handlers).join(', ') || '(없음)'}`),
    };
  }
  let args;
  try {
    args = call.arguments && call.arguments.trim() ? JSON.parse(call.arguments) : {};
  } catch (e) {
    return { outcome: 'bad_arguments', content: errorResult(`도구 인자가 올바른 JSON 이 아닙니다: ${e.message}`) };
  }
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return { outcome: 'bad_arguments', content: errorResult('도구 인자는 JSON 객체여야 합니다.') };
  }
  try {
    const value = await handler(args, call);
    const { text, truncated } = serializeResult(value, maxResultChars);
    return { outcome: 'ok', content: text, truncated, args };
  } catch (e) {
    return { outcome: 'handler_error', content: errorResult(e?.message || String(e)), args };
  }
}

/**
 * @param {Object} opts
 * @param {Array} opts.messages 지금까지의 대화 (내부 형식). 바꾸지 않는다
 * @param {Array} opts.tools 도구 정의 [{ name, description, parameters }]
 * @param {Object} opts.handlers 도구 이름 → async (args, call) => 결과
 * @param {Function} opts.callModel async (messages, tools) => { content, toolCalls, usage }
 * @param {number} [opts.maxRounds] 도구를 실행하는 라운드 상한. 넘으면 도구 없이 한 번 더 불러 답을 받는다
 * @param {Function} [opts.onToolCall] (call) => void — 실행 직전
 * @param {Function} [opts.onToolResult] (call, { outcome, content }) => void — 실행 직후
 * @param {Function} [opts.log] 한 줄 로그 (기본 console.log)
 * @returns {Promise<{ content, newMessages, usage, rounds, toolCalls, limitReached }>}
 *   newMessages — 이번 루프에서 생긴 assistant·tool 메시지 (저장용, 순서대로)
 */
async function runToolLoop({
  messages,
  tools = [],
  handlers = {},
  callModel,
  maxRounds = DEFAULT_MAX_ROUNDS,
  maxResultChars = DEFAULT_MAX_RESULT_CHARS,
  onToolCall,
  onToolResult,
  log = console.log,
}) {
  if (typeof callModel !== 'function') throw new Error('runToolLoop: callModel is required');

  const working = [...(messages || [])];
  const newMessages = [];
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let rounds = 0;
  let toolCallCount = 0;
  let limitReached = false;
  const outcomes = { ok: 0, unknown_tool: 0, bad_arguments: 0, handler_error: 0 };

  for (;;) {
    // 상한에 닿으면 도구를 빼고 부른다 — 모델이 지금까지의 결과로 답을 마무리하게 한다
    const offered = limitReached ? [] : tools;
    const reply = await callModel(working, offered);
    usage = addUsage(usage, reply?.usage);
    const calls = limitReached ? [] : (Array.isArray(reply?.toolCalls) ? reply.toolCalls : []);

    const assistant = { role: 'assistant', content: reply?.content || '' };
    if (calls.length > 0) assistant.toolCalls = calls;
    working.push(assistant);
    newMessages.push(assistant);

    if (calls.length === 0) {
      // 0건이어도 남긴다 — "도구를 안 불렀다"와 "루프가 안 돌았다"가 로그에서 갈려야 한다
      log(`[llmToolLoop] done rounds=${rounds} toolCalls=${toolCallCount} ok=${outcomes.ok} unknownTool=${outcomes.unknown_tool} badArguments=${outcomes.bad_arguments} handlerError=${outcomes.handler_error} limitReached=${limitReached}`);
      return { content: assistant.content, newMessages, usage, rounds, toolCalls: toolCallCount, limitReached };
    }

    rounds += 1;
    for (const call of calls) {
      toolCallCount += 1;
      if (typeof onToolCall === 'function') onToolCall(call);
      const result = await runToolCall(call, handlers, maxResultChars);
      outcomes[result.outcome] += 1;
      log(`[llmToolLoop] round=${rounds} tool=${call.name} outcome=${result.outcome} resultChars=${result.content.length}${result.truncated ? ' truncated=true' : ''}`);
      const toolMessage = { role: 'tool', toolCallId: call.id, name: call.name, content: result.content };
      working.push(toolMessage);
      newMessages.push(toolMessage);
      if (typeof onToolResult === 'function') onToolResult(call, { outcome: result.outcome, content: result.content });
    }

    if (rounds >= maxRounds) {
      limitReached = true;
      log(`[llmToolLoop] 라운드 상한 도달 maxRounds=${maxRounds} — 도구 없이 마무리 호출`);
    }
  }
}

module.exports = { runToolLoop, runToolCall, DEFAULT_MAX_ROUNDS, DEFAULT_MAX_RESULT_CHARS };
