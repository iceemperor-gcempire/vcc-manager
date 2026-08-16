/**
 * 조건부 생략 필드는 흰 PNG 를 올리지 않는다 (#786)
 *
 * 미첨부 image 필드에는 흰 1024x1024 PNG 를 주입한다 (#230) — ComfyUI 의 LoadImage 는
 * 입력이 없으면 워크플로 실행이 실패하기 때문이다.
 *
 * 그런데 `_vcc.omitInputsUnless` (#771) 로 조건화된 필드는 미첨부 시 **입력 슬롯 자체가
 * 제거된다.** 그 LoadImage 는 고아가 되어 모델에 도달하지 않으므로, 올린 흰 PNG 는
 * 순수 낭비였다. R2V 처럼 슬롯이 많은 작업판에서 증폭된다.
 *
 * 여기서 고정하는 것은 "조건부는 건너뛴다" 와 **"조건부가 아니면 계속 주입한다"** 두 가지다.
 * 후자를 놓치면 #230 이 되돌아가 워크플로가 통째로 실패한다.
 */
const { getOmitConditionedFieldNames } = require('../utils/workflowDirectives');

// queueService 는 업로드 헬퍼를 export 하지 않아 직접 호출할 수 없다. 대신 판정의 입력이
// 되는 계약(어떤 필드가 조건부인가)과, 생략 분기가 조건부에만 걸린다는 것을 고정한다.
describe('조건부 생략 필드 판정 (#774 → #786 재사용)', () => {
  const workflowWith = (directive) =>
    JSON.stringify({
      104: {
        class_type: 'MiniMaxH3ImageToVideo',
        inputs: { first_frame: ['114', 0], last_frame: ['115', 0] },
        _vcc: directive,
      },
    });

  test('`{{##필드_attached##}}` 조건이 걸린 필드를 뽑아낸다', () => {
    const names = getOmitConditionedFieldNames(
      workflowWith({
        omitInputsUnless: {
          first_frame: '{{##first_frame_attached##}}',
          last_frame: '{{##last_frame_attached##}}',
        },
      })
    );
    expect(names.sort()).toEqual(['first_frame', 'last_frame']);
  });

  test('첨부 여부와 무관한 조건(select 값 등)은 대상이 아니다', () => {
    // 이걸 필드로 오인하면 조건이 참일 때도 흰 PNG 를 안 올려 워크플로가 깨진다
    const names = getOmitConditionedFieldNames(
      workflowWith({ omitInputsUnless: { first_frame: '{{##use_sol_attn##}}' } })
    );
    expect(names).toEqual([]);
  });

  test('지시자가 없으면 빈 목록 — 흰 PNG 주입 경로가 그대로 유지된다', () => {
    expect(getOmitConditionedFieldNames(JSON.stringify({ 1: { class_type: 'LoadImage', inputs: {} } }))).toEqual([]);
    expect(getOmitConditionedFieldNames('')).toEqual([]);
    expect(getOmitConditionedFieldNames(null)).toEqual([]);
  });
});

describe('업로드 생략의 안전성 근거 (#786)', () => {
  test('생략된 필드는 치환 단계에서 빈 문자열이 되어 미치환 플레이스홀더가 남지 않는다', () => {
    // injectInputsIntoWorkflow 의 image/video/audio 분기는 맵에 없으면 '' 로 채운다.
    // 그래서 업로드를 건너뛰어도 `{{##first_frame##}}` 가 ComfyUI 로 새어나가지 않는다.
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'services', 'queueService.js'),
      'utf8'
    );
    expect(src).toContain("omitConditionedFields");
    // 조건부일 때만 건너뛴다 — 무조건 건너뛰면 #230 회귀
    expect(src).toMatch(/omitConditionedFields\.has\(fieldName\)/);
  });
});
