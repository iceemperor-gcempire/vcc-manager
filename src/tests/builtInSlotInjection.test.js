/**
 * #1174 — REST 의 top-level `aiModel`·`imageSize` 는 판의 모델 칸·크기 칸 값으로 워크플로에 들어간다.
 *
 * 그동안 {{##base_model##}} 을 칸 반복이 칸 기본값으로 다시 써서, top-level 로 보낸 모델이 무시되고 판의 기본
 * 모델로 실행됐다. 폴더 검사는 보낸 모델을 봐서 검사한 모델과 실행한 모델이 달랐다. 크기 칸도 같은 구조라
 * {{##image_size##}} 는 기본값, {{##width##}}/{{##height##}} 는 보낸 크기로 서로 어긋났다.
 */
const { injectInputsIntoWorkflow } = require('../services/queueService');
const { getModelValue } = require('../utils/customFieldHelpers');
const { findModelFolderViolation } = require('../services/modelFolderGuard');

let logSpy;
beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => logSpy.mockRestore());

const workboard = {
  allowedModelFolders: ['qwen/'],
  additionalInputFields: [
    { name: 'base_model', label: '베이스 모델', type: 'baseModel', defaultValue: 'qwen/default.safetensors' },
    { name: 'image_size', label: '크기', type: 'select', defaultValue: '1024x1024' },
  ],
};

const template = JSON.stringify({
  1: { class_type: 'UNETLoader', inputs: { unet_name: '{{##base_model##}}' } },
  2: { class_type: 'EmptyLatentImage', inputs: { width: '{{##width##}}', height: '{{##height##}}' } },
  3: { class_type: 'ResolutionString', inputs: { size: '{{##image_size##}}' } },
});

const run = async (inputData) => (await injectInputsIntoWorkflow(template, inputData, workboard)).workflowJson;

describe('모델 칸 (#1174)', () => {
  test('top-level aiModel 만 보내면 그 모델로 실행한다', async () => {
    const wf = await run({ aiModel: 'qwen/picked.safetensors', additionalParams: {} });
    expect(wf[1].inputs.unet_name).toBe('qwen/picked.safetensors');
  });

  test('칸 값(additionalParams.base_model)으로 보내면 그 모델 — 화면 경로', async () => {
    const wf = await run({ additionalParams: { base_model: 'qwen/picked.safetensors' } });
    expect(wf[1].inputs.unet_name).toBe('qwen/picked.safetensors');
  });

  test('둘 다 오면 칸 값이 먼저다', async () => {
    const wf = await run({ aiModel: 'qwen/top.safetensors', additionalParams: { base_model: 'qwen/field.safetensors' } });
    expect(wf[1].inputs.unet_name).toBe('qwen/field.safetensors');
  });

  test('docs/API.md 예시의 {key, value} 형태도 값을 꺼내 쓴다', async () => {
    const wf = await run({ aiModel: { key: 'picked', value: 'qwen/picked.safetensors' }, additionalParams: {} });
    expect(wf[1].inputs.unet_name).toBe('qwen/picked.safetensors');
  });

  test('아무것도 안 보내면 칸 기본값 — 예전과 같다', async () => {
    const wf = await run({ additionalParams: {} });
    expect(wf[1].inputs.unet_name).toBe('qwen/default.safetensors');
  });

  test('모델 칸 이름이 base_model 이 아니어도 top-level aiModel 이 그 칸에 들어간다', async () => {
    const wb = { additionalInputFields: [{ name: 'unet', type: 'baseModel', defaultValue: 'qwen/default.safetensors' }] };
    const tpl = JSON.stringify({ 1: { class_type: 'UNETLoader', inputs: { unet_name: '{{##unet##}}' } } });
    const { workflowJson } = await injectInputsIntoWorkflow(tpl, { aiModel: 'qwen/picked.safetensors', additionalParams: {} }, wb);
    expect(workflowJson[1].inputs.unet_name).toBe('qwen/picked.safetensors');
  });
});

describe('크기 칸 (#1174)', () => {
  test('top-level imageSize 만 보내면 {{##image_size##}} 와 width/height 가 같은 크기다', async () => {
    const wf = await run({ imageSize: '1344x768', additionalParams: {} });
    expect(wf[3].inputs.size).toBe('1344x768');
    expect(wf[2].inputs).toEqual({ width: 1344, height: 768 });
  });

  test('칸 값이 먼저다', async () => {
    const wf = await run({ imageSize: '1344x768', additionalParams: { image_size: '768x1344' } });
    expect(wf[3].inputs.size).toBe('768x1344');
    expect(wf[2].inputs).toEqual({ width: 768, height: 1344 });
  });

  test('아무것도 안 보내면 칸 기본값', async () => {
    const wf = await run({ additionalParams: {} });
    expect(wf[3].inputs.size).toBe('1024x1024');
    // #1221 — width/height 도 칸 기본값이다. 전에는 512x512 로 떨어져 {{##image_size##}} 와 어긋났다
    expect(wf[2].inputs).toEqual({ width: 1024, height: 1024 });
  });
});

