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

const CANCEL = (id) => `/api/jobs/${id}/cancel`;

/**
 * ComfyUI 흉내.
 * @param {{ jobCancel?: boolean|'missing'|'down', history?: object }} opts
 *   jobCancel: 작업별 취소가 돌려줄 값. 'missing' 이면 그 API 가 없는 옛 서버(404), 'down' 이면 무응답
 */
function fakeComfy({ jobCancel = true, queue = { running: [MINE], pending: [] }, history = {} } = {}) {
  const posts = [];
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith('/queue')) {
      return { data: { queue_running: (queue.running || []).map(entry), queue_pending: (queue.pending || []).map(entry) } };
    }
    if (url.includes('/history/')) return { data: history };
    throw new Error(`unexpected GET ${url}`);
  });
  axios.post.mockImplementation(async (url, body) => {
    const path = url.replace(SERVER, '');
    posts.push({ path, body });
    if (path === '/prompt') return { data: { prompt_id: MINE } };
    if (path.startsWith('/api/jobs/')) {
      if (jobCancel === 'missing') throw Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } });
      if (jobCancel === 'down') throw new Error('ECONNREFUSED');
      return { data: { cancelled: jobCancel } };
    }
    return { data: {} };
  });
  return posts;
}
const sent = (posts, path) => posts.filter((p) => p.path === path);
/** prompt 제출을 뺀, ComfyUI 상태를 바꾸는 요청 */
const mutations = (posts) => posts.filter((p) => p.path !== '/prompt');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('cancelPrompt — 이 prompt 만 겨눈다', () => {
  test('작업별 취소를 그 id 로 한 번 부른다. 다른 요청은 보내지 않는다', async () => {
    const posts = fakeComfy({ jobCancel: true });
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'cancelled' });
    expect(posts).toEqual([{ path: CANCEL(MINE), body: {} }]);
  });

  test('서버가 "취소할 것이 없다"고 하면 (이미 끝남 · 모르는 id) 더 보내지 않는다', async () => {
    const posts = fakeComfy({ jobCancel: false });
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'none', reason: 'not-in-queue' });
    expect(posts).toHaveLength(1);
  });

  test('/interrupt 는 어떤 경우에도 보내지 않는다 — id 를 붙여도 남의 작업이 멈출 틈이 있다', async () => {
    for (const jobCancel of [true, false, 'missing', 'down']) {
      const posts = fakeComfy({ jobCancel });
      await cancelPrompt(SERVER, MINE);
      expect(sent(posts, '/interrupt')).toHaveLength(0);
    }
  });

  test('작업별 취소가 없는 옛 서버에서는 대기열에서 그 id 만 뺀다. 실행 중단은 하지 않는다', async () => {
    const posts = fakeComfy({ jobCancel: 'missing' });
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'dequeue-requested', reason: 'no-job-cancel-api' });
    expect(posts.map((p) => p.path)).toEqual([CANCEL(MINE), '/queue']);
    expect(sent(posts, '/queue')[0].body).toEqual({ delete: [MINE] });
  });

  test('대기열 요청에 전체 비우기(clear)는 들어가지 않는다', async () => {
    const posts = fakeComfy({ jobCancel: 'missing' });
    await cancelPrompt(SERVER, MINE);
    for (const p of sent(posts, '/queue')) expect(Object.keys(p.body)).toEqual(['delete']);
  });

  test('405 도 "그 API 가 없다"로 읽는다', async () => {
    const posts = fakeComfy();
    axios.post.mockImplementation(async (url, body) => {
      posts.push({ path: url.replace(SERVER, ''), body });
      if (url.includes('/api/jobs/')) throw Object.assign(new Error('405'), { response: { status: 405 } });
      return { data: {} };
    });
    await expect(cancelPrompt(SERVER, MINE)).resolves.toMatchObject({ action: 'dequeue-requested' });
  });

  test.each([500, 502, 401])('작업별 취소가 %i 로 실패하면 대기열 삭제로 넘어가지 않는다', async (status) => {
    const posts = fakeComfy();
    axios.post.mockImplementation(async (url, body) => {
      posts.push({ path: url.replace(SERVER, ''), body });
      throw Object.assign(new Error(String(status)), { response: { status } });
    });
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'none', reason: 'unreachable' });
    expect(posts).toHaveLength(1);
  });

  test('응답 형식이 예상과 다르면 취소됐다고 하지 않는다', async () => {
    const posts = fakeComfy();
    axios.post.mockResolvedValue({ data: '<html>' });
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'none', reason: 'unexpected-response' });
    expect(posts).toHaveLength(0);
  });

  test.each([undefined, null, '', 0, 123, {}, [], ['prompt-mine']])('prompt id 가 %p 면 ComfyUI 를 부르지 않는다', async (id) => {
    fakeComfy();
    await expect(cancelPrompt(SERVER, id)).resolves.toEqual({ action: 'none', reason: 'no-prompt-id' });
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('id 에 경로 문자가 있어도 다른 주소로 새지 않는다', async () => {
    const posts = fakeComfy({ jobCancel: false });
    await cancelPrompt(SERVER, '../../queue');
    expect(posts[0].path).toBe('/api/jobs/..%2F..%2Fqueue/cancel');
  });

  test('ComfyUI 가 응답하지 않아도 던지지 않는다', async () => {
    fakeComfy({ jobCancel: 'down' });
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'none', reason: 'unreachable' });
  });

  test('옛 서버에서 대기열 삭제가 실패해도 던지지 않는다', async () => {
    fakeComfy();
    axios.post.mockImplementation(async (url) => {
      if (url.includes('/api/jobs/')) throw Object.assign(new Error('404'), { response: { status: 404 } });
      throw new Error('timeout');
    });
    await expect(cancelPrompt(SERVER, MINE)).resolves.toEqual({ action: 'none', reason: 'unreachable' });
  });
});

