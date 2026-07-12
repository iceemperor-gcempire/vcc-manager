/**
 * admin 정합성 라우트 테스트 (#662 P2)
 *
 * admin 게이트, 파일 검사 opt-in, cleanup 의 apply 플래그가
 * 서비스로 정확히 전달되는지(기본 dry-run) 검증.
 */
const express = require('express');
const request = require('supertest');

let mockCurrentUser;

jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, res, next) => {
    if (!mockCurrentUser?.isAdmin) {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }
    req.user = mockCurrentUser;
    next();
  },
}));

jest.mock('../services/integrityService', () => ({
  checkOwnerOrphans: jest.fn(),
  checkDanglingJobRefs: jest.fn(),
  checkFileIntegrity: jest.fn(),
  cleanupOwnerOrphans: jest.fn(),
}));

// admin.js 가 물고 있는 모델들 — 이 테스트에서 호출 안 됨
jest.mock('../models/User', () => ({}));
jest.mock('../models/Workboard', () => ({}));
jest.mock('../models/ImageGenerationJob', () => ({}));
jest.mock('../models/GeneratedImage', () => ({}));
jest.mock('../models/UploadedImage', () => ({}));
jest.mock('../models/SystemSettings', () => ({}));

const integrityService = require('../services/integrityService');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../routes/admin'));
  return app;
}

describe('admin 정합성 라우트 (#662 P2)', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { _id: 'admin-1', isAdmin: true };
    integrityService.checkOwnerOrphans.mockResolvedValue({ userContent: [], structural: [], totalOrphanDocs: 0 });
    integrityService.checkDanglingJobRefs.mockResolvedValue([]);
    integrityService.checkFileIntegrity.mockResolvedValue({ missingCount: 0, orphanFileCount: 0 });
    integrityService.cleanupOwnerOrphans.mockResolvedValue({ apply: false, results: [] });
  });

  test('GET /integrity — 일반 사용자는 403', async () => {
    mockCurrentUser = { _id: 'user-1', isAdmin: false };
    const res = await request(app).get('/api/admin/integrity');
    expect(res.status).toBe(403);
    expect(integrityService.checkOwnerOrphans).not.toHaveBeenCalled();
  });

  test('GET /integrity — 기본은 파일 검사 제외', async () => {
    const res = await request(app).get('/api/admin/integrity');
    expect(res.status).toBe(200);
    expect(res.body.data.files).toBeNull();
    expect(integrityService.checkFileIntegrity).not.toHaveBeenCalled();
  });

  test('GET /integrity?files=true — 파일 검사 포함', async () => {
    const res = await request(app).get('/api/admin/integrity').query({ files: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.data.files).toEqual({ missingCount: 0, orphanFileCount: 0 });
    expect(integrityService.checkFileIntegrity).toHaveBeenCalled();
  });

  test('POST /cleanup-owner-orphans — 기본은 dry-run (apply:false)', async () => {
    const res = await request(app).post('/api/admin/integrity/cleanup-owner-orphans').send({});
    expect(res.status).toBe(200);
    expect(integrityService.cleanupOwnerOrphans).toHaveBeenCalledWith({ apply: false });
  });

  test('POST /cleanup-owner-orphans — apply 는 boolean true 일 때만', async () => {
    await request(app).post('/api/admin/integrity/cleanup-owner-orphans').send({ apply: true });
    expect(integrityService.cleanupOwnerOrphans).toHaveBeenLastCalledWith({ apply: true });

    // 문자열 'true' 등 유사값은 dry-run 으로 강등 (안전)
    await request(app).post('/api/admin/integrity/cleanup-owner-orphans').send({ apply: 'true' });
    expect(integrityService.cleanupOwnerOrphans).toHaveBeenLastCalledWith({ apply: false });
  });
});
