/**
 * 파이프라인 실행 시작의 결과 귀속 프로젝트(targetProjectId) 검증 (#923).
 */
const express = require('express');
const request = require('supertest');

let mockCurrentUser;
const mockProject = { _id: 'p1', userId: 'owner1', allowedGroupIds: ['g1'] };

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = mockCurrentUser; next(); },
  userHasProjectAccess: (user, project) => {
    if (!user || !project) return false;
    if (user.isAdmin) return true;
    if (String(project.userId) === String(user._id)) return true;
    const allowed = (project.allowedGroupIds || []).map(String);
    return (user.groupIds || []).map(String).some((g) => allowed.includes(g));
  },
}));
jest.mock('../middleware/projectAccess', () => ({
  loadProjectForRead: () => async () => mockProject,
  loadProjectForManage: () => async () => mockProject,
}));
jest.mock('../models/Pipeline', () => ({ findOne: jest.fn() }));
jest.mock('../models/PipelineRun', () => ({ create: jest.fn(), findOne: jest.fn(), find: jest.fn() }));
jest.mock('../models/Project', () => ({ findById: jest.fn() }));
jest.mock('../services/pipelineRunService', () => ({ startPipelineRun: jest.fn(), retryPipelineRun: jest.fn() }));

const Pipeline = require('../models/Pipeline');
const PipelineRun = require('../models/PipelineRun');
const Project = require('../models/Project');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/projects/:projectId/pipeline-runs', require('../routes/pipelineRuns'));
  return app;
}

describe('POST pipeline-runs — targetProjectId (#923)', () => {
  let app;
  beforeAll(() => { app = createApp(); });
  beforeEach(() => {
    jest.clearAllMocks();
    Pipeline.findOne.mockResolvedValue({ _id: 'pl1', steps: [{ workboardId: 'w1' }] });
    PipelineRun.create.mockImplementation(async (doc) => ({ _id: 'run1', ...doc }));
  });

  test('미지정 → targetProjectId 없이 생성', async () => {
    mockCurrentUser = { _id: 'reader1', groupIds: ['g1'] };
    const res = await request(app).post('/api/projects/p1/pipeline-runs').send({ pipelineId: 'pl1', initialPrompt: 'x' });
    expect(res.status).toBe(201);
    expect(PipelineRun.create.mock.calls[0][0].targetProjectId).toBeUndefined();
    expect(Project.findById).not.toHaveBeenCalled();
  });

  test('파이프라인의 프로젝트와 같으면 무시', async () => {
    mockCurrentUser = { _id: 'reader1', groupIds: ['g1'] };
    const res = await request(app).post('/api/projects/p1/pipeline-runs').send({ pipelineId: 'pl1', targetProjectId: 'p1' });
    expect(res.status).toBe(201);
    expect(PipelineRun.create.mock.calls[0][0].targetProjectId).toBeUndefined();
  });

  test('실행자가 읽을 수 있는 다른 프로젝트 → 저장', async () => {
    mockCurrentUser = { _id: 'reader1', groupIds: ['g1'] };
    Project.findById.mockResolvedValue({ _id: 'mine', userId: 'reader1', allowedGroupIds: [] });
    const res = await request(app).post('/api/projects/p1/pipeline-runs').send({ pipelineId: 'pl1', targetProjectId: 'mine' });
    expect(res.status).toBe(201);
    expect(PipelineRun.create.mock.calls[0][0].targetProjectId).toBe('mine');
  });

  test('접근 없는 프로젝트 → 400 (존재 여부 미노출)', async () => {
    mockCurrentUser = { _id: 'reader1', groupIds: ['g1'] };
    Project.findById.mockResolvedValue({ _id: 'other', userId: 'someone', allowedGroupIds: [] });
    const res = await request(app).post('/api/projects/p1/pipeline-runs').send({ pipelineId: 'pl1', targetProjectId: 'other' });
    expect(res.status).toBe(400);
    expect(PipelineRun.create).not.toHaveBeenCalled();
  });

  test('없는 프로젝트 → 400', async () => {
    mockCurrentUser = { _id: 'reader1', groupIds: ['g1'] };
    Project.findById.mockResolvedValue(null);
    const res = await request(app).post('/api/projects/p1/pipeline-runs').send({ pipelineId: 'pl1', targetProjectId: 'nope' });
    expect(res.status).toBe(400);
  });
});
