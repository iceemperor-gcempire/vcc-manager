import { describe, expect, test } from 'vitest';
import { serverSaveFeedback } from './serverSaveFeedback';

describe('서버 저장 결과 알림 (#1013)', () => {
  test('연결 확인 성공이면 성공 알림', () => {
    const r = serverSaveFeedback({ isEdit: false, healthCheck: { status: 'healthy' } });
    expect(r).toEqual({ tone: 'success', message: '서버를 추가했습니다.' });
  });

  test('연결 확인 실패면 저장 사실과 사유를 함께 경고', () => {
    const r = serverSaveFeedback({
      isEdit: true,
      healthCheck: { status: 'unhealthy', errorMessage: 'connect ECONNREFUSED 192.168.1.131:8889' },
    });
    expect(r.tone).toBe('warning');
    expect(r.message).toMatch(/^서버를 수정했습니다\./);
    expect(r.message).toMatch(/ECONNREFUSED/);
  });

  test('사유가 없어도 경고는 나온다', () => {
    const r = serverSaveFeedback({ isEdit: false, healthCheck: { status: 'unhealthy', errorMessage: null } });
    expect(r.tone).toBe('warning');
    expect(r.message).not.toMatch(/\(null\)|\(\)/);
  });

  test('이번에 연결을 확인하지 않은 수정(이름만 변경)은 성공으로 본다', () => {
    expect(serverSaveFeedback({ isEdit: true, healthCheck: null }).tone).toBe('success');
    expect(serverSaveFeedback({ isEdit: true }).tone).toBe('success');
  });
});
