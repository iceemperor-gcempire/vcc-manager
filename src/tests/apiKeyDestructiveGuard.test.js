/**
 * API 키로 할 수 있는 파괴적 작업의 범위 (#994, #1061).
 *
 * - 로그인 세션(JWT)에서만 (`requireNonApiKeyAuth`) — 키를 재발급해도 되돌릴 수 없거나, API 로 제공할 이유가 없는 작업
 * - 관리자 계정의 범용 키로 된다 — 구성물 삭제와 백업 실행. 일반 사용자 키는 requireAdmin 이,
 *   MCP 키는 enforceApiKeyScope 의 허용 목록이 막는다
 *
 * 라우터의 미들웨어 체인을 직접 검사한다. 라우트를 새로 만들거나 가드를 빼먹으면 여기서 깨진다.
 */
const { requireNonApiKeyAuth, requireAdmin, verifyJWT } = require('../middleware/auth');
const { isMcpKeyAllowed } = require('../constants/apiKeyScopes');

// 어떤 키로도 안 되는 작업 — 파일, 메서드, 경로 (마운트 지점 기준 상대 경로)
// 키 관리(apikeys.js)는 router.use 로 라우터 전체에 건다 — 아래 별도 테스트
const LOGIN_ONLY = [
  // 계정 삭제 — API 로 제공할 이유가 없다. 계정 + 개인 콘텐츠가 cascade 로 지워진다
  ['users', 'delete', '/account'],
  // 복원: 서버를 통째로 바꾼다. 백업에 키 목록도 들어 있어 옛 백업을 복원하면 폐기한 키가 되살아난다
  ['backup', 'post', '/restore/server-validate'],
  ['backup', 'post', '/restore/validate'],
  ['backup', 'post', '/restore'],
  // 반출·삭제: 자동화에는 필요 없다 — 백업 파일은 BACKUP_HOST_PATH 로 호스트 폴더에서 읽는다
  ['backup', 'post', '/:id/signed-url'],
  ['backup', 'get', '/download/:id'],
  ['backup', 'delete', '/:id'],
  // 사용자 삭제 — 다른 사용자의 계정과 생성물을 통째로 지운다 (요구가 생기면 연다)
  ['admin', 'delete', '/users/:id'],
  // 무결성 정리 — 데이터가 깨졌을 때 사람이 보고 돌리는 작업이라 API 로 거칠 이유가 없다
  ['admin', 'post', '/integrity/cleanup-owner-orphans'],
  ['admin', 'post', '/integrity/cleanup-orphan-files'],
];

// 관리자 계정의 범용 키로 되는 파괴적 작업 (#1061) — 마운트 지점(/api 기준)도 함께 둔다 (MCP 허용 목록 대조용)
const ADMIN_KEY_OPEN = [
  // 구성물 삭제 — 이미 키로 되는 수정과 위험이 비슷하다. 쓰는 곳이 있으면 각 라우트가 거부한다
  ['workboards', 'delete', '/:id', '/workboards/x1'],
  ['servers', 'delete', '/:id', '/servers/x1'],
  ['groups', 'delete', '/:id', '/groups/x1'],
  ['sequences', 'delete', '/:id', '/sequences/x1'],
  ['sequenceDocs', 'delete', '/:id', '/sequence-docs/x1'],
  ['promptGuides', 'delete', '/:id', '/prompt-guides/x1'],
  // 백업 실행 — 시간당 1회 제한·디스크 점검이 라우트에 있다
  ['backup', 'post', '/', '/admin/backup'],
];

