/**
 * 채팅 대화 한 턴 (#1284) — 가짜 LLM 으로 루프·저장 단위·실패 처리를 본다.
 */
jest.mock('../services/openAIChatService', () => ({ completeStream: jest.fn() }));
jest.mock('../services/openAIResponsesService', () => ({ completeStream: jest.fn() }));
jest.mock('../services/chatTools', () => ({ createChatTools: jest.fn() }));
jest.mock('../utils/visionImages', () => ({ loadVisionImages: jest.fn(async (ids) => ids.map((i) => ({ imageId: i, url: `/uploads/${i}`, base64: `b64-${i}`, mimeType: 'image/jpeg' }))) }));
jest.mock('../utils/secretCrypto', () => ({ decryptSecret: (v) => (v ? `dec:${v}` : v) }));

const openAIChatService = require('../services/openAIChatService');
const openAIResponsesService = require('../services/openAIResponsesService');
const { createChatTools } = require('../services/chatTools');
const { loadVisionImages } = require('../utils/visionImages');
const {
  runChatTurn, toModelMessages, buildSystemPrompt, defaultModelOf, titleFrom, isChatCapableWorkboard, isTurnInProgress,
  CHAT_SYSTEM_PROMPT, CHAT_MAX_ROUNDS, STALE_TURN_MS,
} = require('../services/chatService');

const usage = (n) => ({ promptTokens: n, completionTokens: 1, totalTokens: n + 1 });
const call = (cid, name, args = {}) => ({ id: cid, name, arguments: JSON.stringify(args) });

const workboard = (extra = {}) => ({
  _id: 'wb', isActive: true, outputFormat: 'text', llmExtraParams: { temperature: 1 },
  serverId: { isActive: true, serverType: 'OpenAI Compatible', serverUrl: 'http://llm.invalid', configuration: { apiKey: 'enc', timeout: 1234 } },
  additionalInputFields: [{ name: 'base_model', type: 'baseModel', defaultValue: 'board-model' }],
  incrementUsage: jest.fn(async () => {}),
  ...extra,
});

/** 저장할 때마다 메시지 role 목록을 찍어 두는 가짜 대화 문서 */
function conversationDoc(messages = [{ role: 'system', content: 'sys' }, { role: 'user', content: '고양이 그려 줘' }]) {
  const doc = { _id: 'conv', userId: 'user-1', model: 'conv-model', status: 'processing', messages: [...messages], saves: [] };
  doc.save = jest.fn(async () => { doc.saves.push({ status: doc.status, roles: doc.messages.map((m) => m.role) }); });
  return doc;
}

let handlers;
let toolState;
let seenMessages;
let events;
let logs;
const emit = (event, data) => events.push([event, data]);
const turn = (conversation, wb = workboard()) => runChatTurn({ user: { _id: 'user-1' }, conversation, workboard: wb, emit, log: (l) => logs.push(l) });