describe('크기를 빼고 부르면 판의 기본 크기 (#1221)', () => {
  const sizeTemplate = JSON.stringify({
    2: { class_type: 'EmptyLatentImage', inputs: { width: '{{##width##}}', height: '{{##height##}}' } },
  });
  const runWith = async (wb, inputData) => (await injectInputsIntoWorkflow(sizeTemplate, inputData, wb)).workflowJson;

  test('H3 영상 판처럼 기본이 1344x768 이면 그 크기 — 512x512 가 아니다', async () => {
    const wb = { additionalInputFields: [{ name: 'image_size', type: 'select', defaultValue: '1344x768' }] };
    const wf = await runWith(wb, { additionalParams: {} });
    expect(wf[2].inputs).toEqual({ width: 1344, height: 768 });
  });

  test('기본값이 {key, value} 형태여도 값을 꺼내 쓴다', async () => {
    const wb = { additionalInputFields: [{ name: 'image_size', type: 'select', defaultValue: { key: '세로', value: '768x1344' } }] };
    const wf = await runWith(wb, { additionalParams: {} });
    expect(wf[2].inputs).toEqual({ width: 768, height: 1344 });
  });

  test('빈 문자열로 보내도 판 기본값', async () => {
    const wb = { additionalInputFields: [{ name: 'image_size', type: 'select', defaultValue: '1344x768' }] };
    const wf = await runWith(wb, { additionalParams: { image_size: '' } });
    expect(wf[2].inputs).toEqual({ width: 1344, height: 768 });
  });

  test('판에 크기 칸이 없으면 1024x1024', async () => {
    const wf = await runWith({ additionalInputFields: [] }, { additionalParams: {} });
    expect(wf[2].inputs).toEqual({ width: 1024, height: 1024 });
  });

  test('크기 칸은 있는데 기본값이 없으면 1024x1024', async () => {
    const wb = { additionalInputFields: [{ name: 'image_size', type: 'select' }] };
    const wf = await runWith(wb, { additionalParams: {} });
    expect(wf[2].inputs).toEqual({ width: 1024, height: 1024 });
  });

  test('보낸 크기가 있으면 판 기본값보다 먼저다 — 예전과 같다', async () => {
    const wb = { additionalInputFields: [{ name: 'image_size', type: 'select', defaultValue: '1344x768' }] };
    const wf = await runWith(wb, { additionalParams: { image_size: '832x480' } });
    expect(wf[2].inputs).toEqual({ width: 832, height: 480 });
  });
});

describe('폴더 검사와 실행이 같은 모델을 본다 (#1174)', () => {
  test.each([
    [{ aiModel: 'Z-Image/z.safetensors', additionalParams: {} }, 'Z-Image/z.safetensors'],
    [{ aiModel: 'Z-Image/z.safetensors', additionalParams: { base_model: 'qwen/ok.safetensors' } }, 'qwen/ok.safetensors'],
    [{ additionalParams: { base_model: 'qwen/ok.safetensors' } }, 'qwen/ok.safetensors'],
  ])('%j → %s', async (input, expected) => {
    const wf = await run(input);
    expect(wf[1].inputs.unet_name).toBe(expected);
    expect(getModelValue(workboard, input)).toBe(expected);
    expect(findModelFolderViolation(workboard, input) === null).toBe(expected.startsWith('qwen/'));
  });
});

describe('getModelValue', () => {
  test('칸 값이 빈 문자열이면 top-level aiModel', () => {
    expect(getModelValue(workboard, { aiModel: 'qwen/a.safetensors', additionalParams: { base_model: '' } })).toBe('qwen/a.safetensors');
  });

  test('둘 다 없으면 undefined', () => {
    expect(getModelValue(workboard, { additionalParams: {} })).toBeUndefined();
  });

  test('모델 칸이 없는 판도 top-level aiModel 을 돌려준다 (OpenAI·Gemini 경로)', () => {
    expect(getModelValue({ additionalInputFields: [] }, { aiModel: 'gpt-image-1' })).toBe('gpt-image-1');
  });
});

describe('선택 칸에 숫자로 온 값 (#1163)', () => {
  const wb = {
    additionalInputFields: [
      { name: 'h3_upsample', label: '업샘플', type: 'select', defaultValue: '2', options: [{ key: '안 함', value: '0' }, { key: '2배', value: '2' }] },
    ],
  };
  const tpl = JSON.stringify({ 1: { class_type: 'X', inputs: { mode: '{{##h3_upsample##}}' } } });
  const inject = async (inputData) => (await injectInputsIntoWorkflow(tpl, inputData, wb)).workflowJson;

  test('숫자 0 은 선택지 "0" 으로 들어간다 — 빈 값으로 바뀌지 않는다', async () => {
    expect((await inject({ additionalParams: { h3_upsample: 0 } }))[1].inputs.mode).toBe('0');
    expect((await inject({ additionalParams: { h3_upsample: { key: '안 함', value: 0 } } }))[1].inputs.mode).toBe('0');
  });

  test('글자 값과 다른 숫자는 예전과 같다', async () => {
    expect((await inject({ additionalParams: { h3_upsample: '0' } }))[1].inputs.mode).toBe('0');
    expect((await inject({ additionalParams: { h3_upsample: 2 } }))[1].inputs.mode).toBe('2');
  });
});
