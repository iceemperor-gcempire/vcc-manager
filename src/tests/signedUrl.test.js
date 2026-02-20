// signedUrl 모듈은 로드 시점에 JWT_SECRET을 검사하므로 require 전에 설정
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';
const { generateSignedUrl, verifySignature } = require('../utils/signedUrl');

describe('signedUrl - generateSignedUrl 경로 정규화', () => {
  test('일반 경로를 올바르게 서명', () => {
    const url = generateSignedUrl('/uploads/generated/test.png');
    expect(url).toMatch(/^\/api\/files\/generated\/test\.png\?expires=\d+&sig=[a-f0-9]+$/);
  });

  test('/uploads 접두사가 제거됨', () => {
    const url = generateSignedUrl('/uploads/reference/image.jpg');
    expect(url).toContain('/api/files/reference/image.jpg');
    expect(url).not.toContain('/uploads');
  });

  test('중복 슬래시가 정규화됨', () => {
    const url = generateSignedUrl('/uploads/generated//test.png');
    expect(url).toContain('/api/files/generated/test.png');
  });

  test('동일 경로는 동일 서명 생성 (라운딩 구간 내)', () => {
    const url1 = generateSignedUrl('/uploads/generated/test.png');
    const url2 = generateSignedUrl('/uploads/generated/test.png');
    expect(url1).toBe(url2);
  });

  test('서로 다른 경로는 서로 다른 서명 생성', () => {
    const url1 = generateSignedUrl('/uploads/generated/a.png');
    const url2 = generateSignedUrl('/uploads/generated/b.png');
    const sig1 = new URL(url1, 'http://localhost').searchParams.get('sig');
    const sig2 = new URL(url2, 'http://localhost').searchParams.get('sig');
    expect(sig1).not.toBe(sig2);
  });
});

describe('signedUrl - verifySignature', () => {
  test('유효한 서명 검증 성공', () => {
    const url = generateSignedUrl('/uploads/generated/test.png');
    const parsed = new URL(url, 'http://localhost');
    const filePath = parsed.pathname.replace('/api/files', '');
    const expires = parsed.searchParams.get('expires');
    const sig = parsed.searchParams.get('sig');

    const result = verifySignature(filePath, expires, sig);
    expect(result.valid).toBe(true);
    expect(result.expired).toBe(false);
  });

  test('잘못된 서명 거부', () => {
    const url = generateSignedUrl('/uploads/generated/test.png');
    const parsed = new URL(url, 'http://localhost');
    const filePath = parsed.pathname.replace('/api/files', '');
    const expires = parsed.searchParams.get('expires');

    const result = verifySignature(filePath, expires, 'a'.repeat(64));
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(false);
  });

  test('만료된 서명 거부', () => {
    const result = verifySignature('/generated/test.png', '1000000000', 'a'.repeat(64));
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
  });

  test('서명 길이 불일치 시 거부', () => {
    const result = verifySignature('/generated/test.png', '9999999999', 'short');
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(false);
  });

  test('정규화된 경로와 원본 경로 서명 일관성', () => {
    // generateSignedUrl이 정규화하므로 검증 시에도 정규화된 경로를 사용해야 일치
    const url = generateSignedUrl('/uploads/generated/test.png');
    const parsed = new URL(url, 'http://localhost');
    const filePath = parsed.pathname.replace('/api/files', '');
    const expires = parsed.searchParams.get('expires');
    const sig = parsed.searchParams.get('sig');

    // 정규화된 경로로 검증 — 성공
    const result = verifySignature(filePath, expires, sig);
    expect(result.valid).toBe(true);
  });
});
