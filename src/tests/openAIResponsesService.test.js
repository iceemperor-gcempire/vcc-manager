/**
 * openAIResponsesService (#1293) — OpenAI 공식 서버의 채팅 호출 경로.
 *
 * 내부 형식 ↔ Responses 입력·출력 변환, 추가 파라미터 옮기기, 스트림 읽기를 고정한다.
 * 스트림 픽스처(fixtures/openai-responses-toolcalls.sse)는 gpt-6.2-sol 실호출을 그대로 받아 둔 것이다 —
 * 글 한 줄 뒤에 도구 호출 둘.
 */
jest.mock('axios');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const axios = require('axios');
const {
  completeStream, toResponsesInput, toResponsesTools, toResponsesParams, fromResponsesOutput,
} = require('../services/openAIResponsesService');

const CAPTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'openai-responses-toolcalls.sse'), 'utf8');
const TOOLS = [{ name: 'get_weather', description: '날씨', parameters: { type: 'object', properties: { city: { type: 'string' } } } }];
const sse = (...events) => events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');

/** 본문을 주어진 크기로 잘라 흘리는 가짜 스트림 응답 */
function streamOf(body, chunkSize = body.length || 1) {
  const emitter = new EventEmitter();
  const buf = Buffer.from(body, 'utf8');
  setImmediate(() => {
    for (let i = 0; i < buf.length; i += chunkSize) emitter.emit('data', buf.subarray(i, i + chunkSize));
    emitter.emit('end');
  });
  return { data: emitter };
}

const run = (body, { chunkSize, options = { model: 'm', tools: TOOLS }, messages = [{ role: 'user', content: 'hi' }] } = {}) => {
  axios.post.mockResolvedValue(streamOf(body, chunkSize));
  const tokens = [];
  return completeStream('http://llm/', 'k', messages, options, (d) => tokens.push(d)).then((r) => ({ ...r, tokens }));
};

beforeEach(() => jest.clearAllMocks());

describe('toResponsesInput', () => {
  test('도구 호출이 있는 assistant 는 글 항목과 호출 항목들로 풀고, 결과는 call_id 로 짝을 맞춘다', () => {
    const input = toResponsesInput([
      { role: 'system', content: 'sys' },
      { role: 'user', content: '날씨' },
      { role: 'assistant', content: '볼게요', toolCalls: [{ id: 'call_a', name: 'get_weather', arguments: '{"city":"Seoul"}' }, { id: 'call_b', name: 'get_weather', arguments: '' }] },
      { role: 'tool', toolCallId: 'call_a', name: 'get_weather', content: '{"t":7}' },
      { role: 'tool', toolCallId: 'call_b', name: 'get_weather', content: '' },
      { role: 'assistant', content: '맑아요' },
    ]);
    expect(input).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: '날씨' },
      { role: 'assistant', content: '볼게요' },
      { type: 'function_call', call_id: 'call_a', name: 'get_weather', arguments: '{"city":"Seoul"}' },
      { type: 'function_call', call_id: 'call_b', name: 'get_weather', arguments: '{}' },
      { type: 'function_call_output', call_id: 'call_a', output: '{"t":7}' },
      { type: 'function_call_output', call_id: 'call_b', output: '' },
      { role: 'assistant', content: '맑아요' },
    ]);
  });

  test('글 없이 도구만 부른 assistant 는 빈 글 항목을 만들지 않는다', () => {
    const input = toResponsesInput([{ role: 'assistant', content: '', toolCalls: [{ id: 'c', name: 'f', arguments: '{}' }] }]);
    expect(input).toEqual([{ type: 'function_call', call_id: 'c', name: 'f', arguments: '{}' }]);
  });

  test('이미지가 붙은 메시지는 input_text + input_image(data URL)', () => {
    const [item] = toResponsesInput([{ role: 'user', content: '이거', images: [{ base64: 'AAA', mimeType: 'image/png' }, { base64: 'BBB' }] }]);
    expect(item).toEqual({
      role: 'user',
      content: [
        { type: 'input_text', text: '이거' },
        { type: 'input_image', image_url: 'data:image/png;base64,AAA' },
        { type: 'input_image', image_url: 'data:image/jpeg;base64,BBB' },
      ],
    });
  });
});

describe('toResponsesTools · toResponsesParams', () => {
  test('도구는 평평한 꼴에 strict: false. 없으면 키를 넣지 않는다', () => {
    expect(toResponsesTools(TOOLS)).toEqual({ tools: [{ type: 'function', name: 'get_weather', description: '날씨', parameters: TOOLS[0].parameters, strict: false }] });
    expect(toResponsesTools([])).toEqual({});
    expect(toResponsesTools(undefined)).toEqual({});
  });

  test('Chat Completions 꼴 파라미터를 옮긴다 — 이름이 다른 것은 바꾸고, 없는 것은 뺀다', () => {
    expect(toResponsesParams({
      temperature: 0.7, reasoning_effort: 'low', max_completion_tokens: 500, max_tokens: 900,
      stream_options: { include_usage: true }, stop: ['x'], messages: [], tools: [{}], store: true, input: 'x',
    })).toEqual({ temperature: 0.7, reasoning: { effort: 'low' }, max_output_tokens: 500 });
    expect(toResponsesParams({ reasoning: { summary: 'auto' }, reasoning_effort: 'high' })).toEqual({ reasoning: { summary: 'auto', effort: 'high' } });
    expect(toResponsesParams({ reasoning_effort: 'high', reasoning: { summary: 'auto', effort: 'low' } })).toEqual({ reasoning: { summary: 'auto', effort: 'high' } });
    expect(toResponsesParams(undefined)).toEqual({});
  });
});

