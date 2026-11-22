const fs = require('fs');
const path = require('path');

// H3 업샘플러를 쓰는 판 (#1176).
// 노드 0.7 대는 0.1 대와 입력이 다르다 — 옛 입력(prompt·lora_strength·clip)이 남거나 새 필수 입력이 빠지면
// ComfyUI 가 요청을 거절한다. 판 다섯 개가 같은 설정으로 맞춰져 있는지 본다.
const load = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, `../../workboards/comfyui/${name}.json`), 'utf8')).workboard;
const BOARDS = [
  'video-upscale-h3-upsampler',
  'minimax-h3-r2v-av1',
  'minimax-h3-r2v-turbo',
  'minimax-h3-r2v-pika-flex',
  'minimax-h3-r2v-prism',
];
// 노드 0.7.3 (44db226) 의 필수 입력
const REQUIRED = [
  'model', 'vae', 'images', 'upscale_model', 'megapixels', 'denoise', 'lora', 'tile_tokens', 'sampler_name', 'redraw_seed',
  'attention', 'chunk_join', 'chunking', 'tiling', 'redraw_start', 'redraw_steps', 'method', 'sharpness', 'face_pass',
];

describe.each(BOARDS)('%s', (name) => {
  const wf = JSON.parse(load(name).workflowData);
  const nodes = Object.values(wf).filter((n) => n.class_type === 'H3VideoUpsampler');

  test('업샘플러 노드가 하나 있고 필수 입력을 모두 채웠다', () => {
    expect(nodes).toHaveLength(1);
    for (const key of REQUIRED) expect(nodes[0].inputs).toHaveProperty(key);
  });

  test('옛 노드의 입력이 남아 있지 않다', () => {
    for (const key of ['prompt', 'lora_strength', 'clip']) expect(nodes[0].inputs).not.toHaveProperty(key);
  });

  test('Regen2K 설정 — LoRA 는 loras 폴더 바로 아래 이름 그대로', () => {
    const i = nodes[0].inputs;
    expect(i.method).toBe('regen2k');
    expect(i.lora).toBe('open_h3_regenerate_2k_r256pp_bf16.safetensors');
    expect(i.upscale_model).toBe('minimax_h3_latent_upscaler_3d_conv_v1_bf16.safetensors');
    expect(i.denoise).toBe(0.8);
    expect(i.redraw_start).toBe(0.6);
  });

  test('소리를 듣고 그리도록 오디오와 오디오 VAE 를 잇는다', () => {
    expect(Array.isArray(nodes[0].inputs.audio)).toBe(true);
    expect(Array.isArray(nodes[0].inputs.audio_vae)).toBe(true);
  });
});

test('업스케일 판에는 쓰지 않는 텍스트 인코더가 없다', () => {
  const wf = JSON.parse(load('video-upscale-h3-upsampler').workflowData);
  expect(Object.values(wf).map((n) => n.class_type)).not.toContain('CLIPLoader');
});
