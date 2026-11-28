/**
 * 사용자 취소가 ComfyUI 까지 가는 경로 (#1327).
 *
 * 같은 ComfyUI 서버를 여럿이 함께 쓴다. 그래서 여기서 지키는 것은 "취소된다"보다
 * **"남의 작업을 건드리지 않는다"** 쪽이다 — 중단 요청이 나가면 안 되는 경우를 하나씩 고정한다.
 */
const EventEmitter = require('events');

jest.mock('axios');
jest.mock('ws', () => {
  const { EventEmitter: EE } = require('events');
  class FakeWS extends EE {
    constructor() {
      super();
      FakeWS.last = this;
      this.closed = false;
      setImmediate(() => this.emit('open'));
    }
    close() { this.closed = true; }
  }
  return FakeWS;
});

const axios = require('axios');
const WebSocket = require('ws');
const { cancelPrompt, submitWorkflow } = require('../services/comfyUIService');

const SERVER = 'http://comfy.example.com:8188';
const MINE = 'prompt-mine';
const OTHER = 'prompt-other';
const entry = (id) => [0, id, {}, {}, []];

/** ComfyUI 흉내: 대기열 상태를 주면 GET /queue 가 그것을 돌려준다 */
function fakeComfy(queueStates) {
  const states = [...queueStates];
  const posts = [];
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith('/queue')) {
      const s = states.length > 1 ? states.shift() : states[0];
      return { data: { queue_running: (s.running || []).map(entry), queue_pending: (s.pending || []).map(entry) } };
    }
    if (url.includes('/history/')) return { data: {} };
    throw new Error(`unexpected GET ${url}`);
  });
  axios.post.mockImplementation(async (url, body) => {
    posts.push({ path: url.replace(SERVER, ''), body });
    if (url.endsWith('/prompt')) return { data: { prompt_id: MINE } };
    return { data: {} };
  });
  return posts;
}
const sent = (posts, path) => posts.filter((p) => p.path === path);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('cancelPrompt — 이 prompt 만 겨눈다', () => {
  test('대기 중이면 대기열에서 그 id 만 뺀다. 중단 요청은 보내지 않는다', async () => {
    const posts = fakeComfy([{ running: [OTHER], pending: [MINE, 'prompt-third'] }, { running: [OTHER], pending: ['prompt-third'] }]);
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'dequeued' });
    expect(sent(posts, '/queue')).toEqual([{ path: '/queue', body: { delete: [MINE] } }]);
    expect(sent(posts, '/interrupt')).toHaveLength(0);
  });

  test('실행 중이면 그 id 를 지정해 중단한다. 대기열 삭제 · 전체 비우기는 보내지 않는다', async () => {
    const posts = fakeComfy([{ running: [MINE], pending: [OTHER] }]);
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'interrupted' });
    expect(posts).toEqual([{ path: '/interrupt', body: { prompt_id: MINE } }]);
  });

  test('실행 중인 것이 남의 prompt 면 아무것도 보내지 않는다', async () => {
    const posts = fakeComfy([{ running: [OTHER], pending: ['prompt-third'] }]);
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'none', reason: 'not-in-queue' });
    expect(posts).toHaveLength(0);
  });

  test('대기열이 비어 있으면 (이미 끝남) 아무것도 보내지 않는다', async () => {
    const posts = fakeComfy([{ running: [], pending: [] }]);
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'none', reason: 'not-in-queue' });
    expect(posts).toHaveLength(0);
  });

  test('빼는 사이 실행으로 넘어갔으면 그 id 를 지정해 중단한다', async () => {
    const posts = fakeComfy([{ running: [OTHER], pending: [MINE] }, { running: [MINE], pending: [] }]);
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'interrupted' });
    expect(posts).toEqual([
      { path: '/queue', body: { delete: [MINE] } },
      { path: '/interrupt', body: { prompt_id: MINE } },
    ]);
  });

  test('빼고 나서 실행 중인 것이 남의 prompt 면 중단하지 않는다', async () => {
    const posts = fakeComfy([{ running: [], pending: [MINE] }, { running: [OTHER], pending: [] }]);
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'dequeued' });
    expect(sent(posts, '/interrupt')).toHaveLength(0);
  });

  test.each([undefined, null, '', 0, 123, {}, [], ['prompt-mine']])('prompt id 가 %p 면 ComfyUI 를 부르지 않는다', async (id) => {
    const posts = fakeComfy([{ running: [OTHER], pending: [] }]);
    await expect(cancelPrompt(SERVER, id)).resolves.toEqual({ action: 'none', reason: 'no-prompt-id' });
    expect(axios.get).not.toHaveBeenCalled();
    expect(posts).toHaveLength(0);
  });

  test('중단 요청에는 언제나 prompt_id 가 들어 있다 — 빈 본문(전체 중단)은 나가지 않는다', async () => {
    const posts = fakeComfy([{ running: [MINE], pending: [] }]);
    await cancelPrompt(SERVER, MINE);
    for (const p of sent(posts, '/interrupt')) expect(p.body).toEqual({ prompt_id: MINE });
    for (const p of sent(posts, '/queue')) expect(p.body).not.toHaveProperty('clear');
  });

  test('ComfyUI 가 응답하지 않아도 던지지 않는다', async () => {
    axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'none', reason: 'unreachable' });
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('대기열을 읽은 뒤 요청이 실패해도 던지지 않는다', async () => {
    fakeComfy([{ running: [MINE], pending: [] }]);
    axios.post.mockRejectedValue(new Error('timeout'));
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'none', reason: 'unreachable' });
  });
});

