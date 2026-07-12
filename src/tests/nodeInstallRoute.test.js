/**
 * 커스텀 노드 원클릭 설치 라우트 테스트 (#609 P4)
 *
 * - GET /install-status 가 /:id 에 셰도잉되지 않는지 (등록 순서 회귀 — #687 클래스)
 * - admin 게이트, Manager v4 미지원 서버 400
 * - normalizeManagerMap 의 installId 도출 (cnr id 키 / github slug)
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
  buildWorkboardAccessFilter: jest.fn(),
  userHasWorkboardAccess: jest.fn().mockResolvedValue(true),
}));
jest.mock('../models/Workboard', () => ({ findById: jest.fn() }));
jest.mock('../models/Server', () => ({ findById: jest.fn(), findOne: jest.fn(), find: jest.fn() }));
jest.mock('../models/Group', () => ({ findDefault: jest.fn().mockResolvedValue(null) }));
jest.mock('../models/ServerLoraCache', () => ({}));
jest.mock('../services/loraMetadataService', () => ({}));
jest.mock('../services/openAIChatService', () => ({}));
jest.mock('../services/geminiService', () => ({}));
jest.mock('../services/comfyUIService', () => ({
  managerV4Available: jest.fn(),
  managerQueueInstall: jest.fn().mockResolvedValue(undefined),
  managerQueueStatus: jest.fn().mockResolvedValue({ total_count: 0 }),
  managerHistoryEntry: jest.fn().mockResolvedValue({ result: 'success' }),
  managerReboot: jest.fn().mockResolvedValue(true),
  getObjectInfo: jest.fn(),
  fetchNodeRepoMap: jest.fn(),
}));

const Server = require('../models/Server');
const comfyUIService = require('../services/comfyUIService');
const { normalizeManagerMap } = require('../services/workflowConverterService');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/workboards', require('../routes/workboards'));
  return app;
}

describe('원클릭 설치 라우트 (#609 P4)', () => {
  let app;
  beforeAll(() => { app = createApp(); });
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { _id: 'admin-1', isAdmin: true };
    Server.findById.mockResolvedValue({ _id: 'srv-1', serverUrl: 'http://comfy' });
    comfyUIService.managerV4Available.mockResolvedValue(true);
    comfyUIService.managerHistoryEntry.mockResolvedValue({ result: 'success' });
    comfyUIService.managerQueueStatus.mockResolvedValue({ total_count: 0 });
  });

  test('GET /install-status — /:id 에 셰도잉되지 않는다 (#687 클래스 회귀)', async () => {
    const res = await request(app)
      .get('/api/workboards/install-status')
      .query({ serverId: 'srv-1', uiId: 'vcc_install_1' });
    expect(res.status).toBe(200);
    expect(res.body.data.entry.result).toBe('success');
  });

  test('POST /install-node — Manager v4 미지원 서버는 400', async () => {
    comfyUIService.managerV4Available.mockResolvedValue(false);
    const res = await request(app)
      .post('/api/workboards/install-node')
      .send({ serverId: 'srv-1', installId: 'was-ns' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Manager');
    expect(comfyUIService.managerQueueInstall).not.toHaveBeenCalled();
  });

  test('POST /install-node — 성공 시 uiId 반환 + 큐잉 호출', async () => {
    const res = await request(app)
      .post('/api/workboards/install-node')
      .send({ serverId: 'srv-1', installId: 'was-ns' });
    expect(res.status).toBe(200);
    expect(res.body.data.uiId).toMatch(/^vcc_install_/);
    expect(comfyUIService.managerQueueInstall).toHaveBeenCalledWith('http://comfy', 'was-ns', expect.any(String));
  });

  test('일반 사용자는 설치/재시작 403', async () => {
    mockCurrentUser = { _id: 'user-1', isAdmin: false };
    expect((await request(app).post('/api/workboards/install-node').send({ serverId: 's', installId: 'x' })).status).toBe(403);
    expect((await request(app).post('/api/workboards/reboot-comfyui').send({ serverId: 's' })).status).toBe(403);
  });
});

describe('normalizeManagerMap installId (#609 P4)', () => {
  test('v2 cnr 팩 id 키 / github URL 키 / meta url 각각에서 installId 도출', () => {
    const map = normalizeManagerMap({
      'was-ns': [['Logic Comparison AND'], { title_aux: 'WAS Node Suite (Revised)' }],
      'https://github.com/owner/repo': [['SomeNode'], { title_aux: 'Some Pack' }],
      'https://gist.githubusercontent.com/x/raw/y.py': [['GistNode'], { title_aux: 'Gist' }],
    });
    expect(map['Logic Comparison AND']).toEqual({ title: 'WAS Node Suite (Revised)', url: null, installId: 'was-ns' });
    expect(map['SomeNode'].installId).toBe('owner/repo');
    expect(map['SomeNode'].url).toBe('https://github.com/owner/repo');
    expect(map['GistNode'].installId).toBe('https://gist.githubusercontent.com/x/raw/y.py');
  });
});
