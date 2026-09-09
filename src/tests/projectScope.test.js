/**
 * 공용(서버 범위) 프로젝트 (#924, Epic #922 2단계)
 *
 * 판정 함수와 라우트 게이트를 고정한다 — isPublic 은 모든 사용자에게 읽기·실행,
 * server 스코프의 편집·삭제·설정 변경은 admin 만, 목록은 내 것 + 공유 + 공개.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const express = require('express');
const request = require('supertest');

let mockCurrentUser;
jest.mock('../middleware/auth', () => {
  const actual = jest.requireActual('../middleware/auth');
  return { ...actual, requireAuth: (req, res, next) => { req.user = mockCurrentUser; next(); }, requireAdmin: (req, res, next) => next() };
});
jest.mock('../utils/projectCounts', () => ({ buildProjectCounts: jest.fn().mockResolvedValue({ images: 0, promptData: 0, jobs: 0 }) }));
jest.mock('../models/Tag', () => {
  const Tag = jest.fn().mockImplementation((doc) => ({ ...doc, _id: 'tag-new', save: jest.fn().mockResolvedValue(undefined) }));
  Tag.findOne = jest.fn().mockResolvedValue(null);
  return Tag;
});
jest.mock('../models/Project', () => {
  const Project = jest.fn().mockImplementation((doc) => {
    const inst = { ...doc, _id: 'proj-new', save: jest.fn().mockResolvedValue(undefined), populate: jest.fn().mockResolvedValue(undefined) };
    Project.__last = inst;
    return inst;
  });
  Project.find = jest.fn();
  Project.findOne = jest.fn();
  Project.findById = jest.fn();
  return Project;
});
jest.mock('../models/User', () => ({ findById: jest.fn() }));

const {
  userHasProjectAccess, userCanManageProject, buildProjectListFilter, buildProjectManageFilter, buildProjectAccessFilter,
} = require('../middleware/auth');
const Project = require('../models/Project');
const User = require('../models/User');

function chainable(result) {
  const chain = {};
  chain.populate = () => chain; chain.select = () => chain; chain.sort = () => chain; chain.lean = () => chain;
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

const admin = { _id: 'adm', isAdmin: true, groupIds: [] };
const owner = { _id: 'u1', isAdmin: false, groupIds: ['g1'] };
const stranger = { _id: 'u3', isAdmin: false, groupIds: ['g9'] };
const publicProject = { userId: 'adm', scope: 'server', isPublic: true, allowedGroupIds: [] };
const serverGroupProject = { userId: 'adm', scope: 'server', isPublic: false, allowedGroupIds: ['g1'] };

describe('판정 함수 (#924)', () => {
  test('isPublic 은 그룹과 무관하게 모든 사용자에게 읽기·실행', () => {
    expect(userHasProjectAccess(stranger, publicProject)).toBe(true);
    expect(userHasProjectAccess(owner, publicProject)).toBe(true);
  });
  test('공용이라도 isPublic 이 아니면 그룹 축이 그대로 판정한다', () => {
    expect(userHasProjectAccess(owner, serverGroupProject)).toBe(true);
    expect(userHasProjectAccess(stranger, serverGroupProject)).toBe(false);
  });
  test('server 스코프는 소유자여도 admin 이 아니면 관리 불가', () => {
    const nonAdminOwned = { userId: 'u1', scope: 'server', allowedGroupIds: [] };
    expect(userCanManageProject(owner, nonAdminOwned)).toBe(false);
    expect(userCanManageProject(admin, nonAdminOwned)).toBe(true);
    expect(userCanManageProject(owner, { userId: 'u1', scope: 'personal' })).toBe(true);
  });
  test('목록 필터 — admin 도 내 것 + 공유 + 공개만 (전권 아님), 접근 필터는 admin 전권', () => {
    expect(buildProjectListFilter(admin)).toEqual({ $or: [{ userId: 'adm' }, { isPublic: true }] });
    expect(buildProjectListFilter(owner)).toEqual({ $or: [{ userId: 'u1' }, { isPublic: true }, { allowedGroupIds: { $in: ['g1'] } }] });
    expect(buildProjectAccessFilter(admin)).toEqual({});
    expect(buildProjectAccessFilter(stranger).$or).toEqual(expect.arrayContaining([{ isPublic: true }]));
  });
  test('관리 필터 — 일반 사용자는 server 스코프 제외', () => {
    expect(buildProjectManageFilter(owner)).toEqual({ userId: 'u1', scope: { $ne: 'server' } });
    expect(buildProjectManageFilter(admin)).toEqual({});
  });
});

describe('projects 라우트 게이트 (#924)', () => {
  let app;
  beforeAll(() => {
    app = express(); app.use(express.json()); app.use('/api/projects', require('../routes/projects'));
  });
  beforeEach(() => { jest.clearAllMocks(); User.findById.mockReturnValue(chainable({ favoriteProjects: [] })); });

  test('POST scope=server — 일반 사용자 403, admin 201 (isPublic 기본 true)', async () => {
    mockCurrentUser = owner;
    let res = await request(app).post('/api/projects').send({ name: '공용', tagName: 't1', scope: 'server' });
    expect(res.status).toBe(403);
    mockCurrentUser = admin;
    res = await request(app).post('/api/projects').send({ name: '공용', tagName: 't1', scope: 'server' });
    expect(res.status).toBe(201);
    expect(Project.__last.scope).toBe('server');
    expect(Project.__last.isPublic).toBe(true);
  });

  test('POST 일반 사용자의 평범한 생성은 personal·비공개', async () => {
    mockCurrentUser = owner;
    const res = await request(app).post('/api/projects').send({ name: '내 것', tagName: 't2' });
    expect(res.status).toBe(201);
    expect(Project.__last.scope).toBe('personal');
    expect(Project.__last.isPublic).toBe(false);
  });

  test('PUT — 일반 사용자가 isPublic 을 보내면 403 (조용히 무시하지 않음)', async () => {
    mockCurrentUser = owner;
    Project.findOne.mockResolvedValue({ _id: 'p1', userId: 'u1', scope: 'personal', save: jest.fn(), populate: jest.fn() });
    const res = await request(app).put('/api/projects/p1').send({ isPublic: true });
    expect(res.status).toBe(403);
  });

  test('PUT — admin 은 scope/isPublic 변경 가능', async () => {
    mockCurrentUser = admin;
    const doc = { _id: 'p1', userId: 'adm', scope: 'personal', isPublic: false, save: jest.fn(), populate: jest.fn() };
    Project.findOne.mockResolvedValue(doc);
    const res = await request(app).put('/api/projects/p1').send({ scope: 'server', isPublic: true });
    expect(res.status).toBe(200);
    expect(doc.scope).toBe('server'); expect(doc.isPublic).toBe(true);
  });

  test('GET 목록 — 접근 필터로 조회하고 access 마커를 붙인다', async () => {
    mockCurrentUser = owner;
    Project.find.mockReturnValue(chainable([
      { _id: 'a', userId: 'u1', isPublic: false, tagId: { _id: 'ta' }, toObject() { return { _id: 'a', userId: 'u1' }; } },
      { _id: 'b', userId: 'adm', isPublic: true, tagId: { _id: 'tb' }, toObject() { return { _id: 'b', userId: 'adm', isPublic: true }; } },
      { _id: 'c', userId: 'u9', isPublic: false, tagId: { _id: 'tc' }, toObject() { return { _id: 'c', userId: 'u9' }; } },
    ]));
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(Project.find.mock.calls[0][0]).toEqual(buildProjectListFilter(owner));
    expect(res.body.data.projects.map((p) => p.access)).toEqual(['owner', 'public', 'shared']);
  });

  test('GET 목록 검색 — 접근 조건과 AND 로 묶인다', async () => {
    mockCurrentUser = owner;
    Project.find.mockReturnValue(chainable([]));
    await request(app).get('/api/projects?search=x');
    const f = Project.find.mock.calls[0][0];
    expect(f.$and[0]).toEqual(buildProjectListFilter(owner));
    expect(f.$and[1].$or).toHaveLength(2);
  });
});
