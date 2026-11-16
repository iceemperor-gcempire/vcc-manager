/**
 * 작업판 즐겨찾기 (#1216) — GET /api/workboards/favorites · POST /api/workboards/:id/favorite
 *
 * 목록은 생성 화면과 같은 조건(활성 + 접근 권한)으로 거르고 즐겨찾기한 순서를 지킨다.
 * 지워진 판은 저장 목록에서도 빼고, 비활성·권한 없는 판은 감추기만 한다.
 */
const express = require('express');
const request = require('supertest');

let mockCurrentUser;

jest.mock('../middleware/auth', () => ({
  requireNonApiKeyAuth: (req, res, next) => next(),
  requireAuth: (req, res, next) => { req.user = mockCurrentUser; next(); },
  requireAdmin: (req, res, next) => { req.user = mockCurrentUser; next(); },
  buildWorkboardAccessFilter: jest.fn(() => ({})),
  // 실제 규칙과 같다: admin 은 전부, 그 외는 allowedGroupIds ∩ groupIds
  userHasWorkboardAccess: (user, wb) => {
    if (!user || !wb) return false;
    if (user.isAdmin) return true;
    const allowed = (wb.allowedGroupIds || []).map(String);
    return (user.groupIds || []).map(String).some((g) => allowed.includes(g));
  },
}));
jest.mock('../models/Workboard', () => ({ find: jest.fn(), findById: jest.fn(), findByIdAndDelete: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn(), updateOne: jest.fn(), updateMany: jest.fn() }));
jest.mock('../models/Server', () => ({ findById: jest.fn(), findOne: jest.fn(), find: jest.fn() }));
jest.mock('../models/Group', () => ({ findDefault: jest.fn().mockResolvedValue(null) }));
jest.mock('../models/ImageGenerationJob', () => ({ countDocuments: jest.fn().mockResolvedValue(0) }));
jest.mock('../models/ServerLoraCache', () => ({}));
jest.mock('../services/loraMetadataService', () => ({}));
jest.mock('../services/openAIChatService', () => ({}));
jest.mock('../services/geminiService', () => ({}));
jest.mock('../services/comfyUIService', () => ({}));
jest.mock('../services/workflowConverterService', () => ({}));

const Workboard = require('../models/Workboard');
const User = require('../models/User');

// mongoose 쿼리 체인 흉내 — await 하면 result
const chainable = (result) => {
  const chain = {};
  chain.populate = () => chain;
  chain.select = () => chain;
  chain.lean = () => chain;
  chain.then = (res, rej) => Promise.resolve(result).then(res, rej);
  return chain;
};

const ID = {
  a: '6a0000000000000000000001',
  b: '6a0000000000000000000002',
  c: '6a0000000000000000000003',
  gone: '6a0000000000000000000009',
};
const board = (id, extra = {}) => ({ _id: id, name: `판 ${id.slice(-1)}`, isActive: true, allowedGroupIds: ['grp-1'], outputFormat: 'image', ...extra });

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/workboards', require('../routes/workboards'));
  return app;
}

