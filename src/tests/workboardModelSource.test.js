const { inferBaseModelSource } = require('../utils/workboardModelSource');

describe('inferBaseModelSource (#898)', () => {
  const wf = (nodes) => JSON.stringify(nodes);

  test('CheckpointLoaderSimple 이 소비하면 checkpoints', () => {
    expect(inferBaseModelSource(wf({ 1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: '{{##base_model##}}' } } }))).toBe('checkpoints');
  });

  test('UNETLoader 가 소비하면 diffusion_models', () => {
    expect(inferBaseModelSource(wf({ 6: { class_type: 'UNETLoader', inputs: { unet_name: '{{##base_model##}}', weight_dtype: 'default' } } }))).toBe('diffusion_models');
  });

  test('GGUF 로더도 diffusion_models', () => {
    expect(inferBaseModelSource(wf({ 6: { class_type: 'UnetLoaderGGUF', inputs: { unet_name: '{{##base_model##}}' } } }))).toBe('diffusion_models');
  });

  test('placeholder 를 아무 노드도 안 쓰면 null', () => {
    expect(inferBaseModelSource(wf({ 6: { class_type: 'UNETLoader', inputs: { unet_name: 'fixed.safetensors' } } }))).toBeNull();
  });

  test('알 수 없는 로더면 null (거르지 않음)', () => {
    expect(inferBaseModelSource(wf({ 6: { class_type: 'MyCustomLoader', inputs: { name: '{{##base_model##}}' } } }))).toBeNull();
  });

  test('두 종류가 섞이면 null', () => {
    expect(inferBaseModelSource(wf({
      1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: '{{##base_model##}}' } },
      6: { class_type: 'UNETLoader', inputs: { unet_name: '{{##base_model##}}' } },
    }))).toBeNull();
  });

  test('다른 placeholder 이름도 받는다 / 파싱 실패는 null', () => {
    expect(inferBaseModelSource(wf({ 1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: '{{##ckpt##}}' } } }), '{{##ckpt##}}')).toBe('checkpoints');
    expect(inferBaseModelSource('{not json', '{{##base_model##}}')).toBeNull();
    expect(inferBaseModelSource(null)).toBeNull();
  });

  test('저장소 export 전부에서 base_model 폴더가 추론된다', () => {
    const fs = require('fs'); const path = require('path');
    const dir = path.join(__dirname, '../../workboards/comfyui');
    const results = {};
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const wb = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).workboard;
      const hasBase = (wb.additionalInputFields || []).some((x) => x.type === 'baseModel');
      if (!hasBase) continue;
      results[f] = inferBaseModelSource(wb.workflowData);
      expect(results[f]).not.toBeNull();   // 베이스 모델 필드가 있는 판은 로더가 판별돼야 picker 가 맞게 걸러진다
    }
    expect(Object.keys(results).length).toBeGreaterThan(0);
  });
});
