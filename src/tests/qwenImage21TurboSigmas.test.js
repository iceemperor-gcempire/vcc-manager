const fs = require('fs');
const path = require('path');

// Qwen-Image 2.1 판은 공식 Turbo 모델을 고르면 공식 Turbo 템플릿의 8스텝 시그마로 돈다 (#1278).
// 스텝만 8 로 줄인 simple 일정은 질감이 과하게 거칠어졌다. 일반 모델은 지금까지와 같은 simple 일정이다.
const load = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, `../../workboards/comfyui/${name}.json`), 'utf8')).workboard;
// ComfyUI 공식 템플릿 image_qwen_image_2_1_turbo_t2i 의 ManualSigmas 값
const OFFICIAL_TURBO_SIGMAS = '1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0';

describe.each(['text-to-image-qwen-image-21', 'sketch-to-image-qwen-image-21'])('%s', (name) => {
  const board = load(name);
  const wf = JSON.parse(board.workflowData);
  const one = (t) => {
    const l = Object.entries(wf).filter(([, n]) => n.class_type === t);
    expect(l).toHaveLength(1);
    return l[0];
  };

  test('샘플러가 고른 일정을 받는다 — 공식 Turbo 면 고정 시그마, 아니면 simple', () => {
    const [, sampler] = one('SamplerCustomAdvanced');
    const sw = wf[sampler.inputs.sigmas[0]];
    expect(sw.class_type).toBe('ComfySwitchNode');
    const turbo = wf[sw.inputs.on_true[0]];
    expect(turbo.class_type).toBe('ManualSigmas');
    expect(turbo.inputs.sigmas).toBe(OFFICIAL_TURBO_SIGMAS);
    const normal = wf[sw.inputs.on_false[0]];
    expect(normal.class_type).toBe('BasicScheduler');
    expect(normal.inputs).toMatchObject({ scheduler: 'simple', steps: '{{##steps##}}', denoise: 1 });
  });

  test('공식 Turbo 파일 이름으로 판정한다 (폴더 안 · 폴더 밖 둘 다)', () => {
    const [, sampler] = one('SamplerCustomAdvanced');
    const cmp = wf[wf[sampler.inputs.sigmas[0]].inputs.switch[0]];
    expect(cmp.class_type).toBe('StringContains');
    expect(cmp.inputs.substring).toBe(';{{##base_model##}};');
    const names = cmp.inputs.string.split(';').filter(Boolean);
    expect(names).toEqual(expect.arrayContaining([
      'qwen\\qwen_image_2.1_turbo_int8_convrot.safetensors',
      'qwen_image_2.1_turbo_int8_convrot.safetensors',
    ]));
    for (const n of names) expect(n).toMatch(/qwen_image_2\.1_turbo_/);
    // 일반 모델(판 기본값)은 Turbo 목록에 없다
    const base = board.additionalInputFields.find((f) => f.name === 'base_model').defaultValue;
    expect(names).not.toContain(base);
  });

  test('CFG 1 · 일정과 가이더가 같은 모델을 본다 · 옛 KSampler 는 남지 않는다', () => {
    const [, guider] = one('CFGGuider');
    expect(guider.inputs.cfg).toBe(1);
    const [, basic] = one('BasicScheduler');
    expect(basic.inputs.model).toEqual(guider.inputs.model);
    expect(one('RandomNoise')[1].inputs.noise_seed).toBe('{{##seed##}}');
    expect(Object.values(wf).some((n) => n.class_type === 'KSampler')).toBe(false);
  });
});