describe('fromResponsesOutput', () => {
  test('내부 호출 id 는 항목 id 가 아니라 call_id', () => {
    const r = fromResponsesOutput([
      { type: 'reasoning', id: 'rs_1' },
      { type: 'message', content: [{ type: 'output_text', text: '볼게요' }] },
      { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'f', arguments: '{"a":1}' },
    ], { wantsTools: true });
    expect(r).toEqual({ content: '볼게요', toolCalls: [{ id: 'call_1', name: 'f', arguments: '{"a":1}' }] });
  });

  test('도구를 안 준 호출에서는 호출을 받지 않는다. 거절은 글로 돌려준다', () => {
    const r = fromResponsesOutput([
      { type: 'function_call', call_id: 'c', name: 'f', arguments: '{}' },
      { type: 'message', content: [{ type: 'refusal', refusal: '도와드릴 수 없습니다' }] },
    ], { wantsTools: false });
    expect(r).toEqual({ content: '도와드릴 수 없습니다', toolCalls: [] });
  });
});

describe('completeStream', () => {
  test('요청 본문 — /v1/responses, store: false, extraParams 가 필수 키를 못 바꾼다', async () => {
    await run(sse({ type: 'response.completed', response: { output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }] } }), {
      options: { model: { value: 'gpt-x' }, tools: TOOLS, timeout: 777, extraParams: { model: 'evil', stream: false, store: true, temperature: 0.3, reasoning_effort: 'low' } },
    });
    const [url, body, config] = axios.post.mock.calls[0];
    expect(url).toBe('http://llm/v1/responses');
    expect(body).toEqual({
      temperature: 0.3, reasoning: { effort: 'low' }, model: 'gpt-x',
      input: [{ role: 'user', content: 'hi' }],
      tools: [expect.objectContaining({ name: 'get_weather', strict: false })],
      stream: true, store: false,
    });
    expect(config).toEqual(expect.objectContaining({ timeout: 777, responseType: 'stream', headers: expect.objectContaining({ Authorization: 'Bearer k' }) }));
  });

  test.each([[undefined], [1], [7], [200]])('실호출 캡처 — 글 한 줄 + 도구 호출 둘 (청크 크기 %s)', async (chunkSize) => {
    const r = await run(CAPTURE, { chunkSize });
    expect(r.content).toBe('서울과 부산의 현재 날씨를 확인해 볼게요.');
    expect(r.tokens.join('')).toBe(r.content);
    expect(r.toolCalls).toEqual([
      { id: 'call_e75a8a9f7afb4c7f80a60517f986afe9', name: 'get_weather', arguments: '{"city": "Seoul"}' },
      { id: 'call_caae95bbe57a492c9922353178f03e78', name: 'get_weather', arguments: '{"city": "Busan"}' },
    ]);
    expect(r.usage).toEqual({ promptTokens: 96, completionTokens: 71, totalTokens: 167 });
  });

  test('CRLF 줄 끝도 읽는다', async () => {
    const r = await run(CAPTURE.replace(/\n/g, '\r\n'), { chunkSize: 13 });
    expect(r.toolCalls).toHaveLength(2);
  });

  test('스트림 안의 실패 이벤트는 던진다 (HTTP 는 200)', async () => {
    await expect(run(sse({ type: 'response.created', response: {} }, { type: 'response.failed', response: { error: { code: 'server_error', message: 'boom' } } })))
      .rejects.toThrow('OpenAI: boom');
    await expect(run(sse({ type: 'error', code: 'rate_limit', message: 'slow down' }))).rejects.toThrow('OpenAI: slow down');
  });

  test('완료 이벤트 없이 닫히면 던진다 — 빈 응답으로 넘기지 않는다', async () => {
    await expect(run(sse({ type: 'response.output_text.delta', delta: '안' }))).rejects.toThrow('중간에 끊겼습니다');
    await expect(run('')).rejects.toThrow('중간에 끊겼습니다');
  });

  test('중단된 응답 — 받은 글이 있으면 돌려주고, 없으면 사유와 함께 던진다', async () => {
    const partial = await run(sse({ type: 'response.incomplete', response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [{ type: 'message', content: [{ type: 'output_text', text: '절반' }] }], usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 } } }));
    expect(partial.content).toBe('절반');
    expect(partial.usage).toEqual({ promptTokens: 3, completionTokens: 2, totalTokens: 5 });
    await expect(run(sse({ type: 'response.incomplete', response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] } })))
      .rejects.toThrow('max_output_tokens');
  });

  test('요청이 거절되면 서버가 말한 이유를 꺼낸다 (오류 본문도 스트림으로 온다)', async () => {
    const body = new EventEmitter();
    body[Symbol.asyncIterator] = async function* gen() { yield Buffer.from(JSON.stringify({ error: { message: 'The model `x` does not exist' } })); };
    axios.post.mockRejectedValue(Object.assign(new Error('Request failed with status code 404'), { response: { status: 404, data: body } }));
    await expect(completeStream('http://llm', 'k', [{ role: 'user', content: 'hi' }], { model: 'x' })).rejects.toThrow('OpenAI: The model `x` does not exist');
  });

  test('serverUrl·model 이 없으면 부르지 않는다', async () => {
    await expect(completeStream('', 'k', [], { model: 'm' })).rejects.toThrow('serverUrl');
    await expect(completeStream('http://llm', 'k', [], {})).rejects.toThrow('model');
    expect(axios.post).not.toHaveBeenCalled();
  });
});
