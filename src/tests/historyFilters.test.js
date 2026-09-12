/**
 * 작업 절차 단계 작업의 일반 히스토리 제외 (#952).
 */
const fs = require('fs');
const path = require('path');
const { excludeSequenceStepJobs } = require('../utils/historyFilters');

describe('excludeSequenceStepJobs', () => {
  test('기존 조건을 보존하고 sequenceRunId: null 을 더한다 (필드 없음·null 모두 매칭)', () => {
    const base = { userId: 'u1', $or: [{ a: 1 }] };
    expect(excludeSequenceStepJobs(base)).toEqual({ userId: 'u1', $or: [{ a: 1 }], sequenceRunId: null });
    expect(base).not.toHaveProperty('sequenceRunId');
  });
});

// 사용자 히스토리 목록 네 곳이 모두 필터를 거치는지 소스로 가드한다.
// 한 곳만 빠져도 그 화면에서 작업 절차 결과가 두 번 뜬다.
describe('사용자 히스토리 목록 라우트가 필터를 쓴다', () => {
  const routeBody = (file, marker) => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', file), 'utf8');
    const start = src.indexOf(marker);
    if (start < 0) return null;
    const next = src.indexOf('\nrouter.', start + marker.length);
    return src.slice(start, next < 0 ? undefined : next);
  };

  test.each([
    ['jobs.js', "router.get('/my',"],
    ['conversations.js', "router.get('/my',"],
    ['projects.js', "router.get('/:id/jobs',"],
    ['projects.js', "router.get('/:id/conversations',"],
  ])('%s %s', (file, marker) => {
    const body = routeBody(file, marker);
    expect(body).not.toBeNull();
    expect(body).toContain('excludeSequenceStepJobs(');
  });
});
