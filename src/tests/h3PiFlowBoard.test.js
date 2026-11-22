const fs = require('fs');
const path = require('path');

// MiniMax H3 - FL2V (pi-H3) 판 (#1266).
// 「샘플링 스텝」 칸 하나가 어댑터 파일 · 스케줄러 스텝 · max_raw_t · Spark-Attn 스텝을 함께 바꾼다.
// 한 곳이라도 따로 놀면 2스텝 어댑터에 4스텝 스케줄이 걸리는 식으로 조용히 화질이 무너진다.
const board = JSON.parse(fs.readFileSync(path.join(__dirname, '../../workboards/comfyui/minimax-h3-fl2v-pi-h3.json'), 'utf8')).workboard;
const wf = JSON.parse(board.workflowData);
const byType = (t) => Object.entries(wf).filter(([, n]) => n.class_type === t);
const one = (t) => { const l = byType(t); expect(l).toHaveLength(1); return l[0]; };
const field = (name) => board.additionalInputFields.find((f) => f.name === name);

test('스텝 선택지는 2 와 4 뿐이고 기본은 4', () => {
  expect(field('steps').options.map((o) => o.value).sort()).toEqual(['2', '4']);
  expect(field('steps').defaultValue).toBe('4');
});

test('어댑터 파일 이름이 고른 스텝을 따른다 (DWD · loras 폴더 바로 아래)', () => {
  const [, n] = one('Load LakonLab Adapter');
  expect(n.inputs.adapter_name).toBe('pi_h3_{{##steps##}}step_dwd_adapter_int8_convrot.safetensors');
  expect(n.inputs.adapter_strength).toBe(1);
});

test('스케줄러 — 스텝은 선택값, max_raw_t 는 4스텝 0.96 · 2스텝 0.93, 마지막 스텝 배율 0.6', () => {
  const [, s] = one('pi-Flow Scheduler');
  expect(s.inputs.steps).toBe('{{##steps##}}');
  expect(s.inputs.min_raw_t).toBe(0);
  expect(s.inputs.final_step_size_scale).toBe(0.6);
  const sw = wf[s.inputs.max_raw_t[0]];
  expect(sw.class_type).toBe('ComfySwitchNode');
  const cmp = wf[sw.inputs.switch[0]];
  expect(cmp.class_type).toBe('StringCompare');
  expect(cmp.inputs).toMatchObject({ string_a: 'steps={{##steps##}}', string_b: 'steps=4', mode: 'Equal' });
  expect(wf[sw.inputs.on_true[0]].inputs.value).toBe(0.96);
  expect(wf[sw.inputs.on_false[0]].inputs.value).toBe(0.93);
});

test('Spark-Attn 은 끌 수 있고(기본 켬), 스텝을 함께 받는다', () => {
  const [, n] = one('MiniMaxH3SparkAttentionSM120');
  expect(n.inputs.steps).toBe('{{##steps##}}');
  expect(n.inputs.mode).toBe('speed');
  expect(n._vcc.bypassUnless).toEqual({ condition: '{{##use_spark_attn##}}', passthrough: { 0: 'model' } });
  expect(field('use_spark_attn').defaultValue).toBe(true);
});

test('내장 Sol-Attn 은 쓰지 않는다 — pi-H3 영상을 눈에 띄게 떨어뜨린다', () => {
  expect(byType('BlockSparseAttention')).toHaveLength(0);
});

test('영상은 DWD 디코드로, 소리는 오디오 VAE 로 푼다', () => {
  const [samplerId] = one('SamplerCustomAdvanced');
  const [, dwd] = one('DWD Decode');
  expect(dwd.inputs.samples).toEqual([samplerId, 0]);
  expect(byType('VAEDecode')).toHaveLength(0);
  const [, audio] = one('VAEDecodeAudio');
  expect(audio.inputs.samples).toEqual([samplerId, 0]);
});

test('시프트 12/3 · euler', () => {
  expect(one('MiniMaxH3SigmaShift')[1].inputs).toMatchObject({ shift_video: 12, shift_audio: 3 });
  expect(one('KSamplerSelect')[1].inputs.sampler_name).toBe('euler');
});

test('베이스 모델은 pruned 만 — 어댑터가 pruned 모델 모양이라 일반 모델에는 걸리지 않는다', () => {
  expect(board.modelExposurePolicy).toBe('whitelist');
  expect(board.modelWhitelist.length).toBeGreaterThan(0);
  for (const m of board.modelWhitelist) expect(m).toMatch(/fl2va_pruned_/);
  expect(board.modelWhitelist).toContain(field('base_model').defaultValue);
});
