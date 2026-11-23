/**
 * openAIChatService 툴 콜 (#769)
 *
 * 도구 정의·도구 메시지 직렬화, 응답의 tool_calls 파싱, 스트림 조각 누적을 고정한다.
 * 도구를 안 쓰는 기존 호출이 그대로인지도 함께 본다.
 */

jest.mock('axios');
const { EventEmitter } = require('events');
const axios = require('axios');
const openAIChatService = require('../services/openAIChatService');

const TOOLS = [{
  name: 'find_workboards',
  description: '작업판을 찾는다',
  parameters: { type: 'object', properties: { outputFormat: { type: 'string' } } },
}];

describe('complete — 툴 콜', () => {
  beforeEach(() => jest.clearAllMocks());

  test('tools 가 없으면 요청에 tools 키를 넣지 않는다 (기존 호출 그대로)', async () => {
    axios.post.mockResolvedValue({ data: { choices: [{ message: { content: 'ok' } }] } });
    const r = await openAIChatService.complete('http://llm', 'k', [{ role: 'user', content: 'hi' }], { model: 'm' });
    const body = axios.post.mock.calls[0][1];
    expect('tools' in body).toBe(false);
    expect(r.content).toBe('ok');
    expect(r.toolCalls).toEqual([]);
  });

  test('빈 tools 배열도 키를 넣지 않는다', async () => {
    axios.post.mockResolvedValue({ data: { choices: [{ message: { content: 'ok' } }] } });
    await openAIChatService.complete('http://llm', 'k', [{ role: 'user', content: 'hi' }], { model: 'm', tools: [] });
    expect('tools' in axios.post.mock.calls[0][1]).toBe(false);
  });

  test('tools 는 function 형식으로 실리고 extraParams 가 바꿔치지 못한다', async () => {
    axios.post.mockResolvedValue({ data: { choices: [{ message: { content: 'ok' } }] } });
    await openAIChatService.complete('http://llm', 'k', [{ role: 'user', content: 'hi' }], {
      model: 'm', tools: TOOLS, extraParams: { tools: [{ type: 'function', function: { name: 'evil' } }], temperature: 0.2 },
    });
    const body = axios.post.mock.calls[0][1];
    expect(body.temperature).toBe(0.2);
    expect(body.tools).toEqual([{
      type: 'function',
      function: { name: 'find_workboards', description: '작업판을 찾는다', parameters: TOOLS[0].parameters },
    }]);
  });

  test('assistant 도구 호출·tool 결과 메시지를 OpenAI 형식으로 옮긴다', async () => {
    axios.post.mockResolvedValue({ data: { choices: [{ message: { content: 'done' } }] } });
    await openAIChatService.complete('http://llm', 'k', [
      { role: 'user', content: '그려 줘' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'find_workboards', arguments: '{"outputFormat":"image"}' }] },
      { role: 'tool', toolCallId: 'c1', name: 'find_workboards', content: '[]' },
    ], { model: 'm', tools: TOOLS });
    const { messages } = axios.post.mock.calls[0][1];
    expect(messages[1]).toEqual({
      role: 'assistant',
      content: '',
      tool_calls: [{ id: 'c1', type: 'function', function: { name: 'find_workboards', arguments: '{"outputFormat":"image"}' } }],
    });
    expect(messages[2]).toEqual({ role: 'tool', tool_call_id: 'c1', content: '[]' });
  });

  test('content 가 비어도 tool_calls 가 있으면 오류가 아니다', async () => {
    axios.post.mockResolvedValue({
      data: { choices: [{ message: { content: null, tool_calls: [
        { id: 'c1', type: 'function', function: { name: 'find_workboards', arguments: '{"outputFormat":"video"}' } },
      ] } }] },
    });
    const r = await openAIChatService.complete('http://llm', 'k', [{ role: 'user', content: 'hi' }], { model: 'm', tools: TOOLS });
    expect(r.content).toBe('');
    expect(r.toolCalls).toEqual([{ id: 'c1', name: 'find_workboards', arguments: '{"outputFormat":"video"}' }]);
  });

  test('id 가 없으면 순번으로 채우고, 객체 arguments 는 문자열로 만든다', async () => {
    axios.post.mockResolvedValue({
      data: { choices: [{ message: { content: '', tool_calls: [
        { function: { name: 'a', arguments: { x: 1 } } },
        { function: { name: 'b', arguments: '{}' } },
        { function: {} },
      ] } }] },
    });
    const r = await openAIChatService.complete('http://llm', 'k', [{ role: 'user', content: 'hi' }], { model: 'm', tools: TOOLS });
    expect(r.toolCalls).toEqual([
      { id: 'call_0', name: 'a', arguments: '{"x":1}' },
      { id: 'call_1', name: 'b', arguments: '{}' },
    ]);
  });

  test('호출자가 tools 를 안 줬으면 tool_calls 만 온 응답은 예전처럼 빈 응답 오류 (extraParams 로 들어온 tools)', async () => {
    axios.post.mockResolvedValue({
      data: { choices: [{ message: { content: '', tool_calls: [{ id: 'c1', function: { name: 'x', arguments: '{}' } }] } }] },
    });
    await expect(
      openAIChatService.complete('http://llm', 'k', [{ role: 'user', content: 'hi' }], {
        model: 'm', extraParams: { tools: [{ type: 'function', function: { name: 'x' } }] },
      })
    ).rejects.toThrow('빈 응답');
  });

  test('content 도 tool_calls 도 없으면 여전히 빈 응답 오류', async () => {
    axios.post.mockResolvedValue({ data: { choices: [{ message: { content: '', tool_calls: [] } }] } });
    await expect(
      openAIChatService.complete('http://llm', 'k', [{ role: 'user', content: 'hi' }], { model: 'm', tools: TOOLS })
    ).rejects.toThrow('빈 응답');
  });
});

