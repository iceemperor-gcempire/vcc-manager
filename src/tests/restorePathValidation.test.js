const express = require('express');
const request = require('supertest');
const path = require('path');

/**
 * F-02 복구 API 보안 테스트
 *
 * 1. 경로 검증 로직 단위 테스트 — backup-temp 디렉토리 경계 검증
 * 2. 라우트 통합 테스트 — supertest로 실제 HTTP 핸들러 동작 검증
 *    - POST /restore/validate 응답에서 filePath 제거 확인
 *    - POST /restore 에서 클라이언트 filePath 무시, DB 경로만 사용 확인
 *    - 경로 조작 공격 시나리오 차단 확인
 */

// ── Mock 설정 (라우트 모듈 로드 전) ──

jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, res, next) => {
    req.user = { _id: 'test-admin-id', isAdmin: true };
    next();
  }
}));

jest.mock('../middleware/backupLock', () => ({
  startBackupLock: jest.fn(),
  endBackupLock: jest.fn(),
  isBackupInProgress: jest.fn(() => false),
  getCurrentBackupJobId: jest.fn(() => null)
}));

jest.mock('../services/restoreService', () => ({
  validateBackup: jest.fn(),
  executeRestore: jest.fn(() => Promise.resolve()),
  getRestoreStatus: jest.fn(),
  listRestores: jest.fn()
}));

jest.mock('../services/backupService', () => ({
  ENCRYPTION_KEY: 'a'.repeat(64),
  getLastBackupTime: jest.fn(),
  initBackupJob: jest.fn(),
  executeBackup: jest.fn(() => Promise.resolve()),
  getBackupStatus: jest.fn(),
  listBackups: jest.fn(),
  deleteBackup: jest.fn(),
  getBackupFilePath: jest.fn()
}));

// multer mock: upload.single() → req.file 주입
jest.mock('multer', () => {
  const m = jest.fn(() => ({
    single: jest.fn(() => (req, res, next) => {
      req.file = {
        path: './uploads/backup-temp/restore-test-12345.zip',
        originalname: 'test-backup.zip',
        mimetype: 'application/zip'
      };
      next();
    })
  }));
  m.diskStorage = jest.fn(() => ({}));
  return m;
});

const restoreService = require('../services/restoreService');

const UPLOAD_BASE = process.env.UPLOAD_PATH || './uploads';
const UPLOAD_DIR = process.env.BACKUP_UPLOAD_PATH || path.join(UPLOAD_BASE, 'backup-temp');

function createApp() {
  const app = express();
  app.use(express.json());
  const backupRoutes = require('../routes/backup');
  app.use('/api/admin/backup', backupRoutes);
  return app;
}

// ═══════════════════════════════════════════════════════════
// 1. 경로 검증 로직 단위 테스트
// ═══════════════════════════════════════════════════════════

// backup.js 라우트에서 사용하는 것과 동일한 검증 로직
function isPathWithinUploadDir(filePath) {
  const resolvedPath = path.resolve(filePath);
  const resolvedUploadDir = path.resolve(UPLOAD_DIR);
  return resolvedPath.startsWith(resolvedUploadDir + path.sep) || resolvedPath === resolvedUploadDir;
}