/** 응답을 차례로 내놓는 가짜 LLM. 항목이 Error 면 그 호출에서 던진다 */
function scriptModel(replies) {
  let i = 0;
  openAIChatService.completeStream.mockImplementation(async (url, key, msgs, opts, onDelta) => {
    const reply = replies[i];
    i += 1;
    // 루프는 같은 배열에 메시지를 이어 붙인다 — 호출 시점의 모습을 따로 남긴다
    seenMessages.push(msgs.map((m) => m.role));
    if (reply instanceof Error) throw reply;
    if (reply.content) onDelta(reply.content);
    return reply;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  events = [];
  logs = [];
  seenMessages = [];
  toolState = { generations: 0, jobIds: [] };
  handlers = {
    find_workboards: jest.fn(async () => ({ workboards: [{ id: 'w1' }] })),
    generate: jest.fn(async () => { toolState.generations += 1; toolState.jobIds.push('job-1'); return { jobId: 'job-1' }; }),
  };
  createChatTools.mockImplementation(() => ({ tools: [{ name: 'find_workboards' }, { name: 'generate' }], handlers, state: toolState }));
});

describe('서버 종류별 호출 경로 (#1293)', () => {
  const official = () => workboard({ serverId: { isActive: true, serverType: 'OpenAI', serverUrl: 'https://api.invalid', configuration: { apiKey: 'enc' } } });

  test('OpenAI 공식 서버는 Responses 로 — 같은 인자, 같은 루프', async () => {
    openAIResponsesService.completeStream
      .mockImplementationOnce(async () => ({ content: '', toolCalls: [call('c1', 'find_workboards')], usage: usage(10) }))
      .mockImplementationOnce(async (url, key, msgs, opts, onDelta) => { onDelta('했어요'); return { content: '했어요', toolCalls: [], usage: usage(20) }; });
    const conversation = conversationDoc();

    const result = await turn(conversation, official());

    expect(result.ok).toBe(true);
    expect(openAIChatService.completeStream).not.toHaveBeenCalled();
    expect(openAIResponsesService.completeStream).toHaveBeenCalledTimes(2);
    const [url, key, msgs, opts] = openAIResponsesService.completeStream.mock.calls[1];
    expect(url).toBe('https://api.invalid');
    expect(key).toBe('dec:enc');
    expect(msgs.slice(0, 4).map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'tool']); // 루프가 같은 배열에 이어 붙인다
    expect(opts).toEqual(expect.objectContaining({ model: 'conv-model', extraParams: { temperature: 1 } }));
    expect(opts.tools.map((t) => t.name)).toEqual(['find_workboards', 'generate']);
    expect(events.filter(([e]) => e === 'token')).toEqual([['token', { delta: '했어요' }]]);
    expect(conversation.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'tool', 'assistant']);
  });

  test('호환 서버는 Chat Completions 그대로', async () => {
    scriptModel([{ content: '안녕', toolCalls: [], usage: usage(1) }]);
    expect((await turn(conversationDoc())).ok).toBe(true);
    expect(openAIChatService.completeStream).toHaveBeenCalledTimes(1);
    expect(openAIResponsesService.completeStream).not.toHaveBeenCalled();
  });
});

