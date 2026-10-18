#!/usr/bin/env node
/**
 * iOS 시뮬레이터 레이아웃 검사 (#1057) — 실제 iOS Safari(WebKit)에서 화면마다 가로 넘침·제목 줄 수를 재고 스크린샷을 남긴다.
 *
 *   pnpm run test:ios-sim [-- --public] [--out <dir>] [--settle <ms>] [--keep-dialogs] [/route ...]
 *
 * 사전 조건 (절차는 e2e/ios-sim/README.md):
 *   - 부팅된 iOS 시뮬레이터가 **정확히 하나**이고, 그 Safari 에서 앱(기본 http://localhost:8136)을 열어 둔 상태
 *   - 기본은 로그인한 상태에서 로그인 뒤 화면을, --public 은 로그아웃한 상태에서 로그인 전 화면을 잰다
 *   - Web Inspector → CDP 브리지(inspect-webkit). 포트(기본 9322)가 비어 있으면 이 스크립트가 띄우고 끝날 때 끈다
 *
 * 화면 목록은 frontend/src/App.js 의 <Route path> 에서 읽는다 — 사본을 두지 않는다. 경로를 인자로 주면 그 화면만 잰다.
 * 판정: 문서 가로 스크롤 없음(scrollWidth <= clientWidth) · 가로 스크롤 영역 밖으로 삐져나온 요소 없음 · h1 두 줄 이하.
 * 업데이트 안내창은 닫으면 계정에 '봤음'이 기록되므로 누르지 않고 DOM 에서만 치운다 (--keep-dialogs 로 끈다).
 *
 * 종료 코드: 0 전부 측정·통과 · 2 측정 못 한 화면 있음(견본 ID 규칙·견본 없음, 예상 밖 이동) · 1 레이아웃 문제 또는 오류
 */
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const APP_JS = path.join(ROOT, 'frontend/src/App.js');
const ORCA_INSPECT_WEBKIT = '/Applications/Orca.app/Contents/Resources/node_modules/inspect-webkit/dist/cli.js';

// :param 화면의 견본 — 페이지 안에서 로그인 쿠키로 API 를 불러 고른다.
// 규칙이 없는 새 :param 화면은 '측정 못 함'(종료 코드 2)으로 드러난다. App.js 에 추가하면 여기에도 넣는다.
const PARAM_SAMPLES = {
  '/generate/:id': 'imageWorkboard',
  '/prompt-generate/:workboardId': 'textWorkboard',
  '/projects/:id': 'project',
  '/admin/workboards/:id/edit': 'imageWorkboard',
};
const NOT_MEASURABLE = {
  '/reset-password/:token': '메일로 받는 일회용 토큰이 필요',
  '/auth/callback': 'OAuth 로그인 도중에만 거치는 주소',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const o = { public: false, out: null, settle: 3000, keepDialogs: false, only: [],
    app: process.env.IOS_SIM_APP_URL || 'http://localhost:8136', cdpPort: Number(process.env.IOS_SIM_CDP_PORT || 9322) };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') continue; // pnpm run 이 넘기는 구분자
    else if (a === '--public') o.public = true;
    else if (a === '--keep-dialogs') o.keepDialogs = true;
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--settle') o.settle = Number(argv[++i]);
    else if (a === '--app') o.app = argv[++i];
    else if (a === '--cdp-port') o.cdpPort = Number(argv[++i]);
    else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(0); }
    else if (a.startsWith('/')) o.only.push(a);
    else throw new Error(`알 수 없는 인자: ${a}`);
  }
  o.app = o.app.replace(/\/$/, '');
  return o;
}

// App.js 의 <Route path> — '/*' 보호 레이아웃보다 앞에 있는 것이 로그인 전 화면, <Navigate> 만 하는 것은 이동 주소다
function appRoutes() {
  const src = fs.readFileSync(APP_JS, 'utf8');
  const boundary = src.indexOf('path="/*"');
  if (boundary < 0) throw new Error('App.js 에서 보호 레이아웃(path="/*")을 찾지 못했습니다 — 공개/로그인 뒤 화면을 가를 수 없습니다');
  const found = [...src.matchAll(/path="([^"]+)"/g)];
  return found.filter((m) => m[1] !== '/*').map((m) => {
    const next = found.indexOf(m) + 1;
    const nav = src.slice(m.index, next < found.length ? found[next].index : src.length).match(/<Navigate\s+to="([^"]+)"/);
    return { path: m[1], public: m.index < boundary, alias: nav ? nav[1] : null };
  });
}

