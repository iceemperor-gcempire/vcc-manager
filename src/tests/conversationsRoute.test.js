const express = require('express');
const request = require('supertest');

/**
 * conversations 라우트 통합 테스트 (#687)
 *
 * admin 용 GET /all 이 GET /:id 뒤에 등록돼 있으면 Express 등록 순서 매칭으로
 * /all 요청이 /:id 핸들러에 id="all" 로 걸려 도달 불가가 된다.
 * 라우트 등록 순서 회귀를 방지한다.
 */

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    req.user = { _id: 'user-1', isAdmin: false };
    next();
  },
  requireAdmin: (req, res, next) => {
    req.user = { _id: 'admin-1', isAdmin: true };
    next();
  },
}));

jest.mock('../models/ConversationJob', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn(),
}));

const ConversationJob = require('../models/ConversationJob');

// find/findById 의 mongoose 체이닝(sort/skip/limit/populate/lean)을 흉내내는 헬퍼
function chainable(result) {
  const chain = {};
  chain.sort = () => chain;
  chain.skip = () => chain;
  chain.limit = () => chain;
  chain.populate = () => chain;
  chain.lean = () => Promise.resolve(result);
  return chain;
}

function createApp() {
  const app = express();
  app.use('/api/conversations', require('../routes/conversations'));
  return app;
}

describe('conversations 라우트 등록 순서 (#687)', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /all 이 /:id 에 가려지지 않고 admin 목록 핸들러에 도달한다', async () => {
    ConversationJob.find.mockReturnValue(chainable([{ _id: 'c1' }]));
    ConversationJob.countDocuments.mockResolvedValue(1);

    const res = await request(app).get('/api/conversations/all');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pagination).toEqual({ current: 1, pages: 1, total: 1 });
    // /:id 핸들러로 새면 findById("all") 이 호출된다 — 호출되지 않아야 함
    expect(ConversationJob.findById).not.toHaveBeenCalled();
    expect(ConversationJob.find).toHaveBeenCalledWith({});
  });

  test('GET /:id 는 여전히 단일 대화 상세로 동작한다', async () => {
    ConversationJob.findById.mockReturnValue(
      chainable({ _id: 'c1', userId: 'user-1' })
    );

    const res = await request(app).get('/api/conversations/c1');

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe('c1');
    expect(ConversationJob.findById).toHaveBeenCalledWith('c1');
  });

  test('GET /my 는 본인 필터로 목록을 반환한다', async () => {
    ConversationJob.find.mockReturnValue(chainable([]));
    ConversationJob.countDocuments.mockResolvedValue(0);

    const res = await request(app).get('/api/conversations/my');

    expect(res.status).toBe(200);
    expect(ConversationJob.find).toHaveBeenCalledWith({ userId: 'user-1' });
  });
});