describe('F-02: 경로 검증 로직 단위 테스트', () => {
  describe('정상 경로 허용', () => {
    test('backup-temp 내부 파일 허용', () => {
      const filePath = path.join(UPLOAD_DIR, 'restore-12345.zip');
      expect(isPathWithinUploadDir(filePath)).toBe(true);
    });

    test('backup-temp 내부 서브디렉토리 파일 허용', () => {
      const filePath = path.join(UPLOAD_DIR, 'sub', 'restore-12345.zip');
      expect(isPathWithinUploadDir(filePath)).toBe(true);
    });
  });

  describe('경로 조작 차단', () => {
    test('.. 세그먼트로 상위 디렉토리 접근 차단', () => {
      const filePath = path.join(UPLOAD_DIR, '..', 'etc', 'passwd');
      expect(isPathWithinUploadDir(filePath)).toBe(false);
    });

    test('절대 경로로 임의 파일 접근 차단', () => {
      expect(isPathWithinUploadDir('/etc/passwd')).toBe(false);
    });

    test('다른 uploads 하위 디렉토리 접근 차단', () => {
      const filePath = path.join(UPLOAD_BASE, 'generated', 'image.png');
      expect(isPathWithinUploadDir(filePath)).toBe(false);
    });

    test('backup-temp 접두사 유사 경로 차단 (backup-temp-evil)', () => {
      const filePath = path.resolve(UPLOAD_DIR + '-evil', 'malicious.zip');
      expect(isPathWithinUploadDir(filePath)).toBe(false);
    });

    test('.. 여러 단계 상위 접근 차단', () => {
      const filePath = path.join(UPLOAD_DIR, '..', '..', '..', 'etc', 'shadow');
      expect(isPathWithinUploadDir(filePath)).toBe(false);
    });

    test('현재 디렉토리(.) normalize 후 uploads 루트 접근 차단', () => {
      const filePath = path.join(UPLOAD_BASE, '.', 'important-config.json');
      expect(isPathWithinUploadDir(filePath)).toBe(false);
    });

    test('uploads 루트 자체 파일 접근 차단', () => {
      const filePath = path.join(UPLOAD_BASE, 'secret.json');
      expect(isPathWithinUploadDir(filePath)).toBe(false);
    });

    test('restore-temp 디렉토리 접근 차단', () => {
      const filePath = path.join(UPLOAD_BASE, 'restore-temp', 'data.zip');
      expect(isPathWithinUploadDir(filePath)).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 2. 라우트 통합 테스트
// ═══════════════════════════════════════════════════════════

describe('F-02: 복구 라우트 통합 테스트', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    restoreService.executeRestore.mockResolvedValue({});
  });

  // ── POST /restore/validate 응답 검증 ──

  describe('POST /restore/validate - 응답에서 filePath 제거', () => {
    test('검증 성공 응답에 filePath 필드가 없어야 함', async () => {
      restoreService.validateBackup.mockResolvedValue({
        _id: 'test-job-id',
        validationResult: { isValid: true, errors: [], warnings: [] },
        backupMetadata: { version: '1.0', createdAt: new Date(), collections: {}, files: {} }
      });

      const res = await request(app)
        .post('/api/admin/backup/restore/validate')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('jobId');
      expect(res.body.data).toHaveProperty('validationResult');
      expect(res.body.data).toHaveProperty('backupMetadata');
      // 핵심: filePath가 응답에 포함되지 않아야 함
      expect(res.body.data).not.toHaveProperty('filePath');
    });

    test('검증 실패 시에도 filePath 필드가 없어야 함', async () => {
      restoreService.validateBackup.mockResolvedValue({
        _id: 'test-job-id',
        validationResult: { isValid: false, errors: ['invalid format'], warnings: [] },
        backupMetadata: null
      });

      const res = await request(app)
        .post('/api/admin/backup/restore/validate')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty('filePath');
    });

    test('응답 데이터에는 jobId, validationResult, backupMetadata만 포함', async () => {
      restoreService.validateBackup.mockResolvedValue({
        _id: 'test-job-id',
        validationResult: { isValid: true, errors: [], warnings: ['경고'] },
        backupMetadata: { version: '1.0' }
      });

      const res = await request(app)
        .post('/api/admin/backup/restore/validate')
        .send();

      const dataKeys = Object.keys(res.body.data);
      expect(dataKeys).toEqual(expect.arrayContaining(['jobId', 'validationResult', 'backupMetadata']));
      expect(dataKeys).toHaveLength(3);
    });
  });

  // ── POST /restore 입력 검증 ──

  describe('POST /restore - 입력 검증', () => {
    test('jobId 누락 시 400 반환', async () => {
      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('jobId가 필요합니다.');
    });

    test('존재하지 않는 jobId 요청 시 400 반환', async () => {
      restoreService.getRestoreStatus.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({ jobId: 'nonexistent-job-id' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('검증되지 않은');
    });

    test('검증 실패한 작업 요청 시 400 반환', async () => {
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: false, errors: ['파일 손상'] }
      });

      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({ jobId: 'failed-job-id' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('검증되지 않은');
    });

    test('tempFilePath가 null인 작업 요청 시 400 반환', async () => {
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: true },
        tempFilePath: null
      });

      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({ jobId: 'test-job-id' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('임시 파일 경로');
    });

    test('tempFilePath가 undefined인 작업 요청 시 400 반환', async () => {
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: true }
        // tempFilePath 없음
      });

      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({ jobId: 'test-job-id' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('임시 파일 경로');
    });
  });

  // ── POST /restore 경로 보안 ──

  describe('POST /restore - 경로 보안 검증', () => {
    test('tempFilePath가 절대 경로(/etc/passwd)인 경우 403 반환', async () => {
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: true },
        tempFilePath: '/etc/passwd'
      });

      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({ jobId: 'test-job-id' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
      expect(restoreService.executeRestore).not.toHaveBeenCalled();
    });

    test('tempFilePath에 .. 경로 조작 포함 시 403 반환', async () => {
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: true },
        tempFilePath: path.join(UPLOAD_DIR, '..', 'generated', 'important.png')
      });

      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({ jobId: 'test-job-id' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
      expect(restoreService.executeRestore).not.toHaveBeenCalled();
    });

    test('tempFilePath가 다른 uploads 하위 디렉토리인 경우 403 반환', async () => {
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: true },
        tempFilePath: path.join(UPLOAD_BASE, 'generated', 'image.png')
      });

      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({ jobId: 'test-job-id' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
      expect(restoreService.executeRestore).not.toHaveBeenCalled();
    });

    test('tempFilePath가 backup-temp-evil (접두사 유사 경로)인 경우 403 반환', async () => {
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: true },
        tempFilePath: path.resolve(UPLOAD_DIR + '-evil', 'malicious.zip')
      });

      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({ jobId: 'test-job-id' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
      expect(restoreService.executeRestore).not.toHaveBeenCalled();
    });

    test('tempFilePath가 .. 다중 레벨 상위 접근인 경우 403 반환', async () => {
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: true },
        tempFilePath: path.join(UPLOAD_DIR, '..', '..', '..', 'etc', 'shadow')
      });

      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({ jobId: 'test-job-id' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
      expect(restoreService.executeRestore).not.toHaveBeenCalled();
    });
  });

  // ── POST /restore 정상 동작 ──

  describe('POST /restore - 정상 복구 실행', () => {
    test('DB의 tempFilePath를 사용하여 복구 시작 → 200 반환', async () => {
      const dbFilePath = path.join(UPLOAD_DIR, 'restore-12345.zip');
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: true },
        tempFilePath: dbFilePath
      });

      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({ jobId: 'test-job-id', options: { overwriteExisting: true } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBe('test-job-id');

      // executeRestore가 DB 경로로 호출되었는지 확인
      expect(restoreService.executeRestore).toHaveBeenCalledWith(
        'test-job-id',
        dbFilePath,
        { overwriteExisting: true }
      );
    });

    test('options 기본값은 빈 객체', async () => {
      const dbFilePath = path.join(UPLOAD_DIR, 'restore-99999.zip');
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: true },
        tempFilePath: dbFilePath
      });

      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({ jobId: 'test-job-id' });

      expect(res.status).toBe(200);
      expect(restoreService.executeRestore).toHaveBeenCalledWith(
        'test-job-id',
        dbFilePath,
        {}
      );
    });
  });

  // ── POST /restore 클라이언트 filePath 무시 ──

  describe('POST /restore - 클라이언트 filePath 무시 (핵심 보안)', () => {
    test('요청 본문에 filePath가 포함되어도 DB 경로만 사용', async () => {
      const dbFilePath = path.join(UPLOAD_DIR, 'restore-12345.zip');
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: true },
        tempFilePath: dbFilePath
      });

      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({
          jobId: 'test-job-id',
          filePath: '/etc/passwd',   // 공격자가 주입한 경로
          options: {}
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // executeRestore가 DB 경로로 호출됨 (공격자 경로 아님)
      expect(restoreService.executeRestore).toHaveBeenCalledWith(
        'test-job-id',
        dbFilePath,
        {}
      );
    });

    test('filePath로 시스템 파일 경로를 보내도 executeRestore에 전달되지 않음', async () => {
      const dbFilePath = path.join(UPLOAD_DIR, 'restore-safe.zip');
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: true },
        tempFilePath: dbFilePath
      });

      await request(app)
        .post('/api/admin/backup/restore')
        .send({
          jobId: 'test-job-id',
          filePath: '/var/log/syslog',
          options: { skipDatabase: true }
        });

      // 첫 번째 인자 확인: executeRestore의 두 번째 파라미터(filePath)가 DB 경로인지
      const callArgs = restoreService.executeRestore.mock.calls[0];
      expect(callArgs[1]).toBe(dbFilePath);
      expect(callArgs[1]).not.toBe('/var/log/syslog');
    });

    test('filePath로 다른 uploads 하위 경로를 보내도 DB 경로만 사용', async () => {
      const dbFilePath = path.join(UPLOAD_DIR, 'restore-ok.zip');
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: true },
        tempFilePath: dbFilePath
      });

      await request(app)
        .post('/api/admin/backup/restore')
        .send({
          jobId: 'test-job-id',
          filePath: './uploads/generated/user-image.png',
          options: {}
        });

      const callArgs = restoreService.executeRestore.mock.calls[0];
      expect(callArgs[1]).toBe(dbFilePath);
    });
  });

  // ── 복합 공격 시나리오 ──

  describe('POST /restore - 복합 공격 시나리오', () => {
    test('DB tempFilePath 변조 가정: backup-temp/../generated 경로 차단', async () => {
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: true },
        tempFilePath: path.join(UPLOAD_DIR, '..', 'generated', 'secret.png')
      });

      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({ jobId: 'test-job-id' });

      expect(res.status).toBe(403);
      expect(restoreService.executeRestore).not.toHaveBeenCalled();
    });

    test('DB tempFilePath 변조 가정: 빈 문자열인 경우 차단', async () => {
      restoreService.getRestoreStatus.mockResolvedValue({
        validationResult: { isValid: true },
        tempFilePath: ''
      });

      const res = await request(app)
        .post('/api/admin/backup/restore')
        .send({ jobId: 'test-job-id' });

      // 빈 문자열은 falsy이므로 400 반환
      expect(res.status).toBe(400);
      expect(restoreService.executeRestore).not.toHaveBeenCalled();
    });

    test('경로 검증 통과 실패 시 executeRestore는 절대 호출되지 않음', async () => {
      const attackPaths = [
        '/etc/passwd',
        '/tmp/malicious.zip',
        path.join(UPLOAD_BASE, 'videos', 'data.mp4'),
        path.join(UPLOAD_DIR, '..', '..', 'package.json'),
        path.resolve(UPLOAD_DIR + '-pwned', 'evil.zip')
      ];

      for (const attackPath of attackPaths) {
        jest.clearAllMocks();
        restoreService.executeRestore.mockResolvedValue({});

        restoreService.getRestoreStatus.mockResolvedValue({
          validationResult: { isValid: true },
          tempFilePath: attackPath
        });

        const res = await request(app)
          .post('/api/admin/backup/restore')
          .send({ jobId: 'test-job-id' });

        expect(res.status).toBe(403);
        expect(restoreService.executeRestore).not.toHaveBeenCalled();
      }
    });
  });
});
