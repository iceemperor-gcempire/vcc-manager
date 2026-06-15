/**
 * #594 at-rest secret 암호화 유틸 테스트
 */
const { encryptSecret, decryptSecret, isEncrypted } = require('../utils/secretCrypto');

const KEY = 'a'.repeat(64); // 32바이트 hex

describe('#594 secretCrypto (키 설정됨)', () => {
  const orig = process.env.CONFIG_ENCRYPTION_KEY;
  beforeAll(() => { process.env.CONFIG_ENCRYPTION_KEY = KEY; });
  afterAll(() => { process.env.CONFIG_ENCRYPTION_KEY = orig; });

  test('암호화 → 복호화 round-trip', () => {
    const enc = encryptSecret('sk-secret-123');
    expect(enc).not.toBe('sk-secret-123');
    expect(isEncrypted(enc)).toBe(true);
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(decryptSecret(enc)).toBe('sk-secret-123');
  });

  test('멱등 — 이미 암호문이면 다시 암호화하지 않음', () => {
    const enc = encryptSecret('key');
    expect(encryptSecret(enc)).toBe(enc);
  });

  test('서로 다른 IV — 같은 평문도 매번 다른 암호문', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
    // 그래도 둘 다 같은 평문으로 복호화
    expect(decryptSecret(encryptSecret('same'))).toBe('same');
  });

  test('평문/빈값/null 은 그대로 통과', () => {
    expect(decryptSecret('plaintext-not-enc')).toBe('plaintext-not-enc');
    expect(encryptSecret('')).toBe('');
    expect(encryptSecret(null)).toBeNull();
    expect(decryptSecret(null)).toBeNull();
  });

  test('변조된 암호문은 복호화 실패 → null', () => {
    const enc = encryptSecret('secret');
    const tampered = enc.slice(0, -2) + (enc.endsWith('00') ? '11' : '00');
    expect(decryptSecret(tampered)).toBeNull();
  });
});

describe('#594 secretCrypto (키 없음 — graceful degrade)', () => {
  const origC = process.env.CONFIG_ENCRYPTION_KEY;
  const origB = process.env.BACKUP_ENCRYPTION_KEY;
  beforeAll(() => { delete process.env.CONFIG_ENCRYPTION_KEY; delete process.env.BACKUP_ENCRYPTION_KEY; });
  afterAll(() => { process.env.CONFIG_ENCRYPTION_KEY = origC; process.env.BACKUP_ENCRYPTION_KEY = origB; });

  test('키 없으면 평문 그대로 (기존 동작 유지)', () => {
    expect(encryptSecret('plain')).toBe('plain');
    expect(isEncrypted(encryptSecret('plain'))).toBe(false);
  });
});

describe('#594 secretCrypto (BACKUP_ENCRYPTION_KEY fallback)', () => {
  const origC = process.env.CONFIG_ENCRYPTION_KEY;
  const origB = process.env.BACKUP_ENCRYPTION_KEY;
  beforeAll(() => { delete process.env.CONFIG_ENCRYPTION_KEY; process.env.BACKUP_ENCRYPTION_KEY = KEY; });
  afterAll(() => { process.env.CONFIG_ENCRYPTION_KEY = origC; process.env.BACKUP_ENCRYPTION_KEY = origB; });

  test('CONFIG 없으면 BACKUP 키로 암복호화', () => {
    const enc = encryptSecret('x');
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptSecret(enc)).toBe('x');
  });
});
