/**
 * API 키 용도 — MCP 키는 MCP 도구가 쓰는 요청만 (#995).
 *
 * 허용 목록(src/constants/apiKeyScopes.js)과 MCP 도구가 실제로 호출하는 경로를 **양방향으로** 대조한다.
 * 도구가 새 경로를 쓰면 목록에 넣으라고, 도구가 더는 안 쓰는 경로가 목록에 남으면 빼라고 여기서 깨진다.
 */
const fs = require('fs');
const path = require('path');
const { isMcpKeyAllowed, MCP_KEY_ALLOWED_ROUTES, API_KEY_PREFIX, API_KEY_SCOPES } = require('../constants/apiKeyScopes');
const { enforceApiKeyScope } = require('../middleware/auth');
const ApiKey = require('../models/ApiKey');

const TOOLS_DIR = path.join(__dirname, '../../mcp-server/src/tools');

// MCP 도구 소스에서 (메서드, 경로 패턴) 을 뽑는다. `${…}` 는 :id 로 바꾼다.
function toolRoutes() {
  const toPattern = (p) => p.replace(/\$\{[^}]+\}/g, ':id');
  const found = new Set();
  for (const file of fs.readdirSync(TOOLS_DIR).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(TOOLS_DIR, file), 'utf8');
    // apiRequest('/x', { method: 'POST', … })
    const call = /apiRequest\(\s*([`'])(\/[^`']+)\1\s*(?:,\s*\{([\s\S]{0,400}?)\})?\s*\)/g;
    let m;
    while ((m = call.exec(src))) {
      const method = (/method:\s*'([A-Z]+)'/.exec(m[3] || '') || [])[1] || 'GET';
      found.add(`${method} ${toPattern(m[2])}`);
    }
    // media.js: { path: (id) => `/images/generated/${id}` } — download_result 가 GET 으로 메타데이터를 읽는다
    const spec = /path:\s*\([^)]*\)\s*=>\s*`(\/[^`]+)`/g;
    while ((m = spec.exec(src))) found.add(`GET ${toPattern(m[1])}`);
  }
  return found;
}

describe('MCP 키 허용 목록 (#995)', () => {
  test('MCP 도구가 호출하는 모든 경로가 허용 목록에 있다', () => {
    const missing = [...toolRoutes()].filter((r) => {
      const [method, p] = r.split(' ');
      return !isMcpKeyAllowed(method, p.replace(/:id/g, 'x1'));
    });
    expect(missing).toEqual([]);
  });

  test('허용 목록에 도구가 안 쓰는 경로가 남아 있지 않다', () => {
    const used = toolRoutes();
    const stale = MCP_KEY_ALLOWED_ROUTES
      .map(([m, p]) => `${m} ${p}`)
      .filter((r) => !used.has(r));
    expect(stale).toEqual([]);
  });

  test.each([
    ['GET', '/workboards'],
    ['GET', '/workboards/abc123'],
    ['GET', '/workboards/abc123/'],
    ['post', '/jobs/generate'],
    ['GET', '/jobs/my'],
    ['GET', '/images/videos/v1'],
    ['POST', '/projects/p1/pipeline-runs'],
  ])('허용: %s %s', (method, p) => {
    expect(isMcpKeyAllowed(method, p)).toBe(true);
  });

  test.each([
    ['DELETE', '/jobs/j1'],
    ['POST', '/jobs/bulk-delete'],
    ['PUT', '/workboards/w1'],
    ['POST', '/workboards/import'],
    ['GET', '/admin/stats'],
    ['GET', '/users/profile'],
    ['DELETE', '/users/account'],
    ['GET', '/apikeys'],
    ['POST', '/images/bulk-delete'],
    ['GET', '/workboards/w1/extra'],
  ])('거부: %s %s', (method, p) => {
    expect(isMcpKeyAllowed(method, p)).toBe(false);
  });
});

describe('enforceApiKeyScope', () => {
  const run = (req) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    enforceApiKeyScope({ method: 'GET', path: '/', ...req }, res, next);
    return { res, next };
  };

  test('MCP 키 + 허용 경로 → 통과', () => {
    const { next, res } = run({ authMethod: 'apikey', apiKeyScope: 'mcp', method: 'GET', path: '/workboards' });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('MCP 키 + 허용 밖 → 403, 다음으로 안 넘김', () => {
    const { next, res } = run({ authMethod: 'apikey', apiKeyScope: 'mcp', method: 'GET', path: '/admin/stats' });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('범용 키는 영향 없음', () => {
    const { next } = run({ authMethod: 'apikey', apiKeyScope: 'api', method: 'GET', path: '/admin/stats' });
    expect(next).toHaveBeenCalled();
  });

  test('로그인 세션(JWT)은 영향 없음', () => {
    const { next } = run({ method: 'DELETE', path: '/jobs/j1' });
    expect(next).toHaveBeenCalled();
  });
});

describe('키 발급 — 용도별 접두사', () => {
  test.each(['api', 'mcp'])('%s 키의 접두사', (scope) => {
    const { fullKey, prefix } = ApiKey.generateKey(scope);
    expect(fullKey.startsWith(API_KEY_PREFIX[scope])).toBe(true);
    expect(fullKey).toMatch(/^vccm?_[0-9a-f]{40}$/);
    expect(prefix).toBe(fullKey.substring(0, 8));
  });

  test('용도를 안 주면 범용', () => {
    expect(ApiKey.generateKey().fullKey.startsWith('vcc_')).toBe(true);
  });

  test('모르는 용도는 거부', () => {
    expect(() => ApiKey.generateKey('admin')).toThrow();
  });
});

describe('프론트 화면 문구의 용도 값이 백엔드와 같다', () => {
  test('frontend/src/utils/apiKeyScope.js 의 선택지 값 = API_KEY_SCOPES', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../frontend/src/utils/apiKeyScope.js'), 'utf8');
    const values = [...src.matchAll(/value:\s*'([a-z]+)'/g)].map((m) => m[1]).sort();
    expect(values).toEqual([...API_KEY_SCOPES].sort());
  });
});
