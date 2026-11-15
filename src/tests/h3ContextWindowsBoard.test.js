const fs = require('fs');
const path = require('path');
const { applyOmitDirectives } = require('../utils/workflowDirectives');

// MiniMax H3 I2V 긴 영상 판 (#1108).
// 구간 프롬프트 칸을 비우면 그 구간의 Conditioning (Combine) 을 건너뛰고(_vcc.bypassUnless), 쓰이지 않게 된
// 조건화 노드는 요청에서 빠져야 한다(#1102 pruneOrphans). 채운 구간은 순서대로 묶여야 한다 —
// ComfyUI 의 split_conds_to_windows 는 묶인 순서를 영상의 앞뒤 순서로 읽는다 (get_region_index).

// Turbo 판(별도 판, 사용자 결정 11-15)은 같은 짜임에 FL2V (Turbo) 판의 가속만 얹었다 — 구간·창 검사는 두 판에 똑같이 건다
const load = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, `../../workboards/comfyui/${name}.json`), 'utf8')).workboard;
const BOARDS = [
  ['I2V 긴 영상', load('minimax-h3-i2v-long-context')],
  ['I2V 긴 영상 Turbo', load('minimax-h3-i2v-long-context-turbo')],
];

// 서버가 치환하는 것과 같이 칸 값을 JSON 문자열 안에 넣는다. 나머지 placeholder 는 그대로 둬도
// 이 테스트가 보는 조건(구간 프롬프트)에는 영향이 없다
function render(workboard, segments) {
  let wf = workboard.workflowData;
  for (const n of [2, 3, 4]) {
    wf = wf.split(`{{##prompt_${n}##}}`).join(JSON.stringify(segments[n] || '').slice(1, -1));
  }
  return applyOmitDirectives(JSON.parse(wf)).workflow;
}

const combineOrder = (wf) => {
  // 가이더에서 거슬러 올라가며 묶인 조건화 노드를 앞에서부터 모은다
  const walk = (link) => {
    const node = wf[link[0]];
    if (node.class_type === 'ConditioningCombine') {
      return [...walk(node.inputs.conditioning_1), ...walk(node.inputs.conditioning_2)];
    }
    return [link[0]];
  };
  const guider = Object.values(wf).find((n) => n.class_type === 'BasicGuider');
  return walk(guider.inputs.conditioning);
};

describe.each(BOARDS)('MiniMax H3 %s 판 (#1108)', (_, workboard) => {
  test('구간 프롬프트를 다 비우면 메인 프롬프트 하나만 가이더로 간다', () => {
    const wf = render(workboard, {});
    expect(combineOrder(wf)).toEqual(['104']);
    for (const id of ['105', '106', '107', '120', '121', '122']) expect(wf[id]).toBeUndefined();
  });

  test('채운 구간만 순서대로 묶인다 — 가운데 칸을 비워도 순서가 유지된다', () => {
    const wf = render(workboard, { 2: 'segment two', 4: 'segment "four"\nline' });
    expect(combineOrder(wf)).toEqual(['104', '105', '107']);
    expect(wf['106']).toBeUndefined();
    expect(wf['107'].inputs.prompt).toBe('segment "four"\nline');
  });

  test('구간 4개를 다 채우면 넷 다 순서대로 묶인다', () => {
    const wf = render(workboard, { 2: 'b', 3: 'c', 4: 'd' });
    expect(combineOrder(wf)).toEqual(['104', '105', '106', '107']);
  });

  test('구간마다 같은 첫 프레임·크기·길이로 조건화한다 — 창마다 인물이 첫 프레임을 따르게', () => {
    const wf = render(workboard, { 2: 'b', 3: 'c', 4: 'd' });
    const seg = ['104', '105', '106', '107'].map((id) => wf[id].inputs);
    for (const key of ['first_frame', 'width', 'height', 'length', 'clip', 'vae']) {
      expect(new Set(seg.map((s) => JSON.stringify(s[key]))).size).toBe(1);
    }
  });

  test('Context Windows 가 샘플러·가이더 둘 다에 걸리고 구간 나누기가 켜져 있다', () => {
    const wf = render(workboard, {});
    const cwId = Object.keys(wf).find((id) => wf[id].class_type === 'MiniMaxH3ContextWindows');
    expect(cwId).toBeDefined();
    expect(wf[cwId].inputs.split_conds_to_windows).toBe(true);
    const guider = Object.values(wf).find((n) => n.class_type === 'BasicGuider');
    const scheduler = Object.values(wf).find((n) => n.class_type === 'BasicScheduler');
    expect(guider.inputs.model).toEqual([cwId, 0]);
    expect(scheduler.inputs.model).toEqual([cwId, 0]);
  });

  test('길이 선택지와 창 설정이 H3 의 17k+5 프레임 격자 위에 있다', () => {
    const length = workboard.additionalInputFields.find((f) => f.name === 'length');
    for (const { value } of length.options) expect((Number(value) - 5) % 17).toBe(0);
    const cw = Object.values(JSON.parse(workboard.workflowData)).find((n) => n.class_type === 'MiniMaxH3ContextWindows');
    expect((cw.inputs.context_length - 5) % 17).toBe(0);
    expect((cw.inputs.context_overlap - 5) % 17).toBe(0);
  });
});

describe('MiniMax H3 I2V 긴 영상 Turbo 판 — 가속 (#1108)', () => {
  const [, base] = BOARDS[0];
  const [, turbo] = BOARDS[1];
  const wf = JSON.parse(turbo.workflowData);
  const byClass = (cls) => Object.keys(wf).filter((id) => wf[id].class_type === cls);

  test('모델 경로: UNET → 터보 LoRA → SigmaShift → Sol-Attn → Context Windows (FL2V (Turbo) 판 순서에 창만 덧붙임)', () => {
    const [cw] = byClass('MiniMaxH3ContextWindows');
    const chain = [];
    for (let id = cw; id; id = wf[id].inputs.model && wf[id].inputs.model[0]) chain.push(wf[id].class_type);
    expect(chain).toEqual(['MiniMaxH3ContextWindows', 'BlockSparseAttention', 'MiniMaxH3SigmaShift', 'LoraLoaderModelOnly', 'UNETLoader']);
    const [lora] = byClass('LoraLoaderModelOnly');
    expect(wf[lora].inputs.lora_name).toBe('{{##turbo_lora##}}');
  });

  test('euler 샘플러에 터보 칸(스텝·LoRA·시프트)이 있고 기본값은 8step LoRA · 8스텝 · 시프트 6', () => {
    expect(wf[byClass('KSamplerSelect')[0]].inputs.sampler_name).toBe('euler');
    const field = (name) => turbo.additionalInputFields.find((f) => f.name === name);
    expect(field('steps').defaultValue).toBe('8');
    expect(field('turbo_lora').defaultValue).toMatch(/turbo_8step_v1\.0/);
    expect(field('shift_video').defaultValue).toBe('6');
    // 긴 영상 시험에서 Pika 합본은 8step 보다 느리고 움직임도 줄어 이 판에서는 뺐다
    expect(field('turbo_lora').options.some((o) => /pika/i.test(o.value))).toBe(false);
  });

  test('터보 칸 말고는 원본 긴 영상 판과 칸·AI 프롬프트 지침이 같다', () => {
    const names = (wb) => wb.additionalInputFields.map((f) => f.name).filter((n) => !['steps', 'turbo_lora', 'shift_video'].includes(n));
    expect(names(turbo)).toEqual(names(base));
    expect(turbo.promptGeneratorInstructions).toBe(base.promptGeneratorInstructions);
  });
});
