import { describe, test, expect } from 'vitest';
import { formatDuration } from './formatDuration';

describe('formatDuration (#879)', () => {
  test('값이 없으면 대시', () => {
    expect(formatDuration(undefined)).toBe('-');
    expect(formatDuration(null)).toBe('-');
    expect(formatDuration(0)).toBe('-');
    expect(formatDuration(-5)).toBe('-');
  });

  test('초 단위', () => {
    expect(formatDuration(999)).toBe('0초');
    expect(formatDuration(45_000)).toBe('45초');
  });

  test('분 단위는 초를 함께', () => {
    expect(formatDuration(92_000)).toBe('1분 32초');
    expect(formatDuration(600_000)).toBe('10분 0초');
  });

  test('시간 단위는 분까지만', () => {
    expect(formatDuration(3_725_000)).toBe('1시간 2분');
  });
});
