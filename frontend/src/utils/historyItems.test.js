/**
 * 작업 히스토리 항목 표시 (#805)
 *
 * 오디오 축을 추가했을 때 부제 계산이 "나머지는 파이프라인" 으로 가정하고
 * stepStatuses.length 를 읽어 **목록 전체가 렌더 실패**했다. 사용자에게는
 * "선택이 안 된다" 로 보였지만 실제로는 화면이 죽은 것이었다.
 *
 * 새 미디어 타입이 늘어도 죽지 않는다는 것을 여기서 고정한다.
 */
import { buildHistorySubtitle, MEDIA_ITEM_TYPES } from './historyItems';

describe('부제 계산 — 타입별 (#805)', () => {
  test('이미지: 장수 표시', () => {
    expect(buildHistorySubtitle({ type: 'image', projectName: 'P', model: 'M', res: '512x512', count: 3 }))
      .toBe('P · M · 512x512 · 3장');
  });

  test('영상: 길이 표시', () => {
    expect(buildHistorySubtitle({ type: 'video', model: 'M', res: '864x480', duration: 3.04 }))
      .toBe('M · 864x480 · 3초');
  });

  test('오디오: 해상도 없이 길이만', () => {
    expect(buildHistorySubtitle({ type: 'audio', model: 'MM3', duration: 66.2 }))
      .toBe('MM3 · 66초');
  });

  test('텍스트: 토큰 수', () => {
    expect(buildHistorySubtitle({ type: 'text', model: 'gpt', tokens: 11889 }))
      .toBe('gpt · 11,889 토큰');
  });

  test('파이프라인: 단계 수', () => {
    expect(buildHistorySubtitle({ type: 'pipeline', projectName: 'P', stepStatuses: [1, 2], input: 'hi' }))
      .toBe('P · 2단계 · hi');
  });
});

describe('렌더가 죽지 않는다 (#805 회귀 방지)', () => {
  // 사고의 본질: 새 type 이 파이프라인 분기로 떨어져 undefined.length 로 터졌다
  test.each([
    ['오디오 — 사고 당시 타입', { type: 'audio' }],
    ['아직 없는 타입', { type: 'model3d' }],
    ['타입 없음', {}],
    ['stepStatuses 없는 파이프라인', { type: 'pipeline' }],
    ['빈 객체가 아닌 null', null],
  ])('%s 이어도 던지지 않는다', (_label, item) => {
    expect(() => buildHistorySubtitle(item)).not.toThrow();
    expect(typeof buildHistorySubtitle(item)).toBe('string');
  });

  test('알 수 없는 타입도 있는 정보는 보여준다', () => {
    expect(buildHistorySubtitle({ type: 'model3d', projectName: 'P', model: 'M' })).toBe('P · M');
  });

  test('값이 비면 구분자만 남지 않는다', () => {
    expect(buildHistorySubtitle({ type: 'image' })).toBe('');
    expect(buildHistorySubtitle({ type: 'video', model: 'M' })).toBe('M');
  });
});

describe('미디어 항목 타입 (#805)', () => {
  test('세 축이 모두 클릭 가능', () => {
    expect(MEDIA_ITEM_TYPES).toEqual(['image', 'video', 'audio']);
  });

  test('텍스트·파이프라인은 미디어가 아니다 — 뷰어를 열면 안 된다', () => {
    expect(MEDIA_ITEM_TYPES).not.toContain('text');
    expect(MEDIA_ITEM_TYPES).not.toContain('pipeline');
  });
});
