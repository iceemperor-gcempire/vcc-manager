/**
 * API 키의 용도 (#995).
 *
 * - 'api' — 범용. 그 계정의 REST 를 쓴다 (파괴적 작업은 #994 로 키 인증 자체가 막혀 있다)
 * - 'mcp' — MCP 전용. MCP 도구가 실제로 호출하는 요청만 허용하고 나머지는 거부한다
 *
 * 막을 걸 나열하지 않고 허용할 걸 나열한다 — 새 라우트가 생겨도 MCP 키로는 기본이 거부다.
 * 키 용도는 **라우트**를 막고 데이터는 막지 않는다. 데이터까지 나누려면 MCP 전용 계정을 쓴다.
 */

const API_KEY_SCOPES = ['api', 'mcp'];
const DEFAULT_API_KEY_SCOPE = 'api';

// 설정 파일에서 어떤 키인지 바로 보이도록 접두사를 다르게 한다
const API_KEY_PREFIX = { api: 'vcc_', mcp: 'vccm_' };

// MCP 키로 허용하는 요청 — 경로는 /api 기준.
// mcp-server/src/tools/*.js 가 호출하는 것과 정확히 같아야 한다 (apiKeyScope.test.js 가 양방향으로 대조).
// 서명 URL(/api/files/*)은 키 없이 서명으로 열리므로 여기 없다.
const MCP_KEY_ALLOWED_ROUTES = [
  ['GET', '/workboards'],
  ['GET', '/workboards/:id'],
  ['POST', '/jobs/generate'],
  ['GET', '/jobs/my'],
  ['GET', '/jobs/:id'],
  ['GET', '/images/generated/:id'],
  ['GET', '/images/videos/:id'],
  ['GET', '/images/audios/:id'],
  ['POST', '/images/upload'],
  ['GET', '/projects'],
  ['GET', '/projects/:id/pipelines'],
  ['GET', '/projects/:id/pipelines/:id'],
  ['GET', '/projects/:id/pipeline-runs'],
  ['POST', '/projects/:id/pipeline-runs'],
  ['GET', '/projects/:id/pipeline-runs/:id'],
];

function routePatternToRegExp(pattern) {
  const body = pattern
    .split('/')
    .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${body}$`);
}

const MCP_KEY_ALLOWED = MCP_KEY_ALLOWED_ROUTES.map(([method, pattern]) => ({
  method,
  pattern,
  regex: routePatternToRegExp(pattern),
}));

function normalizePath(path) {
  const p = String(path || '').split('?')[0];
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

/** MCP 키로 이 요청을 허용하는가. path 는 /api 를 뗀 경로 (Express 의 req.path, app.use('/api') 안). */
function isMcpKeyAllowed(method, path) {
  const m = String(method || '').toUpperCase();
  const p = normalizePath(path);
  return MCP_KEY_ALLOWED.some((r) => r.method === m && r.regex.test(p));
}

module.exports = {
  API_KEY_SCOPES,
  DEFAULT_API_KEY_SCOPE,
  API_KEY_PREFIX,
  MCP_KEY_ALLOWED_ROUTES,
  isMcpKeyAllowed,
  routePatternToRegExp,
};
