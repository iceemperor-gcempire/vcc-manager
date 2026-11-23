/**
 * llmToolLoop (#769) — 가짜 모델로 재호출 루프와 방어를 고정한다.
 */

const { runToolLoop, LIMIT_NOTICE } = require('../services/llmToolLoop');

const TOOLS = [{ name: 'echo', description: '', parameters: { type: 'object', properties: {} } }];
const call = (id, name, args) => ({ id, name, arguments: typeof args === 'string' ? args : JSON.stringify(args) });

// 대본대로 답하는 가짜 모델. 받은 메시지·도구를 기록한다.
const scripted = (replies) => {
  const seen = [];
  const callModel = jest.fn(async (messages, tools) => {
    seen.push({ messages: messages.map((m) => ({ ...m })), tools });
    const next = replies[Math.min(seen.length - 1, replies.length - 1)];
    return typeof next === 'function' ? next(messages) : next;
  });
  return { callModel, seen };
};

const quiet = () => {};

describe('runToolLoop', () => {
  test('도구를 안 부르면 한 번 호출로 끝난다 — 0건도 로그에 남는다', async () => {
    const { callModel } = scripted([{ content: '안녕하세요', toolCalls: [], usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 } }]);
    const logs = [];
    const r = await runToolLoop({ messages: [{ role: 'user', content: 'hi' }], tools: TOOLS, handlers: {}, callModel, log: (l) => logs.push(l) });
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ content: '안녕하세요', rounds: 0, toolCalls: 0, limitReached: false });
    expect(r.usage).toEqual({ promptTokens: 3, completionTokens: 2, totalTokens: 5 });
    expect(r.newMessages).toEqual([{ role: 'assistant', content: '안녕하세요' }]);
    expect(logs.join('\n')).toMatch(/rounds=0 toolCalls=0/);
  });

  test('도구 실행 → 결과를 tool 메시지로 붙여 재호출, usage 는 합산', async () => {
    const { callModel, seen } = scripted([
      { content: '', toolCalls: [call('c1', 'echo', { text: 'a' })], usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 } },
      { content: '끝', toolCalls: [], usage: { promptTokens: 20, completionTokens: 2, totalTokens: 22 } },
    ]);
    const echo = jest.fn(async (args) => ({ said: args.text }));
    const onToolCall = jest.fn();
    const onToolResult = jest.fn();
    const input = [{ role: 'user', content: 'hi' }];
    const r = await runToolLoop({ messages: input, tools: TOOLS, handlers: { echo }, callModel, onToolCall, onToolResult, log: quiet });

    expect(echo).toHaveBeenCalledWith({ text: 'a' }, expect.objectContaining({ id: 'c1' }));
    expect(seen[1].messages.slice(-2)).toEqual([
      { role: 'assistant', content: '', toolCalls: [call('c1', 'echo', { text: 'a' })] },
      { role: 'tool', toolCallId: 'c1', name: 'echo', content: '{"said":"a"}' },
    ]);
    expect(r).toMatchObject({ content: '끝', rounds: 1, toolCalls: 1, limitReached: false });
    expect(r.usage).toEqual({ promptTokens: 30, completionTokens: 3, totalTokens: 33 });
    expect(r.newMessages.map((m) => m.role)).toEqual(['assistant', 'tool', 'assistant']);
    expect(onToolCall).toHaveBeenCalledTimes(1);
    expect(onToolResult).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }), { outcome: 'ok', content: '{"said":"a"}' });
    expect(input).toHaveLength(1); // 입력 배열은 바꾸지 않는다
  });

  test('한 응답의 도구 호출 여럿을 순서대로 실행한다', async () => {
    const { callModel } = scripted([
      { content: '', toolCalls: [call('c1', 'echo', { text: 'a' }), call('c2', 'echo', { text: 'b' })] },
      { content: '끝', toolCalls: [] },
    ]);
    const order = [];
    const r = await runToolLoop({
      messages: [], tools: TOOLS, callModel, log: quiet,
      handlers: { echo: async (a) => { order.push(a.text); return a.text; } },
    });
    expect(order).toEqual(['a', 'b']);
    expect(r.newMessages.filter((m) => m.role === 'tool').map((m) => [m.toolCallId, m.content])).toEqual([['c1', 'a'], ['c2', 'b']]);
  });

  test('없는 도구·깨진 인자·객체 아닌 인자·핸들러 오류는 도구 결과로 돌려주고 계속한다', async () => {
    const { callModel } = scripted([
      { content: '', toolCalls: [
        call('c1', 'nope', {}),
        call('c2', 'echo', '{"text": '),
        call('c3', 'echo', '[1,2]'),
        call('c4', 'boom', {}),
        call('c5', 'constructor', {}),
      ] },
      { content: '끝', toolCalls: [] },
    ]);
    const echo = jest.fn();
    const results = [];
    const r = await runToolLoop({
      messages: [], tools: TOOLS, callModel, log: quiet,
      handlers: { echo, boom: async () => { throw new Error('서버가 꺼져 있습니다'); } },
      onToolResult: (c, res) => results.push([c.id, res.outcome]),
    });
    expect(results).toEqual([
      ['c1', 'unknown_tool'], ['c2', 'bad_arguments'], ['c3', 'bad_arguments'], ['c4', 'handler_error'], ['c5', 'unknown_tool'],
    ]);
    expect(echo).not.toHaveBeenCalled();
    const toolMsgs = r.newMessages.filter((m) => m.role === 'tool');
    expect(JSON.parse(toolMsgs[0].content).error).toMatch(/없는 도구입니다: nope.*echo, boom/);
    expect(JSON.parse(toolMsgs[3].content).error).toBe('서버가 꺼져 있습니다');
    expect(r.content).toBe('끝');
  });

  test('빈 인자 문자열은 빈 객체로 본다', async () => {
    const { callModel } = scripted([{ content: '', toolCalls: [call('c1', 'echo', '')] }, { content: '끝', toolCalls: [] }]);
    const echo = jest.fn(async () => 'ok');
    await runToolLoop({ messages: [], tools: TOOLS, handlers: { echo }, callModel, log: quiet });
    expect(echo).toHaveBeenCalledWith({}, expect.anything());
  });

  test('라운드 상한에 닿으면 도구 없이 한 번 더 불러 마무리한다 (무한 루프 방지)', async () => {
    // 끝없이 도구만 부르는 모델 — 도구가 안 주어지면 그제야 글로 답한다
    const callModel = jest.fn(async (messages, tools) => (tools.length > 0
      ? { content: '', toolCalls: [call(`c${messages.length}`, 'echo', {})] }
      : { content: '여기까지 했습니다', toolCalls: [call('ignored', 'echo', {})] }));
    const echo = jest.fn(async () => 'ok');
    const logs = [];
    const r = await runToolLoop({ messages: [], tools: TOOLS, handlers: { echo }, callModel, maxRounds: 3, log: (l) => logs.push(l) });
    expect(echo).toHaveBeenCalledTimes(3);
    expect(callModel).toHaveBeenCalledTimes(4);
    expect(callModel.mock.calls[3][1]).toEqual([]);
    // 마무리 호출에는 "도구를 더 못 쓴다" 안내가 붙고, 저장할 대화에는 남지 않는다
    const lastSent = callModel.mock.calls[3][0];
    expect(lastSent[lastSent.length - 1]).toEqual(LIMIT_NOTICE);
    expect(callModel.mock.calls[2][0]).not.toContainEqual(LIMIT_NOTICE);
    expect(r.newMessages).not.toContainEqual(LIMIT_NOTICE);
    expect(r).toMatchObject({ content: '여기까지 했습니다', rounds: 3, toolCalls: 3, limitReached: true });
    expect(r.newMessages[r.newMessages.length - 1]).toEqual({ role: 'assistant', content: '여기까지 했습니다' });
    expect(logs.join('\n')).toMatch(/라운드 상한 도달 maxRounds=3/);
  });

  test('긴 도구 결과는 잘라 싣고 잘랐다고 적는다', async () => {
    const { callModel } = scripted([{ content: '', toolCalls: [call('c1', 'echo', {})] }, { content: '끝', toolCalls: [] }]);
    const logs = [];
    const r = await runToolLoop({
      messages: [], tools: TOOLS, callModel, maxResultChars: 100, log: (l) => logs.push(l),
      handlers: { echo: async () => 'x'.repeat(5000) },
    });
    const content = r.newMessages[1].content;
    expect(content.startsWith('x'.repeat(100))).toBe(true);
    expect(content).toMatch(/5000자 중 100자만/);
    expect(logs.join('\n')).toMatch(/truncated=true/);
  });

  test('모델 호출 실패는 밖으로 나간다', async () => {
    const callModel = jest.fn(async () => { throw new Error('OpenAI: rate limit'); });
    await expect(runToolLoop({ messages: [], tools: TOOLS, handlers: {}, callModel, log: quiet })).rejects.toThrow('rate limit');
  });

  test('callModel 은 필수', async () => {
    await expect(runToolLoop({ messages: [] })).rejects.toThrow('callModel is required');
  });
});

