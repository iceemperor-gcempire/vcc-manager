/**
 * 프로젝트 export 라우트 테스트 (#404 P0)
 *
 * admin 게이트·소유권, 그리고 export 규격의 핵심인 참조 재배선
 * (작업판 ObjectId → 배열 index, 문서 ObjectId → index)을 검증한다.
 */
const express = require('express');
const request = require('supertest');

let mockCurrentUser;

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = mockCurrentUser; next(); },
  requireAdmin: (req, res, next) => {
    if (!mockCurrentUser?.isAdmin) return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    req.user = mockCurrentUser; next();
  },
}));
jest.mock('../utils/signedUrl', () => ({ reverseSignedUrl: (u) => u, convertToSignedUrls: (x) => x, generateSignedUrl: (u) => u }));

const chainable = (result) => {
  const chain = {};
  chain.populate = () => chain;
  chain.select = () => chain;
  chain.sort = () => chain;
  chain.lean = () => chain;
  chain.then = (res, rej) => Promise.resolve(result).then(res, rej);
  return chain;
};

jest.mock('../models/Project', () => ({ findOne: jest.fn() }));
jest.mock('../models/Tag', () => ({ findOne: jest.fn() }));
jest.mock('../models/User', () => ({}));
jest.mock('../models/GeneratedImage', () => ({}));
jest.mock('../models/GeneratedVideo', () => ({}));
jest.mock('../models/PromptData', () => ({}));
jest.mock('../models/ImageGenerationJob', () => ({}));
jest.mock('../models/Workboard', () => ({ find: jest.fn() }));
jest.mock('../models/Server', () => ({ find: jest.fn() }));
jest.mock('../models/Pipeline', () => ({ find: jest.fn() }));
jest.mock('../models/UploadedText', () => ({ find: jest.fn() }));

const Project = require('../models/Project');
const Workboard = require('../models/Workboard');
const Server = require('../models/Server');
const Pipeline = require('../models/Pipeline');
const UploadedText = require('../models/UploadedText');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/projects', require('../routes/projects'));
  return app;
}

describe('프로젝트 export (#404 P0)', () => {
  let app;

  beforeAll(() => { app = createApp(); });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { _id: 'admin-1', isAdmin: true };

    Project.findOne.mockReturnValue(chainable({
      _id: 'proj-1',
      name: '뱀파이어 NYC',
      description: '테스트',
      userId: 'admin-1',
      tagId: { _id: 'tag-proj', name: 'vampires', color: '#7c4dff' },
      workboardIds: ['wb-1'],
    }));
    Pipeline.find.mockReturnValue(chainable([{
      name: '텍스트→이미지',
      description: '',
      steps: [
        { workboardId: 'wb-1', autoInject: true, inputs: {}, contextDocIds: ['doc-2'], systemPromptDocId: 'doc-1', note: '' },
        { workboardId: 'wb-2', autoInject: false, inputs: { image_size: '1024x1024' }, contextDocIds: [], note: 'step2' },
      ],
    }]));
    Workboard.find.mockReturnValue(chainable([
      { _id: 'wb-1', name: '장면 LLM', outputFormat: 'text', serverId: 'srv-1', additionalInputFields: [] },
      { _id: 'wb-2', name: '이미지 생성', outputFormat: 'image', serverId: 'srv-1', additionalInputFields: [] },
    ]));
    Server.find.mockReturnValue(chainable([{ _id: 'srv-1', name: 'GPT', serverType: 'OpenAI' }]));
    UploadedText.find.mockReturnValue(chainable([
      { _id: 'doc-1', title: '작업 지침', content: 'sys', tags: [{ name: 'vampires' }, { name: '시스템 프롬프트' }] },
      { _id: 'doc-2', title: '세계관', content: 'lore', tags: [{ name: 'vampires' }, { name: '세계관' }] },
    ]));
  });

  test('일반 사용자는 403 (작업판 정의 노출 차단)', async () => {
    mockCurrentUser = { _id: 'user-1', isAdmin: false };
    const res = await request(app).get('/api/projects/proj-1/export');
    expect(res.status).toBe(403);
  });

  test('export 규격 — 인덱스 재배선·태그 이름·프로젝트 태그 제외', async () => {
    const res = await request(app).get('/api/projects/proj-1/export');
    expect(res.status).toBe(200);
    const data = res.body;

    expect(data.projectExportVersion).toBe(1);
    expect(data.project.name).toBe('뱀파이어 NYC');

    // 작업판: 프로젝트 소속(wb-1) + 파이프라인만 참조(wb-2)의 합집합, 풀 정의 인라인
    expect(data.workboards).toHaveLength(2);
    expect(data.workboards[0].workboard.name).toBe('장면 LLM');
    expect(data.workboards[0].server).toEqual({ name: 'GPT', serverType: 'OpenAI' });

    // 문서: 프로젝트 전용 태그(vampires)는 제외, 분류 태그만
    expect(data.documents).toHaveLength(2);
    expect(data.documents[0].tagNames).toEqual(['시스템 프롬프트']);
    expect(data.documents[1].tagNames).toEqual(['세계관']);

    // 파이프라인: ObjectId → index 재배선
    const steps = data.pipelines[0].steps;
    expect(steps[0].workboardIndex).toBe(0);
    expect(steps[0].contextDocIndexes).toEqual([1]);
    expect(steps[0].systemPromptDocIndex).toBe(0);
    expect(steps[1].workboardIndex).toBe(1);
    expect(steps[1].inputs).toEqual({ image_size: '1024x1024' });
    expect(steps[1].systemPromptDocIndex).toBeNull();
  });

  test('타인 프로젝트/없는 프로젝트는 404', async () => {
    Project.findOne.mockReturnValue(chainable(null));
    const res = await request(app).get('/api/projects/other/export');
    expect(res.status).toBe(404);
  });

  test('import — 잘못된 파일/버전은 400, 일반 사용자는 403', async () => {
    let res = await request(app).post('/api/projects/import').send({ data: { foo: 1 }, tagName: 't' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('올바른 프로젝트');

    res = await request(app).post('/api/projects/import').send({ data: { projectExportVersion: 2 }, tagName: 't' });
    expect(res.status).toBe(400);

    mockCurrentUser = { _id: 'user-1', isAdmin: false };
    res = await request(app).post('/api/projects/import').send({ data: { projectExportVersion: 1 }, tagName: 't' });
    expect(res.status).toBe(403);
  });

  test('import — 서버 자동 해석 실패 시 needsMapping 응답', async () => {
    const Server = require('../models/Server');
    // 같은 타입 서버 2대 → 자동 채택 불가
    Server.find.mockReturnValue(chainable([
      { _id: 'srv-1', name: 'GPT', serverType: 'OpenAI' },
      { _id: 'srv-2', name: 'GPT-2', serverType: 'OpenAI' },
    ]));
    const res = await request(app).post('/api/projects/import').send({
      tagName: 'imported',
      data: {
        projectExportVersion: 1,
        project: { name: 'X' },
        workboards: [{ workboard: { name: 'W', outputFormat: 'text' }, server: { name: '없는서버', serverType: 'OpenAI' } }],
        documents: [], pipelines: [],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.needsMapping).toBe(true);
    expect(res.body.workboards[0].name).toBe('W');
    expect(res.body.servers).toHaveLength(2);
  });
});
