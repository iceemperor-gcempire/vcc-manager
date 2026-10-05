/**
 * API 키로 파괴적 작업을 못 하게 막는 가드 (#994).
 *
 * API 키는 범용이라 새면 그 계정의 REST 가 통째로 열린다. 그래서 되돌릴 수 없거나 서버 구성을
 * 바꾸는 작업은 `requireNonApiKeyAuth` 로 로그인 세션(JWT)에서만 되게 한다 — 키 관리에 이미 쓰던 방식.
 *
 * 라우터의 미들웨어 체인을 직접 검사한다. 라우트를 새로 만들거나 가드를 빼먹으면 여기서 깨진다.
 */
const { requireNonApiKeyAuth, verifyJWT } = require('../middleware/auth');

// 키로 하면 안 되는 작업 — 파일, 메서드, 경로 (마운트 지점 기준 상대 경로)
const GUARDED = [
  // 계정 삭제: 일반 사용자 키로도 계정 + 콘텐츠가 cascade 로 지워진다
  ['users', 'delete', '/account'],
  // 백업·복원 (/api/admin/backup): 복원은 DB 완전 교체, 다운로드는 DB 전체 반출, 생성은 서비스 전면 차단을 건다
  // (백업 생성을 키로 열지는 아직 정하지 않았다 — #1017 에서 현행 유지)
  ['backup', 'post', '/'],
  ['backup', 'post', '/:id/signed-url'],
  ['backup', 'get', '/download/:id'],
  ['backup', 'delete', '/:id'],
  ['backup', 'post', '/restore/server-validate'],
  ['backup', 'post', '/restore/validate'],
  ['backup', 'post', '/restore'],
  // 사용자 삭제·정리 작업 — 되돌릴 수 없다
  ['admin', 'delete', '/users/:id'],
  ['admin', 'post', '/integrity/cleanup-owner-orphans'],
  ['admin', 'post', '/integrity/cleanup-orphan-files'],
  // 공유 구성물의 삭제
  ['servers', 'delete', '/:id'],
  ['groups', 'delete', '/:id'],
  ['sequences', 'delete', '/:id'],
  ['sequenceDocs', 'delete', '/:id'],
  ['promptGuides', 'delete', '/:id'],
  ['workboards', 'delete', '/:id'],
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
