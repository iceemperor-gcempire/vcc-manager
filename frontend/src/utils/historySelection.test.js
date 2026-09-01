import { describe, test, expect } from 'vitest';
import { isSelectable, selectableIds, toggleId, toggleAll, pruneSelection } from './historySelection';

const items = [
  { id: 'a', kind: 'job', type: 'image', status: 'done' },
  { id: 'b', kind: 'job', type: 'video', status: 'error' },
  { id: 'c', kind: 'job', type: 'audio', status: 'running' },   // 처리 중 — 제외
  { id: 'd', kind: 'conv', type: 'text', status: 'done' },      // 대화 — 제외
  { id: 'e', kind: 'run', type: 'pipeline', status: 'done' },   // 파이프라인 — 제외
];

describe('historySelection (#902)', () => {
  test('선택 가능: 처리 중이 아닌 미디어 job 만', () => {
    expect(selectableIds(items)).toEqual(['a', 'b']);
    expect(isSelectable(null)).toBe(false);
  });

  test('toggleId 는 새 Set 을 돌려준다', () => {
    const s0 = new Set();
    const s1 = toggleId(s0, 'a'); expect([...s1]).toEqual(['a']); expect(s0.size).toBe(0);
    expect(toggleId(s1, 'a').size).toBe(0);
  });

  test('toggleAll: 일부/없음 → 전부, 전부 → 없음', () => {
    expect([...toggleAll(new Set(), items)]).toEqual(['a', 'b']);
    expect([...toggleAll(new Set(['a']), items)]).toEqual(['a', 'b']);
    expect(toggleAll(new Set(['a', 'b']), items).size).toBe(0);
  });

  test('pruneSelection: 사라진 항목 제거, 변화 없으면 같은 Set', () => {
    const s = new Set(['a', 'b', 'zzz']);
    const p = pruneSelection(s, items);
    expect([...p]).toEqual(['a', 'b']);
    expect(pruneSelection(p, items)).toBe(p);
  });
});
