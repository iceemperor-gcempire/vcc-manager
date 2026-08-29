const fs = require('fs');
const path = require('path');
const { JOB_MEMO_MAX_LENGTH, normalizeJobMemo } = require('../constants/jobMemo');

/**
 * #879 — 메모 길이 상한 백엔드 ↔ 프론트 mirror 동기화 + 정규화 규칙.
 * (builtinTagsMirror.test.js 와 같은 single-source-of-truth 정책)
 */
describe('jobMemo 상수 mirror 동기화 (#879)', () => {
  test('프론트 mirror 의 상한이 백엔드와 일치', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../frontend/src/constants/jobMemo.js'), 'utf8');
    const m = src.match(/JOB_MEMO_MAX_LENGTH\s*=\s*(\d+)/);
    expect(m).toBeTruthy();
    expect(Number(m[1])).toBe(JOB_MEMO_MAX_LENGTH);
  });
});

describe('normalizeJobMemo', () => {
  test('null/undefined 는 빈 메모 (지우기)', () => {
    expect(normalizeJobMemo(undefined)).toEqual({ memo: '', error: null });
    expect(normalizeJobMemo(null)).toEqual({ memo: '', error: null });
  });

  test('개행·탭·연속 공백은 한 칸으로, 앞뒤 공백 제거', () => {
    expect(normalizeJobMemo('  양갈래\n\n소녀   밀밭\t테스트 ').memo).toBe('양갈래 소녀 밀밭 테스트');
  });

  test('상한 초과는 error (정규화 후 길이 기준)', () => {
    const ok = normalizeJobMemo('가'.repeat(JOB_MEMO_MAX_LENGTH));
    expect(ok.error).toBeNull();
    const over = normalizeJobMemo('가'.repeat(JOB_MEMO_MAX_LENGTH + 1));
    expect(over.error).toMatch(/이내/);
    // 공백을 붙여 초과한 것은 정규화로 살아난다
    expect(normalizeJobMemo('가'.repeat(JOB_MEMO_MAX_LENGTH) + '   ').error).toBeNull();
  });

  test('문자열이 아니면 error', () => {
    expect(normalizeJobMemo(123).error).toBeTruthy();
    expect(normalizeJobMemo({}).error).toBeTruthy();
  });
});
