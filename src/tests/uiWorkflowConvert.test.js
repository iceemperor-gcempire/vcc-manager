/**
 * UI 포맷 → API 포맷 변환 테스트 (#609 P3)
 *
 * 합성 fixture 로 핵심 규칙 검증: widgets_values 순서 매핑, seed 의
 * control_after_generate 소거, Reroute/PrimitiveNode 해석, mute 노드 제외,
 * 서브그래프 재귀 확장("인스턴스ID:내부ID")과 경계 링크/승격 위젯.
 * (실 서버 검증: 3중 중첩 서브그래프 워크플로 변환 → ComfyUI /prompt 실행 성공 — PR 참고)
 */
const { convertUiToApi, detectFormat } = require('../services/workflowConverterService');

const OBJECT_INFO = {
  CheckpointLoaderSimple: { input: { required: { ckpt_name: [['a.safetensors', 'b.safetensors']] } } },
  CLIPTextEncode: { input: { required: { text: ['STRING', { multiline: true }], clip: ['CLIP'] } } },
  KSampler: {
    input: {
      required: {
        model: ['MODEL'],
        seed: ['INT', { default: 0, control_after_generate: true }],
        steps: ['INT', { default: 20 }],
        cfg: ['FLOAT', { default: 8 }],
        positive: ['CONDITIONING'],
        negative: ['CONDITIONING'],
        latent_image: ['LATENT'],
      },
    },
  },
  EmptyLatentImage: { input: { required: { width: ['INT', {}], height: ['INT', {}], batch_size: ['INT', {}] } } },
  VAEDecode: { input: { required: { samples: ['LATENT'], vae: ['VAE'] } } },
  SaveImage: { input: { required: { images: ['IMAGE'], filename_prefix: ['STRING', {}] } } },
};

const link = (id, o, os, t, ts) => [id, o, os, t, ts, '*'];

