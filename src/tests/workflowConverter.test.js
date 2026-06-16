/**
 * #607 ComfyUI 워크플로 파서 + 필요 노드 감지 테스트
 */
const {
  isLinkInput,
  detectFormat,
  parseWorkflow,
  analyzeNodes,
  analyzeWorkflow,
} = require('../services/workflowConverterService');

// 표준 txt2img API 포맷 워크플로 (축약)
const API_WF = {
  '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sdxl.safetensors' } },
  '5': { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
  '6': { class_type: 'CLIPTextEncode', inputs: { text: 'a cat', clip: ['4', 1] } },
  '7': { class_type: 'CLIPTextEncode', inputs: { text: 'blurry', clip: ['4', 1] } },
  '3': {
    class_type: 'KSampler',
    inputs: {
      seed: 12345, steps: 20, cfg: 7,
      model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0],
    },
  },
};

describe('#607 detectFormat', () => {
  test('API 포맷 인식', () => {
    expect(detectFormat(API_WF)).toBe('api');
  });
  test('UI 포맷 인식', () => {
    expect(detectFormat({ nodes: [{ id: 1 }], links: [] })).toBe('ui');
  });
  test('알 수 없는 형식', () => {
    expect(detectFormat({ foo: 'bar' })).toBe('unknown');
    expect(detectFormat(null)).toBe('unknown');
    expect(detectFormat([])).toBe('unknown');
  });
});

describe('#607 isLinkInput', () => {
  const ids = new Set(['3', '4', '5', '6', '7']);
  test('존재하는 노드로의 [id, idx] 는 링크', () => {
    expect(isLinkInput(['4', 0], ids)).toBe(true);
  });
  test('존재하지 않는 노드 id 는 링크 아님(리터럴 2-배열 오인 방지)', () => {
    expect(isLinkInput(['999', 0], ids)).toBe(false);
  });
  test('스칼라 리터럴은 링크 아님', () => {
    expect(isLinkInput('a cat', ids)).toBe(false);
    expect(isLinkInput(12345, ids)).toBe(false);
    expect(isLinkInput(true, ids)).toBe(false);
  });
});

describe('#607 parseWorkflow', () => {
  test('문자열 JSON 도 파싱', () => {
    const parsed = parseWorkflow(JSON.stringify(API_WF));
    expect(parsed.format).toBe('api');
    expect(parsed.nodes).toHaveLength(5);
  });

  test('class_type 수집', () => {
    const parsed = parseWorkflow(API_WF);
    expect(parsed.classTypes.sort()).toEqual(
      ['CLIPTextEncode', 'CheckpointLoaderSimple', 'EmptyLatentImage', 'KSampler'].sort()
    );
  });

  test('링크 vs 리터럴 분류 — KSampler', () => {
    const parsed = parseWorkflow(API_WF);
    const ksampler = parsed.nodes.find((n) => n.classType === 'KSampler');
    const links = ksampler.inputs.filter((i) => i.kind === 'link').map((i) => i.key).sort();
    const lits = ksampler.inputs.filter((i) => i.kind === 'literal').map((i) => i.key).sort();
    expect(links).toEqual(['latent_image', 'model', 'negative', 'positive']);
    expect(lits).toEqual(['cfg', 'seed', 'steps']);
  });

  test('리터럴 입력 후보 수집 (prompt/seed/size/ckpt 등)', () => {
    const parsed = parseWorkflow(API_WF);
    const keys = parsed.literalInputs.map((l) => `${l.classType}.${l.key}`);
    expect(keys).toContain('CheckpointLoaderSimple.ckpt_name');
    expect(keys).toContain('CLIPTextEncode.text');
    expect(keys).toContain('KSampler.seed');
    expect(keys).toContain('EmptyLatentImage.width');
    // 링크 입력은 후보에서 제외
    expect(keys).not.toContain('KSampler.model');
  });

  test('UI 포맷은 명확한 메시지로 거부', () => {
    expect(() => parseWorkflow({ nodes: [], links: [] })).toThrow(/Save \(API Format\)/);
  });

  test('깨진 JSON 거부', () => {
    expect(() => parseWorkflow('{ not json')).toThrow(/파싱 실패/);
  });
});

describe('#607 analyzeNodes (필요/빠진 노드)', () => {
  test('object_info 와 비교해 빠진 커스텀 노드 산출', () => {
    const parsed = parseWorkflow(API_WF);
    // EmptyLatentImage 가 설치 안 된 서버라고 가정
    const objectInfo = {
      CheckpointLoaderSimple: {}, CLIPTextEncode: {}, KSampler: {},
    };
    const r = analyzeNodes(parsed, objectInfo);
    expect(r.missingNodes).toEqual(['EmptyLatentImage']);
    expect(r.installedNodes.sort()).toEqual(['CLIPTextEncode', 'CheckpointLoaderSimple', 'KSampler'].sort());
  });

  test('object_info 없으면 missingNodes=null (판단 불가)', () => {
    const parsed = parseWorkflow(API_WF);
    const r = analyzeNodes(parsed, null);
    expect(r.missingNodes).toBeNull();
    expect(r.requiredNodes.length).toBe(4);
  });

  test('모두 설치돼 있으면 빈 배열', () => {
    const parsed = parseWorkflow(API_WF);
    const objectInfo = { CheckpointLoaderSimple: {}, CLIPTextEncode: {}, KSampler: {}, EmptyLatentImage: {} };
    expect(analyzeNodes(parsed, objectInfo).missingNodes).toEqual([]);
  });
});

describe('#607 analyzeWorkflow (통합)', () => {
  test('커스텀 노드 포함 워크플로의 빠진 노드 감지', () => {
    const wf = {
      ...API_WF,
      '10': { class_type: 'IPAdapterApply', inputs: { weight: 0.8, image: ['4', 0] } },
    };
    const objectInfo = { CheckpointLoaderSimple: {}, CLIPTextEncode: {}, KSampler: {}, EmptyLatentImage: {} };
    const a = analyzeWorkflow(wf, objectInfo);
    expect(a.format).toBe('api');
    expect(a.missingNodes).toEqual(['IPAdapterApply']);
    expect(a.literalInputs.some((l) => l.classType === 'IPAdapterApply' && l.key === 'weight')).toBe(true);
  });
});
