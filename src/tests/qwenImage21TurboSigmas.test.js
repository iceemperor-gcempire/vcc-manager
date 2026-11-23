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

  test('공식 Turbo 파일 이름으로 판정한다 — 폴더·구분자·대소문자와 무관, 다른 이름은 일반 일정', () => {
    const [, sampler] = one('SamplerCustomAdvanced');
    const cmp = wf[wf[sampler.inputs.sigmas[0]].inputs.switch[0]];
    expect(cmp.class_type).toBe('RegexMatch');
    expect(cmp.inputs).toMatchObject({ string: '{{##base_model##}}', case_insensitive: true, multiline: false, dotall: false });
    // 실제 판정을 재현한다 — 치환된 모델 이름에 노드의 정규식을 건다
    const isTurbo = (model) => new RegExp(cmp.inputs.regex_pattern, 'i').test(model);
    for (const m of [
      'qwen\\qwen_image_2.1_turbo_int8_convrot.safetensors',
      'qwen\\qwen_image_2.1_turbo_bf16.safetensors',
      'qwen/qwen_image_2.1_turbo_int8_convrot.safetensors',
      'qwen/official/qwen_image_2.1_turbo_bf16.safetensors',
      'Qwen\\Qwen_Image_2.1_Turbo_int8_convrot.safetensors',
      'qwen_image_2.1_turbo_int8_convrot.safetensors',
    ]) expect([m, isTurbo(m)]).toEqual([m, true]);
    const base = board.additionalInputFields.find((f) => f.name === 'base_model').defaultValue;
    for (const m of [
      base,
      'qwen\\qwen_image_2.1_int8_convrot.safetensors',
      'qwen\\my_qwen_image_2.1_turbo_int8_convrot.safetensors',
      'qwen\\qwen_image_2.1_turbo_int8_convrot.safetensors.bak',
      'qwen\\qwen_image_2.1_turbo_bf16.safetensors;qwen_image_2.1_turbo_int8_convrot.safetensors.x',
      'qwen\\qwen_image_2x1_turbo_bf16.safetensors',
      'qwen\\qwen-image-2.1-UC-int8_convrot.safetensors',
    ]) expect([m, isTurbo(m)]).toEqual([m, false]);
  });

  test('배선 — 출력 슬롯 0 을 쓰고, 노이즈·가이더·샘플러 선택·일정이 샘플러에 물린다', () => {
    const [, sampler] = one('SamplerCustomAdvanced');
    const sw = wf[sampler.inputs.sigmas[0]];
    for (const link of [sampler.inputs.sigmas, sw.inputs.switch, sw.inputs.on_true, sw.inputs.on_false]) {
      expect(link).toHaveLength(2);
      expect(link[1]).toBe(0);
    }
    expect(sampler.inputs.noise).toEqual([one('RandomNoise')[0], 0]);
    expect(sampler.inputs.guider).toEqual([one('CFGGuider')[0], 0]);
    expect(sampler.inputs.sampler).toEqual([one('KSamplerSelect')[0], 0]);
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

// 공식 모델 카드(Qwen/Qwen-Image-2.1 "Supported Aspect Ratios")의 2K 크기 7가지 (#1278)
const OFFICIAL_2K_SIZES = ['2048x2048', '2400x1792', '1792x2400', '2528x1696', '1696x2528', '2752x1536', '1536x2752'];

describe('text-to-image-qwen-image-21 크기 선택지', () => {
  const board = load('text-to-image-qwen-image-21');
  const field = board.additionalInputFields.find((f) => f.name === 'image_size');
  const values = field.options.map((o) => o.value);

  test('공식 2K 크기 7가지를 모두 고를 수 있다', () => {
    for (const size of OFFICIAL_2K_SIZES) expect(values).toContain(size);
  });

  test('모든 크기는 "가로x세로" 형식이고 32 의 배수이며 겹치지 않는다', () => {
    expect(new Set(values).size).toBe(values.length);
    for (const v of values) {
      expect(v).toMatch(/^\d+x\d+$/);
      const [w, h] = v.split('x').map(Number);
      expect(w % 32).toBe(0);
      expect(h % 32).toBe(0);
    }
  });

  test('선택지 이름은 값으로 시작한다 — 이름과 실제 크기가 어긋나지 않게', () => {
    for (const o of field.options) expect(o.key.startsWith(`${o.value} `)).toBe(true);
  });

  test('기본 크기는 1MP 그대로다', () => {
    expect(field.defaultValue).toBe('1024x1024');
  });

  test('빈 latent 가 고른 크기를 그대로 받는다', () => {
    const wf = JSON.parse(board.workflowData);
    const latent = Object.values(wf).filter((n) => n.class_type === 'EmptyLatentImage');
    expect(latent).toHaveLength(1);
    expect(latent[0].inputs).toMatchObject({ width: '{{##width##}}', height: '{{##height##}}' });
  });
});
