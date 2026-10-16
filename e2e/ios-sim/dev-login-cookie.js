#!/usr/bin/env node
/**
 * 개발 중 테스트 전용 (#1057) — 시뮬레이터 Safari 에 개발용 로그인 쿠키를 심는 루프백 서버.
 *
 *   node e2e/ios-sim/dev-login-cookie.js --email <계정 이메일> [--port 18999] [--to /dashboard] [--no-open]
 *
 * 로컬 docker-compose 백엔드 컨테이너에서 그 계정의 JWT 를 발급해 **메모리에만** 들고 있다 (파일·출력에 남기지 않는다).
 * 프런트는 토큰을 JS 쿠키 `token` 으로 쓰고 쿠키는 포트를 가리지 않으므로, localhost:<port> 에서 심은 쿠키가
 * localhost:8136 에도 간다. 그래서 앱 주소가 localhost 가 아니면 거부한다 — 외부에 열린 인스턴스에는 쓰지 않는다.
 * 쿠키는 1시간 뒤 만료된다. Ctrl+C 로 끄면 부팅된 시뮬레이터에서 /clear 를 열어 쿠키를 지운 뒤 종료한다.
 *
 * QA 는 이 도구가 아니라 시뮬레이터에서 직접 로그인해서 한다 (e2e/ios-sim/README.md).
 */
const { execFileSync } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function parseArgs(argv) {
  const o = { email: process.env.IOS_SIM_DEV_EMAIL, port: 18999, to: '/dashboard', open: true, app: process.env.IOS_SIM_APP_URL || 'http://localhost:8136' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') o.email = argv[++i];
    else if (a === '--port') o.port = Number(argv[++i]);
    else if (a === '--to') o.to = argv[++i];
    else if (a === '--no-open') o.open = false;
    else if (a === '--help' || a === '-h') { console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(0); }
    else throw new Error(`알 수 없는 인자: ${a}`);
  }
  if (!o.email) throw new Error('--email (또는 IOS_SIM_DEV_EMAIL) 이 필요합니다');
  o.app = o.app.replace(/\/$/, '');
  if (new URL(o.app).hostname !== 'localhost') throw new Error(`앱 주소가 localhost 가 아닙니다 (${o.app}) — 이 도구는 로컬 개발 스택 전용입니다`);
  return o;
}

function issueToken(email) {
  const code = `const mongoose=require('mongoose');const User=require('./src/models/User');const {generateJWT}=require('./src/middleware/auth');
(async()=>{await mongoose.connect(process.env.MONGODB_URI);const u=await User.findOne({email:${JSON.stringify(email)}});
if(!u)process.exit(3);process.stdout.write(generateJWT(u));await mongoose.disconnect();})()
.catch((e)=>{console.error(e.message);process.exit(1)});`;
  const args = ['exec', '-T', 'backend', 'node', '-e', code];
  let out;
  try { out = execFileSync('docker-compose', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }); }
  catch (e) {
    if (e.status === 3) throw new Error(`이 인스턴스에 ${email} 계정이 없습니다`);
    if (e.code !== 'ENOENT') throw new Error('백엔드 컨테이너에서 토큰을 발급하지 못했습니다 (docker-compose 스택이 떠 있나요?)');
    out = execFileSync('docker', ['compose', ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  }
  const token = out.trim();
  if (token.split('.').length !== 3) throw new Error('발급 결과가 JWT 형식이 아닙니다');
  return token;
}

function simOpen(url) {
  try { execFileSync('xcrun', ['simctl', 'openurl', 'booted', url], { stdio: 'ignore' }); return true; } catch { return false; }
}

function main() {
  const opt = parseArgs(process.argv.slice(2));
  const token = issueToken(opt.email);
  const self = `http://localhost:${opt.port}`;

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, self);
    let js;
    if (u.pathname === '/set') {
      const to = (u.searchParams.get('to') || opt.to).replace(/[^\w\-/?=&.]/g, '');
      js = `document.cookie = "token=${token}; path=/; max-age=3600"; location.replace(${JSON.stringify(opt.app + to)});`;
    } else if (u.pathname === '/clear') {
      js = `document.cookie = "token=; path=/; max-age=0"; document.body.textContent = document.cookie.includes("token=") ? "쿠키가 남아 있습니다" : "개발용 로그인 쿠키를 지웠습니다";`;
    } else { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`<!doctype html><meta charset="utf-8"><body><script>${js}</script></body>`);
  });

  server.listen(opt.port, '127.0.0.1', () => {
    console.log(`개발용 로그인 쿠키 서버: 127.0.0.1:${opt.port} (토큰은 메모리에만, 쿠키는 1시간 뒤 만료)`);
    const setUrl = `${self}/set?to=${encodeURIComponent(opt.to)}`;
    if (opt.open && simOpen(setUrl)) console.log(`시뮬레이터에서 열었습니다: ${opt.app}${opt.to}`);
    else console.log(`시뮬레이터에서 여세요: xcrun simctl openurl booted '${setUrl}'`);
    console.log('끝나면 Ctrl+C — 쿠키를 지우고 종료합니다.');
  });

  let closing = false;
  const shutdown = async () => {
    if (closing) return; closing = true;
    const cleared = simOpen(`${self}/clear`);
    if (cleared) await new Promise((r) => setTimeout(r, 4000)); // 시뮬레이터가 /clear 를 받아갈 때까지 서버를 살려 둔다
    console.log(cleared ? '\n시뮬레이터에서 쿠키 삭제 페이지를 열었습니다 (결과는 그 화면에 보입니다).' : '\n부팅된 시뮬레이터가 없어 쿠키를 지우지 못했습니다 — 심은 지 1시간이 지나면 만료됩니다.');
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

try { main(); } catch (e) { console.error('dev-login-cookie 실패:', e.message); process.exit(1); }