describe('completeStream — 툴 콜 조각 누적', () => {
  beforeEach(() => jest.clearAllMocks());

  const line = (delta, extra = {}) => `data: ${JSON.stringify({ choices: [{ delta }], ...extra })}\n`;
  const streamWith = (emitFn) => {
    const stream = new EventEmitter();
    axios.post.mockResolvedValue({ data: stream });
    setImmediate(() => emitFn(stream));
  };

  test('index 별로 id·name·arguments 조각을 모은다 (청크 경계에서 잘려도)', async () => {
    const all =
      line({ tool_calls: [{ index: 0, id: 'c1', function: { name: 'find_workboards', arguments: '' } }] }) +
      line({ tool_calls: [{ index: 0, function: { arguments: '{"output' } }] }) +
      line({ tool_calls: [{ index: 1, id: 'c2', function: { name: 'get_workboard', arguments: '{"id":' } }] }) +
      line({ tool_calls: [{ index: 0, function: { arguments: 'Format":"image"}' } }] }) +
      line({ tool_calls: [{ index: 1, function: { arguments: '"w1"}' } }] }) +
      'data: [DONE]\n';
    const cut = Math.floor(all.length / 2) + 3;
    streamWith((s) => { s.emit('data', Buffer.from(all.slice(0, cut))); s.emit('data', Buffer.from(all.slice(cut))); s.emit('end'); });

    const tokens = [];
    const r = await openAIChatService.completeStream(
      'http://llm', 'k', [{ role: 'user', content: 'hi' }], { model: 'm', tools: TOOLS }, (d) => tokens.push(d)
    );
    expect(axios.post.mock.calls[0][1].tools).toHaveLength(1);
    expect(tokens).toEqual([]);
    expect(r.content).toBe('');
    expect(r.toolCalls).toEqual([
      { id: 'c1', name: 'find_workboards', arguments: '{"outputFormat":"image"}' },
      { id: 'c2', name: 'get_workboard', arguments: '{"id":"w1"}' },
    ]);
  });

  test('청크가 한글 글자 중간에서 잘려도 글이 깨지지 않는다 (#1293)', async () => {
    const buf = Buffer.from(line({ content: '서울과 부산의 날씨' }) + 'data: [DONE]\n');
    streamWith((s) => { for (let i = 0; i < buf.length; i += 7) s.emit('data', buf.subarray(i, i + 7)); s.emit('end'); });
    const tokens = [];
    const r = await openAIChatService.completeStream('http://llm', 'k', [{ role: 'user', content: 'hi' }], { model: 'm' }, (d) => tokens.push(d));
    expect(r.content).toBe('서울과 부산의 날씨');
    expect(tokens.join('')).toBe('서울과 부산의 날씨');
  });

  test('글과 도구 호출이 함께 와도 둘 다 받는다', async () => {
    streamWith((s) => {
      s.emit('data', Buffer.from(line({ content: '찾아볼게요' })));
      s.emit('data', Buffer.from(line({ tool_calls: [{ index: 0, function: { name: 'find_workboards' } }] })));
      s.emit('end');
    });
    const r = await openAIChatService.completeStream('http://llm', 'k', [{ role: 'user', content: 'hi' }], { model: 'm', tools: TOOLS });
    expect(r.content).toBe('찾아볼게요');
    expect(r.toolCalls).toEqual([{ id: 'call_0', name: 'find_workboards', arguments: '{}' }]);
  });

  test('index 가 없거나 전부 0 이어도 id 가 바뀌면 다른 호출로 가른다', async () => {
    streamWith((s) => {
      s.emit('data', Buffer.from(line({ tool_calls: [{ id: 'c1', function: { name: 'a', arguments: '{"x":' } }] })));
      s.emit('data', Buffer.from(line({ tool_calls: [{ function: { arguments: '1}' } }] })));
      s.emit('data', Buffer.from(line({ tool_calls: [{ index: 0, id: 'c2', function: { name: 'b', arguments: '{}' } }] })));
      s.emit('end');
    });
    const r = await openAIChatService.completeStream('http://llm', 'k', [{ role: 'user', content: 'hi' }], { model: 'm', tools: TOOLS });
    expect(r.toolCalls).toEqual([
      { id: 'c1', name: 'a', arguments: '{"x":1}' },
      { id: 'c2', name: 'b', arguments: '{}' },
    ]);
  });

  test('호출자가 tools 를 안 줬으면 스트림의 tool_calls 조각은 모으지 않는다', async () => {
    streamWith((s) => {
      s.emit('data', Buffer.from(line({ content: 'hi' })));
      s.emit('data', Buffer.from(line({ tool_calls: [{ index: 0, id: 'c1', function: { name: 'a' } }] })));
      s.emit('end');
    });
    const r = await openAIChatService.completeStream('http://llm', 'k', [{ role: 'user', content: 'hi' }], { model: 'm' });
    expect(r.toolCalls).toEqual([]);
  });

  test('도구 호출이 없으면 빈 배열', async () => {
    streamWith((s) => { s.emit('data', Buffer.from(line({ content: 'hello' }))); s.emit('end'); });
    const r = await openAIChatService.completeStream('http://llm', 'k', [{ role: 'user', content: 'hi' }], { model: 'm' });
    expect(r.toolCalls).toEqual([]);
    expect('tools' in axios.post.mock.calls[0][1]).toBe(false);
  });
});