describe('runChatTurn', () => {
  test('도구 없이 답하면 답 하나만 저장하고 완료', async () => {
    scriptModel([{ content: '안녕하세요', toolCalls: [], usage: usage(10) }]);
    const conv = conversationDoc();
    const r = await turn(conv);
    expect(r).toMatchObject({ ok: true, content: '안녕하세요', rounds: 0, jobIds: [] });
    expect(conv.saves).toEqual([{ status: 'completed', roles: ['system', 'user', 'assistant'] }]);
    expect(conv.usage).toEqual(usage(10));
    expect(events.map((e) => e[0])).toEqual(['token', 'done']);
  });

  test('도구 라운드는 호출과 결과를 한 묶음으로 저장한다', async () => {
    scriptModel([
      { content: '', toolCalls: [call('c1', 'find_workboards', { output: 'image' })], usage: usage(10) },
      { content: '', toolCalls: [call('c2', 'generate', { workboardId: 'w1', prompt: 'a cat' })], usage: usage(20) },
      { content: '고양이를 만들기 시작했습니다.', toolCalls: [], usage: usage(30) },
    ]);
    const conv = conversationDoc();
    const r = await turn(conv);

    expect(r).toMatchObject({ ok: true, rounds: 2, jobIds: ['job-1'] });
    // 저장 시점마다 기록은 짝이 맞는다: (assistant+tool) 묶음 둘, 마지막 답
    expect(conv.saves.map((s) => s.roles.slice(2))).toEqual([
      ['assistant', 'tool'],
      ['assistant', 'tool', 'assistant', 'tool'],
      ['assistant', 'tool', 'assistant', 'tool', 'assistant'],
    ]);
    expect(conv.messages[2].toolCalls).toEqual([call('c1', 'find_workboards', { output: 'image' })]);
    expect(conv.messages[3]).toMatchObject({ role: 'tool', toolCallId: 'c1', name: 'find_workboards' });
    expect(conv.usage).toEqual({ promptTokens: 60, completionTokens: 3, totalTokens: 63 });
    expect(conv.status).toBe('completed');
    expect(events.map((e) => e[0])).toEqual(['tool_call', 'tool_result', 'round', 'tool_call', 'tool_result', 'round', 'token', 'done']);
    expect(events[events.length - 1][1]).toMatchObject({ conversationId: 'conv', jobIds: ['job-1'] });
  });

  test('LLM 에는 대화의 모델·판의 추가 파라미터·복호화한 키와 도구를 넘긴다', async () => {
    scriptModel([{ content: 'ok', toolCalls: [], usage: usage(1) }]);
    await turn(conversationDoc());
    const [url, key, msgs, opts] = openAIChatService.completeStream.mock.calls[0];
    expect(url).toBe('http://llm.invalid');
    expect(key).toBe('dec:enc');
    expect(msgs).toBeDefined();
    expect(seenMessages).toEqual([['system', 'user']]);
    expect(opts).toMatchObject({ model: 'conv-model', timeout: 1234, extraParams: { temperature: 1 } });
    expect(opts.tools.map((t) => t.name)).toEqual(['find_workboards', 'generate']);
  });

  test('생성 뒤 모델 호출이 실패해도 그 라운드는 기록에 남고, 실패로 끝난다', async () => {
    scriptModel([
      { content: '', toolCalls: [call('c1', 'generate', { workboardId: 'w1' })], usage: usage(10) },
      new Error('upstream 502'),
    ]);
    const conv = conversationDoc();
    const r = await turn(conv);

    expect(r).toMatchObject({ ok: false, error: 'upstream 502', jobIds: ['job-1'] });
    expect(conv.status).toBe('failed');
    expect(conv.error).toEqual({ message: 'upstream 502' });
    expect(conv.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'tool']);
    expect(events[events.length - 1]).toEqual(['error', { message: 'upstream 502', jobIds: ['job-1'] }]);
    expect(logs.some((l) => /turn failed .*savedRounds=1 jobs=1/.test(l))).toBe(true);
  });

  test('첫 호출부터 실패하면 사용자 메시지만 남는다', async () => {
    scriptModel([new Error('connect ECONNREFUSED')]);
    const conv = conversationDoc();
    const r = await turn(conv);
    expect(r.ok).toBe(false);
    expect(conv.messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(conv.status).toBe('failed');
  });

  test('도구 뒤에 빈 답이 오면 실패 — 빈 assistant 메시지를 만들지 않는다', async () => {
    scriptModel([
      { content: '', toolCalls: [call('c1', 'find_workboards', { output: 'image' })], usage: usage(1) },
      { content: '  ', toolCalls: [], usage: usage(1) },
    ]);
    const conv = conversationDoc();
    const r = await turn(conv);
    expect(r.ok).toBe(false);
    expect(conv.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'tool']);
    expect(conv.error.message).toMatch(/빈 응답/);
  });

  test('라운드 상한에 닿으면 도구 없이 마무리 답을 받는다', async () => {
    const replies = Array.from({ length: CHAT_MAX_ROUNDS }, (_, i) => ({ content: '', toolCalls: [call(`c${i}`, 'find_workboards', { output: 'image' })], usage: usage(1) }));
    replies.push({ content: '여기까지 했습니다.', toolCalls: [], usage: usage(1) });
    scriptModel(replies);
    const conv = conversationDoc();
    const r = await turn(conv);
    expect(r).toMatchObject({ ok: true, rounds: CHAT_MAX_ROUNDS, limitReached: true });
    const lastCall = openAIChatService.completeStream.mock.calls[CHAT_MAX_ROUNDS];
    expect(lastCall[3].tools).toEqual([]);
    expect(conv.messages[conv.messages.length - 1]).toMatchObject({ role: 'assistant', content: '여기까지 했습니다.' });
  });

  test('없는 도구 호출·깨진 인자는 오류를 도구 결과로 돌려주고 대화는 이어진다', async () => {
    scriptModel([
      { content: '', toolCalls: [{ id: 'c1', name: 'delete_everything', arguments: '{}' }, { id: 'c2', name: 'generate', arguments: '{bad' }], usage: usage(1) },
      { content: '죄송합니다.', toolCalls: [], usage: usage(1) },
    ]);
    const conv = conversationDoc();
    const r = await turn(conv);
    expect(r.ok).toBe(true);
    expect(handlers.generate).not.toHaveBeenCalled();
    expect(conv.messages.slice(2).map((m) => m.role)).toEqual(['assistant', 'tool', 'tool', 'assistant']);
    expect(JSON.parse(conv.messages[3].content).error).toBeDefined();
  });
});

