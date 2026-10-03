import { describe, expect, test } from 'vitest';
import { needsActionAlert, noticeTitle } from './updateNotice';

describe('업데이트 공지 화면 판단 (#999)', () => {
  test('한 건이면 그 버전, 여러 건이면 범위', () => {
    expect(noticeTitle([{ version: '4.6.0' }])).toBe('v4.6.0 업데이트');
    // 백엔드는 최신순으로 준다
    expect(noticeTitle([{ version: '4.6.0' }, { version: '4.5.1' }])).toBe('업데이트 2건 (v4.5.1 → v4.6.0)');
    expect(noticeTitle([])).toBe('');
  });

  test('"기존 사용자가 할 일" 이 하나라도 있으면 알림', () => {
    expect(needsActionAlert([{ hasActionItems: false }, { hasActionItems: true }])).toBe(true);
    expect(needsActionAlert([{ hasActionItems: false }])).toBe(false);
    expect(needsActionAlert(undefined)).toBe(false);
  });
});
