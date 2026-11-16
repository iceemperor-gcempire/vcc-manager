import { describe, test, expect } from 'vitest';
import { favoriteIdsFrom, favoriteWorkboardsFrom, workboardRunPath, favoriteToggleMessage } from './workboardFavorites';

describe('작업판 즐겨찾기 helper (#1216)', () => {
  test('응답에서 id Set 과 판 목록을 꺼낸다 — 응답이 비거나 모양이 달라도 빈 값', () => {
    const res = { data: { success: true, data: { workboards: [{ _id: 'a' }, { _id: 'b' }], favoriteIds: ['a', 'b'] } } };
    expect([...favoriteIdsFrom(res)]).toEqual(['a', 'b']);
    expect(favoriteWorkboardsFrom(res).map((w) => w._id)).toEqual(['a', 'b']);
    expect(favoriteIdsFrom(undefined).size).toBe(0);
    expect(favoriteWorkboardsFrom({ data: {} })).toEqual([]);
  });

  test('텍스트 판은 프롬프트 생성 화면, 나머지는 생성 화면으로 연다 — 프로젝트 문맥은 쿼리로 넘긴다', () => {
    expect(workboardRunPath({ _id: 'w1', outputFormat: 'text' })).toBe('/prompt-generate/w1');
    expect(workboardRunPath({ _id: 'w2', outputFormat: 'video' })).toBe('/generate/w2');
    expect(workboardRunPath({ _id: 'w3' })).toBe('/generate/w3');
    expect(workboardRunPath({ _id: 'w4', outputFormat: 'image' }, 'p1')).toBe('/generate/w4?projectId=p1');
  });

  test('토글 알림 문구', () => {
    expect(favoriteToggleMessage(true)).toBe('즐겨찾기에 추가했습니다');
    expect(favoriteToggleMessage(false)).toBe('즐겨찾기에서 뺐습니다');
  });
});
