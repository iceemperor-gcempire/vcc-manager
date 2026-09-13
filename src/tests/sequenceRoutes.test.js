/**
 * 작업 절차 API (#952) — 권한 판정, 사용자 응답의 운영 정보 제외, 실행 시작 점검, 실행 기록 삭제.
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
jest.mock('../models/Sequence', () => ({ find: jest.fn(), findById: jest.fn(), create: jest.fn(), findByIdAndDelete: jest.fn() }));
jest.mock('../models/SequenceDoc', () => ({ find: jest.fn(), findById: jest.fn(), create: jest.fn(), findByIdAndDelete: jest.fn(), aggregate: jest.fn() }));
jest.mock('../models/SequenceRun', () => ({ find: jest.fn(), findOne: jest.fn(), create: jest.fn(), countDocuments: jest.fn(), deleteOne: jest.fn() }));
jest.mock('../models/Workboard', () => ({ find: jest.fn() }));
jest.mock('../models/Group', () => ({ find: jest.fn() }));
jest.mock('../models/Project', () => ({ findById: jest.fn() }));
jest.mock('../models/ImageGenerationJob', () => ({ find: jest.fn() }));
jest.mock('../models/ConversationJob', () => ({ deleteMany: jest.fn() }));
jest.mock('../services/pipelineRunService', () => ({ startSequenceRun: jest.fn(), retrySequenceRun: jest.fn() }));
jest.mock('../services/jobDeletionService', () => ({ deleteJobRecord: jest.fn() }));

const Sequence = require('../models/Sequence');
const SequenceDoc = require('../models/SequenceDoc');
const SequenceRun = require('../models/SequenceRun');
const Workboard = require('../models/Workboard');
const Group = require('../models/Group');
const Project = require('../models/Project');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const ConversationJob = require('../models/ConversationJob');
const { startSequenceRun } = require('../services/pipelineRunService');
const { deleteJobRecord } = require('../services/jobDeletionService');

function chain(result) {
  const q = {};
  ['sort', 'populate', 'select', 'lean', 'skip', 'limit'].forEach((m) => { q[m] = () => q; });
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return q;
}

const G1 = '1'.repeat(24);
const G2 = '2'.repeat(24);
const WB_TEXT = 'a'.repeat(24);
const WB_IMAGE = 'b'.repeat(24);
const SEQ = 'e'.repeat(24);
const RUN = 'f'.repeat(24);
const DOC = 'd'.repeat(24);

const member = { _id: 'u1', groupIds: [G1] };
const admin = { _id: 'adm', isAdmin: true, groupIds: [] };

const WORKBOARDS = [
  { _id: WB_TEXT, name: 'LLM', outputFormat: 'text', isActive: true, allowedGroupIds: [G1] },
  { _id: WB_IMAGE, name: '이미지', outputFormat: 'image', isActive: true, allowedGroupIds: [G2], additionalInputFields: [{ name: 'ref', type: 'image' }] },
];
const sequenceDoc = (overrides = {}) => ({
  _id: SEQ,
  name: '썸네일 절차',
  description: '',
  isActive: true,
  allowedGroupIds: [G1],
  steps: [
    { _id: 's1', workboardId: WB_TEXT, inputs: { tone: '차분' }, contextDocIds: [DOC], systemPromptDocId: DOC },
    { _id: 's2', workboardId: WB_IMAGE, inputs: {} },
  ],
  ...overrides,
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/sequences', require('../routes/sequences'));
  app.use('/api/sequence-runs', require('../routes/sequenceRuns'));
  app.use('/api/sequence-docs', require('../routes/sequenceDocs'));
  return app;
}

let app;
let errorSpy;
beforeAll(() => { app = createApp(); });
beforeEach(() => {
  jest.clearAllMocks();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  Workboard.find.mockReturnValue(chain(WORKBOARDS));
});
afterEach(() => errorSpy.mockRestore());

describe('GET /api/sequences — 사용자 목록', () => {
  test('그룹·활성 조건으로 조회하고, 운영 정보는 싣지 않으며, 막힌 단계를 표시', async () => {
    mockCurrentUser = member;
    Sequence.find.mockReturnValue(chain([sequenceDoc()]));

    const res = await request(app).get('/api/sequences');

    expect(res.status).toBe(200);
    expect(Sequence.find).toHaveBeenCalledWith({ isActive: true, allowedGroupIds: { $in: [G1] } });
    const [seq] = res.body.data.sequences;
    expect(seq).not.toHaveProperty('allowedGroupIds');
    expect(seq.steps[0]).not.toHaveProperty('inputs');
    expect(seq.steps[0]).not.toHaveProperty('contextDocIds');
    expect(seq.steps[0]).toMatchObject({ docCount: 2, blocked: null, workboard: { name: 'LLM' } });
    expect(seq.steps[0].workboard).not.toHaveProperty('allowedGroupIds');
    expect(seq.steps[1].blocked).toBe('no_access');
    expect(seq.runnable).toBe(false);
  });

  test('관리 보기는 admin 전용', async () => {
    mockCurrentUser = member;
    const res = await request(app).get('/api/sequences?view=manage');
    expect(res.status).toBe(403);
    expect(Sequence.find).not.toHaveBeenCalled();
  });

  test('관리 보기 — 작업판이 그룹을 덮지 않는 단계를 알려준다', async () => {
    mockCurrentUser = admin;
    Sequence.find.mockReturnValue(chain([sequenceDoc({ allowedGroupIds: [{ _id: G1, name: '팀A' }] })]));
    const res = await request(app).get('/api/sequences?view=manage');
    expect(res.status).toBe(200);
    expect(res.body.data.sequences[0].coverage).toEqual([
      expect.objectContaining({ stepIndex: 1, workboardName: '이미지', missingGroups: [{ _id: G1, name: '팀A' }] }),
    ]);
  });
});

describe('GET /api/sequences/:id', () => {
  test('그룹 밖이면 없는 것과 같은 404', async () => {
    mockCurrentUser = member;
    Sequence.findById.mockReturnValue(chain(sequenceDoc({ allowedGroupIds: [G2] })));
    const res = await request(app).get(`/api/sequences/${SEQ}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/sequences — 관리자 생성', () => {
  test('일반 사용자는 403', async () => {
    mockCurrentUser = member;
    const res = await request(app).post('/api/sequences').send({ name: 'x' });
    expect(res.status).toBe(403);
    expect(Sequence.create).not.toHaveBeenCalled();
  });

  test('미디어 사전 입력과 없는 그룹은 저장하지 않고 경고로 돌려준다', async () => {
    mockCurrentUser = admin;
    SequenceDoc.find.mockReturnValue(chain([]));
    Group.find.mockReturnValue(chain([{ _id: G1 }]));
    Sequence.create.mockImplementation(async (doc) => ({ _id: SEQ, ...doc }));

    const res = await request(app).post('/api/sequences').send({
      name: '  새 절차  ',
      steps: [{ workboardId: WB_IMAGE, inputs: { ref: ['img'], steps: 4 } }],
      allowedGroupIds: [G1, G2],
    });

    expect(res.status).toBe(201);
    const created = Sequence.create.mock.calls[0][0];
    expect(created).toMatchObject({ name: '새 절차', allowedGroupIds: [G1], createdBy: 'adm', isActive: true });
    expect(created.steps[0].inputs).toEqual({ steps: 4 });
    expect(res.body.data.warnings).toHaveLength(2);
  });

  test('없는 작업판이면 400', async () => {
    mockCurrentUser = admin;
    Workboard.find.mockReturnValue(chain([]));
    SequenceDoc.find.mockReturnValue(chain([]));
    const res = await request(app).post('/api/sequences').send({ name: 'x', steps: [{ workboardId: WB_TEXT }] });
    expect(res.status).toBe(400);
    expect(Sequence.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/sequence-runs — 실행 시작', () => {
  test('작업 절차 그룹 밖이면 404', async () => {
    mockCurrentUser = member;
    Sequence.findById.mockReturnValue(chain(sequenceDoc({ allowedGroupIds: [G2] })));
    const res = await request(app).post('/api/sequence-runs').send({ sequenceId: SEQ });
    expect(res.status).toBe(404);
    expect(SequenceRun.create).not.toHaveBeenCalled();
  });

  test('단계 작업판 접근이 없으면 어느 단계인지 알려주고 시작하지 않는다 (#802)', async () => {
    mockCurrentUser = member;
    Sequence.findById.mockReturnValue(chain(sequenceDoc()));
    const res = await request(app).post('/api/sequence-runs').send({ sequenceId: SEQ, initialPrompt: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('실행할 수 없는 단계가 있습니다 — 2단계 (이미지): 작업판 접근 권한 없음');
    expect(SequenceRun.create).not.toHaveBeenCalled();
  });

  test('성공 — 실행 시점 이름과 단계별 작업판을 기록하고 큐에 넣는다', async () => {
    mockCurrentUser = member;
    Workboard.find.mockReturnValue(chain(WORKBOARDS.map((w) => ({ ...w, allowedGroupIds: [G1] }))));
    Sequence.findById.mockReturnValue(chain(sequenceDoc()));
    SequenceRun.create.mockImplementation(async (doc) => ({ _id: RUN, ...doc }));

    const res = await request(app).post('/api/sequence-runs').send({ sequenceId: SEQ, initialPrompt: '고양이' });

    expect(res.status).toBe(201);
    expect(SequenceRun.create.mock.calls[0][0]).toMatchObject({
      userId: 'u1',
      sequenceId: SEQ,
      sequenceName: '썸네일 절차',
      initialPrompt: '고양이',
      steps: [{ workboardId: WB_TEXT, status: 'pending' }, { workboardId: WB_IMAGE, status: 'pending' }],
    });
    expect(startSequenceRun).toHaveBeenCalledWith(RUN);
  });

  test('결과 프로젝트에 접근할 수 없으면 400', async () => {
    mockCurrentUser = member;
    Workboard.find.mockReturnValue(chain(WORKBOARDS.map((w) => ({ ...w, allowedGroupIds: [G1] }))));
    Sequence.findById.mockReturnValue(chain(sequenceDoc()));
    Project.findById.mockResolvedValue({ _id: 'p9', userId: 'someone', allowedGroupIds: [] });
    const res = await request(app).post('/api/sequence-runs').send({ sequenceId: SEQ, targetProjectId: '9'.repeat(24) });
    expect(res.status).toBe(400);
    expect(SequenceRun.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/sequence-runs', () => {
  test('본인 기록만, 알 수 없는 상태 값은 무시', async () => {
    mockCurrentUser = member;
    SequenceRun.find.mockReturnValue(chain([]));
    SequenceRun.countDocuments.mockResolvedValue(0);
    await request(app).get('/api/sequence-runs?status=hacked');
    expect(SequenceRun.find).toHaveBeenCalledWith({ userId: 'u1' });
  });
});

describe('DELETE /api/sequence-runs/:runId', () => {
  test('진행 중이면 400', async () => {
    mockCurrentUser = member;
    SequenceRun.findOne.mockResolvedValue({ _id: RUN, status: 'running' });
    const res = await request(app).delete(`/api/sequence-runs/${RUN}`);
    expect(res.status).toBe(400);
    expect(SequenceRun.deleteOne).not.toHaveBeenCalled();
  });

  test('단계 작업 레코드를 콘텐츠는 남기고 함께 지운다', async () => {
    mockCurrentUser = member;
    SequenceRun.findOne.mockResolvedValue({ _id: RUN, status: 'completed' });
    const jobs = [{ _id: 'j1', status: 'completed' }, { _id: 'j2', status: 'failed' }];
    ImageGenerationJob.find.mockReturnValue(chain(jobs));
    ConversationJob.deleteMany.mockResolvedValue({ deletedCount: 1 });

    const res = await request(app).delete(`/api/sequence-runs/${RUN}`);

    expect(res.status).toBe(200);
    expect(ImageGenerationJob.find).toHaveBeenCalledWith({ sequenceRunId: RUN, userId: 'u1' });
    expect(deleteJobRecord).toHaveBeenCalledTimes(2);
    expect(deleteJobRecord).toHaveBeenCalledWith(jobs[0], { deleteContent: false });
    expect(ConversationJob.deleteMany).toHaveBeenCalledWith({ sequenceRunId: RUN, userId: 'u1' });
    expect(SequenceRun.deleteOne).toHaveBeenCalledWith({ _id: RUN });
    expect(res.body.data).toEqual({ deletedImageJobs: 2, deletedConversations: 1 });
  });

  test('생성 큐에서 아직 도는 단계 작업이 있으면 지우지 않는다', async () => {
    mockCurrentUser = member;
    SequenceRun.findOne.mockResolvedValue({ _id: RUN, status: 'failed' });
    ImageGenerationJob.find.mockReturnValue(chain([{ _id: 'j1', status: 'processing' }]));
    const res = await request(app).delete(`/api/sequence-runs/${RUN}`);
    expect(res.status).toBe(400);
    expect(deleteJobRecord).not.toHaveBeenCalled();
    expect(SequenceRun.deleteOne).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/sequence-docs/:id', () => {
  test('작업 절차가 쓰는 문서는 지우지 않고 어디서 쓰는지 알려준다', async () => {
    mockCurrentUser = admin;
    SequenceDoc.findById.mockReturnValue(chain({ _id: DOC }));
    Sequence.find.mockReturnValue(chain([{ _id: SEQ, name: '썸네일 절차' }]));
    const res = await request(app).delete(`/api/sequence-docs/${DOC}`);
    expect(res.status).toBe(400);
    expect(res.body.data.linkedSequences).toEqual([{ _id: SEQ, name: '썸네일 절차' }]);
    expect(SequenceDoc.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('일반 사용자는 문서 목록도 볼 수 없다', async () => {
    mockCurrentUser = member;
    const res = await request(app).get('/api/sequence-docs');
    expect(res.status).toBe(403);
  });
});
