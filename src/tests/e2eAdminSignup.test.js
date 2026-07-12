/**
 * E2E admin 시크릿 signup 게이트 테스트 (#381)
 *
 * E2E_ADMIN_SECRET 이 설정된 환경에서 X-E2E-Admin-Secret 헤더가 일치하는 signup 만
 * admin + approved 로 생성되고, 미설정/불일치 시 기존과 동일하게 pending 인지 검증.
 */

const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
  generateJWT: jest.fn(() => 'test-token'),
  requireAuth: (req, res, next) => next(),
  verifyJWT: (req, res, next) => next(),
  authRateLimit: (req, res, next) => next(),
  signupRateLimit: (req, res, next) => next(),
}));

jest.mock('../models/User', () => {
  function MockUser(data) {
    Object.assign(this, data);
    this.isAdmin = false;
    this.approvalStatus = 'pending';
    MockUser.__last = this;
  }
  MockUser.prototype.updateAdminStatus = function () {
    // 실제 구현은 ADMIN_EMAILS 검사 — 테스트에선 항상 비-admin
    return Promise.resolve(this);
  };
  MockUser.prototype.save = function () {
    this._id = 'user-new';
    return Promise.resolve(this);
  };
  MockUser.findOne = jest.fn().mockResolvedValue(null);
  return MockUser;
});

jest.mock('../models/Group', () => ({
  findDefault: jest.fn().mockResolvedValue(null),
}));

jest.mock('../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  return app;
}

const VALID_BODY = {
  email: 'e2e-user@example.com',
  password: 'TestPass!23',
  confirmPassword: 'TestPass!23',
  nickname: 'e2euser',
};

describe('signup E2E admin 시크릿 게이트 (#381)', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterEach(() => {
    delete process.env.E2E_ADMIN_SECRET;
  });

  test('시크릿 미설정 — 헤더를 보내도 pending (기능 완전 비활성)', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .set('X-E2E-Admin-Secret', 'anything')
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.user.approvalStatus).toBe('pending');
    expect(res.body.user.isAdmin).toBe(false);
  });

  test('시크릿 설정 + 헤더 일치 — admin + approved 로 생성', async () => {
    process.env.E2E_ADMIN_SECRET = 'test-secret-381';

    const res = await request(app)
      .post('/api/auth/signup')
      .set('X-E2E-Admin-Secret', 'test-secret-381')
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.user.approvalStatus).toBe('approved');
    expect(res.body.user.isAdmin).toBe(true);
  });

  test('시크릿 설정 + 헤더 불일치/누락 — pending 유지', async () => {
    process.env.E2E_ADMIN_SECRET = 'test-secret-381';

    let res = await request(app)
      .post('/api/auth/signup')
      .set('X-E2E-Admin-Secret', 'wrong-secret-!!')
      .send(VALID_BODY);
    expect(res.status).toBe(201);
    expect(res.body.user.approvalStatus).toBe('pending');
    expect(res.body.user.isAdmin).toBe(false);

    res = await request(app).post('/api/auth/signup').send(VALID_BODY);
    expect(res.status).toBe(201);
    expect(res.body.user.approvalStatus).toBe('pending');
  });
});
