const express = require('express');
const request = require('supertest');
const path = require('path');
const { generateSignedUrl } = require('../utils/signedUrl');

/**
 * files 라우트 통합 테스트
 *
 * 실제 Express 앱에 files 라우터를 마운트하고
 * supertest로 HTTP 요청을 검증합니다.
 */

function createApp() {
  const app = express();
  const filesRoutes = require('../routes/files');
  app.use('/api/files', filesRoutes);
  return app;
}

// signed URL에서 경로와 쿼리 파라미터를 추출하는 헬퍼
function parseSignedUrl(signedUrl) {
  const parsed = new URL(signedUrl, 'http://localhost');
  return {
    path: parsed.pathname,
    expires: parsed.searchParams.get('expires'),
    sig: parsed.searchParams.get('sig'),
  };
}

describe('GET /api/files/* - 파일 서빙 라우트', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  // ── 제거된 엔드포인트 ──

  describe('/api/files/sign 엔드포인트 제거 확인', () => {
    test('서명 파라미터 없이 요청하면 Missing signature parameters 반환', async () => {
      const res = await request(app)
        .get('/api/files/sign')
        .query({ path: '/uploads/generated/test.png' });

      // /sign 엔드포인트가 없으므로 /* 핸들러가 처리하며,
      // expires/sig가 없어 403 반환
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Missing signature parameters');
    });
  });

  // ── 서명 파라미터 검증 ──

  describe('서명 파라미터 누락', () => {
    test('expires 누락 시 403', async () => {
      const res = await request(app)
        .get('/api/files/generated/test.png')
        .query({ sig: 'fakesig' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Missing signature parameters');
    });

    test('sig 누락 시 403', async () => {
      const res = await request(app)
        .get('/api/files/generated/test.png')
        .query({ expires: '9999999999' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Missing signature parameters');
    });

    test('둘 다 누락 시 403', async () => {
      const res = await request(app).get('/api/files/generated/test.png');

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Missing signature parameters');
    });
  });

  // ── 경로 보안 ──

  describe('경로 조작 차단', () => {
    test('.. 세그먼트 포함 시 Access denied', async () => {
      const res = await request(app)
        .get('/api/files/generated/../../../etc/passwd')
        .query({ expires: '9999999999', sig: 'fakesig' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('인코딩된 .. 세그먼트도 차단', async () => {
      const res = await request(app)
        .get('/api/files/generated/%2e%2e/%2e%2e/etc/passwd')
        .query({ expires: '9999999999', sig: 'fakesig' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('null byte 포함 시 차단', async () => {
      const res = await request(app)
        .get('/api/files/generated/test.png%00.jpg')
        .query({ expires: '9999999999', sig: 'fakesig' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });
  });

  // ── 서브디렉토리 allowlist ──

  describe('서브디렉토리 allowlist', () => {
    test('generated 경로 허용 (서명 검증 단계까지 도달)', async () => {
      const res = await request(app)
        .get('/api/files/generated/test.png')
        .query({ expires: '9999999999', sig: 'fakesig' });

      // allowlist를 통과하지만 서명이 잘못되어 Invalid signature
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Invalid signature');
    });

    test('reference 경로 허용 (서명 검증 단계까지 도달)', async () => {
      const res = await request(app)
        .get('/api/files/reference/image.jpg')
        .query({ expires: '9999999999', sig: 'fakesig' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Invalid signature');
    });

    test('allowlist 외 경로 차단: backup-temp', async () => {
      const res = await request(app)
        .get('/api/files/backup-temp/data.zip')
        .query({ expires: '9999999999', sig: 'fakesig' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('allowlist 외 경로 차단: restore-temp', async () => {
      const res = await request(app)
        .get('/api/files/restore-temp/data.zip')
        .query({ expires: '9999999999', sig: 'fakesig' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('allowlist 외 경로 차단: 루트 레벨 파일', async () => {
      const res = await request(app)
        .get('/api/files/secret.txt')
        .query({ expires: '9999999999', sig: 'fakesig' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });
  });

  // ── 서명 검증 ──

  describe('서명 검증', () => {
    test('만료된 서명 거부', async () => {
      const res = await request(app)
        .get('/api/files/generated/test.png')
        .query({ expires: '1000000000', sig: 'a'.repeat(64) });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('URL has expired');
    });

    test('유효한 signed URL로 파일 접근 시도 (파일 없으면 404)', async () => {
      const signedUrl = generateSignedUrl('/uploads/generated/nonexistent-file.png');
      const { path: urlPath, expires, sig } = parseSignedUrl(signedUrl);

      const res = await request(app)
        .get(urlPath)
        .query({ expires, sig });

      // 서명은 유효하지만 파일이 없으므로 404
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('File not found');
    });
  });

  // ── 복합 공격 시나리오 ──

  describe('복합 공격 시나리오', () => {
    test('allowlist 우회 시도: generated/../backup-temp', async () => {
      const res = await request(app)
        .get('/api/files/generated/../backup-temp/data.zip')
        .query({ expires: '9999999999', sig: 'fakesig' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('서명은 유효하지만 다른 파일 경로로 변경 시 거부', async () => {
      // generated/a.png에 대한 유효한 서명 생성
      const signedUrl = generateSignedUrl('/uploads/generated/a.png');
      const { expires, sig } = parseSignedUrl(signedUrl);

      // 다른 파일 경로로 접근 시도
      const res = await request(app)
        .get('/api/files/generated/b.png')
        .query({ expires, sig });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Invalid signature');
    });
  });
});
