/**
 * 작업 절차 단계 입력 출처 (#953) — 분류, 출처, 실행 입력 검사, 실행 루프 입력.
 */
const {
  stepFields, classifyField, resolveStepInputs, defaultValueOf, normalizeValue,
  validateRunInputs, buildSequenceStepInput, firstPromptOf,
} = require('../utils/sequenceInputs');

const S1 = '1'.repeat(24);
const S2 = '2'.repeat(24);
const IMG = 'a'.repeat(24);

const chat = {
  _id: 'wb-chat',
  outputFormat: 'text',
  additionalInputFields: [
    { name: 'base_model', label: '모델', type: 'baseModel', defaultValue: 'gpt-5.5' },
    { name: 'system_prompt', label: '시스템 프롬프트', type: 'string' },
    { name: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
    { name: 'conversation_mode', label: '대화', type: 'boolean', defaultValue: true },
  ],
};
const imageBoard = {
  _id: 'wb-image',
  outputFormat: 'image',
  additionalInputFields: [
    { name: 'image_size', label: '크기', type: 'select', options: [{ key: '1024', value: '1024x1024' }, { key: '1536', value: '1536x1024' }] },
    { name: 'quality', label: '품질', type: 'select', defaultValue: 'medium', options: [{ key: '낮음', value: 'low' }, { key: '보통', value: 'medium' }] },
    { name: 'start_image', label: '시작 이미지', type: 'image', imageConfig: { maxImages: 2 } },
    { name: 'style_image', label: '스타일 이미지', type: 'image' },
    { name: 'steps', label: '스텝', type: 'number', defaultValue: 8 },
    { name: 'lyrics', label: '가사', type: 'string', required: true },
  ],
};
const byId = new Map([['wb-chat', chat], ['wb-image', imageBoard]]);

describe('stepFields / classifyField', () => {
  test('텍스트 작업판: 프롬프트 암묵 입력 추가, 관리용 필드 제외', () => {
    const names = stepFields(chat).map((f) => f.name);
    expect(names).toEqual(['prompt', 'base_model', 'system_prompt', 'temperature']);
  });

  test('이미지 작업판: 프롬프트·부정 프롬프트·시드 암묵 입력', () => {
    expect(stepFields(imageBoard).slice(0, 3).map((f) => f.name)).toEqual(['prompt', 'negativePrompt', 'seed']);
  });

  test('작업판에 prompt 필드가 있으면 암묵 프롬프트를 겹쳐 넣지 않는다', () => {
    const wb = { outputFormat: 'image', additionalInputFields: [{ name: 'prompt', label: '프롬프트', type: 'string' }] };
    expect(stepFields(wb).filter((f) => f.name === 'prompt')).toHaveLength(1);
  });

  test.each([
    ['prompt', 'string', 'content'],
    ['start_image', 'image', 'content'],
    ['ref_audio', 'audio', 'content'],
    ['base_model', 'baseModel', 'tuning'],
    ['turbo_lora', 'select', 'tuning'],
    ['system_prompt', 'string', 'tuning'],
    ['negativePrompt', 'string', 'tuning'],
    ['seed', 'number', 'tuning'],
    ['steps', 'number', 'tuning'],
    ['lora_strength', 'number', 'tuning'],
    ['image_size', 'select', 'output'],
    ['quality', 'select', 'output'],
    ['output_format', 'select', 'output'],
    ['video_length', 'select', 'output'],
    ['n', 'number', 'output'],
    ['lyrics', 'string', 'other'],
  ])('%s (%s) → %s', (name, type, kind) => {
    expect(classifyField({ name, type })).toBe(kind);
  });
});

describe('resolveStepInputs — 기본 출처', () => {
  const modes = (resolved) => Object.fromEntries(resolved.map((r) => [r.field.name, r.mode]));

  test('첫 단계: 내용·출력 취향은 노출, 조율값·분류 밖은 잠금', () => {
    expect(modes(resolveStepInputs({ workboard: imageBoard, step: {}, stepIndex: 0 }))).toEqual({
      prompt: 'exposed', negativePrompt: 'locked', seed: 'locked', image_size: 'exposed', quality: 'exposed',
      start_image: 'exposed', style_image: 'exposed', steps: 'locked', lyrics: 'locked',
    });
  });

  test('텍스트 다음 단계: 프롬프트가 앞 단계 출력을 받는다', () => {
    const m = modes(resolveStepInputs({ workboard: imageBoard, step: {}, stepIndex: 1, previousWorkboard: chat }));
    expect(m.prompt).toBe('previous');
    expect(m.start_image).toBe('exposed');
  });

  test('이미지 다음 단계: 첫 이미지 필드만 앞 단계 출력을 받는다', () => {
    const m = modes(resolveStepInputs({ workboard: imageBoard, step: {}, stepIndex: 1, previousWorkboard: imageBoard }));
    expect(m).toMatchObject({ prompt: 'exposed', start_image: 'previous', style_image: 'exposed' });
  });

  test('자동 주입을 끄면 앞 단계 출처가 기본값에서 빠진다', () => {
    const m = modes(resolveStepInputs({ workboard: imageBoard, step: { autoInject: false }, stepIndex: 1, previousWorkboard: chat }));
    expect(m.prompt).toBe('exposed');
  });

  test('작성자 지정이 기본값보다 우선, 첫 단계의 앞 단계 지정은 무시', () => {
    const step = { inputSources: { steps: { mode: 'exposed' }, quality: { mode: 'locked' }, prompt: { mode: 'previous' }, lyrics: { mode: 'bogus' } } };
    const first = modes(resolveStepInputs({ workboard: imageBoard, step, stepIndex: 0 }));
    expect(first).toMatchObject({ steps: 'exposed', quality: 'locked', prompt: 'exposed', lyrics: 'locked' });
  });
});

describe('defaultValueOf / normalizeValue', () => {
  test('사전 입력 > 작업판 기본값 > select 첫 옵션 · 미디어는 빈 배열 · 암묵 입력은 값이 없으면 없음', () => {
    const fields = Object.fromEntries(stepFields(imageBoard).map((f) => [f.name, f]));
    expect(defaultValueOf(fields.quality, { quality: 'low' })).toBe('low');
    expect(defaultValueOf(fields.quality, {})).toBe('medium');
    expect(defaultValueOf(fields.image_size, {})).toBe('1024x1024');
    expect(defaultValueOf(fields.start_image, { start_image: ['x'] })).toEqual([]);
    expect(defaultValueOf(fields.seed, {})).toBeUndefined();
    expect(defaultValueOf(fields.lyrics, {})).toBe('');
  });

  test('첨부는 id 로 정규화, 개수 상한, 잘못된 모양 거절', () => {
    const field = { name: 'start_image', type: 'image', imageConfig: { maxImages: 2 } };
    expect(normalizeValue(field, [{ imageId: IMG, image: { url: 'x' } }, IMG])).toEqual({ value: [{ imageId: IMG }, { imageId: IMG }] });
    expect(normalizeValue(field, [IMG, IMG, IMG]).error).toContain('최대 2개');
    expect(normalizeValue(field, [{ foo: 1 }]).error).toBeDefined();
  });

  test('select 옵션 밖·숫자 아님·범위 밖 거절', () => {
    expect(normalizeValue({ type: 'select', options: [{ value: 'a' }] }, 'b').error).toBeDefined();
    expect(normalizeValue({ type: 'number' }, 'abc').error).toBeDefined();
    expect(normalizeValue({ type: 'number', validation: { max: 10 } }, 11).error).toBeDefined();
    expect(normalizeValue({ type: 'number' }, '7')).toEqual({ value: 7 });
    expect(normalizeValue({ type: 'boolean' }, 'true')).toEqual({ value: true });
    expect(normalizeValue({ type: 'file' }, 'x').error).toBeDefined();
  });
});

describe('validateRunInputs', () => {
  const steps = [
    { _id: S1, workboardId: 'wb-chat', inputs: {} },
    { _id: S2, workboardId: 'wb-image', inputs: { lyrics: '고정 가사' } },
  ];

  test('노출 필드만 받아 정규화 — 잠금·앞 단계 필드는 400 사유', () => {
    const ok = validateRunInputs({
      steps, workboardsById: byId,
      inputs: { [S1]: { prompt: '고양이' }, [S2]: { quality: 'low', start_image: [{ imageId: IMG, image: {} }] } },
    });
    expect(ok).toEqual({ ok: true, inputs: { [S1]: { prompt: '고양이' }, [S2]: { quality: 'low', start_image: [{ imageId: IMG }] } } });

    const bad = validateRunInputs({
      steps, workboardsById: byId,
      inputs: { [S1]: { prompt: '고양이', temperature: 1 }, [S2]: { prompt: '덮어쓰기', steps: 20 } },
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors).toEqual([
      '1단계 Temperature: 실행할 때 바꿀 수 없는 입력입니다',
      '2단계 프롬프트: 실행할 때 바꿀 수 없는 입력입니다',
      '2단계 스텝: 실행할 때 바꿀 수 없는 입력입니다',
    ]);
  });

  test('필수 노출 필드 — 첫 단계 프롬프트는 initialPrompt 호환 별칭으로도 채워진다', () => {
    expect(validateRunInputs({ steps, workboardsById: byId, inputs: {} }).errors).toEqual(['1단계 프롬프트: 입력하세요']);
    expect(validateRunInputs({ steps, workboardsById: byId, inputs: {}, initialPrompt: '고양이' }).ok).toBe(true);
  });

  test('필수 필드를 작성자가 노출했는데 기본값도 입력도 없으면 거절', () => {
    const exposedLyrics = [steps[0], { ...steps[1], inputs: {}, inputSources: { lyrics: { mode: 'exposed' } } }];
    const out = validateRunInputs({ steps: exposedLyrics, workboardsById: byId, inputs: { [S1]: { prompt: 'x' } } });
    expect(out.errors).toEqual(['2단계 가사: 입력하세요']);
  });

  test('없는 단계·없는 필드', () => {
    const out = validateRunInputs({ steps, workboardsById: byId, inputs: { ['9'.repeat(24)]: {}, [S1]: { prompt: 'x', nope: 1 } } });
    expect(out.errors).toEqual(['작업 절차에 없는 단계의 입력이 있습니다', '1단계: 알 수 없는 입력 nope']);
  });
});

describe('buildSequenceStepInput', () => {
  test('첫 단계: 실행 입력 > 사전 입력 > 작업판 기본값, userPrompt 동기화', () => {
    const { values } = buildSequenceStepInput({
      workboard: chat, step: { _id: S1, inputs: { system_prompt: '지침' } }, stepIndex: 0,
      stepRunInputs: { prompt: '고양이' },
    });
    expect(values).toEqual({ prompt: '고양이', userPrompt: '고양이', base_model: 'gpt-5.5', system_prompt: '지침', temperature: 0.7 });
  });

  test('첫 단계 프롬프트가 비면 initialPrompt 호환 별칭', () => {
    const { values } = buildSequenceStepInput({ workboard: chat, step: {}, stepIndex: 0, initialPrompt: '옛 방식' });
    expect(values.userPrompt).toBe('옛 방식');
  });

  test('앞 단계 텍스트 → 프롬프트, 노출 값은 실행 입력, 잠긴 값은 작성자 값', () => {
    const { values, skippedPrevious } = buildSequenceStepInput({
      workboard: imageBoard, step: { _id: S2, inputs: { lyrics: '고정 가사', steps: 12 } }, stepIndex: 1,
      previousWorkboard: chat, prevOutput: { type: 'text', value: 'a cat' },
      stepRunInputs: { quality: 'low', start_image: [{ imageId: IMG }], lyrics: '실행자가 보낸 값' },
    });
    expect(values).toMatchObject({
      prompt: 'a cat', userPrompt: 'a cat', quality: 'low', image_size: '1024x1024', steps: 12, lyrics: '고정 가사',
      start_image: [{ imageId: IMG }], style_image: [],
    });
    expect(values).not.toHaveProperty('seed');
    expect(skippedPrevious).toEqual([]);
  });

  test('앞 단계 이미지 → 첫 이미지 필드, 형식이 안 맞는 앞 단계 출처는 건너뛰고 알린다', () => {
    const step = { inputSources: { style_image: { mode: 'previous' } } };
    const { values, skippedPrevious } = buildSequenceStepInput({
      workboard: imageBoard, step, stepIndex: 1, previousWorkboard: imageBoard,
      prevOutput: { type: 'image', imageIds: [IMG] },
    });
    expect(values.start_image).toEqual([{ imageId: IMG }]);
    expect(values.style_image).toEqual([{ imageId: IMG }]);
    expect(skippedPrevious).toEqual([]);

    const mismatch = buildSequenceStepInput({
      workboard: imageBoard, step: { inputSources: { lyrics: { mode: 'previous' } } }, stepIndex: 1, previousWorkboard: imageBoard,
      prevOutput: { type: 'image', imageIds: [IMG] },
    });
    expect(mismatch.skippedPrevious).toEqual(['lyrics']);
  });
});

describe('firstPromptOf', () => {
  test('첫 단계 실행 입력의 프롬프트, 없으면 initialPrompt', () => {
    const steps = [{ _id: S1 }];
    expect(firstPromptOf({ steps, runInputs: { [S1]: { prompt: '새 방식' } }, initialPrompt: '옛' })).toBe('새 방식');
    expect(firstPromptOf({ steps, runInputs: {}, initialPrompt: '옛' })).toBe('옛');
  });
});
