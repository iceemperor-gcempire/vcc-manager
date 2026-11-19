import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { refreshListsOnEnter } from './queryInvalidation';

// 화면들이 실제로 쓰는 키 모양 그대로 심는다 — prefix 매칭까지 확인하려고.
const CONTENT_LIST_KEYS = [
  ['historyJobs', { page: 1 }],
  ['generatedImages', '', 1, 24, undefined],   // MediaGrid: [키, search, page, pageSize, extra]
  ['uploadedImages', '', 1, 24, undefined],
  ['generatedVideos', '', 1, 24, undefined],
  ['generatedAudios', '', 1, 24, undefined],
  ['uploadedAudios', '', 1, 24, undefined],
  ['generatedTexts', 1, '', ''],               // TextContentPanel: [키, page, search, tagIds]
  ['uploadedTexts', 1, '', ''],
  ['contentCount', 'audioGen'],                // 탭 옆 개수
  ['contentCount', 'textUp'],
];

function seeded(keys) {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } } });
  keys.forEach((key) => qc.setQueryData(key, { seeded: true }));
  return qc;
}

const invalidated = (qc, key) => qc.getQueryState(key)?.isInvalidated === true;

describe('refreshListsOnEnter (#829)', () => {
  it.each(['/content', '/jobs'])('%s 로 들어오면 내 콘텐츠의 모든 목록·개수를 새로 받는다', (path) => {
    const qc = seeded(CONTENT_LIST_KEYS);
    expect(refreshListsOnEnter(qc, path)).toBe(true);
    const missed = CONTENT_LIST_KEYS.filter((key) => !invalidated(qc, key)).map((key) => key[0]);
    expect(missed).toEqual([]);
  });

  it('목록과 상관없는 쿼리는 건드리지 않는다', () => {
    const qc = seeded([['userProfile'], ['workboard', 'abc']]);
    refreshListsOnEnter(qc, '/content');
    expect(invalidated(qc, ['userProfile'])).toBe(false);
    expect(invalidated(qc, ['workboard', 'abc'])).toBe(false);
  });

  it('다른 화면으로 갈 때는 아무것도 무효화하지 않는다', () => {
    const qc = seeded(CONTENT_LIST_KEYS);
    expect(refreshListsOnEnter(qc, '/workboards')).toBe(false);
    expect(CONTENT_LIST_KEYS.some((key) => invalidated(qc, key))).toBe(false);
  });
});
