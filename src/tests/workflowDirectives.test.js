const { applyOmitDirectives, isFalsy } = require('../utils/workflowDirectives');

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

const { getOmitConditionedFieldNames } = require('../utils/workflowDirectives');

// #774 — 생성 화면의 "미첨부 시 흰 이미지" 안내를 분기하기 위한 판정.
// 조건부 생략 대상 필드는 흰 이미지가 모델에 도달하지 않으므로 문구가 달라야 한다.

describe('getOmitConditionedFieldNames (#774)', () => {
  const wf = (nodes) => JSON.stringify(nodes);

  test('_attached 조건이 걸린 필드명을 추출', () => {
    const s = wf({
      136: {
        class_type: 'X',
        inputs: { 'ref_images.ref_image_0': ['1', 0] },
        _vcc: { omitInputsUnless: { 'ref_images.ref_image_0': '{{##ref_image_1_attached##}}' } },
      },
    });
    expect(getOmitConditionedFieldNames(s)).toEqual(['ref_image_1']);
  });

  test('여러 노드·여러 슬롯에서 중복 없이 모은다', () => {
    const s = wf({
      1: { _vcc: { omitInputsUnless: { a: '{{##img1_attached##}}', b: '{{##img2_attached##}}' } } },
      2: { _vcc: { omitInputsUnless: { c: '{{##img1_attached##}}' } } },
    });
    expect(getOmitConditionedFieldNames(s).sort()).toEqual(['img1', 'img2']);
  });

  test('비디오 필드도 동일하게 인식 — 슬롯 2개가 한 필드를 공유해도 1건', () => {
    const s = wf({
      1: {
        _vcc: {
          omitInputsUnless: {
            'ref_videos.ref_video_0': '{{##ref_video_1_attached##}}',
            'ref_video_audios.ref_video_audio_0': '{{##ref_video_1_attached##}}',
          },
        },
      },
    });
    expect(getOmitConditionedFieldNames(s)).toEqual(['ref_video_1']);
  });

  test('_attached 형태가 아닌 조건은 제외 — 특정 필드의 첨부 여부와 무관하다', () => {
    const s = wf({ 1: { _vcc: { omitInputsUnless: { a: '{{##mode##}}', b: '1', c: 0 } } } });
    expect(getOmitConditionedFieldNames(s)).toEqual([]);
  });

  test('_vcc 없는 워크플로는 빈 배열', () => {
    expect(getOmitConditionedFieldNames(wf({ 1: { class_type: 'LoadImage', inputs: {} } }))).toEqual([]);
  });

  test('파싱 불가 워크플로는 빈 배열 — 따옴표 없는 플레이스홀더는 _vcc 가 애초에 동작 안 함', () => {
    expect(getOmitConditionedFieldNames('{ "1": { "inputs": { "w": {{##width##}} } } }')).toEqual([]);
  });

  test('빈 입력', () => {
    expect(getOmitConditionedFieldNames('')).toEqual([]);
    expect(getOmitConditionedFieldNames(null)).toEqual([]);
    expect(getOmitConditionedFieldNames(undefined)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// #789 — 조건부 노드 우회 (_vcc.bypassUnless)
// ---------------------------------------------------------------------------

const chain = (condition) => ({
  6: { class_type: 'UNETLoader', inputs: { unet_name: 'h3.safetensors' } },
  200: {
    class_type: 'SolAttnPatch',
    inputs: { model: ['6', 0], tau: 1.3, int8_qk: true },
    _vcc: { bypassUnless: { condition, passthrough: { 0: 'model' } } },
  },
  16: { class_type: 'BasicGuider', inputs: { model: ['200', 0], conditioning: ['104', 0] } },
  9: { class_type: 'BasicScheduler', inputs: { model: ['200', 0], steps: 20 } },
});

describe('조건부 노드 우회 (#789)', () => {
  test('조건이 falsy 면 노드가 사라지고 소비자가 상류로 재연결된다', () => {
    const { workflow, bypassed } = applyOmitDirectives(chain(false));
    expect(workflow['200']).toBeUndefined();
    expect(workflow['16'].inputs.model).toEqual(['6', 0]);
    expect(workflow['9'].inputs.model).toEqual(['6', 0]);
    expect(bypassed).toEqual([{ node: '200', classType: 'SolAttnPatch' }]);
    // 우회와 무관한 입력은 그대로
    expect(workflow['16'].inputs.conditioning).toEqual(['104', 0]);
  });

  test('조건이 truthy 면 노드가 남고 _vcc 만 제거된다', () => {
    const { workflow, bypassed } = applyOmitDirectives(chain(true));
    expect(workflow['200'].class_type).toBe('SolAttnPatch');
    expect(workflow['200']._vcc).toBeUndefined();
    expect(workflow['16'].inputs.model).toEqual(['200', 0]);
    expect(bypassed).toEqual([]);
  });

  test('문자열 "0" / "false" 도 falsy — 체크박스 외 필드 타입 대응', () => {
    expect(applyOmitDirectives(chain('0')).workflow['200']).toBeUndefined();
    expect(applyOmitDirectives(chain('false')).workflow['200']).toBeUndefined();
    expect(applyOmitDirectives(chain('1')).workflow['200']).toBeDefined();
  });

  test('연쇄 우회 — 두 노드를 동시에 끄면 최상류로 직결된다', () => {
    const { workflow } = applyOmitDirectives({
      6: { class_type: 'UNETLoader', inputs: {} },
      200: {
        class_type: 'SolAttnPatch',
        inputs: { model: ['6', 0] },
        _vcc: { bypassUnless: { condition: 0, passthrough: { 0: 'model' } } },
      },
      201: {
        class_type: 'EasyCache',
        inputs: { model: ['200', 0] },
        _vcc: { bypassUnless: { condition: 0, passthrough: { 0: 'model' } } },
      },
      16: { class_type: 'BasicGuider', inputs: { model: ['201', 0] } },
    });
    expect(workflow['200']).toBeUndefined();
    expect(workflow['201']).toBeUndefined();
    expect(workflow['16'].inputs.model).toEqual(['6', 0]);
  });

  test('앞만 끄고 뒤는 켠 경우 — 켠 노드가 최상류를 직접 본다', () => {
    const { workflow } = applyOmitDirectives({
      6: { class_type: 'UNETLoader', inputs: {} },
      200: {
        class_type: 'SolAttnPatch',
        inputs: { model: ['6', 0] },
        _vcc: { bypassUnless: { condition: 0, passthrough: { 0: 'model' } } },
      },
      201: {
        class_type: 'EasyCache',
        inputs: { model: ['200', 0] },
        _vcc: { bypassUnless: { condition: 1, passthrough: { 0: 'model' } } },
      },
      16: { class_type: 'BasicGuider', inputs: { model: ['201', 0] } },
    });
    expect(workflow['200']).toBeUndefined();
    expect(workflow['201'].inputs.model).toEqual(['6', 0]);
    expect(workflow['16'].inputs.model).toEqual(['201', 0]);
  });

  test('통과 입력이 링크가 아니면 우회하지 않는다 — 재연결할 상류가 없다', () => {
    const { workflow, bypassed } = applyOmitDirectives({
      200: {
        class_type: 'SomeNode',
        inputs: { model: 'literal_value' },
        _vcc: { bypassUnless: { condition: 0, passthrough: { 0: 'model' } } },
      },
    });
    expect(workflow['200']).toBeDefined();
    expect(bypassed).toEqual([]);
  });

  test('생략과 우회가 같은 워크플로에 공존', () => {
    const { workflow, omitted, bypassed } = applyOmitDirectives({
      6: { class_type: 'UNETLoader', inputs: {} },
      200: {
        class_type: 'SolAttnPatch',
        inputs: { model: ['6', 0] },
        _vcc: { bypassUnless: { condition: 0, passthrough: { 0: 'model' } } },
      },
      104: {
        class_type: 'MiniMaxH3ImageToVideo',
        inputs: { first_frame: ['114', 0], prompt: 'x' },
        _vcc: { omitInputsUnless: { first_frame: 0 } },
      },
      16: { class_type: 'BasicGuider', inputs: { model: ['200', 0] } },
    });
    expect(workflow['16'].inputs.model).toEqual(['6', 0]);
    expect(workflow['104'].inputs.first_frame).toBeUndefined();
    expect(omitted).toEqual([{ node: '104', input: 'first_frame' }]);
    expect(bypassed).toHaveLength(1);
  });
});
