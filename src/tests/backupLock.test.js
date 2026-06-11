const express = require('express');
const request = require('supertest');

/**
 * #529 backupLock 미들웨어 경로 매칭 회귀 테스트
 *
 * app.use('/api', blockDuringBackup) 로 마운트되면 req.path 에서 '/api' prefix 가
 * 제거된다. allowlist 가 '/api/...' 형태로 비교하면 절대 매치되지 않는 버그가 있었음.
 * 실제 마운트 형태 그대로 supertest 로 검증한다.
 */

const {
  startBackupLock,
  endBackupLock,
  blockDuringBackup
} = require('../middleware/backupLock');

function buildApp() {
  const app = express();
  app.use('/api', blockDuringBackup);
  app.all('/api/*', (req, res) => res.status(200).json({ passed: true }));
  return app;
}

describe('blockDuringBackup (마운트 경로 기준)', () => {
  const app = buildApp();

  afterEach(() => {
    endBackupLock();
  });

  describe('백업 미진행 시', () => {
    test('모든 쓰기 요청 통과', async () => {
      await request(app).post('/api/images/bulk-delete').expect(200);
      await request(app).post('/api/auth/signup').expect(200);
      await request(app).post('/api/admin/backup/restore').expect(200);
    });
  });

  describe('백업 진행 중', () => {
    beforeEach(() => {
      startBackupLock('test-backup-job');
    });

    test('읽기 요청 (GET) 은 항상 통과', async () => {
      await request(app).get('/api/admin/backup/list').expect(200);
      await request(app).get('/api/jobs/my').expect(200);
    });

    test('일반 쓰기 요청은 503 차단', async () => {
      const res = await request(app).post('/api/images/bulk-delete').expect(503);
      expect(res.body.backupJobId).toBe('test-backup-job');
      await request(app).delete('/api/jobs/123').expect(503);
      await request(app).put('/api/workboards/123').expect(503);
    });

    test('로그인/로그아웃은 허용 (관리자 진입 경로)', async () => {
      await request(app).post('/api/auth/signin').expect(200);
      await request(app).post('/api/auth/logout').expect(200);
    });

    test('signup / 비밀번호 재설정은 차단 (User 컬렉션 쓰기)', async () => {
      await request(app).post('/api/auth/signup').expect(503);
      await request(app).post('/api/auth/forgot-password').expect(503);
      await request(app).post('/api/auth/reset-password').expect(503);
    });

    test('백업 제어 API 는 허용', async () => {
      await request(app).post('/api/admin/backup').expect(200);
      await request(app).post('/api/admin/backup/abc123/signed-url').expect(200);
      await request(app).delete('/api/admin/backup/abc123').expect(200);
    });

    test('복원(restore) 은 백업 중 차단', async () => {
      await request(app).post('/api/admin/backup/restore').expect(503);
      await request(app).post('/api/admin/backup/restore/validate').expect(503);
    });
  });
});
