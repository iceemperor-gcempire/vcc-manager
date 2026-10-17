/**
 * 모델 라이선스 API (#1073) — 관리자만 등록·수정·삭제, 입력 검사, 경로 하나는 라이선스 하나에만(409), 조회·판정.
 */
const express = require('express');
const request = require('supertest');

let mockCurrentUser;

jest.mock('../middleware/auth', () => {
  const actual = jest.requireActual('../middleware/auth');
  return {
    ...actual,
    requireAuth: (req, res, next) => { req.user = mockCurrentUser; next(); },
    requireAdmin: (req, res, next) => {
      req.user = mockCurrentUser;
      if (!req.user?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
      return next();
    },
  };
});
jest.mock('../models/ModelLicense', () => ({ find: jest.fn(), findById: jest.fn(), create: jest.fn(), findByIdAndDelete: jest.fn() }));

const ModelLicense = require('../models/ModelLicense');

function chain(result) {
  const q = {};
  ['sort', 'populate', 'select', 'lean'].forEach((m) => { q[m] = () => q; });
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return q;
}

const ID1 = '1'.repeat(24);
const ID2 = '2'.repeat(24);
const admin = { _id: 'adm', id: 'adm', isAdmin: true };
const member = { _id: 'u1', id: 'u1', isAdmin: false };
const H3 = { _id: ID1, name: 'MiniMax H3 Community License', commercialUse: 'conditional', targets: [{ match: 'minimax/' }] };

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/model-licenses', require('../routes/modelLicenses')); // eslint-disable-line global-require
  return a;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser = admin;
  // 수정 때는 자기 자신을 빼고 찾는다 ({ _id: { $ne } }) — 그 조건을 흉내 낸다
  ModelLicense.find.mockImplementation((filter = {}) => chain([H3].filter((l) => !filter._id || l._id !== String(filter._id.$ne))));
  ModelLicense.create.mockImplementation(async (doc) => ({ _id: ID2, ...doc }));
});

const body = (over = {}) => ({ name: 'Krea 2 Community License', url: 'https://example.com/krea2', commercialUse: 'prohibited', note: '비상업', targets: ['Krea2\\', 'krea2_turbo.safetensors'], ...over });

describe('등록 (POST)', () => {
  test('경로를 정규화해 저장하고 등록자를 남긴다', async () => {
    const res = await request(app()).post('/api/model-licenses').send(body());
    expect(res.status).toBe(201);
    expect(ModelLicense.create).toHaveBeenCalledWith({
      name: 'Krea 2 Community License', url: 'https://example.com/krea2', commercialUse: 'prohibited', note: '비상업',
      targets: [{ match: 'Krea2/' }, { match: 'krea2_turbo.safetensors' }], createdBy: 'adm',
    });
  });

  test('일반 사용자는 403', async () => {
    mockCurrentUser = member;
    expect((await request(app()).post('/api/model-licenses').send(body())).status).toBe(403);
    expect(ModelLicense.create).not.toHaveBeenCalled();
  });

  test.each([
    [{ name: '' }, '이름'],
    [{ name: undefined }, '이름'],
    [{ commercialUse: 'maybe' }, '상업적 이용'],
    [{ url: 'javascript:alert(1)' }, 'http'],
    [{ targets: ['../x'] }, '..'],
    [{ targets: 'minimax/' }, '배열'],
    [{ note: 'x'.repeat(201) }, '메모'],
  ])('잘못된 입력 %p 은 400', async (over, word) => {
    const res = await request(app()).post('/api/model-licenses').send(body(over));
    expect(res.status).toBe(400);
    expect(res.body.message).toContain(word);
    expect(ModelLicense.create).not.toHaveBeenCalled();
  });

  test('다른 라이선스가 쥔 경로는 409 — 구분자·대소문자가 달라도 같은 경로다', async () => {
    const res = await request(app()).post('/api/model-licenses').send(body({ targets: ['MiniMax\\'] }));
    expect(res.status).toBe(409);
    expect(res.body.data.taken).toEqual([{ target: 'MiniMax/', license: 'MiniMax H3 Community License' }]);
    expect(ModelLicense.create).not.toHaveBeenCalled();
  });

  test('같은 요청 안의 중복 경로는 하나로', async () => {
    await request(app()).post('/api/model-licenses').send(body({ targets: ['qwen/', 'QWEN\\'] }));
    expect(ModelLicense.create.mock.calls[0][0].targets).toEqual([{ match: 'qwen/' }]);
  });
});

describe('수정 (PUT)', () => {
  const doc = () => ({ ...H3, targets: [...H3.targets], save: jest.fn(async () => {}) });

  test('온 필드만 바꾼다 — 자기 경로는 충돌이 아니다', async () => {
    const d = doc();
    ModelLicense.findById.mockResolvedValue(d);
    const res = await request(app()).put(`/api/model-licenses/${ID1}`).send({ targets: ['minimax\\', 'minimax_extra.safetensors'] });
    expect(res.status).toBe(200);
    expect(ModelLicense.find).toHaveBeenCalledWith({ _id: { $ne: ID1 } }, { name: 1, targets: 1 });
    expect(d.targets).toEqual([{ match: 'minimax/' }, { match: 'minimax_extra.safetensors' }]);
    expect(d.name).toBe('MiniMax H3 Community License');
    expect(d.save).toHaveBeenCalled();
  });

  test('없는 라이선스는 404', async () => {
    ModelLicense.findById.mockResolvedValue(null);
    expect((await request(app()).put(`/api/model-licenses/${ID1}`).send({ name: 'x' })).status).toBe(404);
  });

  test('일반 사용자는 403', async () => {
    mockCurrentUser = member;
    expect((await request(app()).put(`/api/model-licenses/${ID1}`).send({ name: 'x' })).status).toBe(403);
  });
});

describe('삭제 (DELETE)', () => {
  test('관리자는 지운다', async () => {
    ModelLicense.findByIdAndDelete.mockResolvedValue(H3);
    expect((await request(app()).delete(`/api/model-licenses/${ID1}`)).status).toBe(200);
  });
  test('없으면 404, 일반 사용자는 403', async () => {
    ModelLicense.findByIdAndDelete.mockResolvedValue(null);
    expect((await request(app()).delete(`/api/model-licenses/${ID1}`)).status).toBe(404);
    mockCurrentUser = member;
    expect((await request(app()).delete(`/api/model-licenses/${ID1}`)).status).toBe(403);
  });
});

describe('조회', () => {
  test('목록은 로그인한 사용자 누구나', async () => {
    mockCurrentUser = member;
    const res = await request(app()).get('/api/model-licenses');
    expect(res.status).toBe(200);
    expect(res.body.data.licenses).toHaveLength(1);
  });

  test('resolve — 파일 이름으로 붙은 라이선스를 판정한다', async () => {
    mockCurrentUser = member;
    const res = await request(app()).get('/api/model-licenses/resolve').query({ filename: 'minimax\\minimax_h3_fl2va_int8_convrot.safetensors' });
    expect(res.status).toBe(200);
    expect(res.body.data.license).toMatchObject({ licenseId: ID1, matchedBy: 'folder', commercialUse: 'conditional' });
  });

  test('resolve — 붙은 게 없으면 null, filename 이 없으면 400', async () => {
    expect((await request(app()).get('/api/model-licenses/resolve').query({ filename: 'sdxl.safetensors' })).body.data.license).toBeNull();
    expect((await request(app()).get('/api/model-licenses/resolve')).status).toBe(400);
  });
});
