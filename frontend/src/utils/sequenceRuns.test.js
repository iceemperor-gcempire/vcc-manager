import { describe, test, expect } from 'vitest';
import {
  runStatusMeta, runProgress, retryStartIndex, blockedSummary, stepGroupGaps,
  toEditorState, buildSequencePayload, newEditorStep, moveItem, isRunInProgress,
} from './sequenceRuns';

describe('실행 상태 표시', () => {
  test('알려진 상태는 라벨·톤, 모르는 값은 그대로 중립', () => {
    expect(runStatusMeta('failed')).toEqual({ label: '실패', tone: 'error' });
    expect(runStatusMeta('weird')).toEqual({ label: 'weird', tone: 'neutral' });
  });

  test('진행 중 판정과 진행률', () => {
    expect(isRunInProgress({ status: 'pending' })).toBe(true);
    expect(isRunInProgress({ status: 'failed' })).toBe(false);
    expect(runProgress({ steps: [{ status: 'completed' }, { status: 'running' }, { status: 'pending' }] }))
      .toEqual({ done: 1, total: 3, pct: 33 });
    expect(runProgress({})).toEqual({ done: 0, total: 0, pct: 0 });
  });
});

describe('retryStartIndex', () => {
  test('완료되지 않은 첫 단계부터', () => {
    expect(retryStartIndex({ status: 'failed', steps: [{ status: 'completed' }, { status: 'failed' }, { status: 'skipped' }] })).toBe(1);
  });

  test('접근 문제로 전부 건너뜀이어도 다시 시작할 수 있다', () => {
    expect(retryStartIndex({ status: 'failed', steps: [{ status: 'skipped' }, { status: 'skipped' }] })).toBe(0);
  });

  test('실패가 아니면 -1', () => {
    expect(retryStartIndex({ status: 'completed', steps: [{ status: 'completed' }] })).toBe(-1);
    expect(retryStartIndex(null)).toBe(-1);
  });
});

describe('blockedSummary', () => {
  test('막힌 단계를 번호와 사유로', () => {
    expect(blockedSummary({ steps: [{ blocked: null }, { blocked: 'no_access' }] })).toBe('2단계 작업판 접근 권한 없음');
    expect(blockedSummary({ steps: [] })).toBe('단계가 없습니다');
    expect(blockedSummary({ steps: [{ blocked: null }] })).toBe('');
  });
});

describe('stepGroupGaps', () => {
  test('populate 된 그룹과 id 를 섞어도 빠진 그룹만', () => {
    const wb = { allowedGroupIds: [{ _id: 'g1', name: 'A' }, 'g3'] };
    expect(stepGroupGaps(wb, ['g1', 'g2', 'g3'])).toEqual(['g2']);
    expect(stepGroupGaps(null, ['g1'])).toEqual([]);
  });

  test('작업판 접근 그룹 정보가 없으면 경고하지 않는다', () => {
    expect(stepGroupGaps({ name: 'x' }, ['g1'])).toEqual([]);
    expect(stepGroupGaps({ allowedGroupIds: [] }, ['g1'])).toEqual(['g1']);
  });
});

describe('편집기 상태 ↔ 저장 본문', () => {
  const managed = {
    name: '절차',
    description: '설명',
    isActive: false,
    allowedGroupIds: [{ _id: 'g1', name: 'A' }],
    steps: [
      { _id: 's1', workboardId: 'w1', workboard: { _id: 'w1', name: 'LLM' }, inputs: { tone: '차분' }, contextDocIds: ['d1'], systemPromptDocId: 'd2', note: '메모' },
    ],
  };

  test('단계 _id 를 돌려보내고 표시용 필드는 뺀다', () => {
    const payload = buildSequencePayload(toEditorState(managed));
    expect(payload).toEqual({
      name: '절차',
      description: '설명',
      isActive: false,
      allowedGroupIds: ['g1'],
      steps: [{ _id: 's1', workboardId: 'w1', autoInject: true, inputs: { tone: '차분' }, contextDocIds: ['d1'], systemPromptDocId: 'd2', note: '메모' }],
    });
  });

  test('새 단계는 _id 없이, 이름·설명은 trim', () => {
    const form = { ...toEditorState(null), name: '  새 절차 ', steps: [newEditorStep({ _id: 'w9', name: '이미지' })] };
    const payload = buildSequencePayload(form);
    expect(payload.name).toBe('새 절차');
    expect(payload.steps[0]).toEqual({ workboardId: 'w9', autoInject: true, inputs: {}, contextDocIds: [], systemPromptDocId: undefined, note: '' });
  });

  test('새 단계마다 다른 clientKey', () => {
    expect(newEditorStep({ _id: 'w' }).clientKey).not.toBe(newEditorStep({ _id: 'w' }).clientKey);
  });
});

describe('moveItem', () => {
  test('옮긴 새 배열, 범위 밖은 원본 그대로', () => {
    const list = ['a', 'b', 'c'];
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(list, 2, 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(list).toEqual(['a', 'b', 'c']);
  });
});
