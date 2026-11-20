import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { refreshListsOnEnter, invalidateWorkboardQueries, WORKBOARD_QUERY_ROOTS } from './queryInvalidation';

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

// 작업판 화면들이 실제로 쓰는 키 모양 (#498·#1241)
const WORKBOARD_KEYS = [
  ['workboardCatalog', true],
  ['workboardCatalog', false],
  ['adminWorkboard', 'wb1'],
  ['workboard', 'wb1'],
  ['workboards', { limit: 50, isActive: true, search: '' }],
  ['promptWorkboards'],
  ['projectWorkboards', 'p1'],
  ['dashboardWorkboardUsage'],
  ['workboardFavorites'],
  ['adminDefaultValueMetadata', 'wb1'],
  ['allWorkboards'],
  ['allWorkboardsForPicker'],
  ['sequenceWorkboardPicker', ''],
  ['sequencePreviewInputs', '[{"workboardId":"wb1"}]'],
];

describe('invalidateWorkboardQueries (#498·#1241)', () => {
  it('작업판을 보여 주는 쿼리를 모두 무효화한다', () => {
    const qc = seeded(WORKBOARD_KEYS);
    invalidateWorkboardQueries(qc);
    const missed = WORKBOARD_KEYS.filter((key) => !invalidated(qc, key)).map((key) => key[0]);
    expect(missed).toEqual([]);
  });

  it('작업판과 상관없는 쿼리는 건드리지 않는다 — 문자열 키로 넘기면 v5 에서 전부 무효화된다', () => {
    const unrelated = [['userProfile'], ['generatedImages', '', 1, 24, undefined], ['servers'], ['projects', { page: 1 }]];
    const qc = seeded([...WORKBOARD_KEYS, ...unrelated]);
    invalidateWorkboardQueries(qc);
    const touched = unrelated.filter((key) => invalidated(qc, key)).map((key) => key[0]);
    expect(touched).toEqual([]);
  });

  // 작업판을 보여 주는 쿼리를 새로 만들고 목록에 넣지 않으면, 판을 고친 뒤 그 화면이 옛 값을 보인다.
  // v5 전환 뒤로는 전체 무효화가 그걸 가려 왔다 (#1241). 이름에 workboard 가 들어간 키는 목록에 있어야 한다.
  it('소스의 작업판 쿼리 키가 모두 목록에 있다', () => {
    const sources = import.meta.glob('../**/*.{js,jsx}', { query: '?raw', import: 'default', eager: true });
    const roots = new Set();
    Object.entries(sources).forEach(([path, text]) => {
      if (/\.test\.jsx?$/.test(path)) return;
      for (const m of text.matchAll(/queryKey:\s*\[\s*'([A-Za-z0-9_]+)'/g)) roots.add(m[1]);
    });
    const workboardRoots = [...roots].filter((r) => /workboard/i.test(r));
    expect(workboardRoots.length).toBeGreaterThan(5); // 스캔이 비면 이 검사가 헛돈다
    expect(workboardRoots.filter((r) => !WORKBOARD_QUERY_ROOTS.includes(r))).toEqual([]);
  });
});
