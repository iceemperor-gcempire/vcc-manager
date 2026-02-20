const { escapeRegex } = require('../utils/escapeRegex');

describe('escapeRegex - ReDoS 방지 (F-08)', () => {
  test('정규식 특수문자가 이스케이프됨', () => {
    const input = '(a+)+$';
    const escaped = escapeRegex(input);
    expect(escaped).toBe('\\(a\\+\\)\\+\\$');
  });

  test('모든 특수문자 이스케이프', () => {
    const specials = '.*+?^${}()|[]\\';
    const escaped = escapeRegex(specials);
    expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  test('일반 문자열은 변경 없음', () => {
    expect(escapeRegex('hello world')).toBe('hello world');
    expect(escapeRegex('test123')).toBe('test123');
    expect(escapeRegex('한글검색')).toBe('한글검색');
  });

  test('빈 문자열 처리', () => {
    expect(escapeRegex('')).toBe('');
  });

  test('이스케이프된 문자열로 RegExp 생성 시 정상 동작', () => {
    const userInput = 'file.name (copy)';
    const escaped = escapeRegex(userInput);
    const regex = new RegExp(escaped, 'i');

    expect(regex.test('file.name (copy)')).toBe(true);
    expect(regex.test('filexname xcopy)')).toBe(false);
  });

  test('ReDoS 패턴이 literal로 변환됨', () => {
    const malicious = '(a+)+$';
    const escaped = escapeRegex(malicious);
    const regex = new RegExp(escaped, 'i');

    // literal 매칭만 수행하므로 원본 패턴 문자열에만 일치
    expect(regex.test('(a+)+$')).toBe(true);
    expect(regex.test('aaaaaaaaaaaaaaa')).toBe(false);
  });
});
