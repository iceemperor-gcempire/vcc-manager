/**
 * 프로젝트 삭제 — 무엇이 지워지고 무엇이 남는가 (#1319, 점검 #1316).
 *
 * 파이프라인은 프로젝트에 딸린 것이라 실행 기록과 함께 지운다. 남기는 것은 콘텐츠다.
 * 휴지통이 없어 되돌릴 수 없으므로 "지워지면 안 되는 것"을 경우마다 고정한다.
 * 모델은 흉내지만 조건을 문서에 실제로 적용한다 — 어떤 문서가 남는지를 본다.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId();
let mockCurrentUser;
jest.mock('../middleware/auth', () => {
  const actual = jest.requireActual('../middleware/auth');
  return { ...actual, requireAuth: (req, res, next) => { req.user = mockCurrentUser; next(); }, requireAdmin: (req, res, next) => next() };
});
jest.mock('../utils/projectCounts', () => ({ buildProjectCounts: jest.fn() }));

// 조건을 문서에 적용하는 작은 저장소 — 라우트가 쓰는 모양만 ($in · $ne · $or · 배열 포함 · 같음)
const mockGet = (doc, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), doc);
function mockMatches(doc, filter = {}) {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === '$or') return cond.some((sub) => mockMatches(doc, sub));
    const value = mockGet(doc, key);
    if (cond && typeof cond === 'object' && !(cond instanceof mongoose.Types.ObjectId)) {
      if (cond.$in) return (Array.isArray(value) ? value : [value]).some((v) => cond.$in.map(String).includes(String(v)));
      if (cond.$nin) return !cond.$nin.map(String).includes(String(value));
      if ('$ne' in cond) return String(value) !== String(cond.$ne);
    }
    if (Array.isArray(value)) return value.map(String).includes(String(cond));
    return String(value) === String(cond);
  });
}
function mockStore() {
  const store = { docs: [] };
  store.findOne = jest.fn(async (filter) => store.docs.find((d) => mockMatches(d, filter)) || null);
  store.countDocuments = jest.fn(async (filter) => store.docs.filter((d) => mockMatches(d, filter)).length);
  store.deleteMany = jest.fn(async (filter) => {
    const before = store.docs.length;
    store.docs = store.docs.filter((d) => !mockMatches(d, filter));
    return { deletedCount: before - store.docs.length };
  });
  store.findByIdAndDelete = jest.fn(async (id) => {
    if (id === undefined || id === null) throw new Error('findByIdAndDelete 를 빈 id 로 불렀다');
    const hit = store.docs.find((d) => String(d._id) === String(id)) || null;
    store.docs = store.docs.filter((d) => d !== hit);
    return hit;
  });
  // $pull 한 가지만 — 조건에 맞는 문서의 배열 필드에서 값을 뺀다
  store.updateMany = jest.fn(async (filter, update) => {
    let n = 0;
    for (const d of store.docs.filter((x) => mockMatches(x, filter))) {
      for (const [path, val] of Object.entries(update.$pull || {})) {
        const keys = path.split('.'); const last = keys.pop();
        const holder = keys.reduce((o, k) => o[k], d);
        holder[last] = (holder[last] || []).filter((v) => String(v) !== String(val));
      }
      n += 1;
    }
    return { modifiedCount: n };
  });
  return store;
}
jest.mock('../models/Project', () => mockStore());
jest.mock('../models/Tag', () => mockStore());
jest.mock('../models/User', () => mockStore());
jest.mock('../models/Pipeline', () => mockStore());
jest.mock('../models/PipelineRun', () => mockStore());
jest.mock('../models/GeneratedImage', () => mockStore());
jest.mock('../models/GeneratedVideo', () => mockStore());
jest.mock('../models/GeneratedAudio', () => mockStore());
jest.mock('../models/PromptData', () => mockStore());
jest.mock('../models/ImageGenerationJob', () => mockStore());
jest.mock('../models/Workboard', () => mockStore());

const Project = require('../models/Project');
const Tag = require('../models/Tag');
const User = require('../models/User');
const Pipeline = require('../models/Pipeline');
const PipelineRun = require('../models/PipelineRun');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const GeneratedAudio = require('../models/GeneratedAudio');
const PromptData = require('../models/PromptData');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const STORES = [Project, Tag, User, Pipeline, PipelineRun, GeneratedImage, GeneratedVideo, GeneratedAudio, PromptData, ImageGenerationJob];

const owner = { _id: oid(), isAdmin: false, groupIds: ['g1'] };
const member = { _id: oid(), isAdmin: false, groupIds: ['g1'] };
const stranger = { _id: oid(), isAdmin: false, groupIds: [] };
const admin = { _id: oid(), isAdmin: true, groupIds: [] };

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/projects', require('../routes/projects'));
});

let mine; let other; // 지울 프로젝트와, 건드리면 안 되는 다른 프로젝트
beforeEach(() => {
  jest.clearAllMocks();
  for (const s of STORES) s.docs = [];
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockCurrentUser = owner;
  const tagMine = oid(); const tagOther = oid();
  mine = { _id: oid(), userId: owner._id, scope: 'user', tagId: tagMine, allowedGroupIds: ['g1'] };
  other = { _id: oid(), userId: owner._id, scope: 'user', tagId: tagOther, allowedGroupIds: [] };
  Project.docs = [mine, other];
  Tag.docs = [{ _id: tagMine }, { _id: tagOther }];
  Pipeline.docs = [
    { _id: oid(), projectId: mine._id }, { _id: oid(), projectId: mine._id },
    { _id: oid(), projectId: other._id },
  ];
  PipelineRun.docs = [
    { _id: oid(), projectId: mine._id, userId: owner._id, status: 'completed' },
    { _id: oid(), projectId: mine._id, userId: member._id, status: 'failed' },
    { _id: oid(), projectId: other._id, userId: owner._id, status: 'completed' },
    // 다른 프로젝트의 파이프라인이 이 프로젝트를 결과 귀속처로 돌린 실행 — 그쪽 것이다
    { _id: oid(), projectId: other._id, targetProjectId: mine._id, userId: owner._id, status: 'completed' },
  ];
  GeneratedImage.docs = [
    { _id: oid(), userId: owner._id, tags: [tagMine, tagOther] },
    { _id: oid(), userId: owner._id, tags: [tagOther] },
  ];
  GeneratedVideo.docs = [{ _id: oid(), userId: owner._id, tags: [tagMine] }];
  GeneratedAudio.docs = [{ _id: oid(), userId: owner._id, tags: [tagMine] }];
  PromptData.docs = [{ _id: oid(), createdBy: owner._id, tags: [tagMine] }];
  ImageGenerationJob.docs = [{ _id: oid(), userId: owner._id, inputData: { tags: [tagMine] } }];
  User.docs = [{ _id: owner._id, favoriteProjects: [mine._id, other._id] }, { _id: member._id, favoriteProjects: [mine._id] }];
});
afterEach(() => { console.log.mockRestore(); console.error.mockRestore(); });

const del = (id) => request(app).delete(`/api/projects/${id}`);
const ids = (store) => store.docs.map((d) => String(d._id));
const snapshot = () => JSON.stringify(STORES.map((s) => s.docs));
const expectNothingChanged = (before) => {
  expect(snapshot()).toBe(before);
  for (const s of [Project, Tag, Pipeline, PipelineRun]) {
    expect(s.deleteMany).not.toHaveBeenCalled();
    expect(s.findByIdAndDelete).not.toHaveBeenCalled();
  }
};

describe('DELETE /api/projects/:id — 지우는 것', () => {
  test('프로젝트 · 전용 태그 · 그 프로젝트의 파이프라인과 실행 기록을 지운다', async () => {
    const res = await del(mine._id);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ deletedPipelines: 2, deletedPipelineRuns: 2 });
    expect(ids(Project)).toEqual([String(other._id)]);
    expect(ids(Tag)).toEqual([String(other.tagId)]);
    expect(Pipeline.docs.every((p) => String(p.projectId) === String(other._id))).toBe(true);
    expect(Pipeline.docs).toHaveLength(1);
  });

  test('파이프라인 · 실행 기록을 지우는 조건은 그 프로젝트의 id 하나뿐이다', async () => {
    await del(mine._id);
    expect(Pipeline.deleteMany.mock.calls).toEqual([[{ projectId: mine._id }]]);
    expect(PipelineRun.deleteMany.mock.calls).toEqual([[{ projectId: mine._id, status: { $nin: ['pending', 'running'] } }]]);
  });

  test('다른 프로젝트의 파이프라인 · 실행 기록은 남는다 — 이 프로젝트를 결과 귀속처로 돌린 실행도', async () => {
    await del(mine._id);
    expect(PipelineRun.docs).toHaveLength(2);
    expect(PipelineRun.docs.every((r) => String(r.projectId) === String(other._id))).toBe(true);
    expect(PipelineRun.docs.some((r) => String(r.targetProjectId) === String(mine._id))).toBe(true);
  });

  test('다른 멤버가 돌린 실행 기록도 프로젝트와 함께 지워진다 (프로젝트에 딸린 것)', async () => {
    await del(mine._id);
    expect(PipelineRun.docs.some((r) => String(r.userId) === String(member._id))).toBe(false);
  });

  test('콘텐츠는 지우지 않는다 — 프로젝트 태그만 떼고 다른 태그는 그대로다', async () => {
    const before = [GeneratedImage, GeneratedVideo, GeneratedAudio, PromptData, ImageGenerationJob].map((s) => ids(s));
    await del(mine._id);
    expect([GeneratedImage, GeneratedVideo, GeneratedAudio, PromptData, ImageGenerationJob].map((s) => ids(s))).toEqual(before);
    for (const s of [GeneratedImage, GeneratedVideo, GeneratedAudio, PromptData, ImageGenerationJob]) expect(s.deleteMany).not.toHaveBeenCalled();
    expect(GeneratedImage.docs.map((d) => d.tags.map(String))).toEqual([[String(other.tagId)], [String(other.tagId)]]);
    expect(GeneratedVideo.docs[0].tags).toEqual([]);
    expect(ImageGenerationJob.docs[0].inputData.tags).toEqual([]);
  });

  test('모든 사용자의 즐겨찾기에서 그 프로젝트만 빠진다', async () => {
    await del(mine._id);
    expect(User.docs.map((u) => u.favoriteProjects.map(String))).toEqual([[String(other._id)], []]);
  });

  test('파이프라인이 하나도 없는 프로젝트도 지워진다', async () => {
    const res = await del(other._id);
    expect(res.status).toBe(200);
    expect(res.body.data.deletedPipelines).toBe(1);
    Pipeline.docs = []; PipelineRun.docs = []; Project.docs = [mine];
    Tag.docs = [{ _id: mine.tagId }];
    const res2 = await del(mine._id);
    expect(res2.status).toBe(200);
    expect(res2.body.data).toEqual({ deletedPipelines: 0, deletedPipelineRuns: 0 });
  });

  test('전용 태그가 없는 옛 프로젝트: 태그 삭제를 빈 id 로 부르지 않고, 콘텐츠 태그도 건드리지 않는다', async () => {
    delete mine.tagId;
    const res = await del(mine._id);
    expect(res.status).toBe(200);
    expect(Tag.findByIdAndDelete).not.toHaveBeenCalled();
    for (const s of [GeneratedImage, GeneratedVideo, GeneratedAudio, PromptData, ImageGenerationJob]) expect(s.updateMany).not.toHaveBeenCalled();
    expect(ids(Tag)).toHaveLength(2);
  });
});

describe('DELETE /api/projects/:id — 지우지 않는 경우', () => {
  test.each([
    ['대기 중인 실행', 'pending'],
    ['도는 실행', 'running'],
  ])('%s 이 있으면 400 이고 아무것도 바뀌지 않는다', async (_n, status) => {
    PipelineRun.docs.push({ _id: oid(), projectId: mine._id, userId: member._id, status });
    const before = snapshot();
    const res = await del(mine._id);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('실행 중인 파이프라인');
    expectNothingChanged(before);
  });

  test('다른 프로젝트에서 도는 실행은 막지 않는다', async () => {
    PipelineRun.docs.push({ _id: oid(), projectId: other._id, userId: owner._id, status: 'running' });
    expect((await del(mine._id)).status).toBe(200);
  });

  test.each([
    ['공유 그룹 멤버', () => member],
    ['다른 사용자', () => stranger],
  ])('%s 가 지우려 하면 404 이고 아무것도 바뀌지 않는다', async (_n, who) => {
    mockCurrentUser = who();
    const before = snapshot();
    expect((await del(mine._id)).status).toBe(404);
    expectNothingChanged(before);
  });

  test('일반 사용자는 자기 소유여도 공용 프로젝트를 못 지운다', async () => {
    mine.scope = 'server';
    const before = snapshot();
    expect((await del(mine._id)).status).toBe(404);
    expectNothingChanged(before);
  });

  test('관리자는 남의 프로젝트와 공용 프로젝트를 지울 수 있다', async () => {
    mockCurrentUser = admin;
    mine.scope = 'server';
    expect((await del(mine._id)).status).toBe(200);
    expect(ids(Project)).toEqual([String(other._id)]);
  });

  test('없는 id 는 404 이고 아무것도 바뀌지 않는다', async () => {
    const before = snapshot();
    expect((await del(oid())).status).toBe(404);
    expectNothingChanged(before);
  });

  test('확인한 뒤에 시작된 실행(경합)은 지우지 않는다 — 도는 기록은 어느 경우에도 남는다', async () => {
    const late = { _id: oid(), projectId: mine._id, userId: member._id, status: 'running' };
    // 활성 실행 확인(countDocuments)이 끝난 직후에 실행이 시작됐다
    PipelineRun.countDocuments.mockImplementationOnce(async () => { PipelineRun.docs.push(late); return 0; });
    const res = await del(mine._id);
    expect(res.status).toBe(200);
    expect(ids(PipelineRun)).toContain(String(late._id));
    expect(PipelineRun.docs.filter((r) => String(r.projectId) === String(mine._id))).toEqual([late]);
  });

  test('파이프라인 정의를 먼저 지운다 (그 뒤로는 새 실행을 시작할 수 없다)', async () => {
    const order = [];
    Pipeline.deleteMany.mockImplementationOnce(async () => { order.push('pipelines'); return { deletedCount: 2 }; });
    PipelineRun.deleteMany.mockImplementationOnce(async () => { order.push('runs'); return { deletedCount: 2 }; });
    await del(mine._id);
    expect(order).toEqual(['pipelines', 'runs']);
  });

  test.each([
    ['파이프라인을 지우다', () => Pipeline, []],
    ['실행 기록을 지우다', () => PipelineRun, ['pipelines']],
  ])('%s 실패하면 500 이고 프로젝트와 태그는 남는다 — 다시 지우면 끝난다', async (_n, failing) => {
    failing().deleteMany.mockRejectedValueOnce(new Error('db down'));
    const res = await del(mine._id);
    expect(res.status).toBe(500);
    expect(ids(Project)).toContain(String(mine._id));
    expect(ids(Tag)).toContain(String(mine.tagId));

    const again = await del(mine._id);
    expect(again.status).toBe(200);
    expect(ids(Project)).toEqual([String(other._id)]);
    expect(Pipeline.docs.every((p) => String(p.projectId) === String(other._id))).toBe(true);
    expect(PipelineRun.docs.every((r) => String(r.projectId) === String(other._id))).toBe(true);
  });
});
