/**
 * #663 비밀번호 정책 단일 소스
 */
const { isValidPassword, PASSWORD_REGEX, PASSWORD_POLICY_MESSAGE } = require('../utils/passwordPolicy');

describe('#663 passwordPolicy', () => {
  test('정책 충족(8자+, 대/소문자·숫자·특수문자) → 통과', () => {
    expect(isValidPassword('Abcdef1!')).toBe(true);
    expect(isValidPassword('StrongP@ss2026')).toBe(true);
    expect(isValidPassword('AlphaReset2026!')).toBe(true);
  });

  test('정책 미달 → 거부', () => {
    expect(isValidPassword('short1!A')).toBe(true); // 8자 경계(통과 케이스 확인)
    expect(isValidPassword('abc123!a')).toBe(false); // 대문자 없음
    expect(isValidPassword('ABC123!A')).toBe(false); // 소문자 없음
    expect(isValidPassword('Abcdefg!')).toBe(false); // 숫자 없음
    expect(isValidPassword('Abcdefg1')).toBe(false); // 특수문자 없음
    expect(isValidPassword('Ab1!')).toBe(false);     // 8자 미만
    expect(isValidPassword('')).toBe(false);
  });

  test('문자열 아닌 입력 → 거부(throw 안 함)', () => {
    expect(isValidPassword(null)).toBe(false);
    expect(isValidPassword(undefined)).toBe(false);
    expect(isValidPassword(12345678)).toBe(false);
  });

  test('정책 메시지·정규식 export', () => {
    expect(typeof PASSWORD_POLICY_MESSAGE).toBe('string');
    expect(PASSWORD_REGEX.test('Abcdef1!')).toBe(true);
  });
});
