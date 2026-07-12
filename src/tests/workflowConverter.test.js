/**
 * #607 ComfyUI 워크플로 파서 + 필요 노드 감지 테스트
 */
const {
  isLinkInput,
  detectFormat,
  parseWorkflow,
  analyzeNodes,
  analyzeWorkflow,
  generateDraft,
  collectDeterministicPicks,
  buildDraftFromPicks,
  proposeLlmPicks,
  normalizeManagerMap,
  resolveMissingNodes,
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

describe('#608 generateDraft (결정론적 초안)', () => {
  test('표준 txt2img → 역할 변수 추출 + placeholder 주입', () => {
    const parsed = parseWorkflow(API_WF);
    const draft = generateDraft(parsed, API_WF);
    const byName = Object.fromEntries(draft.additionalInputFields.map((f) => [f.name, f]));

    // 핵심 역할 추출
    expect(byName.base_model?.type).toBe('baseModel');
    expect(byName.base_model?.defaultValue).toBe('sdxl.safetensors');
    expect(byName.prompt).toBeTruthy();
    expect(byName.negative_prompt).toBeTruthy();
    expect(byName.seed?.type).toBe('number');
    expect(byName.width?.type).toBe('number');
    expect(byName.height?.type).toBe('number');

    // positive/negative 판별 (샘플러 추적): 'a cat'=prompt, 'blurry'=negative_prompt
    expect(byName.prompt.defaultValue).toBe('a cat');
    expect(byName.negative_prompt.defaultValue).toBe('blurry');
  });

  test('workflowData 에 placeholder 가 박히고 링크는 보존', () => {
    const parsed = parseWorkflow(API_WF);
    const draft = generateDraft(parsed, API_WF);
    const wf = JSON.parse(draft.workflowData);
    expect(wf['4'].inputs.ckpt_name).toBe('{{##base_model##}}');
    expect(wf['6'].inputs.text).toBe('{{##prompt##}}');
    expect(wf['7'].inputs.text).toBe('{{##negative_prompt##}}');
    expect(wf['3'].inputs.seed).toBe('{{##seed##}}');
    // 링크 입력은 그대로
    expect(wf['3'].inputs.positive).toEqual(['6', 0]);
    // 노출 안 한 튜닝값은 원본 유지
    expect(wf['3'].inputs.steps).toBe(20);
  });

  test('steps/cfg 등 미노출 튜닝값은 note 로 안내', () => {
    const parsed = parseWorkflow(API_WF);
    const draft = generateDraft(parsed, API_WF);
    expect(draft.notes.join(' ')).toMatch(/튜닝/);
  });

  test('이름 충돌 시 _2 로 유일화 (LoRA 2개)', () => {
    const wf = {
      ...API_WF,
      '8': { class_type: 'LoraLoader', inputs: { lora_name: 'a.safetensors', model: ['4', 0], clip: ['4', 1] } },
      '9': { class_type: 'LoraLoader', inputs: { lora_name: 'b.safetensors', model: ['8', 0], clip: ['8', 1] } },
    };
    const parsed = parseWorkflow(wf);
    const draft = generateDraft(parsed, wf);
    const loraNames = draft.additionalInputFields.filter((f) => f.type === 'lora').map((f) => f.name).sort();
    expect(loraNames).toEqual(['lora', 'lora_2']);
  });

  test('커스텀 노드만 있으면 변수 못 찾고 note 안내', () => {
    const wf = { '1': { class_type: 'SomeCustomNode', inputs: { foo: ['1', 0] } } };
    const parsed = parseWorkflow(wf);
    const draft = generateDraft(parsed, wf);
    expect(draft.additionalInputFields).toHaveLength(0);
    expect(draft.notes.join(' ')).toMatch(/커스텀|수동/);
  });
});

describe('#P1 proposeLlmPicks (LLM 보조)', () => {
  // 커스텀 노드가 있는 워크플로 — 결정론은 못 잡고 LLM 이 제안
  const CUSTOM_WF = {
    '1': { class_type: 'FooSampler', inputs: { my_prompt: 'hello', steps: 8, ref: ['2', 0] } },
    '2': { class_type: 'BarLoader', inputs: { ckpt: 'x.safetensors' } },
  };

  test('LLM 제안을 검증해 picks 로 변환 (실재 후보만)', async () => {
    const parsed = parseWorkflow(CUSTOM_WF);
    const llmComplete = async () => JSON.stringify([
      { nodeId: '1', key: 'my_prompt', name: 'prompt', type: 'string', label: '프롬프트' },
      { nodeId: '9', key: 'ghost', name: 'x', type: 'string' }, // 실재 안 함 → 제거
    ]);
    const picks = await proposeLlmPicks({ parsed, existingPicks: [], llmComplete });
    expect(picks).toHaveLength(1);
    expect(picks[0]).toMatchObject({ nodeId: '1', key: 'my_prompt', name: 'prompt', type: 'string', source: 'llm' });
  });

  test('이미 결정론이 잡은 입력은 후보에서 제외', async () => {
    const parsed = parseWorkflow(CUSTOM_WF);
    const llmComplete = async () => JSON.stringify([{ nodeId: '1', key: 'my_prompt', name: 'p', type: 'string' }]);
    const picks = await proposeLlmPicks({ parsed, existingPicks: [{ nodeId: '1', key: 'my_prompt' }], llmComplete });
    expect(picks).toHaveLength(0);
  });

  test('잘못된 type 은 string 으로, prose 로 감싼 JSON 도 파싱', async () => {
    const parsed = parseWorkflow(CUSTOM_WF);
    const llmComplete = async () => 'Here you go:\n[{"nodeId":"1","key":"steps","name":"steps","type":"bogus"}]\nDone.';
    const picks = await proposeLlmPicks({ parsed, existingPicks: [], llmComplete });
    expect(picks).toHaveLength(1);
    expect(picks[0].type).toBe('string');
  });

  test('LLM 호출 실패/비JSON 이면 빈 배열', async () => {
    const parsed = parseWorkflow(CUSTOM_WF);
    expect(await proposeLlmPicks({ parsed, existingPicks: [], llmComplete: async () => 'no json here' })).toEqual([]);
    expect(await proposeLlmPicks({ parsed, existingPicks: [], llmComplete: async () => { throw new Error('boom'); } })).toEqual([]);
    expect(await proposeLlmPicks({ parsed, existingPicks: [], llmComplete: undefined })).toEqual([]);
  });

  test('buildDraftFromPicks 가 결정론+LLM picks 를 합쳐 placeholder 주입', async () => {
    const parsed = parseWorkflow(CUSTOM_WF);
    const det = collectDeterministicPicks(parsed); // 표준 노드 없음 → []
    const llmPicks = [{ nodeId: '1', key: 'my_prompt', name: 'prompt', type: 'string', source: 'llm' }];
    const draft = buildDraftFromPicks(parsed, CUSTOM_WF, [...det, ...llmPicks]);
    const wf = JSON.parse(draft.workflowData);
    expect(wf['1'].inputs.my_prompt).toBe('{{##prompt##}}');
    const f = draft.additionalInputFields.find((x) => x.name === 'prompt');
    expect(f.description).toMatch(/AI 제안/);
  });

  test('LLM pick 이 결정론과 같은 입력을 가리키면 중복 주입 안 함', () => {
    const parsed = parseWorkflow(API_WF);
    const det = collectDeterministicPicks(parsed); // CLIPTextEncode '6' text=prompt 포함
    const dupe = [{ nodeId: '6', key: 'text', name: 'prompt_dup', type: 'string', source: 'llm' }];
    const draft = buildDraftFromPicks(parsed, API_WF, [...det, ...dupe]);
    const wf = JSON.parse(draft.workflowData);
    expect(wf['6'].inputs.text).toBe('{{##prompt##}}'); // 결정론 우선, dupe 무시
    expect(draft.additionalInputFields.filter((f) => f.name.startsWith('prompt_dup'))).toHaveLength(0);
  });
});

describe('#614 normalizeManagerMap', () => {
  test('형태 A: getmappings { url: [[nodes], meta] }', () => {
    const raw = {
      'https://github.com/foo/ComfyUI-IPAdapter': [
        ['IPAdapterApply', 'IPAdapterEncoder'],
        { title: 'IPAdapter', url: 'https://github.com/foo/ComfyUI-IPAdapter' },
      ],
    };
    const map = normalizeManagerMap(raw);
    expect(map.IPAdapterApply).toEqual({ title: 'IPAdapter', url: 'https://github.com/foo/ComfyUI-IPAdapter', installId: 'foo/ComfyUI-IPAdapter' });
    expect(map.IPAdapterEncoder.url).toContain('ComfyUI-IPAdapter');
  });

  test('형태 A: meta.url 없으면 key(url) 사용', () => {
    const raw = { 'https://github.com/x/Y': [['NodeX'], { title: 'Y' }] };
    expect(normalizeManagerMap(raw).NodeX).toEqual({ title: 'Y', url: 'https://github.com/x/Y', installId: 'x/Y' });
  });

  test('형태 B: { className: { url, title } }', () => {
    const raw = { UltimateSDUpscale: { url: 'https://github.com/a/b', title: 'Ultimate' } };
    expect(normalizeManagerMap(raw).UltimateSDUpscale.url).toBe('https://github.com/a/b');
  });

  test('이상한 입력은 빈 맵', () => {
    expect(normalizeManagerMap(null)).toEqual({});
    expect(normalizeManagerMap('x')).toEqual({});
    expect(normalizeManagerMap({ k: 123 })).toEqual({});
  });
});

describe('#614 resolveMissingNodes', () => {
  const map = {
    IPAdapterApply: { title: 'IPAdapter', url: 'https://github.com/foo/ipadapter' },
    UltimateSDUpscale: { title: 'Ultimate', url: 'https://github.com/a/ultimate' },
  };
  test('해석/미해석 분리', () => {
    const r = resolveMissingNodes(['IPAdapterApply', 'UnknownCustomNode'], map);
    expect(r.resolutions).toEqual([{ node: 'IPAdapterApply', repos: [{ title: 'IPAdapter', url: 'https://github.com/foo/ipadapter' }] }]);
    expect(r.unresolved).toEqual(['UnknownCustomNode']);
  });
  test('맵 없으면 전부 미해석', () => {
    const r = resolveMissingNodes(['A', 'B'], null);
    expect(r.resolutions).toEqual([]);
    expect(r.unresolved).toEqual(['A', 'B']);
  });
  test('빈 노드 목록', () => {
    expect(resolveMissingNodes([], map)).toEqual({ resolutions: [], unresolved: [] });
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
