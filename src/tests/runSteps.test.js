/**
 * 실행 기록 ↔ 정의 단계 일치 판정 (#952).
 */
const { findDefinitionMismatch } = require('../utils/runSteps');

const A = 'a'.repeat(24);
const B = 'b'.repeat(24);
const C = 'c'.repeat(24);

describe('findDefinitionMismatch', () => {
  test('같은 작업판·같은 단계 수 → null (ObjectId·populate 객체 혼용 허용)', () => {
    expect(findDefinitionMismatch(
      [{ workboardId: A }, { workboardId: { _id: B } }],
      [{ workboardId: { _id: A } }, { workboardId: B }],
    )).toBeNull();
  });

  test('단계 작업판 교체 → 그 단계', () => {
    expect(findDefinitionMismatch(
      [{ workboardId: A }, { workboardId: C }],
      [{ workboardId: A }, { workboardId: B }],
    )).toEqual({ stepIndex: 1, reason: 'workboard' });
  });

  test('정의에 단계 추가 → 기록 끝 다음 위치', () => {
    expect(findDefinitionMismatch(
      [{ workboardId: A }, { workboardId: B }, { workboardId: C }],
      [{ workboardId: A }, { workboardId: B }],
    )).toEqual({ stepIndex: 2, reason: 'count' });
  });

  test('정의에서 단계 삭제 → 정의 끝 위치', () => {
    expect(findDefinitionMismatch(
      [{ workboardId: A }],
      [{ workboardId: A }, { workboardId: B }],
    )).toEqual({ stepIndex: 1, reason: 'count' });
  });

  test('같은 작업판이라도 단계를 다시 넣어 _id 가 바뀌면 다른 단계 (#953)', () => {
    const S1 = '1'.repeat(24);
    const S9 = '9'.repeat(24);
    expect(findDefinitionMismatch(
      [{ _id: S9, workboardId: A }],
      [{ stepId: S1, workboardId: A }],
    )).toEqual({ stepIndex: 0, reason: 'step' });
    // 파이프라인(단계 _id·stepId 없음)과 옛 실행 기록(stepId 없음)은 작업판만 본다
    expect(findDefinitionMismatch([{ workboardId: A }], [{ workboardId: A }])).toBeNull();
    expect(findDefinitionMismatch([{ _id: S9, workboardId: A }], [{ workboardId: A }])).toBeNull();
  });

  test('작업판 교체가 단계 수 차이보다 먼저 보고된다', () => {
    expect(findDefinitionMismatch(
      [{ workboardId: C }],
      [{ workboardId: A }, { workboardId: B }],
    )).toEqual({ stepIndex: 0, reason: 'workboard' });
  });
});