describe('toModelMessages', () => {
  const conv = {
    userId: 'user-1',
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: '이걸 영상으로', attachments: [{ imageId: 'img1', url: '/u/1' }, { imageId: 'img2', url: '/u/2' }] },
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'generate', arguments: '{}' }] },
      { role: 'tool', toolCallId: 'c1', name: 'generate', content: '{"jobId":"j"}' },
      { role: 'assistant', content: '시작했습니다.', toolCalls: [] },
    ],
  };

  test('도구 메시지의 짝 정보를 살리고, 첨부 id 를 사용자 글에 붙인다', async () => {
    const out = await toModelMessages(conv, { vision: false });
    expect(out[1].content).toBe('이걸 영상으로\n\n[attached image ids: img1, img2]');
    expect(out[1].images).toBeUndefined();
    expect(out[2]).toEqual({ role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'generate', arguments: '{}' }] });
    expect(out[3]).toEqual({ role: 'tool', content: '{"jobId":"j"}', toolCallId: 'c1', name: 'generate' });
    expect(out[4]).toEqual({ role: 'assistant', content: '시작했습니다.' });
    expect(loadVisionImages).not.toHaveBeenCalled();
    expect(conv.messages[1].content).toBe('이걸 영상으로'); // 저장된 글은 그대로
  });

  test('비전 판이면 이미지도 함께 보낸다 (대화 주인의 것으로 읽는다)', async () => {
    const out = await toModelMessages(conv, { vision: true });
    expect(loadVisionImages).toHaveBeenCalledWith(['img1', 'img2'], 'user-1');
    expect(out[1].images).toEqual([{ base64: 'b64-img1', mimeType: 'image/jpeg' }, { base64: 'b64-img2', mimeType: 'image/jpeg' }]);
  });
});

describe('toModelMessages — 지난 턴 줄이기', () => {
  const big = JSON.stringify({ workboards: Array.from({ length: 6 }, (_, i) => ({ id: `w${i}`, description: 'x'.repeat(300) })) });
  const conv = {
    userId: 'user-1',
    messages: [
      { role: 'user', content: '고양이', attachments: [{ imageId: 'old', url: '/u/old' }] },
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'find_workboards', arguments: '{}' }, { id: 'c2', name: 'generate', arguments: '{}' }] },
      { role: 'tool', toolCallId: 'c1', name: 'find_workboards', content: big },
      { role: 'tool', toolCallId: 'c2', name: 'generate', content: '{"jobId":"j1"}' },
      { role: 'assistant', content: '시작했습니다.' },
      { role: 'user', content: '이번엔 영상', attachments: [{ imageId: 'new', url: '/u/new' }] },
      { role: 'assistant', content: '', toolCalls: [{ id: 'c3', name: 'get_workboard', arguments: '{}' }] },
      { role: 'tool', toolCallId: 'c3', name: 'get_workboard', content: big },
    ],
  };

  test('지난 턴의 판 찾기·보기 결과만 줄인다 — 짝·생성 결과·이번 턴은 그대로', async () => {
    const out = await toModelMessages(conv, { vision: false });
    expect(out.map((m) => m.role)).toEqual(conv.messages.map((m) => m.role));
    expect(out[2]).toMatchObject({ role: 'tool', toolCallId: 'c1', name: 'find_workboards' });
    expect(out[2].content).toMatch(/omitted/);
    expect(out[2].content.length).toBeLessThan(120);
    expect(out[3].content).toBe('{"jobId":"j1"}');   // 생성 결과(작업 id)는 남는다
    expect(out[7].content).toBe(big);                 // 이번 턴의 결과는 그대로
    expect(conv.messages[2].content).toBe(big);       // 저장된 기록은 바꾸지 않는다
  });

  test('비전 입력은 이번 턴의 첨부만 싣고, 지난 턴은 id 안내만 남긴다', async () => {
    const out = await toModelMessages(conv, { vision: true });
    expect(loadVisionImages).toHaveBeenCalledTimes(1);
    expect(loadVisionImages).toHaveBeenCalledWith(['new'], 'user-1');
    expect(out[0].images).toBeUndefined();
    expect(out[0].content).toMatch(/\[attached image ids: old\]/);
    expect(out[5].images).toHaveLength(1);
  });
});

