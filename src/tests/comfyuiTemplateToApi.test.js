/**
 * ComfyUI UI 포맷 → API 포맷 변환기 (#800, #1121) — scripts/comfyui-template-to-api.js
 */
const { graphOf, flattenGraph, verifyWidgets } = require('../../scripts/comfyui-template-to-api');

const OBJECT_INFO = {
  UNETLoader: {
    input: { required: { unet_name: [['a.safetensors']], weight_dtype: [['default', 'fp8_e4m3fn']] } },
  },
  MiniMaxH3SigmaShift: {
    input: { required: { model: ['MODEL', {}], shift_video: ['FLOAT', {}], shift_audio: ['FLOAT', {}] } },
  },
  TextGenerate: {
    input: {
      required: { clip: ['CLIP', {}], prompt: ['STRING', {}], max_length: ['INT', {}] },
      optional: {
        system_prompt: ['STRING', { forceInput: true }],
        thinking: ['BOOLEAN', {}],
      },
    },
  },
};

// 평면 그래프: 최상위 links 는 [id, 출처노드, 출처슬롯, 대상노드, 대상슬롯, 타입] 배열
const FLAT = {
  nodes: [
    { id: 1, type: 'UNETLoader', inputs: [], widgets_values: ['a.safetensors', 'default'] },
    { id: 2, type: 'MiniMaxH3SigmaShift', inputs: [{ name: 'model', link: 7 }], widgets_values: [1, 1] },
    { id: 3, type: 'MarkdownNote', inputs: [], widgets_values: ['메모'] },
  ],
  links: [[7, 1, 0, 2, 0, 'MODEL']],
};

describe('graphOf / flattenGraph — 평면 그래프 (#1121)', () => {
  test('서브그래프가 없으면 최상위 노드·링크를 쓰고 배열 링크를 객체로 맞춘다', () => {
    const g = graphOf(FLAT);
    expect(g.nodes).toHaveLength(3);
    expect(g.links[0]).toEqual({ id: 7, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0, type: 'MODEL' });
    expect(g.inputs).toEqual([]);
  });

  test('링크가 ["출처", 슬롯] 으로 풀리고 메모 노드는 빠진다', () => {
    const { api, hostFed } = flattenGraph(FLAT, OBJECT_INFO);
    expect(Object.keys(api).sort()).toEqual(['1', '2']);
    expect(api['2'].inputs).toEqual({ model: ['1', 0], shift_video: 1, shift_audio: 1 });
    expect(hostFed).toEqual([]);
  });
});

describe('graphOf — 서브그래프 템플릿 (기존 동작)', () => {
  test('서브그래프가 있으면 그 안의 노드·링크를 쓴다', () => {
    const tpl = {
      nodes: [{ id: 99, type: 'uuid-wrapper', inputs: [] }],
      links: [],
      definitions: {
        subgraphs: [{
          nodes: FLAT.nodes.slice(0, 2),
          links: [{ id: 7, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0, type: 'MODEL' }],
          inputs: [],
        }],
      },
    };
    const { api } = flattenGraph(tpl, OBJECT_INFO);
    expect(Object.keys(api).sort()).toEqual(['1', '2']);
    expect(api['2'].inputs.model).toEqual(['1', 0]);
  });
});

describe('forceInput 입력은 위젯 칸을 차지하지 않는다 (#1121)', () => {
  test('TextGenerate.system_prompt 를 건너뛰어 뒤의 값이 밀리지 않는다', () => {
    const tpl = {
      nodes: [{ id: 5, type: 'TextGenerate', inputs: [], widgets_values: ['', 2048, true] }],
      links: [],
    };
    const { api, widgetAudit } = flattenGraph(tpl, OBJECT_INFO);
    expect(api['5'].inputs).toEqual({ prompt: '', max_length: 2048, thinking: true });
    expect(verifyWidgets(widgetAudit)).toEqual([]);
  });
});
