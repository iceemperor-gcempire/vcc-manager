const fs = require('fs');
const path = require('path');
const { applyOmitDirectives } = require('../utils/workflowDirectives');

// MiniMax-H3-Image 판 2개 (#1177). ComfyUI 공식 템플릿(Comfy-Org/workflow_templates 의
// image_minimax_h3_image_t2i · image_minimax_h3_image_edit)을 API 형식으로 옮긴 것이라, 템플릿 값에서
// 벗어나지 않게 샘플링·프롬프트 보강·참조 번호를 고정한다.
const load = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, `../../workboards/comfyui/${name}.json`), 'utf8')).workboard;
const BOARDS = [
  ['Text to Image', load('text-to-image-minimax-h3-image')],
  ['Image Edit', load('image-edit-minimax-h3-image')],
];
const DIT = 'minimax\\minimax_h3_image_pruned_int8_convrot.safetensors';
const byClass = (wf, cls) => Object.keys(wf).filter((id) => wf[id].class_type === cls);

// 서버가 치환하는 것처럼 첨부 여부(…_attached)만 값으로 넣는다. 나머지 placeholder 는 이 검사와 무관하다
function render(workboard, attached) {
  let wf = workboard.workflowData;
  for (const n of [1, 2, 3]) {
    wf = wf.split(`{{##ref_image_${n}_attached##}}`).join(attached.includes(n) ? 'true' : '');
  }
  return applyOmitDirectives(JSON.parse(wf)).workflow;
}

describe.each(BOARDS)('MiniMax-H3-Image %s 판 (#1177)', (_, wb) => {
  const wf = JSON.parse(wb.workflowData);

  test('공식 템플릿 샘플링 — 6스텝 · CFG 1 · euler · simple, 부정 조건은 긍정 조건을 비운 것', () => {
    const [ks] = byClass(wf, 'KSampler');
    expect(wf[ks].inputs).toMatchObject({ steps: 6, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1 });
    const [cond] = byClass(wf, 'MiniMaxH3ImageConditioning');
    const zero = wf[wf[ks].inputs.negative[0]];
    expect(zero.class_type).toBe('ConditioningZeroOut');
    expect(zero.inputs.conditioning).toEqual([cond, 0]);
    expect(wf[ks].inputs.positive).toEqual([cond, 0]);
    expect(wf[ks].inputs.latent_image).toEqual([cond, 1]);
  });

  test('H3-Image 전용 본체·VAE 에, 텍스트 인코더는 H3 영상 판과 같은 파일', () => {
    expect(wb.modelWhitelist).toEqual([DIT]);
    expect(wb.additionalInputFields.find((f) => f.name === 'base_model').defaultValue).toBe(DIT);
    expect(wf[byClass(wf, 'VAELoader')[0]].inputs.vae_name).toBe('minimax\\minimax_h3_image_vae_fp16.safetensors');
    const clips = byClass(wf, 'CLIPLoader').map((id) => wf[id].inputs.clip_name);
    expect(clips).toContain('qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors');
  });

  test('프롬프트 보강 — 템플릿 지시문의 {input text} 에 요청을 넣고, 끄면 요청을 그대로 쓴다', () => {
    const [rep] = byClass(wf, 'StringReplace');
    expect(wf[rep].inputs.find).toBe('{input text}');
    const task = wf[wf[rep].inputs.string[0]].inputs.value;
    expect(task.split('{input text}')).toHaveLength(2);
    const raw = wf[rep].inputs.replace[0];
    expect(wf[raw].inputs.value).toBe('{{##prompt##}}');
    const [sw] = byClass(wf, 'ComfySwitchNode');
    expect(wf[sw].inputs.switch).toBe('{{##prompt_upsampler##}}');
    expect(wf[sw].inputs.on_false).toEqual([raw, 0]);
    expect(wf[wf[sw].inputs.on_true[0]].inputs.key).toBe('expanded_caption');
    // 조건화가 받는 프롬프트는 스위치 출력이다
    expect(wf[byClass(wf, 'MiniMaxH3ImageConditioning')[0]].inputs.prompt).toEqual([sw, 0]);
  });

  test('라이선스 고지 — "Powered by MiniMax-H3-Image" 와 H3 고지가 함께 있다', () => {
    expect(wb.description).toContain('Powered by MiniMax-H3-Image');
    expect(wb.description).toContain('Powered by MiniMax H3');
  });
});

describe('Image Edit - MiniMax-H3-Image — 그림 번호 (#1177)', () => {
  const [, edit] = BOARDS[1];
  const condOf = (wf) => wf[byClass(wf, 'MiniMaxH3ImageConditioning')[0]].inputs;
  const peOf = (wf) => wf[byClass(wf, 'TextGenerateV2')[0]].inputs;
  const imgs = (inputs, prefix) => Object.keys(inputs).filter((k) => k.startsWith(prefix)).sort();

  test('참조가 없으면 고칠 이미지 하나만 <Picture 1> 로 들어간다 — 조건화와 보강 모두', () => {
    const wf = render(edit, []);
    expect(imgs(condOf(wf), 'images.image_')).toEqual(['images.image_1']);
    expect(imgs(peOf(wf), 'images.image')).toEqual(['images.image1']);
  });

  test('참조는 1번 칸부터 차례로 — 앞 칸이 비면 뒤 칸은 빠져 번호가 이어진다', () => {
    let wf = render(edit, [1, 2]);
    expect(imgs(condOf(wf), 'images.image_')).toEqual(['images.image_1', 'images.image_2', 'images.image_3']);
    expect(imgs(peOf(wf), 'images.image')).toEqual(['images.image1', 'images.image2', 'images.image3']);
    wf = render(edit, [1, 3]);
    expect(imgs(condOf(wf), 'images.image_')).toEqual(['images.image_1', 'images.image_2']);
  });

  test('결과 크기는 결과 화소 수로 맞춘 고칠 이미지의 크기다', () => {
    const wf = JSON.parse(edit.workflowData);
    const cond = condOf(wf);
    const size = wf[cond.width[0]];
    expect(size.class_type).toBe('GetImageSize');
    expect(cond.height).toEqual([cond.width[0], 1]);
    expect(size.inputs.image).toEqual(cond['images.image_1']);
    expect(wf[cond['images.image_1'][0]].inputs.megapixels).toBe('{{##edit_megapixels##}}');
  });
});