describe('convertUiToApi (#609 P3)', () => {
  test('objectInfo 없으면 throw', () => {
    expect(() => convertUiToApi({ nodes: [], links: [] }, null)).toThrow(/object_info/);
  });

  test('위젯 매핑 + seed control_after_generate 소거 + 링크 배선', () => {
    const ui = {
      nodes: [
        { id: 1, type: 'CheckpointLoaderSimple', mode: 0, inputs: [], outputs: [], widgets_values: ['a.safetensors'] },
        { id: 2, type: 'CLIPTextEncode', mode: 0, inputs: [{ name: 'clip', link: 10 }], widgets_values: ['hello prompt'] },
        {
          id: 3, type: 'KSampler', mode: 0,
          inputs: [
            { name: 'model', link: 11 },
            { name: 'positive', link: 12 },
            { name: 'negative', link: 13 },
            { name: 'latent_image', link: 14 },
          ],
          // seed 뒤에 UI 전용 'randomize' 가 낀 형태
          widgets_values: [12345, 'randomize', 28, 5.5],
        },
        { id: 4, type: 'EmptyLatentImage', mode: 0, inputs: [], widgets_values: [1024, 768, 1] },
      ],
      links: [
        link(10, 1, 1, 2, 0),
        link(11, 1, 0, 3, 0),
        link(12, 2, 0, 3, 1),
        link(13, 2, 0, 3, 2),
        link(14, 4, 0, 3, 3),
      ],
    };
    const { apiWorkflow, warnings } = convertUiToApi(ui, OBJECT_INFO);

    expect(warnings).toEqual([]);
    expect(apiWorkflow['3'].inputs).toEqual({
      model: ['1', 0],
      seed: 12345,
      steps: 28,
      cfg: 5.5,
      positive: ['2', 0],
      negative: ['2', 0],
      latent_image: ['4', 0],
    });
    expect(apiWorkflow['2'].inputs).toEqual({ text: 'hello prompt', clip: ['1', 1] });
    expect(apiWorkflow['4'].inputs).toEqual({ width: 1024, height: 768, batch_size: 1 });
  });

  test('Reroute 체인 통과 + PrimitiveNode 는 리터럴 + mute 노드 제외', () => {
    const ui = {
      nodes: [
        { id: 1, type: 'CheckpointLoaderSimple', mode: 0, inputs: [], widgets_values: ['a.safetensors'] },
        { id: 5, type: 'Reroute', mode: 0, inputs: [{ name: '', link: 20 }], outputs: [] },
        { id: 6, type: 'PrimitiveNode', mode: 0, inputs: [], widgets_values: ['primitive text'] },
        { id: 2, type: 'CLIPTextEncode', mode: 0, inputs: [{ name: 'clip', link: 21 }, { name: 'text', link: 22, widget: { name: 'text' } }], widgets_values: ['unused'] },
        { id: 9, type: 'SaveImage', mode: 2, inputs: [], widgets_values: ['muted'] },
      ],
      links: [
        link(20, 1, 1, 5, 0),   // ckpt.clip → reroute
        link(21, 5, 0, 2, 0),   // reroute → encode.clip
        link(22, 6, 0, 2, 1),   // primitive → encode.text (converted widget)
      ],
    };
    const { apiWorkflow, warnings } = convertUiToApi(ui, OBJECT_INFO);

    expect(apiWorkflow['2'].inputs.clip).toEqual(['1', 1]); // Reroute 를 관통해 원 출처로
    expect(apiWorkflow['2'].inputs.text).toBe('primitive text'); // Primitive → 리터럴
    expect(apiWorkflow['5']).toBeUndefined(); // 가상 노드 미포함
    expect(apiWorkflow['9']).toBeUndefined(); // mute 제외
    expect(warnings.some((w) => w.includes('비활성'))).toBe(true);
  });

  test('서브그래프 재귀 확장 — 인스턴스ID:내부ID, 경계 링크, 승격 위젯', () => {
    const SG_ID = 'aaaa-bbbb';
    const ui = {
      nodes: [
        { id: 1, type: 'CheckpointLoaderSimple', mode: 0, inputs: [], widgets_values: ['a.safetensors'] },
        {
          id: 7, type: SG_ID, mode: 0,
          // sg.inputs 순서: latent(LATENT — 링크), width(INT — 승격 위젯)
          inputs: [{ name: 'vae', link: 30 }],
          outputs: [{ name: 'IMAGE', links: [31] }],
          widgets_values: [512],
        },
        { id: 8, type: 'SaveImage', mode: 0, inputs: [{ name: 'images', link: 31 }], widgets_values: ['out'] },
      ],
      links: [
        link(30, 1, 2, 7, 0),  // ckpt.vae → 인스턴스 입력 0
        link(31, 7, 0, 8, 0),  // 인스턴스 출력 0 → SaveImage
      ],
      definitions: {
        subgraphs: [{
          id: SG_ID,
          name: 'sg',
          inputNode: { id: -10 },
          outputNode: { id: -20 },
          inputs: [
            { id: 'i1', name: 'vae', type: 'VAE', linkIds: [100] },
            { id: 'i2', name: 'width', type: 'INT', linkIds: [101] },
          ],
          outputs: [{ id: 'o1', name: 'IMAGE', type: 'IMAGE', linkIds: [103] }],
          nodes: [
            { id: 40, type: 'EmptyLatentImage', mode: 0, inputs: [{ name: 'width', link: 101, widget: { name: 'width' } }], widgets_values: [0, 768, 1] },
            { id: 41, type: 'VAEDecode', mode: 0, inputs: [{ name: 'samples', link: 102 }, { name: 'vae', link: 100 }] },
          ],
          links: [
            { id: 100, origin_id: -10, origin_slot: 0, target_id: 41, target_slot: 1 },
            { id: 101, origin_id: -10, origin_slot: 1, target_id: 40, target_slot: 0 },
            { id: 102, origin_id: 40, origin_slot: 0, target_id: 41, target_slot: 0 },
            { id: 103, origin_id: 41, origin_slot: 0, target_id: -20, target_slot: 0 },
          ],
        }],
      },
    };
    const { apiWorkflow, warnings } = convertUiToApi(ui, OBJECT_INFO);

    expect(warnings).toEqual([]);
    // 인스턴스 자체는 없고 내부 노드가 "7:40", "7:41" 로 확장
    expect(apiWorkflow['7']).toBeUndefined();
    expect(Object.keys(apiWorkflow).sort()).toEqual(['1', '7:40', '7:41', '8']);
    // 경계: 내부 vae ← 외부 ckpt 출력 / 내부 width ← 인스턴스 승격 위젯(512)
    expect(apiWorkflow['7:41'].inputs.vae).toEqual(['1', 2]);
    expect(apiWorkflow['7:40'].inputs.width).toBe(512);
    // 외부: SaveImage.images ← 서브그래프 출력의 내부 원 출처
    expect(apiWorkflow['8'].inputs.images).toEqual(['7:41', 0]);
  });

  test('detectFormat — ui/api 구분', () => {
    expect(detectFormat({ nodes: [], links: [] })).toBe('ui');
    expect(detectFormat({ 1: { class_type: 'KSampler', inputs: {} } })).toBe('api');
  });
});
