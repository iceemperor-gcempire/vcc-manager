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

    // 배열 = AND (#839). 참조 영상의 사운드트랙이 대표 사례 — "영상이 첨부됐고" AND
    // "소리 스위치가 켜졌을 때"만 조건이 된다. 한쪽만 보면 영상 없이 스위치만 켜진 경우
    // 고아 오디오 링크가 남는다.
    describe('배열 조건 — AND (#839)', () => {
      const audioKey = 'ref_video_audios.ref_video_audio_0';

      test.each([
        [[1, true], true],          // 영상 있음 + 스위치 on → 유지
        [[1, false], false],        // 영상 있음 + 스위치 off → 제거 (무음 참조)
        [[0, true], false],         // 영상 없음 + 스위치 on → 제거 (고아 방지)
        [[0, false], false],
        [['1', 'true'], true],      // 치환 결과가 문자열이어도 동일
        [['1', 'false'], false],
      ])('%j → 유지=%s', (condition, kept) => {
        const wf = { 136: node({ [audioKey]: ['161', 2] }, { [audioKey]: condition }) };
        const { workflow } = applyOmitDirectives(wf);
        expect(Object.prototype.hasOwnProperty.call(workflow['136'].inputs, audioKey)).toBe(kept);
      });

      test('빈 배열은 제거 — 조건 없는 AND 를 "항상 유지" 로 보지 않는다', () => {
        // 빈 배열은 저작 실수다. 항상-유지로 해석하면 지시자를 걸어둔 의도와 반대로 동작한다.
        const wf = { 136: node({ [audioKey]: ['161', 2] }, { [audioKey]: [] }) };
        const { workflow } = applyOmitDirectives(wf);
        expect(workflow['136'].inputs).not.toHaveProperty([audioKey]);
      });
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

  test('배열(AND) 조건 안의 _attached 도 추출한다 (#839)', () => {
    // 사운드트랙 조건이 [영상_attached, 스위치] 배열이 되면서, 배열 원소도 같은 규칙으로
    // 훑어야 영상 필드의 "미첨부 안내" 가 유지된다. 스위치 쪽(_attached 아님)은 무시.
    const s = wf({
      136: {
        class_type: 'X',
        inputs: { 'ref_video_audios.ref_video_audio_0': ['161', 2] },
        _vcc: {
          omitInputsUnless: {
            'ref_video_audios.ref_video_audio_0':
              ['{{##ref_video_1_attached##}}', '{{##use_video_audio_1##}}'],
          },
        },
      },
    });
    expect(getOmitConditionedFieldNames(s)).toEqual(['ref_video_1']);
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

// ---------------------------------------------------------------------------
// #1102 — 끊긴 상류 노드 제거
// 첨부 없는 슬롯의 로더가 파일 이름 "" 로 그래프에 남으면, ComfyUI 가 다음 작업의 캐시 검사에서
// input 폴더 자체를 열려다 윈도에서 Errno 13 경고를 남긴다. vcc 가 끊은 링크의 상류만 지운다.
// ---------------------------------------------------------------------------

describe('끊긴 상류 노드 제거 (#1102)', () => {
  // R2V 판 모양: 이미지 슬롯 3·영상 1(+사운드트랙)·오디오 1
  const r2v = (attached) => ({
    151: { class_type: 'LoadImage', inputs: { image: attached.img1 ? 'a.png' : '' } },
    152: { class_type: 'LoadImage', inputs: { image: '' } },
    153: { class_type: 'LoadImage', inputs: { image: '' } },
    162: { class_type: 'VHS_LoadVideo', inputs: { video: '' } },
    163: { class_type: 'LoadAudio', inputs: { audio: '' } },
    136: {
      class_type: 'MiniMaxH3ReferenceToVideo',
      inputs: {
        'ref_images.ref_image_0': ['151', 0],
        'ref_images.ref_image_1': ['152', 0],
        'ref_images.ref_image_2': ['153', 0],
        'ref_videos.ref_video_0': ['162', 0],
        'ref_video_audios.ref_video_audio_0': ['162', 2],
        'ref_audios.ref_audio_0': ['163', 0],
      },
      _vcc: {
        omitInputsUnless: {
          'ref_images.ref_image_0': attached.img1 ? 1 : 0,
          'ref_images.ref_image_1': 0,
          'ref_images.ref_image_2': 0,
          'ref_videos.ref_video_0': 0,
          'ref_video_audios.ref_video_audio_0': [0, 1],
          'ref_audios.ref_audio_0': 0,
        },
      },
    },
    170: { class_type: 'SaveVideo', inputs: { video: ['136', 0] } },
  });

  test('첨부 없는 슬롯의 로더가 요청에서 빠지고, 첨부한 슬롯의 로더는 남는다', () => {
    const { workflow, pruned } = applyOmitDirectives(r2v({ img1: true }));
    expect(Object.keys(workflow).sort()).toEqual(['136', '151', '170']);
    expect(pruned.map((p) => p.node).sort()).toEqual(['152', '153', '162', '163']);
    expect(pruned.find((p) => p.node === '163').classType).toBe('LoadAudio');
  });

  test('영상과 사운드트랙이 같은 로더를 가리켜도 한 번만 지운다', () => {
    const { pruned } = applyOmitDirectives(r2v({ img1: true }));
    expect(pruned.filter((p) => p.node === '162')).toHaveLength(1);
  });

  test('조건이 모두 truthy 면 아무것도 지우지 않는다', () => {
    const { workflow, pruned } = applyOmitDirectives({
      114: { class_type: 'LoadImage', inputs: { image: 'a.png' } },
      104: {
        class_type: 'MiniMaxH3ImageToVideo',
        inputs: { first_frame: ['114', 0] },
        _vcc: { omitInputsUnless: { first_frame: 1 } },
      },
    });
    expect(workflow['114']).toBeDefined();
    expect(pruned).toEqual([]);
  });

  test('상류로 따라 올라가며 지운다 — 로더 → 크기 조정 → 끊김', () => {
    const { workflow, pruned } = applyOmitDirectives({
      900: { class_type: 'LoadImage', inputs: { image: '' } },
      901: { class_type: 'ImageScale', inputs: { image: ['900', 0], width: 512 } },
      104: {
        class_type: 'X',
        inputs: { last_frame: ['901', 0] },
        _vcc: { omitInputsUnless: { last_frame: 0 } },
      },
    });
    expect(workflow['900']).toBeUndefined();
    expect(workflow['901']).toBeUndefined();
    expect(pruned.map((p) => p.node)).toEqual(['901', '900']);
  });

  test('다른 노드가 아직 쓰는 상류는 남는다', () => {
    const { workflow, pruned } = applyOmitDirectives({
      2: { class_type: 'CLIPLoader', inputs: {} },
      4: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0] } },
      104: {
        class_type: 'X',
        inputs: { clip: ['2', 0] },
        _vcc: { omitInputsUnless: { clip: 0 } },
      },
    });
    expect(workflow['2']).toBeDefined();
    expect(pruned).toEqual([]);
  });

  test('두 갈래가 모두 끊기면 공통 상류도 지운다', () => {
    const { workflow } = applyOmitDirectives({
      1: { class_type: 'LoadImage', inputs: { image: '' } },
      2: { class_type: 'ImageScale', inputs: { image: ['1', 0] } },
      3: { class_type: 'ImageInvert', inputs: { image: ['1', 0] } },
      104: {
        class_type: 'X',
        inputs: { a: ['2', 0], b: ['3', 0] },
        _vcc: { omitInputsUnless: { a: 0, b: 0 } },
      },
    });
    expect(Object.keys(workflow)).toEqual(['104']);
  });

  test('우회한 노드의 나머지 입력도 끊긴 링크다 — 업스케일을 끄면 업스케일 모델 로더가 빠진다', () => {
    const { workflow, pruned } = applyOmitDirectives({
      10: { class_type: 'VAEDecode', inputs: {} },
      11: { class_type: 'UpscaleModelLoader', inputs: { model_name: '0' } },
      12: {
        class_type: 'ImageUpscaleWithModel',
        inputs: { upscale_model: ['11', 0], image: ['10', 0] },
        _vcc: { bypassUnless: { condition: '0', passthrough: { 0: 'image' } } },
      },
      13: { class_type: 'SaveImage', inputs: { images: ['12', 0] } },
    });
    expect(workflow['13'].inputs.images).toEqual(['10', 0]);
    expect(workflow['10']).toBeDefined(); // 통과 경로 상류는 재연결돼 남는다
    expect(workflow['11']).toBeUndefined();
    expect(pruned).toEqual([{ node: '11', classType: 'UpscaleModelLoader' }]);
  });

  test('판에 원래부터 있던 미연결 노드와 출력 노드는 건드리지 않는다', () => {
    const { workflow, pruned } = applyOmitDirectives({
      50: { class_type: 'LoadImage', inputs: { image: '' } }, // 원래 아무 데도 안 이어진 노드
      16: { class_type: 'PreviewAny', inputs: { source: ['15', 0] } },
      15: { class_type: 'TextGenerate', inputs: {} },
      114: { class_type: 'LoadImage', inputs: { image: '' } },
      104: {
        class_type: 'X',
        inputs: { first_frame: ['114', 0] },
        _vcc: { omitInputsUnless: { first_frame: 0 } },
      },
    });
    expect(workflow['50']).toBeDefined();
    expect(workflow['16']).toBeDefined();
    expect(workflow['114']).toBeUndefined();
    expect(pruned).toEqual([{ node: '114', classType: 'LoadImage' }]);
  });

  test('워크플로에 없는 노드를 가리키던 링크를 끊어도 안전', () => {
    const { pruned } = applyOmitDirectives({
      104: { class_type: 'X', inputs: { a: ['999', 0] }, _vcc: { omitInputsUnless: { a: 0 } } },
    });
    expect(pruned).toEqual([]);
  });
});