function bootedDevice() {
  const json = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted', '-j'], { encoding: 'utf8' }));
  const booted = Object.entries(json.devices).flatMap(([runtime, list]) => list
    .filter((d) => d.state === 'Booted')
    .map((d) => ({ ...d, runtime: runtime.replace(/^.*SimRuntime\./, '').replace(/-(\d+)-(\d+)$/, ' $1.$2') })));
  if (booted.length !== 1) {
    throw new Error(`부팅된 시뮬레이터가 ${booted.length}개입니다 — 하나만 켜 두세요${booted.length ? ': ' + booted.map((d) => d.name).join(', ') : ''}`);
  }
  return booted[0];
}

async function reachable(cdp) {
  try { return (await fetch(`${cdp}/json/list`, { signal: AbortSignal.timeout(3000) })).ok; } catch { return false; }
}

// 브리지가 없으면 띄운다 — 끌 때는 이 스크립트가 띄운 PID 만 끈다
async function ensureBridge(cdp, port) {
  if (await reachable(cdp)) { console.log(`브리지: ${cdp} 에 이미 떠 있는 것을 씁니다 (기기를 바꿨다면 재시작하세요)`); return null; }
  const cli = process.env.INSPECT_WEBKIT_CLI || ORCA_INSPECT_WEBKIT;
  if (!fs.existsSync(cli)) throw new Error(`inspect-webkit 을 찾지 못했습니다 (${cli}) — INSPECT_WEBKIT_CLI 로 cli.js 경로를 주세요`);
  const child = spawn(process.execPath, [cli, '--port', String(port)], { stdio: 'ignore' });
  const stop = () => { if (child.exitCode === null) child.kill(); };
  process.on('exit', stop);
  for (let i = 0; i < 30 && !(await reachable(cdp)); i++) await sleep(500);
  if (!(await reachable(cdp))) { stop(); throw new Error(`브리지가 ${cdp} 에서 응답하지 않습니다`); }
  console.log(`브리지: ${cdp} 에 띄웠습니다 (pid ${child.pid}, 끝나면 끕니다)`);
  return stop;
}