describe('판정·보조', () => {
  test('buildSystemPrompt — 채팅 안내 뒤에 판의 시스템 프롬프트 기본값', () => {
    expect(buildSystemPrompt(workboard())).toBe(CHAT_SYSTEM_PROMPT);
    const withPrompt = workboard({ additionalInputFields: [{ name: 'system_prompt', type: 'string', defaultValue: '  반말로 답한다  ' }] });
    expect(buildSystemPrompt(withPrompt)).toBe(`${CHAT_SYSTEM_PROMPT}\n\n[Workboard instructions]\n반말로 답한다`);
  });

  test('defaultModelOf — 모델 칸의 기본값 ({key, value} 꼴도 푼다), 없으면 빈 문자열', () => {
    expect(defaultModelOf(workboard())).toBe('board-model');
    expect(defaultModelOf(workboard({ additionalInputFields: [{ name: 'm', type: 'baseModel', defaultValue: { key: 'K', value: 'v-model' } }] }))).toBe('v-model');
    expect(defaultModelOf(workboard({ additionalInputFields: [] }))).toBe('');
  });

  test('대화에 모델이 없으면 판의 기본 모델로 부른다', async () => {
    scriptModel([{ content: 'ok', toolCalls: [], usage: usage(1) }]);
    const conv = conversationDoc();
    conv.model = undefined;
    await turn(conv);
    expect(openAIChatService.completeStream.mock.calls[0][3].model).toBe('board-model');
  });

  test('isChatCapableWorkboard — 살아 있는 텍스트 판 + 도구 호출을 받는 서버 종류', () => {
    expect(isChatCapableWorkboard(workboard())).toBe(true);
    expect(isChatCapableWorkboard(workboard({ serverId: { isActive: true, serverType: 'OpenAI' } }))).toBe(true);
    expect(isChatCapableWorkboard(workboard({ serverId: { isActive: true, serverType: 'Gemini' } }))).toBe(false);
    expect(isChatCapableWorkboard(workboard({ serverId: { isActive: false, serverType: 'OpenAI' } }))).toBe(false);
    expect(isChatCapableWorkboard(workboard({ outputFormat: 'image' }))).toBe(false);
    expect(isChatCapableWorkboard(workboard({ isActive: false }))).toBe(false);
    expect(isChatCapableWorkboard(workboard({ serverId: null }))).toBe(false);
  });

  test('isTurnInProgress — 오래된 processing 은 죽은 턴', () => {
    const now = Date.now();
    expect(isTurnInProgress({ status: 'processing', updatedAt: new Date(now - 1000) }, now)).toBe(true);
    expect(isTurnInProgress({ status: 'processing', updatedAt: new Date(now - STALE_TURN_MS - 1) }, now)).toBe(false);
    expect(isTurnInProgress({ status: 'completed', updatedAt: new Date(now) }, now)).toBe(false);
    expect(isTurnInProgress({ status: 'failed', updatedAt: new Date(now) }, now)).toBe(false);
  });

  test('titleFrom — 첫 줄, 길면 자른다', () => {
    expect(titleFrom('  고양이 그려 줘\n자세히  ')).toBe('고양이 그려 줘');
    expect(titleFrom('가'.repeat(60))).toBe(`${'가'.repeat(40)}…`);
  });
});