describe('작업판 즐겨찾기 (#1216)', () => {
  let app;
  beforeAll(() => { app = createApp(); });
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { _id: 'user-1', isAdmin: false, groupIds: ['grp-1'] };
    User.updateOne.mockResolvedValue({});
    User.updateMany.mockResolvedValue({});
  });

  describe('GET /favorites', () => {
    test('비어 있으면 판을 조회하지 않고 빈 목록', async () => {
      User.findById.mockReturnValue(chainable({ favoriteWorkboards: [] }));
      const res = await request(app).get('/api/workboards/favorites');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: { workboards: [], favoriteIds: [] } });
      expect(Workboard.find).not.toHaveBeenCalled();
    });

    test('즐겨찾기한 순서를 지키고, 비활성·권한 없는 판은 감추고, 지워진 판은 저장 목록에서 뺀다', async () => {
      User.findById.mockReturnValue(chainable({ favoriteWorkboards: [ID.c, ID.gone, ID.a, ID.b] }));
      Workboard.find.mockReturnValue(chainable([
        board(ID.a),
        board(ID.b, { isActive: false }),                  // 비활성 — 감춤
        board(ID.c, { allowedGroupIds: ['grp-other'] }),   // 권한 없음 — 감춤
      ]));
      let res = await request(app).get('/api/workboards/favorites');
      expect(res.status).toBe(200);
      expect(res.body.data.favoriteIds).toEqual([ID.a]);
      expect(res.body.data.workboards.map((w) => w._id)).toEqual([ID.a]);
      // 지워진 판만 뺀다 — 비활성·권한 없는 판은 남겨 둔다 (다시 켜지면 보인다)
      expect(User.updateOne).toHaveBeenCalledWith({ _id: 'user-1' }, { $pull: { favoriteWorkboards: { $in: [ID.gone] } } });

      // 같은 저장 목록을 관리자가 보면 권한 없는 판도 보이지만, 비활성 판은 여전히 감춘다 (생성 화면이 막으므로)
      mockCurrentUser = { _id: 'admin-1', isAdmin: true };
      User.findById.mockReturnValue(chainable({ favoriteWorkboards: [ID.c, ID.a, ID.b] }));
      res = await request(app).get('/api/workboards/favorites');
      expect(res.body.data.favoriteIds).toEqual([ID.c, ID.a]);
    });

    test('지워진 판이 없으면 저장 목록을 건드리지 않는다', async () => {
      User.findById.mockReturnValue(chainable({ favoriteWorkboards: [ID.a, ID.b] }));
      Workboard.find.mockReturnValue(chainable([board(ID.b), board(ID.a)]));
      const res = await request(app).get('/api/workboards/favorites');
      expect(res.body.data.favoriteIds).toEqual([ID.a, ID.b]);
      expect(User.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('POST /:id/favorite', () => {
    test('없던 판은 넣는다', async () => {
      User.findById.mockReturnValue(chainable({ favoriteWorkboards: [ID.b] }));
      Workboard.findById.mockReturnValue(chainable(board(ID.a)));
      const res = await request(app).post(`/api/workboards/${ID.a}/favorite`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ isFavorite: true, favoriteCount: 2 });
      expect(User.updateOne).toHaveBeenCalledWith({ _id: 'user-1' }, { $addToSet: { favoriteWorkboards: ID.a } });
    });

    test('있던 판은 뺀다 — 판이 비활성이거나 권한이 없어도 뺄 수 있다', async () => {
      User.findById.mockReturnValue(chainable({ favoriteWorkboards: [ID.a, ID.b] }));
      const res = await request(app).post(`/api/workboards/${ID.a}/favorite`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ isFavorite: false, favoriteCount: 1 });
      expect(User.updateOne).toHaveBeenCalledWith({ _id: 'user-1' }, { $pull: { favoriteWorkboards: ID.a } });
      expect(Workboard.findById).not.toHaveBeenCalled();
    });

    test.each([
      ['없는 판', null],
      ['비활성 판', board(ID.a, { isActive: false })],
      ['권한 없는 판', board(ID.a, { allowedGroupIds: ['grp-other'] })],
    ])('%s 은 넣지 않고 404', async (_label, found) => {
      User.findById.mockReturnValue(chainable({ favoriteWorkboards: [] }));
      Workboard.findById.mockReturnValue(chainable(found));
      const res = await request(app).post(`/api/workboards/${ID.a}/favorite`);
      expect(res.status).toBe(404);
      expect(User.updateOne).not.toHaveBeenCalled();
    });

    test('잘못된 id 는 조회 없이 404', async () => {
      const res = await request(app).post('/api/workboards/not-an-id/favorite');
      expect(res.status).toBe(404);
      expect(User.findById).not.toHaveBeenCalled();
    });

    test('보이는 즐겨찾기가 12개면 더 넣지 않는다 — 감춰진 판은 세지 않는다', async () => {
      const saved = Array.from({ length: 12 }, (_, i) => `6b00000000000000000000${String(i).padStart(2, '0')}`);
      User.findById.mockReturnValue(chainable({ favoriteWorkboards: saved }));
      Workboard.findById.mockReturnValue(chainable(board(ID.a)));

      // 12개 모두 보이면 400
      Workboard.find.mockReturnValue(chainable(saved.map((id) => board(id))));
      let res = await request(app).post(`/api/workboards/${ID.a}/favorite`);
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('최대 12개');

      // 그중 하나가 비활성이면 들어간다
      Workboard.find.mockReturnValue(chainable(saved.map((id, i) => board(id, { isActive: i !== 0 }))));
      res = await request(app).post(`/api/workboards/${ID.a}/favorite`);
      expect(res.status).toBe(200);
      expect(res.body.data.isFavorite).toBe(true);
    });
  });

  test('판을 지우면 모든 사용자의 즐겨찾기에서 뺀다', async () => {
    mockCurrentUser = { _id: 'admin-1', isAdmin: true };
    Workboard.findById.mockResolvedValue(board(ID.a));
    Workboard.findByIdAndDelete.mockResolvedValue({});
    const res = await request(app).delete(`/api/workboards/${ID.a}`);
    expect(res.status).toBe(200);
    expect(User.updateMany).toHaveBeenCalledWith({ favoriteWorkboards: ID.a }, { $pull: { favoriteWorkboards: ID.a } });
  });
});
