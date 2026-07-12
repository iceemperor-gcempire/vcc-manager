/**
 * 리소스 라우트 Joi 검증 테스트 (#698)
 *
 * 1) 통합: validateBody 미들웨어가 라우트 앞단에서 잘못된 본문을 400 으로 거부하고,
 *    기존 수동 검증과 동일한 메시지를 반환하는지 (핸들러/DB 도달 전 차단)
 * 2) 단위: 스키마가 기존에 허용되던 본문(부분 업데이트의 빈 문자열, 추가 필드 등)을
 *    계속 허용하는지 — 동작 보존 회귀 방지
 */

const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    req.user = { _id: 'user-1', isAdmin: false };
    next();
  },
  requireAdmin: (req, res, next) => {
    req.user = { _id: 'admin-1', isAdmin: true };
    next();
  },
  verifyJWT: (req, res, next) => {
    req.user = { _id: 'user-1', isAdmin: false };
    next();
  },
  buildWorkboardAccessFilter: jest.fn(),
  userHasWorkboardAccess: jest.fn().mockResolvedValue(true),
}));

// 라우트가 물고 있는 무거운 의존은 모듈째 mock (검증 단계 테스트라 호출 안 됨)
jest.mock('../services/loraMetadataService', () => ({}));
jest.mock('../services/modelMetadataService', () => ({}));
jest.mock('../services/comfyUIService', () => ({}));
jest.mock('../services/workflowConverterService', () => ({}));

const {
  serverCreateSchema,
  serverUpdateSchema,
  workboardUpdateSchema,
  projectUpdateSchema,
  tagUpdateSchema,
} = require('../utils/validation');

function mount(path, routerModule) {
  const app = express();
  app.use(express.json());
  app.use(path, require(routerModule));
  return app;
}

describe('validateBody 통합 — 잘못된 본문은 핸들러 도달 전 400 (#698)', () => {
  test('servers POST — 필수 필드 누락 / 잘못된 서버 타입', async () => {
    const app = mount('/api/servers', '../routes/servers');

    let res = await request(app).post('/api/servers').send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('필수 필드가 누락되었습니다.');

    res = await request(app)
      .post('/api/servers')
      .send({ name: 'x', serverType: 'GPT Image', serverUrl: 'http://a' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('지원하지 않는 서버 타입입니다.');

    // 타입 위반 (문자열 자리에 객체)
    res = await request(app)
      .post('/api/servers')
      .send({ name: { $gt: '' }, serverType: 'ComfyUI', serverUrl: 'http://a' });
    expect(res.status).toBe(400);
  });

  test('workboards POST — serverId 누락', async () => {
    const app = mount('/api/workboards', '../routes/workboards');

    const res = await request(app).post('/api/workboards').send({ name: '작업판' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('serverId is required. Please select a server.');
  });

  test('projects POST — 이름/태그명 누락 (공백 포함)', async () => {
    const app = mount('/api/projects', '../routes/projects');

    let res = await request(app).post('/api/projects').send({ tagName: 't' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('프로젝트 이름은 필수입니다');

    res = await request(app).post('/api/projects').send({ name: 'p', tagName: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('태그명은 필수입니다');
  });

  test('tags POST — 이름 누락', async () => {
    const app = mount('/api/tags', '../routes/tags');

    const res = await request(app).post('/api/tags').send({ color: '#123456' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Tag name is required');
  });
});

describe('스키마 단위 — 기존 허용 본문의 동작 보존 (#698)', () => {
  test('생성 스키마는 유효 본문 + 알 수 없는 필드를 허용', () => {
    const { error } = serverCreateSchema.validate({
      name: 'ComfyUI-1',
      serverType: 'ComfyUI',
      serverUrl: 'http://192.168.1.10:8188',
      configuration: { apiKey: 'k', anything: 1 },
      someFutureField: true,
    });
    expect(error).toBeUndefined();
  });

  test('업데이트 스키마는 부분 본문·빈 문자열을 허용 (기존 핸들러가 무시/통과)', () => {
    expect(serverUpdateSchema.validate({ isActive: false }).error).toBeUndefined();
    expect(serverUpdateSchema.validate({ name: '' }).error).toBeUndefined();
    expect(workboardUpdateSchema.validate({ additionalInputFields: [] }).error).toBeUndefined();
    expect(projectUpdateSchema.validate({ coverImage: null }).error).toBeUndefined();
    expect(projectUpdateSchema.validate({ name: '' }).error).toBeUndefined();
    expect(tagUpdateSchema.validate({ color: null }).error).toBeUndefined();
  });

  test('업데이트 스키마도 타입 위반은 거부', () => {
    expect(serverUpdateSchema.validate({ isActive: 'maybe' }).error).toBeDefined();
    expect(workboardUpdateSchema.validate({ additionalInputFields: 'not-array' }).error).toBeDefined();
    expect(projectUpdateSchema.validate({ coverImage: 'not-object' }).error).toBeDefined();
  });

  test('llmExtraParams 는 객체/null 허용, 문자열 거부 (#493 계약)', () => {
    expect(workboardUpdateSchema.validate({ llmExtraParams: { max_tokens: 8 } }).error).toBeUndefined();
    expect(workboardUpdateSchema.validate({ llmExtraParams: null }).error).toBeUndefined();
    expect(workboardUpdateSchema.validate({ llmExtraParams: '{"a":1}' }).error).toBeDefined();
  });
});
