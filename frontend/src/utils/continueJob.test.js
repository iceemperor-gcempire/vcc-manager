/**
 * 계속하기 페이로드 계약 (#792 · #808)
 *
 * 이 계약이 두 번 깨졌다. #762 가 JobHistoryPanel 만 고쳐 사이드바에서 재발했고(#792),
 * 그때 페이로드 생성을 utils/continueJob 으로 모았다. 이제 러너가 생겼으니 고정한다.
 *
 * 핵심은 sameWorkboard 플래그다 — 이게 없으면 ImageGeneration 이 #673 의
 * 크로스 안전조건을 같은 작업판에도 적용해, 작업판 기본값이 히스토리의 실사용 모델을 덮는다.
 */
import {
  buildSameWorkboardContinue,
  buildCrossWorkboardContinue,
  buildWorkboardPickerContinue,
} from './continueJob';

const job = {
  inputData: { additionalParams: { base_model: 'HISTORY_MODEL' } },
  resultVideos: [{ _id: 'v1' }],
};
const workboard = { _id: 'WB1' };

// ImageGeneration.js 의 prefill 판정을 그대로 재현
const allowPrefill = (payload, bmHasDefault, wbOutputFormat) => {
  const same = payload.sameWorkboard === true;
  const prev = payload.prevOutputFormat || null;
  return same || (!(prev && prev !== wbOutputFormat) && !bmHasDefault);
};

describe('계속하기 페이로드 (#792)', () => {
  test('같은 작업판은 sameWorkboard: true', () => {
    const p = buildSameWorkboardContinue({ workboardId: 'WB1', workboard, job });
    expect(p.sameWorkboard).toBe(true);
    expect(p.inputData).toBe(job.inputData);
    expect(p.prevOutputFormat).toBe('video');
  });

  test('다른 작업판으로 이어가기는 sameWorkboard: false — 명시적이어야 한다', () => {
    const p = buildCrossWorkboardContinue({ workboard, job, lastGeneratedMedia: {} });
    expect(p.sameWorkboard).toBe(false);
  });

  test('작업판 선택 경유는 복원 판단 정보를 담지 않는다', () => {
    const p = buildWorkboardPickerContinue(job);
    expect(p.sameWorkboard).toBeUndefined();
    expect(p.fromJobHistory).toBe(true);
  });

  test('결과가 영상이면 prevOutputFormat 이 video, 아니면 image', () => {
    expect(buildSameWorkboardContinue({ workboardId: 'W', workboard, job }).prevOutputFormat).toBe('video');
    const imgJob = { inputData: {}, resultVideos: [] };
    expect(buildSameWorkboardContinue({ workboardId: 'W', workboard, job: imgJob }).prevOutputFormat).toBe('image');
  });
});

describe('prefill 판정 — #673 안전조건과 #762 복원의 공존', () => {
  const same = buildSameWorkboardContinue({ workboardId: 'WB1', workboard, job });
  const cross = buildCrossWorkboardContinue({ workboard, job, lastGeneratedMedia: {} });
  const picker = buildWorkboardPickerContinue(job);

  test.each([
    ['같은 작업판 · 기본값 있음 (#762 회귀 지점)', same, true, 'video', true],
    ['같은 작업판 · 기본값 없음', same, false, 'video', true],
    ['크로스 · 기본값 있음 (#673 유지)', cross, true, 'video', false],
    ['크로스 · 기본값 없음 · 출력 일치', cross, false, 'video', true],
    ['크로스 · 출력 타입 불일치 (#673 유지)', cross, false, 'image', false],
    ['작업판 선택 경유', picker, true, 'video', false],
  ])('%s', (_label, payload, bmHasDefault, out, expected) => {
    expect(allowPrefill(payload, bmHasDefault, out)).toBe(expected);
  });
});
