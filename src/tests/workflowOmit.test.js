const { applyOmitDirectives, isFalsy } = require('../utils/workflowOmit');

// #771 — 조건부 입력 생략.
// autogrow 슬롯(ref_images.ref_image_N)을 요청 단위로 없애기 위한 기능이라,
// "점이 들어간 키를 경로가 아닌 리터럴로 다루는가" 가 핵심 계약이다.

const node = (inputs, omitRules) => ({
  class_type: 'MiniMaxH3ReferenceToVideo',
  inputs: { ...inputs },
  ...(omitRules ? { _vcc: { omitInputsUnless: omitRules } } : {}),
});

describe('isFalsy (#771)', () => {
  test('미첨부를 뜻하는 값들', () => {
    for (const v of [0, '0', '', '  ', false, null, undefined, 'false', 'FALSE', 'null']) {
      expect(isFalsy(v)).toBe(true);
    }
  });

  test('첨부를 뜻하는 값들', () => {
    for (const v of [1, '1', true, 'true', 'yes', 'image.png', 2]) {
      expect(isFalsy(v)).toBe(false);
    }
  });

  test('NaN 은 falsy — 숫자 치환 실패를 미첨부로 본다', () => {
    expect(isFalsy(NaN)).toBe(true);
  });
});

describe('applyOmitDirectives (#771)', () => {
  describe('입력 제거', () => {
    test('조건이 falsy 면 해당 입력만 제거', () => {
      const wf = {
        136: node(
          { 'ref_images.ref_image_0': ['137', 0], 'ref_images.ref_image_1': ['139', 0], prompt: 'x' },
          { 'ref_images.ref_image_1': 0 }
        ),
      };
      const { workflow, omitted } = applyOmitDirectives(wf);
      expect(workflow['136'].inputs).toEqual({ 'ref_images.ref_image_0': ['137', 0], prompt: 'x' });
      expect(omitted).toEqual([{ node: '136', input: 'ref_images.ref_image_1' }]);
    });

    test('조건이 truthy 면 유지', () => {
      const wf = {
        136: node({ 'ref_images.ref_image_1': ['139', 0] }, { 'ref_images.ref_image_1': 1 }),
      };
      const { workflow, omitted } = applyOmitDirectives(wf);
      expect(workflow['136'].inputs['ref_images.ref_image_1']).toEqual(['139', 0]);
      expect(omitted).toHaveLength(0);
    });

    test('여러 슬롯을 개별 판정 — 가변 개수의 핵심', () => {
      const wf = {
        136: node(
          {
            'ref_images.ref_image_0': ['1', 0],
            'ref_images.ref_image_1': ['2', 0],
            'ref_images.ref_image_2': ['3', 0],
          },
          {
            'ref_images.ref_image_0': 1,
            'ref_images.ref_image_1': 0,
            'ref_images.ref_image_2': 0,
          }
        ),
      };
      const { workflow, omitted } = applyOmitDirectives(wf);
      expect(Object.keys(workflow['136'].inputs)).toEqual(['ref_images.ref_image_0']);
      expect(omitted).toHaveLength(2);
    });

    test('점이 들어간 키를 경로가 아닌 리터럴로 취급', () => {
      const wf = {
        136: node({ 'ref_images.ref_image_1': ['139', 0] }, { 'ref_images.ref_image_1': 0 }),
      };
      const { workflow } = applyOmitDirectives(wf);
      // ref_images 라는 중첩 객체가 생기거나 남으면 안 된다
      expect(workflow['136'].inputs).toEqual({});
      expect(workflow['136'].inputs.ref_images).toBeUndefined();
    });

    test('존재하지 않는 입력 키를 가리켜도 안전', () => {
      const wf = { 136: node({ prompt: 'x' }, { 'ref_images.ref_image_9': 0 }) };
      const { workflow, omitted } = applyOmitDirectives(wf);
      expect(workflow['136'].inputs).toEqual({ prompt: 'x' });
      expect(omitted).toHaveLength(0);
    });
  });

  describe('_vcc 스트립', () => {
    test('조건이 truthy 여도 _vcc 는 제거된다', () => {
      const wf = { 136: node({ a: 1 }, { a: 1 }) };
      const { workflow } = applyOmitDirectives(wf);
      expect(workflow['136']._vcc).toBeUndefined();
    });

    test('omitInputsUnless 가 없는 _vcc 도 제거', () => {
      const wf = { 1: { class_type: 'X', inputs: {}, _vcc: { somethingElse: true } } };
      const { workflow } = applyOmitDirectives(wf);
      expect(workflow['1']._vcc).toBeUndefined();
    });
  });

  describe('무해한 입력', () => {
    test('_vcc 없는 노드는 그대로', () => {
      const wf = { 1: { class_type: 'LoadImage', inputs: { image: 'a.png' } } };
      const { workflow, omitted } = applyOmitDirectives(wf);
      expect(workflow['1']).toEqual({ class_type: 'LoadImage', inputs: { image: 'a.png' } });
      expect(omitted).toHaveLength(0);
    });

    test('빈/비정상 입력', () => {
      expect(applyOmitDirectives({}).omitted).toHaveLength(0);
      expect(applyOmitDirectives(null).workflow).toBeNull();
      expect(applyOmitDirectives(undefined).omitted).toHaveLength(0);
    });

    test('inputs 가 없는 노드에 지시자가 있어도 죽지 않는다', () => {
      const wf = { 1: { class_type: 'X', _vcc: { omitInputsUnless: { a: 0 } } } };
      expect(() => applyOmitDirectives(wf)).not.toThrow();
      expect(wf['1']._vcc).toBeUndefined();
    });
  });
});
