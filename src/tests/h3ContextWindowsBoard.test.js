const fs = require('fs');
const path = require('path');
const { applyOmitDirectives } = require('../utils/workflowDirectives');

// MiniMax H3 I2V 긴 영상 판 (#1108).
// 구간 프롬프트 칸을 비우면 그 구간의 Conditioning (Combine) 을 건너뛰고(_vcc.bypassUnless), 쓰이지 않게 된
// 조건화 노드는 요청에서 빠져야 한다(#1102 pruneOrphans). 채운 구간은 순서대로 묶여야 한다 —
// ComfyUI 의 split_conds_to_windows 는 묶인 순서를 영상의 앞뒤 순서로 읽는다 (get_region_index).

const FILE = path.join(__dirname, '../../workboards/comfyui/minimax-h3-i2v-long-context.json');
const exported = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const { workboard } = exported;

// 서버가 치환하는 것과 같이 칸 값을 JSON 문자열 안에 넣는다. 나머지 placeholder 는 그대로 둬도
// 이 테스트가 보는 조건(구간 프롬프트)에는 영향이 없다
function render(segments) {
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

describe('MiniMax H3 I2V 긴 영상 판 (#1108)', () => {
  test('구간 프롬프트를 다 비우면 메인 프롬프트 하나만 가이더로 간다', () => {
    const wf = render({});
    expect(combineOrder(wf)).toEqual(['104']);
    for (const id of ['105', '106', '107', '120', '121', '122']) expect(wf[id]).toBeUndefined();
  });

  test('채운 구간만 순서대로 묶인다 — 가운데 칸을 비워도 순서가 유지된다', () => {
    const wf = render({ 2: 'segment two', 4: 'segment "four"\nline' });
    expect(combineOrder(wf)).toEqual(['104', '105', '107']);
    expect(wf['106']).toBeUndefined();
    expect(wf['107'].inputs.prompt).toBe('segment "four"\nline');
  });

  test('구간 4개를 다 채우면 넷 다 순서대로 묶인다', () => {
    const wf = render({ 2: 'b', 3: 'c', 4: 'd' });
    expect(combineOrder(wf)).toEqual(['104', '105', '106', '107']);
  });

  test('구간마다 같은 첫 프레임·크기·길이로 조건화한다 — 창마다 인물이 첫 프레임을 따르게', () => {
    const wf = render({ 2: 'b', 3: 'c', 4: 'd' });
    const seg = ['104', '105', '106', '107'].map((id) => wf[id].inputs);
    for (const key of ['first_frame', 'width', 'height', 'length', 'clip', 'vae']) {
      expect(new Set(seg.map((s) => JSON.stringify(s[key]))).size).toBe(1);
    }
  });

  test('Context Windows 가 샘플러·가이더 둘 다에 걸리고 구간 나누기가 켜져 있다', () => {
    const wf = render({});
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