// 키로 계속 돼야 하는 작업 — MCP 도구, 작업판 동기화(scripts/sync-workboards.js),
// 그리고 AI 가 서버·작업판을 스스로 등록하는 구성 작업(#1017, docs/AGENT_WORKBOARD_SETUP.md)
const MUST_STAY_OPEN = [
  ['workboards', 'get', '/'],
  ['workboards', 'get', '/:id'],
  ['workboards', 'post', '/'],
  ['workboards', 'post', '/import'],
  ['workboards', 'put', '/:id'],
  ['jobs', 'post', '/generate'],
  ['jobs', 'post', '/generate-prompt'],
  ['jobs', 'get', '/my'],
  ['jobs', 'get', '/:id'],
  ['images', 'post', '/upload'],
  ['images', 'get', '/generated/:id'],
  ['images', 'get', '/videos/:id'],
  ['images', 'get', '/audios/:id'],
  ['projects', 'get', '/'],
  // 구성 작업 (#1017) — 되돌릴 수 있고, 키로 막으면 AI 가 설치·설정을 못 한다
  ['servers', 'post', '/'],
  ['servers', 'put', '/:id'],
  ['servers', 'post', '/:id/models/sync'],
  ['servers', 'delete', '/:id/models/cache'],
  ['servers', 'delete', '/:id/loras/cache'],
  ['servers', 'post', '/:id/loras/sync/reset'],
  ['servers', 'post', '/:id/models/sync/reset'],
  ['groups', 'put', '/:id'],
  ['sequenceDocs', 'put', '/:id'],
  ['promptGuides', 'put', '/:id'],
  ['admin', 'put', '/settings/lora'],
  ['admin', 'post', '/users/:id/approve'],
  ['admin', 'post', '/users/:id/reject'],
  // 구성에 필요한 조회 (#1020) — 모델 ID 를 읽어야 작업판 기본 모델을 정한다
  ['servers', 'get', '/'],
  ['servers', 'get', '/:id/models'],
  ['servers', 'get', '/:id/models/status'],
  ['servers', 'get', '/:id/loras'],
  ['servers', 'get', '/:id/loras/status'],
  ['promptGuides', 'get', '/'],
  ['promptGuides', 'get', '/:id'],
];

function routeHandlers(file, method, path) {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const router = require(`../routes/${file}`);
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`라우트 없음: ${file} ${method.toUpperCase()} ${path}`);
  return layer.route.stack.map((s) => s.handle);
}

const guardAt = (handlers, guard) => {
  const at = handlers.indexOf(guard);
  return at >= 0 && at < handlers.length - 1;
};

describe('API 키 파괴적 작업 범위 (#994, #1061)', () => {
  describe.each(LOGIN_ONLY)('로그인만: %s %s %s', (file, method, path) => {
    test('requireNonApiKeyAuth 가 핸들러보다 앞에 있다', () => {
      expect(guardAt(routeHandlers(file, method, path), requireNonApiKeyAuth)).toBe(true);
    });
  });

  test('키 관리는 라우터 전체가 로그인만', () => {
    const router = require('../routes/apikeys'); // eslint-disable-line global-require
    const mw = router.stack.filter((l) => !l.route).map((l) => l.handle);
    expect(mw).toContain(requireNonApiKeyAuth);
  });

  describe.each(ADMIN_KEY_OPEN)('관리자 범용 키로 된다: %s %s %s', (file, method, path, apiPath) => {
    test('키 차단 가드가 없다', () => {
      expect(routeHandlers(file, method, path)).not.toContain(requireNonApiKeyAuth);
    });
    test('requireAdmin 이 핸들러보다 앞에 있다 — 일반 사용자 키는 막힌다', () => {
      expect(guardAt(routeHandlers(file, method, path), requireAdmin)).toBe(true);
    });
    test('MCP 키 허용 목록에 없다 — MCP 키는 막힌다', () => {
      expect(isMcpKeyAllowed(method, apiPath)).toBe(false);
    });
  });

  describe.each(MUST_STAY_OPEN)('%s %s %s 는 키로 계속 된다', (file, method, path) => {
    test('requireNonApiKeyAuth 가 없다', () => {
      expect(routeHandlers(file, method, path)).not.toContain(requireNonApiKeyAuth);
    });
  });

  // verifyJWT 는 Authorization: Bearer JWT 만 본다 — 라우트에 걸면 API 키 요청이 401 이 된다 (#1020).
  // 사용자 확인은 전역 인증(src/server.js)이 이미 했으니 라우트에서는 requireAuth 를 쓴다.
  // 전역 인증을 건너뛰는 /api/auth/* (auth.js) 만 예외.
  test('/auth 밖의 라우트는 verifyJWT 를 걸지 않는다', () => {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '../routes');
    const offenders = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'auth.js')) {
      const router = require(`../routes/${f}`); // eslint-disable-line global-require, import/no-dynamic-require
      for (const layer of router.stack || []) {
        if (layer.route && layer.route.stack.some((s) => s.handle === verifyJWT)) {
          offenders.push(`${f} ${Object.keys(layer.route.methods).join(',').toUpperCase()} ${layer.route.path}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  describe('requireNonApiKeyAuth', () => {
    const run = (authMethod, apiKeyScope) => {
      const req = { authMethod, apiKeyScope };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
      const next = jest.fn();
      requireNonApiKeyAuth(req, res, next);
      return { res, next };
    };

    test.each(['api', 'mcp', undefined])('API 키(용도 %s)면 403 이고 다음으로 넘기지 않는다', (scope) => {
      const { res, next } = run('apikey', scope);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('로그인 세션(JWT)이면 통과한다', () => {
      const { res, next } = run(undefined, undefined);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