describe('completeStream — 스트림으로 온 오류 본문 (#1284)', () => {
  const axios = require('axios');
  const { Readable } = require('stream');
  const chat = require('../services/openAIChatService');
  const failWith = (data) => jest.spyOn(axios, 'post').mockRejectedValueOnce(Object.assign(new Error('Request failed with status code 400'), { response: { status: 400, data } }));
  const call = () => chat.completeStream('http://llm.invalid', 'k', [{ role: 'user', content: 'hi' }], { model: 'm' }, () => {});
  afterEach(() => jest.restoreAllMocks());

  test('본문이 스트림이면 모아 읽어 서버가 말한 이유를 돌려준다', async () => {
    failWith(Readable.from([Buffer.from('{"error":{"message":"Function tools are '), Buffer.from('not supported for this model"}}')]));
    await expect(call()).rejects.toThrow('OpenAI: Function tools are not supported for this model');
  });

  test('본문이 객체여도 읽는다', async () => {
    failWith({ error: { message: 'bad model' } });
    await expect(call()).rejects.toThrow('OpenAI: bad model');
  });

  test('JSON 이 아니면 원래 오류를 그대로', async () => {
    failWith(Readable.from([Buffer.from('<html>502</html>')]));
    await expect(call()).rejects.toThrow('Request failed with status code 400');
  });
});
