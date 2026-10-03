/**
 * API 키로 파괴적 작업을 못 하게 막는 가드 (#994).
 *
 * API 키는 범용이라 새면 그 계정의 REST 가 통째로 열린다. 그래서 되돌릴 수 없거나 서버 구성을
 * 바꾸는 작업은 `requireNonApiKeyAuth` 로 로그인 세션(JWT)에서만 되게 한다 — 키 관리에 이미 쓰던 방식.
 *
 * 라우터의 미들웨어 체인을 직접 검사한다. 라우트를 새로 만들거나 가드를 빼먹으면 여기서 깨진다.
 */
const { requireNonApiKeyAuth } = require('../middleware/auth');

// 키로 하면 안 되는 작업 — 파일, 메서드, 경로 (마운트 지점 기준 상대 경로)
const GUARDED = [
  // 계정 삭제: 일반 사용자 키로도 계정 + 콘텐츠가 cascade 로 지워진다
  ['users', 'delete', '/account'],
  // 백업·복원 (/api/admin/backup): 복원은 DB 완전 교체, 다운로드는 DB 전체 반출, 생성은 서비스 전면 차단을 건다
  ['backup', 'post', '/'],
  ['backup', 'post', '/:id/signed-url'],
  ['backup', 'get', '/download/:id'],
  ['backup', 'delete', '/:id'],
  ['backup', 'post', '/restore/server-validate'],
  ['backup', 'post', '/restore/validate'],
  ['backup', 'post', '/restore'],
  // 사용자 관리·정리 작업
  ['admin', 'post', '/users/:id/approve'],
  ['admin', 'post', '/users/:id/reject'],
  ['admin', 'delete', '/users/:id'],
  ['admin', 'put', '/settings/lora'],
  ['admin', 'post', '/integrity/cleanup-owner-orphans'],
  ['admin', 'post', '/integrity/cleanup-orphan-files'],
  // 서버 구성: 생성도 포함 — 서버 주소를 바꾸면 프롬프트·입력이 그쪽으로 간다
  ['servers', 'post', '/'],
  ['servers', 'put', '/:id'],
  ['servers', 'delete', '/:id'],
  ['servers', 'delete', '/:id/models/cache'],
  ['servers', 'delete', '/:id/loras/cache'],
  ['servers', 'post', '/:id/loras/sync/reset'],
  ['servers', 'post', '/:id/models/sync/reset'],
  // 공유 구성물의 수정·삭제
  ['groups', 'put', '/:id'],
  ['groups', 'delete', '/:id'],
  ['sequences', 'delete', '/:id'],
  ['sequenceDocs', 'put', '/:id'],
  ['sequenceDocs', 'delete', '/:id'],
  ['promptGuides', 'put', '/:id'],
  ['promptGuides', 'delete', '/:id'],
  ['workboards', 'put', '/:id'],
  ['workboards', 'delete', '/:id'],
];

// 키로 계속 돼야 하는 작업 — MCP 도구와 작업판 동기화(scripts/sync-workboards.js)가 쓴다
const MUST_STAY_OPEN = [
  ['workboards', 'get', '/'],
  ['workboards', 'get', '/:id'],
  ['workboards', 'post', '/import'],
  ['jobs', 'post', '/generate'],
  ['jobs', 'get', '/my'],
  ['jobs', 'get', '/:id'],
  ['images', 'post', '/upload'],
  ['images', 'get', '/generated/:id'],
  ['images', 'get', '/videos/:id'],
  ['images', 'get', '/audios/:id'],
  ['projects', 'get', '/'],
];

function routeHandlers(file, method, path) {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const router = require(`../routes/${file}`);
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`라우트 없음: ${file} ${method.toUpperCase()} ${path}`);
  return layer.route.stack.map((s) => s.handle);
}

describe('API 키 파괴적 작업 차단 (#994)', () => {
  describe.each(GUARDED)('%s %s %s', (file, method, path) => {
    test('requireNonApiKeyAuth 가 핸들러보다 앞에 있다', () => {
      const handlers = routeHandlers(file, method, path);
      const at = handlers.indexOf(requireNonApiKeyAuth);
      expect(at).toBeGreaterThanOrEqual(0);
      expect(at).toBeLessThan(handlers.length - 1);
    });
  });

  describe.each(MUST_STAY_OPEN)('%s %s %s 는 키로 계속 된다', (file, method, path) => {
    test('requireNonApiKeyAuth 가 없다', () => {
      expect(routeHandlers(file, method, path)).not.toContain(requireNonApiKeyAuth);
    });
  });

  describe('requireNonApiKeyAuth', () => {
    const run = (authMethod) => {
      const req = { authMethod };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
      const next = jest.fn();
      requireNonApiKeyAuth(req, res, next);
      return { res, next };
    };

    test('API 키 인증이면 403 이고 다음으로 넘기지 않는다', () => {
      const { res, next } = run('apikey');
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('로그인 세션(JWT)이면 통과한다', () => {
      const { res, next } = run(undefined);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