describe('submitWorkflow — 취소 신호', () => {
  const tick = () => new Promise((r) => setImmediate(r));
  const settle = async (n = 6) => { for (let i = 0; i < n; i += 1) await tick(); };

  test('시작 전에 이미 취소됐으면 연결도 제출도 하지 않는다', async () => {
    const posts = fakeComfy([{ running: [], pending: [] }]);
    const c = new AbortController(); c.abort();
    WebSocket.last = null;
    await expect(submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal })).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(WebSocket.last).toBeNull();
    expect(posts).toHaveLength(0);
  });

  test('연결하는 사이 취소되면 제출하지 않는다', async () => {
    const posts = fakeComfy([{ running: [], pending: [] }]);
    const c = new AbortController();
    const p = submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal });
    c.abort();
    await expect(p).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(sent(posts, '/prompt')).toHaveLength(0);
    expect(sent(posts, '/interrupt')).toHaveLength(0);
    expect(WebSocket.last.closed).toBe(true);
  });

  test('실행 중에 취소되면 그 prompt 만 중단하고 대기를 바로 끝낸다', async () => {
    const posts = fakeComfy([{ running: [MINE], pending: [OTHER] }]);
    const c = new AbortController();
    const p = submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal });
    const outcome = p.catch((e) => e);
    await settle();
    expect(sent(posts, '/prompt')).toHaveLength(1);
    c.abort();
    const err = await outcome;
    expect(err).toMatchObject({ code: 'ERR_CANCELED' });
    expect(sent(posts, '/interrupt')).toEqual([{ path: '/interrupt', body: { prompt_id: MINE } }]);
    expect(WebSocket.last.closed).toBe(true);
  });

  test('제출 요청이 나가 있는 사이 취소되면 prompt id 를 받는 즉시 취소한다', async () => {
    const posts = fakeComfy([{ running: [OTHER], pending: [MINE] }, { running: [OTHER], pending: [] }]);
    const c = new AbortController();
    let release;
    const base = axios.post.getMockImplementation();
    axios.post.mockImplementation(async (url, body) => {
      if (url.endsWith('/prompt')) await new Promise((r) => { release = r; });
      return base(url, body);
    });
    const outcome = submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal }).catch((e) => e);
    await settle();
    c.abort();          // 제출 응답을 기다리는 중
    release();
    const err = await outcome;
    expect(err).toMatchObject({ code: 'ERR_CANCELED' });
    expect(sent(posts, '/queue')).toEqual([{ path: '/queue', body: { delete: [MINE] } }]);
    expect(sent(posts, '/interrupt')).toHaveLength(0);
  });

  test('취소했는데 ComfyUI 가 응답하지 않아도 대기는 취소로 끝난다', async () => {
    fakeComfy([{ running: [MINE], pending: [] }]);
    const c = new AbortController();
    const outcome = submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal }).catch((e) => e);
    await settle();
    axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
    c.abort();
    expect(await outcome).toMatchObject({ code: 'ERR_CANCELED' });
  });

  test('신호가 없으면 (예전 호출 방식) 시간 초과가 와도 중단 요청을 보내지 않는다', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    try {
      const posts = fakeComfy([{ running: [MINE], pending: [] }]);
      const outcome = submitWorkflow(SERVER, {}, null, 1000).catch((e) => e);
      await settle();
      await jest.advanceTimersByTimeAsync(3500);   // 생존 확인이 세 번 돈다 — 대기열에 있으니 계속 기다린다
      expect(sent(posts, '/interrupt')).toHaveLength(0);
      expect(sent(posts, '/queue')).toHaveLength(0);
      WebSocket.last.emit('message', JSON.stringify({ type: 'execution_error', data: { prompt_id: MINE, exception_message: 'x' } }), false);
      expect((await outcome).message).toMatch(/execution error/);
    } finally {
      jest.useRealTimers();
    }
  });

  test('신호가 있어도 취소하지 않으면 시간 초과에서 중단 요청을 보내지 않는다', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    try {
      const posts = fakeComfy([{ running: [MINE], pending: [] }]);
      const c = new AbortController();
      const outcome = submitWorkflow(SERVER, {}, null, 1000, { signal: c.signal }).catch((e) => e);
      await settle();
      await jest.advanceTimersByTimeAsync(3500);
      expect(sent(posts, '/interrupt')).toHaveLength(0);
      expect(sent(posts, '/queue')).toHaveLength(0);
      WebSocket.last.emit('message', JSON.stringify({ type: 'execution_error', data: { prompt_id: MINE, exception_message: 'x' } }), false);
      await outcome;
      c.abort();   // 끝난 뒤의 취소는 아무것도 보내지 않는다
      await settle();
      expect(sent(posts, '/interrupt')).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('취소 신호의 출처', () => {
  const fs = require('fs');
  const path = require('path');
  const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

  test('ComfyUI 대기에 신호를 넘기는 곳은 작업 워커 하나다', () => {
    const src = read('services/queueService.js');
    expect(src).toMatch(/handleComfyUIWorkflow\(\{[^}]*\bsignal\b[^}]*\}\)/);
    expect(src.match(/\{ signal \}/g)).toHaveLength(1);
  });

  test('작업 중단(abortActiveJob)을 부르는 곳은 취소 라우트뿐이다 — 시간 초과 · 종료 경로에서 부르지 않는다', () => {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) return d.name === 'tests' ? [] : walk(p);
      return p.endsWith('.js') ? [p] : [];
    });
    const root = path.join(__dirname, '..');
    const callers = walk(root)
      .filter((f) => /abortActiveJob\(/.test(fs.readFileSync(f, 'utf8').replace(/const abortActiveJob = \(jobId\)/, '')))
      .map((f) => path.relative(root, f));
    expect(callers).toEqual(['routes/jobs.js']);
    const route = read('routes/jobs.js');
    expect(route.match(/abortActiveJob\(/g)).toHaveLength(1);
    expect(route.indexOf("router.post('/:id/cancel'")).toBeLessThan(route.indexOf('abortActiveJob(job._id)'));
  });

  test('전체 중단 함수(interruptExecution)는 어디서도 부르지 않는다', () => {
    const src = ['services/queueService.js', 'routes/jobs.js', 'services/pipelineRunService.js'].map(read).join('\n');
    expect(src).not.toMatch(/interruptExecution\(/);
  });
});
