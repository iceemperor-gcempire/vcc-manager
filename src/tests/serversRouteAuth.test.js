/**
 * servers 라우트 인가(admin 게이트) 회귀 테스트 (#691)
 *
 * 목록 조회는 일반 사용자 허용(작업판 picker 용), 상세/CUD 는 admin 전용,
 * 목록 응답에서 API 키 필드 제외를 검증한다.
 */

const express = require('express');
const request = require('supertest');

let mockCurrentUser;

jest.mock('../middleware/auth', () => ({
  verifyJWT: (req, res, next) => {
    req.user = mockCurrentUser;
    next();
  },
  requireAdmin: (req, res, next) => {
    if (!mockCurrentUser?.isAdmin) {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }
    req.user = mockCurrentUser;
    next();
  },
  userHasWorkboardAccess: jest.fn().mockResolvedValue(true),
}));

jest.mock('../models/Server', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock('../models/ServerLoraCache', () => ({ findOne: jest.fn() }));
jest.mock('../models/ServerModelCache', () => ({ findOne: jest.fn() }));
jest.mock('../models/Workboard', () => ({ findById: jest.fn() }));
// 무거운 서비스 의존은 모듈째 mock (이 테스트에서 호출 안 됨)
jest.mock('../services/loraMetadataService', () => ({}));
jest.mock('../services/modelMetadataService', () => ({}));
jest.mock('../services/comfyUIService', () => ({}));

const Server = require('../models/Server');

function chainable(result) {
  const chain = {};
  chain.populate = () => chain;
  chain.select = jest.fn(() => chain);
  chain.sort = () => chain;
  chain.lean = () => chain;
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/servers', require('../routes/servers'));
  return app;
}

describe('servers 라우트 admin 게이트 (#691)', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { _id: 'user-1', isAdmin: false };
  });

  test('GET / — 일반 사용자도 목록 조회 가능, API 키는 select 에서 제외', async () => {
    const chain = chainable([{ _id: 's1', name: 'ComfyUI-1' }]);
    Server.find.mockReturnValue(chain);

    const res = await request(app).get('/api/servers');

    expect(res.status).toBe(200);
    expect(res.body.data.servers).toHaveLength(1);
    expect(chain.select).toHaveBeenCalledWith('-configuration.apiKey');
  });

  test('GET / — 기본은 활성 서버만, includeInactive=true 면 필터 해제', async () => {
    Server.find.mockReturnValue(chainable([]));

    await request(app).get('/api/servers');
    expect(Server.find).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));

    await request(app).get('/api/servers').query({ includeInactive: 'true' });
    expect(Server.find).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ isActive: true })
    );
  });

  test('GET /:id — 일반 사용자는 403 (admin 전용 상세)', async () => {
    const res = await request(app).get('/api/servers/s1');
    expect(res.status).toBe(403);
    expect(Server.findById).not.toHaveBeenCalled();
  });

  test('POST / — 일반 사용자는 403, 모델 접근 자체가 없어야 함', async () => {
    const res = await request(app)
      .post('/api/servers')
      .send({ name: 'x', serverType: 'ComfyUI', serverUrl: 'http://c' });

    expect(res.status).toBe(403);
  });

  test('POST / — admin 은 게이트 통과 (필수 필드 검증 단계 도달)', async () => {
    mockCurrentUser = { _id: 'admin-1', isAdmin: true };

    // 필수 필드 누락으로 400 — requireAdmin 게이트를 통과해 핸들러에 도달했다는 증거
    const res = await request(app).post('/api/servers').send({ name: 'only-name' });
    expect(res.status).toBe(400);
  });

  test('DELETE /:id — 일반 사용자는 403', async () => {
    const res = await request(app).delete('/api/servers/s1');
    expect(res.status).toBe(403);
  });
});