describe('onRound — 라운드 단위 저장 훅 (#1284)', () => {
  const { runToolLoop: loop } = require('../services/llmToolLoop');
  const reply = (toolCalls, content = '') => ({ content, toolCalls, usage: {} });
  const tc = (id, name) => ({ id, name, arguments: '{}' });

  test('라운드마다 assistant + 그 호출 전부의 tool 메시지를 한 묶음으로 넘기고, 끝날 때까지 기다린다', async () => {
    const replies = [reply([tc('a', 't'), tc('b', 't')]), reply([tc('c', 't')]), reply([], '끝')];
    const rounds = [];
    const order = [];
    let n = 0;
    await loop({
      messages: [{ role: 'user', content: 'x' }],
      tools: [{ name: 't' }],
      handlers: { t: async () => 'ok' },
      callModel: async () => { order.push(`model${n}`); const r = replies[n]; n += 1; return r; },
      onRound: async (msgs) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        rounds.push(msgs.map((m) => [m.role, m.toolCallId || (m.toolCalls || []).map((c) => c.id).join('+')]));
        order.push(`saved${rounds.length}`);
      },
      log: () => {},
    });
    expect(rounds).toEqual([
      [['assistant', 'a+b'], ['tool', 'a'], ['tool', 'b']],
      [['assistant', 'c'], ['tool', 'c']],
    ]);
    // 저장이 끝난 뒤에 다음 모델 호출로 간다
    expect(order).toEqual(['model0', 'saved1', 'model1', 'saved2', 'model2']);
  });

  test('도구를 안 부르면 불리지 않는다', async () => {
    const onRound = jest.fn();
    await loop({ messages: [], tools: [], handlers: {}, callModel: async () => reply([], '답'), onRound, log: () => {} });
    expect(onRound).not.toHaveBeenCalled();
  });

  test('다음 모델 호출이 실패해도 그 전 라운드는 이미 넘어갔다', async () => {
    const onRound = jest.fn(async () => {});
    let n = 0;
    await expect(loop({
      messages: [], tools: [{ name: 't' }], handlers: { t: async () => 'ok' },
      callModel: async () => { n += 1; if (n === 2) throw new Error('down'); return reply([tc('a', 't')]); },
      onRound, log: () => {},
    })).rejects.toThrow('down');
    expect(onRound).toHaveBeenCalledTimes(1);
  });
});
