// MCP 서버 인증 처리 (#993) — 실제 앱을 띄우고 가짜 백엔드로 검증한다.
//   node --test test/unit/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// 가짜 백엔드: 키 상태에 따라 401 / 200
const keyState = new Map([['good', 'ok'], ['revokeme', 'ok']]);
let backend;
let mcp;
let port;
let sessions;
let mediaBaseUrlWarning;

before(async () => {
  backend = http.createServer((req, res) => {
    if (keyState.get(req.headers['x-api-key']) !== 'ok') {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: 'Invalid or revoked API key' }));
      return;
    }
    if (req.url.startsWith('/api/workboards')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ workboards: [], pagination: { total: 0, pages: 0, page: 1, limit: 10, current: 1 } }));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{}');
  });
  await new Promise((r) => backend.listen(0, '127.0.0.1', r));
  // apiClient 는 모듈 로드 시 VCC_API_URL 을 읽으므로 import 전에 정한다
  process.env.VCC_API_URL = `http://127.0.0.1:${backend.address().port}`;

  const mod = await import('../../src/httpTransport.js');
  mediaBaseUrlWarning = mod.mediaBaseUrlWarning;
  const created = mod.createHttpApp();
  sessions = created.sessions;
  mcp = created.app.listen(0, '127.0.0.1');
  await new Promise((r) => mcp.once('listening', r));
  port = mcp.address().port;
});

after(async () => {
  for (const s of sessions.values()) { try { await s.transport.close(); } catch { /* ignore */ } }
  await new Promise((r) => mcp.close(r));
  await new Promise((r) => backend.close(r));
});

const INIT = {
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'unit', version: '0' } },
};

async function rpc(body, { key, sid } = {}) {
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (key) headers.authorization = `Bearer ${key}`;
  if (sid) headers['mcp-session-id'] = sid;
  const r = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await r.text();
  const data = text.split('\n').find((l) => l.startsWith('data: '));
  let json = null;
  try { json = JSON.parse(data ? data.slice(6) : text); } catch { /* 빈 응답 */ }
  return { status: r.status, sid: r.headers.get('mcp-session-id'), json };
}

async function openSession(key) {
  const r = await rpc(INIT, { key });
  assert.equal(r.status, 200, '세션 열기');
  await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, { sid: r.sid });
  return r.sid;
}

const callListWorkboards = (sid, id = 2) =>
  rpc({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'list_workboards', arguments: {} } }, { sid });

test('키 없이 세션을 열면 401', async () => {
  const r = await rpc(INIT);
  assert.equal(r.status, 401);
});

test('백엔드가 거부하는 키로는 세션이 열리지 않는다 (401)', async () => {
  const r = await rpc(INIT, { key: 'nope' });
  assert.equal(r.status, 401);
  assert.match(r.json.error, /거부/);
});

test('정상 키는 세션이 열리고 도구가 돈다', async () => {
  const sid = await openSession('good');
  const r = await callListWorkboards(sid);
  assert.equal(r.status, 200);
  assert.notEqual(r.json?.result?.isError, true);
});

test('세션 도중 키가 폐기되면: 그 호출은 도구 오류, 다음 요청은 전송 단 401 이고 세션이 닫힌다', async () => {
  const sid = await openSession('revokeme');
  keyState.set('revokeme', 'revoked');

  const first = await callListWorkboards(sid, 3);
  assert.equal(first.status, 200, '실패한 호출 자체는 도구 응답');
  assert.equal(first.json?.result?.isError, true);

  const next = await callListWorkboards(sid, 4);
  assert.equal(next.status, 401, '클라이언트가 재인증하도록 전송 단에서 401');
  assert.equal(sessions.has(sid), false, '세션을 닫는다');

  const again = await callListWorkboards(sid, 5);
  assert.equal(again.status, 404, '닫힌 세션');
});

test('미디어 기준 주소 경고: 없으면 안내, 있으면 null', () => {
  assert.match(mediaBaseUrlWarning({}), /VCC_BASE_URL_FOR_MCP/);
  assert.equal(mediaBaseUrlWarning({ VCC_BASE_URL_FOR_MCP: 'https://vcc.example' }), null);
});
