// #966 — DB 에 서명째 저장된 주소가 만료된 채 응답에 실려 미리보기가 깨지던 문제.
// 응답에서는 다시 서명하고, 저장 전에는 /uploads 경로로 되돌린다.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';
const { transformUploadUrls, reverseUploadUrls, verifySignature } = require('../utils/signedUrl');

const EXPIRED = '/api/files/reference/abc.png?expires=1000000000&sig=deadbeef';

function parts(url) {
  const u = new URL(url, 'http://localhost');
  return {
    filePath: u.pathname.replace(/^\/api\/files/, ''),
    expires: u.searchParams.get('expires'),
    sig: u.searchParams.get('sig'),
  };
}

describe('transformUploadUrls - 저장된 서명 주소 재서명', () => {
  test('만료된 서명 주소를 응답 시점 기준으로 다시 서명', () => {
    const refreshed = transformUploadUrls(EXPIRED);
    const { filePath, expires, sig } = parts(refreshed);

    expect(filePath).toBe('/reference/abc.png');
    expect(Number(expires)).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(verifySignature(filePath, expires, sig)).toEqual({ valid: true, expired: false });
  });

  test('/uploads 경로는 기존대로 서명', () => {
    const signed = transformUploadUrls('/uploads/generated/test.png');
    const { filePath, expires, sig } = parts(signed);
    expect(verifySignature(filePath, expires, sig)).toEqual({ valid: true, expired: false });
  });

  test('백업 다운로드 주소는 건드리지 않는다 — 서명 방식이 다르다', () => {
    const backup = '/api/files/backup/6a8d44c34413f9a2edbffbe4?expires=1000000000&sig=abc123';
    expect(transformUploadUrls(backup)).toBe(backup);
  });

  test('파일 주소가 아닌 문자열은 그대로', () => {
    expect(transformUploadUrls('/api/jobs/123')).toBe('/api/jobs/123');
    expect(transformUploadUrls('참조 이미지')).toBe('참조 이미지');
  });

  test('중첩된 구조 안의 첨부도 재서명 (계속하기가 쓰는 inputData 형태)', () => {
    const inputData = {
      prompt: '고양이',
      referenceImages: [{ imageId: 'a1', image: { url: EXPIRED, path: '/app/uploads/reference/abc.png' } }],
      additionalParams: { ref_image: [{ imageId: 'a1', image: { url: EXPIRED } }] },
    };
    const out = transformUploadUrls(inputData);

    expect(out.prompt).toBe('고양이');
    expect(out.referenceImages[0].image.path).toBe('/app/uploads/reference/abc.png');
    for (const url of [out.referenceImages[0].image.url, out.additionalParams.ref_image[0].image.url]) {
      const { filePath, expires, sig } = parts(url);
      expect(verifySignature(filePath, expires, sig)).toEqual({ valid: true, expired: false });
    }
  });
});

describe('reverseUploadUrls - 저장 전 서명 제거', () => {
  test('서명 주소를 /uploads 경로로 되돌린다', () => {
    expect(reverseUploadUrls(EXPIRED)).toBe('/uploads/reference/abc.png');
  });

  test('백업 주소와 일반 문자열은 그대로', () => {
    const backup = '/api/files/backup/6a8d44c34413f9a2edbffbe4?expires=1&sig=abc';
    expect(reverseUploadUrls(backup)).toBe(backup);
    expect(reverseUploadUrls('/uploads/reference/abc.png')).toBe('/uploads/reference/abc.png');
    expect(reverseUploadUrls('프롬프트')).toBe('프롬프트');
  });

  test('중첩 구조를 따라 되돌리고, 되돌린 값은 다시 서명된다', () => {
    const stored = reverseUploadUrls({
      additionalParams: { ref_image: [{ imageId: 'a1', image: { url: EXPIRED } }] },
    });
    expect(stored.additionalParams.ref_image[0].image.url).toBe('/uploads/reference/abc.png');

    const { filePath, expires, sig } = parts(transformUploadUrls(stored).additionalParams.ref_image[0].image.url);
    expect(verifySignature(filePath, expires, sig)).toEqual({ valid: true, expired: false });
  });

  test('Date 같은 비-평문 객체는 그대로 둔다', () => {
    const when = new Date('2026-09-17T00:00:00.000Z');
    expect(reverseUploadUrls({ createdAt: when }).createdAt).toBe(when);
  });
});