async function openTarget(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('브리지 연결 실패')); });
  let id = 0; const waiting = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } };
  const evaluate = (expression, timeout = 10000) => new Promise((ok, no) => {
    const n = ++id;
    const timer = setTimeout(() => { waiting.delete(n); no(new Error('응답 없음')); }, timeout);
    waiting.set(n, (d) => {
      clearTimeout(timer);
      const r = d.result || {};
      if (d.error || r.exceptionDetails) no(new Error(JSON.stringify(d.error || r.exceptionDetails).slice(0, 300)));
      else ok(r.result && r.result.value);
    });
    ws.send(JSON.stringify({ id: n, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  });
  // 브리지는 awaitPromise 를 받지 않는다 (Promise 가 빈 객체로 온다) — 결과를 페이지 변수에 받아 두고 읽어 온다
  const evaluateAsync = async (asyncFnSource, timeout = 15000) => {
    await evaluate(`window.__vccIosSimR = undefined; (${asyncFnSource})().then((v) => { window.__vccIosSimR = { v }; }, (e) => { window.__vccIosSimR = { e: String(e) }; }); true`);
    for (const end = Date.now() + timeout; Date.now() < end; await sleep(300)) {
      const r = await evaluate('window.__vccIosSimR');
      if (r) { if ('e' in r) throw new Error(r.e); return r.v; }
    }
    throw new Error('페이지 안 비동기 호출이 끝나지 않았습니다');
  };
  return { evaluate, evaluateAsync, close: () => ws.close() };
}

// Safari 탭이 여럿이면 화면에 보이는 탭에 붙는다 — 스크린샷은 보이는 탭만 찍힌다
async function connectVisible(cdp, app) {
  const targets = (await (await fetch(`${cdp}/json/list`)).json()).filter((t) => t.type === 'page' && t.url.startsWith(app));
  for (const t of targets) {
    const c = await openTarget(t);
    try { if ((await c.evaluate('document.visibilityState', 3000)) === 'visible') return c; } catch { /* 다음 탭 */ }
    c.close();
  }
  return null;
}

async function waitVisible(cdp, app, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const c = await connectVisible(cdp, app).catch(() => null);
    if (c) return c;
    await sleep(500);
  }
  throw new Error(`시뮬레이터 Safari 에 ${app} 를 연 보이는 탭이 없습니다`);
}

const MEASURE = `(() => {
  const vw = document.documentElement.clientWidth;
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= vw + 1) continue;
    let p = el.parentElement, inScroller = false;
    while (p && p !== document.body) {
      if (/(auto|scroll)/.test(getComputedStyle(p).overflowX) && p.scrollWidth > p.clientWidth) { inScroller = true; break; }
      p = p.parentElement;
    }
    if (!inScroller) wide.push({ tag: el.tagName.toLowerCase(), right: Math.round(r.right), text: (el.innerText || '').slice(0, 30).replace(/\\n/g, ' ') });
  }
  const h1 = document.querySelector('h1');
  let title = null;
  if (h1) { const r = h1.getBoundingClientRect(); title = { text: h1.innerText.slice(0, 30), width: Math.round(r.width), lines: Math.round(r.height / (parseFloat(getComputedStyle(h1).lineHeight) || r.height || 1)) }; }
  // iOS 는 16px 보다 작은 입력 칸에 포커스가 가면 화면을 확대한다 (#1068) — 보이는 입력 칸의 글자 크기
  const SKIP = ['checkbox', 'radio', 'range', 'file', 'hidden'];
  const small = [...document.querySelectorAll('input, textarea, select')]
    .filter((el) => !SKIP.includes(el.type) && el.getBoundingClientRect().width > 0)
    .map((el) => ({ tag: el.tagName.toLowerCase(), size: parseFloat(getComputedStyle(el).fontSize), name: el.name || el.placeholder || '' }))
    .filter((x) => x.size < 16);
  return { final: location.pathname, vw, scrollWidth: document.documentElement.scrollWidth, title, wideCount: wide.length, wide: wide.slice(0, 5),
    smallInputCount: small.length, smallInputs: small.slice(0, 3) };
})()`;

const HIDE_DIALOGS = `(() => { const d = document.querySelectorAll('.MuiDialog-root'); d.forEach((x) => x.remove());
  document.body.style.overflow = ''; document.body.style.paddingRight = ''; return d.length; })()`;

const LOGGED_IN = '/(?:^|; )token=/.test(document.cookie)';

// 견본 ID — 로그인 쿠키의 토큰으로 API 를 부른다 (evaluateAsync 로 실행하는 async 함수 소스)
const SAMPLES = `async () => {
  const token = decodeURIComponent(document.cookie.match(/(?:^|; )token=([^;]+)/)[1]);
  const get = async (p) => { const r = await fetch('/api' + p, { headers: { Authorization: 'Bearer ' + token } }); return r.ok ? r.json() : null; };
  const wb = await get('/workboards?limit=50'), pj = await get('/projects?limit=1');
  const boards = (wb && ((wb.data && wb.data.workboards) || wb.workboards)) || [];
  const projects = (pj && ((pj.data && pj.data.projects) || pj.projects)) || [];
  const pick = (f) => { const b = boards.find((x) => x.outputFormat === f); return b ? b._id : null; };
  return { imageWorkboard: pick('image'), textWorkboard: pick('text'), project: projects[0] ? projects[0]._id : null };
}`;

async function visit(cdp, app, url, settle) {
  let c = await waitVisible(cdp, app, 10000);
  // 이전 문서에 표시를 남기고 이동 — 표시가 없는 문서가 다 뜨면 새 화면이다
  await c.evaluate(`window.__vccIosSim = true; location.href = ${JSON.stringify(url)}; true`, 3000).catch(() => {});
  const deadline = Date.now() + 20000;
  for (;;) {
    await sleep(500);
    try {
      const [state, old] = await c.evaluate('[document.readyState, !!window.__vccIosSim]', 3000);
      if (state === 'complete' && !old) break;
    } catch { c.close(); c = await waitVisible(cdp, app, 5000).catch(() => null); if (!c) c = await waitVisible(cdp, app, 10000); }
    if (Date.now() > deadline) throw new Error('화면이 20초 안에 뜨지 않았습니다');
  }
  await sleep(settle); // 데이터 로딩과 SPA 안의 이동을 기다린다
  return c;
}

function fileName(route) { return `${route.replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'root'}.png`; }

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const device = bootedDevice();
  const cdp = `http://127.0.0.1:${opt.cdpPort}`;
  const stopBridge = await ensureBridge(cdp, opt.cdpPort);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const outDir = opt.out || path.join(ROOT, 'test-results/ios-sim', `${stamp}-${device.name.replace(/\W+/g, '-')}${opt.public ? '-public' : ''}`);
  fs.mkdirSync(outDir, { recursive: true });

  const first = await waitVisible(cdp, opt.app, 15000);
  const loggedIn = await first.evaluate(LOGGED_IN);
  if (!opt.public && !loggedIn) throw new Error('로그인 상태가 아닙니다 — 시뮬레이터에서 로그인하거나 dev-login-cookie.js 로 쿠키를 심은 뒤 돌리세요');
  if (opt.public && loggedIn) throw new Error('로그인 상태입니다 — --public 은 로그아웃한 뒤 돌리세요');
  const samples = opt.public ? {} : await first.evaluateAsync(SAMPLES);
  first.close();

  const results = [];
  for (const r of appRoutes()) {
    const row = { route: r.path };
    results.push(row);
    if (opt.only.length && !opt.only.includes(r.path)) { row.status = 'skipped'; row.note = '인자로 고른 화면이 아님'; continue; }
    if (r.public !== opt.public) { row.status = 'skipped'; row.note = r.public ? '로그인 전 화면 (--public 으로)' : '로그인 뒤 화면 (--public 없이)'; continue; }
    if (r.alias) { row.status = 'skipped'; row.note = `이동 주소 → ${r.alias}`; continue; }
    if (NOT_MEASURABLE[r.path]) { row.status = 'skipped'; row.note = NOT_MEASURABLE[r.path]; continue; }
    let target = r.path;
    if (target.includes(':')) {
      const key = PARAM_SAMPLES[r.path];
      if (!key) { row.status = 'unmeasured'; row.note = '견본 ID 규칙 없음 — layout-check.js 의 PARAM_SAMPLES 에 추가'; continue; }
      if (!samples[key]) { row.status = 'unmeasured'; row.note = `견본(${key})이 이 인스턴스에 없음`; continue; }
      target = target.replace(/:[^/]+/, samples[key]);
    }
    try {
      const c = await visit(cdp, opt.app, opt.app + target, opt.settle);
      row.dialogsRemoved = opt.keepDialogs ? 0 : await c.evaluate(HIDE_DIALOGS);
      if (row.dialogsRemoved) await sleep(400);
      Object.assign(row, await c.evaluate(MEASURE));
      c.close();
      row.shot = fileName(r.path);
      execFileSync('xcrun', ['simctl', 'io', device.udid, 'screenshot', path.join(outDir, row.shot)], { stdio: 'ignore' });
      if (row.final !== target) { row.status = 'unmeasured'; row.note = `예상 밖 이동 → ${row.final} (권한·로그인 확인)`; continue; }
      const problems = [];
      if (row.scrollWidth > row.vw) problems.push(`문서 폭 ${row.scrollWidth} > ${row.vw}`);
      if (row.wideCount) problems.push(`삐져나온 요소 ${row.wideCount}개 (${row.wide.map((w) => `${w.tag}:${w.right}px "${w.text}"`).join(', ')})`);
      if (row.title && row.title.lines > 2) problems.push(`제목 ${row.title.lines}줄 (폭 ${row.title.width}px)`);
      if (row.smallInputCount) problems.push(`16px 미만 입력 칸 ${row.smallInputCount}개 — 누르면 iOS 가 확대 (${row.smallInputs.map((x) => `${x.tag}:${x.size}px "${x.name.slice(0, 20)}"`).join(', ')})`);
      row.status = problems.length ? 'fail' : 'pass';
      row.note = problems.join(' · ') + (row.title ? '' : (problems.length ? ' · ' : '') + '제목(h1) 없음');
    } catch (e) {
      row.status = 'error'; row.note = e.message;
    }
  }
  if (stopBridge) stopBridge();

  const LABEL = { pass: '통과', fail: '문제', unmeasured: '측정 못 함', error: '오류', skipped: '건너뜀' };
  const count = (s) => results.filter((x) => x.status === s).length;
  const vw = (results.find((x) => x.vw) || {}).vw;
  console.log(`\n기기 ${device.name} (${device.runtime}) · 폭 ${vw || '?'}px · ${opt.public ? '로그인 전 화면' : '로그인 뒤 화면'} · ${opt.app}`);
  // 한글은 터미널에서 두 칸을 차지한다 — 표시 폭으로 채워야 표가 맞는다
  const pad = (str, n) => str + ' '.repeat(Math.max(0, n - [...str].reduce((w, ch) => w + (/[\u3130-\u318f\uac00-\ud7a3]/.test(ch) ? 2 : 1), 0)));
  for (const x of results) {
    const size = x.vw ? `${x.vw}/${x.scrollWidth}` : '';
    const title = x.title ? `제목 ${x.title.lines}줄 ${x.title.width}px` : '';
    console.log(`${pad(LABEL[x.status], 11)}${pad(x.route, 31)}${pad(size, 10)}${pad(title, 18)}${x.note || ''}`);
  }
  const summary = { pass: count('pass'), fail: count('fail'), unmeasured: count('unmeasured'), error: count('error'), skipped: count('skipped') };
  console.log(`\nApp.js 화면 ${results.length}개 — 통과 ${summary.pass} · 문제 ${summary.fail} · 측정 못 함 ${summary.unmeasured} · 오류 ${summary.error} · 건너뜀 ${summary.skipped}`);
  console.log(`스크린샷·report.json: ${path.relative(process.cwd(), outDir) || '.'}`);
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ device: { name: device.name, runtime: device.runtime, udid: device.udid }, viewportWidth: vw, mode: opt.public ? 'public' : 'authenticated', app: opt.app, summary, results }, null, 2));
  process.exit(summary.fail || summary.error ? 1 : summary.unmeasured ? 2 : 0);
}

main().catch((e) => { console.error('ios-sim 레이아웃 검사 실패:', e.message); process.exit(1); });
