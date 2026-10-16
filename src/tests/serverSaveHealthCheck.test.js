/**
 * 서버 추가·수정 응답의 연결 확인 결과 (#1013)
 *
 * 저장 후 연결 확인이 실패해도 저장은 성공이다. 화면이 실패를 알릴 수 있도록 응답의 data.healthCheck 에
 * **이번 요청에서 확인한 결과만** 담는다 — 확인하지 않은 수정(이름만 변경)에는 null.
 */

const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
  requireNonApiKeyAuth: jest.requireActual('../middleware/auth').requireNonApiKeyAuth,
  requireAuth: (req, res, next) => { req.user = { id: 'admin-1', isAdmin: true }; next(); },
  requireAdmin: (req, res, next) => { req.user = { id: 'admin-1', isAdmin: true }; next(); },
  userHasWorkboardAccess: jest.fn().mockResolvedValue(true),
}));

const mockUnhealthy = { status: 'unhealthy', errorMessage: 'connect ECONNREFUSED 10.0.0.9:8889' };

function mockMakeDoc(fields) {
  const doc = {
    _id: '507f1f77bcf86cd799439011',
    healthCheck: { status: 'unhealthy', errorMessage: '지난번 실패' }, // 저장돼 있던 예전 결과
    ...fields,
    save: jest.fn().mockResolvedValue(),
    populate: jest.fn().mockResolvedValue(),
    checkHealth: jest.fn(async function checkHealth() { doc.healthCheck = { ...mockUnhealthy }; }),
    toJSON() {
      const { save, populate, checkHealth, toJSON, ...rest } = doc; // eslint-disable-line no-unused-vars
      return rest;
    },
  };
  return doc;
}

let mockLastCreated;
jest.mock('../models/Server', () => {
  const Server = jest.fn((fields) => {
    mockLastCreated = mockMakeDoc(fields);
    return mockLastCreated;
  });
  Server.find = jest.fn();
  Server.findById = jest.fn();
  Server.findOne = jest.fn();
  return Server;
});
jest.mock('../models/ServerLoraCache', () => ({ findOne: jest.fn() }));
jest.mock('../models/ServerModelCache', () => ({ findOne: jest.fn() }));
jest.mock('../models/Workboard', () => ({ findById: jest.fn() }));
jest.mock('../services/loraMetadataService', () => ({}));
jest.mock('../services/modelMetadataService', () => ({}));
jest.mock('../services/comfyUIService', () => ({}));

const Server = require('../models/Server');

const app = express();
app.use(express.json());
app.use('/api/servers', require('../routes/servers'));

beforeEach(() => {
  jest.clearAllMocks();
  Server.findOne.mockResolvedValue(null);
});

describe('POST /api/servers — 연결 확인 결과를 응답에 담는다', () => {
  test('연결 확인이 실패해도 201, data.healthCheck 로 실패와 사유를 알린다', async () => {
    const res = await request(app).post('/api/servers').send({
      name: 'EVO-X2', serverType: 'OpenAI Compatible', serverUrl: 'http://10.0.0.9:8889',
    });
    expect(res.status).toBe(201);
    expect(mockLastCreated.checkHealth).toHaveBeenCalledTimes(1);
    expect(res.body.data.healthCheck).toEqual(mockUnhealthy);
  });
});

describe('PUT /api/servers/:id', () => {
  test('주소를 바꾸면 이번 확인 결과를 담는다', async () => {
    const doc = mockMakeDoc({ name: 'EVO-X2', serverType: 'OpenAI Compatible', serverUrl: 'http://old' });
    Server.findById.mockResolvedValue(doc);

    const res = await request(app).put(`/api/servers/${doc._id}`).send({ serverUrl: 'http://10.0.0.9:8889' });
    expect(res.status).toBe(200);
    expect(doc.checkHealth).toHaveBeenCalledTimes(1);
    expect(res.body.data.healthCheck).toEqual(mockUnhealthy);
  });

  test('이름만 바꾸면 확인하지 않았으므로 null — 예전 실패를 다시 알리지 않는다', async () => {
    const doc = mockMakeDoc({ name: 'EVO-X2', serverType: 'OpenAI Compatible', serverUrl: 'http://old' });
    Server.findById.mockResolvedValue(doc);

    const res = await request(app).put(`/api/servers/${doc._id}`).send({ name: 'EVO-X2 (Qwen)' });
    expect(res.status).toBe(200);
    expect(doc.checkHealth).not.toHaveBeenCalled();
    expect(res.body.data.healthCheck).toBeNull();
  });
});