describe('submitWorkflow — 취소 신호', () => {
  const tick = () => new Promise((r) => setImmediate(r));
  const settle = async (n = 6) => { for (let i = 0; i < n; i += 1) await tick(); };
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  test('시작 전에 이미 취소됐으면 연결도 제출도 하지 않는다', async () => {
    const posts = fakeComfy();
    const c = new AbortController(); c.abort();
    WebSocket.last = null;
    await expect(submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal })).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(WebSocket.last).toBeNull();
    expect(posts).toHaveLength(0);
  });

  test('연결하는 사이 취소되면 연결을 기다리지 않고 끝낸다. 제출하지 않고 소켓을 닫는다', async () => {
    const posts = fakeComfy();
    const c = new AbortController();
    const p = submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal });
    c.abort();   // 아직 open 전
    await expect(p).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(posts).toHaveLength(0);
    expect(WebSocket.last.closed).toBe(true);
  });

  test('제출할 때 prompt id 를 우리가 정해 보낸다 (소문자 UUID)', async () => {
    const posts = fakeComfy();
    const outcome = submitWorkflow(SERVER, { a: 1 }, null, 300000).catch((e) => e);
    await settle();
    expect(sent(posts, '/prompt')[0].body.prompt_id).toMatch(UUID);
    WebSocket.last.emit('message', JSON.stringify({ type: 'execution_error', data: { prompt_id: MINE, exception_message: 'x' } }), false);
    await outcome;
  });

  test('실행 중에 취소되면 그 prompt 만 취소하고 대기를 바로 끝낸다', async () => {
    const posts = fakeComfy();
    const c = new AbortController();
    const outcome = submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal }).catch((e) => e);
    await settle();
    c.abort();
    expect(await outcome).toMatchObject({ code: 'ERR_CANCELED' });
    await settle();
    expect(mutations(posts)).toEqual([{ path: CANCEL(MINE), body: {} }]);
    expect(WebSocket.last.closed).toBe(true);
  });

  test('ComfyUI 취소 응답이 늦어도 대기는 먼저 끝난다 (워커 자리를 붙잡지 않는다)', async () => {
    const posts = fakeComfy();
    const base = axios.post.getMockImplementation();
    let release;
    axios.post.mockImplementation(async (url, body) => {
      if (url.includes('/api/jobs/')) { posts.push({ path: url.replace(SERVER, ''), body }); await new Promise((r) => { release = r; }); return { data: { cancelled: true } }; }
      return base(url, body);
    });
    const c = new AbortController();
    const outcome = submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal }).catch((e) => e);
    await settle();
    c.abort();
    expect(await outcome).toMatchObject({ code: 'ERR_CANCELED' });   // release 전에 끝난다
    release();
    await settle();
  });

  test('취소 직후 실행 오류가 와도 결말은 취소다', async () => {
    fakeComfy();
    const c = new AbortController();
    const outcome = submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal }).catch((e) => e);
    await settle();
    c.abort();
    WebSocket.last.emit('message', JSON.stringify({ type: 'execution_error', data: { prompt_id: MINE, exception_message: 'interrupted' } }), false);
    expect(await outcome).toMatchObject({ code: 'ERR_CANCELED' });
  });

  test('취소 전에 난 실행 오류는 취소로 가려지지 않는다', async () => {
    const posts = fakeComfy();
    const c = new AbortController();
    const outcome = submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal }).catch((e) => e);
    await settle();
    WebSocket.last.emit('message', JSON.stringify({ type: 'execution_error', data: { prompt_id: MINE, exception_message: 'bad model' } }), false);
    const err = await outcome;
    expect(err.message).toMatch(/bad model/);
    expect(err.code).toBeUndefined();
    c.abort();   // 끝난 뒤의 취소는 아무것도 보내지 않는다
    await settle();
    expect(mutations(posts)).toHaveLength(0);
  });

  test('제출 응답이 오기 전에 취소되고 곧 응답이 오면, 받은 id 로 취소한다', async () => {
    const posts = fakeComfy();
    const base = axios.post.getMockImplementation();
    let release;
    axios.post.mockImplementation(async (url, body) => {
      if (url.endsWith('/prompt')) { posts.push({ path: '/prompt', body }); await new Promise((r) => { release = r; }); return { data: { prompt_id: MINE } }; }
      return base(url, body);
    });
    const c = new AbortController();
    const outcome = submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal }).catch((e) => e);
    await settle();
    c.abort();
    release();
    expect(await outcome).toMatchObject({ code: 'ERR_CANCELED' });
    await settle();
    expect(mutations(posts)).toEqual([{ path: CANCEL(MINE), body: {} }]);
  });

  test('제출 응답이 끝내 안 오면 기다리다 우리가 정한 id 로 취소하고 끝낸다. 소켓도 닫는다', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    try {
      const posts = fakeComfy();
      const base = axios.post.getMockImplementation();
      axios.post.mockImplementation(async (url, body) => {
        if (url.endsWith('/prompt')) { posts.push({ path: '/prompt', body }); return new Promise(() => {}); }
        return base(url, body);
      });
      const c = new AbortController();
      const outcome = submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal }).catch((e) => e);
      await settle();
      c.abort();
      await jest.advanceTimersByTimeAsync(9000);
      expect(mutations(posts)).toHaveLength(0);          // 아직 기다리는 중
      await jest.advanceTimersByTimeAsync(1500);
      expect(await outcome).toMatchObject({ code: 'ERR_CANCELED' });
      const requested = sent(posts, '/prompt')[0].body.prompt_id;
      expect(mutations(posts)).toEqual([{ path: CANCEL(requested), body: {} }]);
      expect(WebSocket.last.closed).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  test('취소 없이 제출이 실패하면 제출 실패로 남고 소켓을 닫는다', async () => {
    const posts = fakeComfy();
    axios.post.mockRejectedValue(Object.assign(new Error('Request failed with status code 400'), { response: { status: 400, data: { error: 'bad' } } }));
    const c = new AbortController();
    const err = await submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal }).catch((e) => e);
    expect(err.message).toMatch(/Failed to submit workflow/);
    expect(err.code).toBeUndefined();
    expect(WebSocket.last.closed).toBe(true);
    expect(posts).toHaveLength(0);
  });

  test('취소했는데 ComfyUI 가 응답하지 않아도 대기는 취소로 끝난다', async () => {
    fakeComfy({ jobCancel: 'down' });
    const c = new AbortController();
    const outcome = submitWorkflow(SERVER, {}, null, 300000, { signal: c.signal }).catch((e) => e);
    await settle();
    c.abort();
    expect(await outcome).toMatchObject({ code: 'ERR_CANCELED' });
    await settle();
  });

  test('취소로 끝나면 타이머와 리스너가 남지 않는다 — 생존 확인이 도는 중이었어도', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    try {
      fakeComfy();
      let releaseHistory;
      axios.get.mockImplementation(async (url) => {
        if (url.includes('/history/')) { await new Promise((r) => { releaseHistory = r; }); return { data: {} }; }
        return { data: { queue_running: [entry(MINE)], queue_pending: [] } };
      });
      const c = new AbortController();
      const remove = jest.spyOn(c.signal, 'removeEventListener');
      const outcome = submitWorkflow(SERVER, {}, null, 1000, { signal: c.signal }).catch((e) => e);
      await settle();
      await jest.advanceTimersByTimeAsync(1000);   // 생존 확인이 이력 조회에서 멈춰 있다
      c.abort();
      expect(await outcome).toMatchObject({ code: 'ERR_CANCELED' });
      releaseHistory();                            // 멈춰 있던 확인이 돌아온다
      await settle();
      expect(jest.getTimerCount()).toBe(0);
      expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    } finally {
      jest.useRealTimers();
    }
  });

  test('취소로 끝난 뒤에는 이력에 결과가 있어도 받지 않는다', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    try {
      fakeComfy();
      let releaseHistory;
      const gets = [];
      axios.get.mockImplementation(async (url) => {
        gets.push(url);
        if (url.includes('/history/')) { await new Promise((r) => { releaseHistory = r; }); return { data: { [MINE]: { status: { status_str: 'success' }, outputs: { 9: { images: [{ filename: 'a.png', subfolder: '', type: 'output' }] } } } } }; }
        return { data: { queue_running: [], queue_pending: [] } };
      });
      const c = new AbortController();
      const outcome = submitWorkflow(SERVER, {}, null, 1000, { signal: c.signal }).catch((e) => e);
      await settle();
      await jest.advanceTimersByTimeAsync(1000);
      c.abort();
      expect(await outcome).toMatchObject({ code: 'ERR_CANCELED' });
      releaseHistory();
      await settle();
      expect(gets.filter((u) => u.includes('/view'))).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  describe('취소가 아닌 경로에서는 ComfyUI 에 취소를 보내지 않는다', () => {
    const run = async ({ withSignal, afterSubmit, timeout = 1000 }) => {
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
      try {
        const posts = fakeComfy({ queue: { running: [], pending: [] } });
        const c = new AbortController();
        const outcome = submitWorkflow(SERVER, {}, null, timeout, withSignal ? { signal: c.signal } : undefined).catch((e) => e);
        await settle();
        const err = await afterSubmit(outcome, posts);
        await settle();
        expect(mutations(posts)).toHaveLength(0);
        return err;
      } finally {
        jest.useRealTimers();
      }
    };

    test.each([true, false])('시간 초과로 끝날 때 (신호 있음=%p)', async (withSignal) => {
      const err = await run({ withSignal, afterSubmit: async (outcome) => { await jest.advanceTimersByTimeAsync(1100); return outcome; } });
      expect(err.message).toMatch(/timeout/);
      expect(err.code).toBeUndefined();
    });

    test.each([true, false])('대기열에 살아 있어 시간 초과를 연장할 때 (신호 있음=%p)', async (withSignal) => {
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
      try {
        const posts = fakeComfy({ queue: { running: [MINE], pending: [] } });
        const c = new AbortController();
        const outcome = submitWorkflow(SERVER, {}, null, 1000, withSignal ? { signal: c.signal } : undefined).catch((e) => e);
        await settle();
        await jest.advanceTimersByTimeAsync(3500);
        expect(mutations(posts)).toHaveLength(0);
        WebSocket.last.emit('message', JSON.stringify({ type: 'execution_error', data: { prompt_id: MINE, exception_message: 'x' } }), false);
        await outcome;
      } finally {
        jest.useRealTimers();
      }
    });

    test('실행 오류로 끝날 때', async () => {
      const err = await run({ withSignal: true, afterSubmit: async (outcome) => {
        WebSocket.last.emit('message', JSON.stringify({ type: 'execution_error', data: { prompt_id: MINE, exception_message: 'boom' } }), false);
        return outcome;
      } });
      expect(err.message).toMatch(/boom/);
    });

    test('연결이 끊겨 이력 확인으로 넘어갔다가 사라진 것으로 끝날 때', async () => {
      const err = await run({ withSignal: true, timeout: 600000, afterSubmit: async (outcome) => {
        WebSocket.last.emit('close', 1006, 'gone');
        await jest.advanceTimersByTimeAsync(10500);
        return outcome;
      } });
      expect(err.message).toMatch(/disappeared/);
    });
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

  test('전체 중단 함수(interruptExecution)와 /interrupt 요청은 어디서도 쓰지 않는다', () => {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) return d.name === 'tests' ? [] : walk(p);
      return p.endsWith('.js') ? [p] : [];
    });
    const root = path.join(__dirname, '..');
    const all = walk(root).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    expect(all).not.toMatch(/interruptExecution\(/);
    // 남아 있는 것은 정의 한 곳뿐이다
    expect(all.match(/\$\{serverUrl\}\/interrupt/g)).toHaveLength(1);
  });
});
