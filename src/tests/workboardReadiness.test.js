/**
 * 작업판 준비 검사 (#1087)
 *
 * #1083 의 세 문제가 각각 잡히는지 — 서버에 없는 기본 모델, 서버에 없는 패치 선택지, 기본 모델을
 * 숨기는 거름 — 와, 실행 때 우회되는 "끄는 값" 이나 첨부 필드처럼 잡으면 안 되는 것을 고정한다.
 */

jest.mock('../models/ServerModelCache', () => ({ findOne: jest.fn() }));
jest.mock('../services/comfyUIService', () => ({ getObjectInfo: jest.fn() }));

const ServerModelCache = require('../models/ServerModelCache');
const comfyUIService = require('../services/comfyUIService');
const { checkWorkboardReadiness, comboOptions, _objectInfoCache } = require('../services/workboardReadiness');
const { formatReadiness, summarizeReadiness } = require('../../scripts/lib/readinessReport');

const OBJECT_INFO = {
  UNETLoader: { input: { required: {
    unet_name: [['Krea2\\krea2TurboOfficialComfy_krea2TurboInt8.safetensors', 'qwen\\qwen_image_2.1_int8_convrot.safetensors', 'Z-Image\\z.safetensors']],
    weight_dtype: [['default', 'fp8_e4m3fn']],
  } } },
  ModelPatchLoader: { input: { required: { name: ['COMBO', { options: ['anima-lllite-any-test-like-v2.safetensors'] }] } } },
  KSampler: { input: { required: { sampler_name: [['euler', 'er_sde']], steps: ['INT', { default: 20 }] } } },
  UpscaleModelLoader: { input: { required: { model_name: [['2x-AnimeSharpV4_RCAN.safetensors']] } } },
  ImageUpscaleWithModel: { input: { required: { upscale_model: ['UPSCALE_MODEL'], image: ['IMAGE'] } } },
  LoadImage: { input: { required: { image: [['a.png']] } } },
};

const server = { _id: 'srv1', serverType: 'ComfyUI', serverUrl: 'http://comfy' };
const wf = (nodes) => JSON.stringify(nodes);
const baseField = (defaultValue) => ({ name: 'base_model', label: '베이스 모델', type: 'baseModel', defaultValue, formatString: '{{##base_model##}}' });
const cacheWith = (models) => ({ models });

beforeEach(() => {
  jest.clearAllMocks();
  _objectInfoCache.clear();
  comfyUIService.getObjectInfo.mockResolvedValue(OBJECT_INFO);
  ServerModelCache.findOne.mockResolvedValue(cacheWith([
    { filename: 'Krea2\\krea2TurboOfficialComfy_krea2TurboInt8.safetensors', source: 'diffusion_models', civitai: { found: true, baseModel: 'Krea 2 Turbo' } },
    { filename: 'qwen\\qwen_image_2.1_int8_convrot.safetensors', source: 'diffusion_models', civitai: { found: false } },
  ]));
});

const codes = (r) => r.issues.map((i) => i.code);

test('comboOptions — 옛 목록형과 COMBO 형 둘 다, 나머지는 선택형 아님', () => {
  expect(comboOptions([['a', 'b']])).toEqual(['a', 'b']);
  expect(comboOptions(['COMBO', { options: ['x'] }])).toEqual(['x']);
  expect(comboOptions(['INT', { default: 1 }])).toBeNull();
  expect(comboOptions(['COMBO', {}])).toBeNull();
});

test('서버에 없는 베이스 모델 기본값 (Krea2 공식 이름) — 파일 없음으로, 목록 검사는 거듭 알리지 않는다', async () => {
  const workboard = {
    workflowData: wf({ 6: { class_type: 'UNETLoader', inputs: { unet_name: '{{##base_model##}}', weight_dtype: 'default' } } }),
    additionalInputFields: [baseField('Krea2\\krea2_turbo_fp8_scaled.safetensors')],
  };
  const r = await checkWorkboardReadiness({ workboard, server });
  expect(codes(r)).toEqual(['VALUE_NOT_ON_SERVER']);
  expect(r.issues[0].message).toContain('필드 "베이스 모델" 기본값');
  expect(r.checked).toEqual({ nodes: 1, values: 2, defaultModel: 'missing' });
});

test('서버에 없는 선택지 (Anima 패치) — 선택지마다 알린다', async () => {
  const workboard = {
    workflowData: wf({ 3: { class_type: 'ModelPatchLoader', inputs: { name: '{{##control_patch##}}' } } }),
    additionalInputFields: [{
      name: 'control_patch', label: '컨트롤 패치', type: 'select', defaultValue: 'anima-lllite-any-test-like-v2.safetensors',
      options: [
        { key: '혼합', value: 'anima-lllite-any-test-like-v2.safetensors' },
        { key: 'Lineart', value: 'anima-lllite-lineart-1.safetensors' },
        { key: 'Depth', value: 'anima-lllite-depth-1.safetensors' },
      ],
    }],
  };
  const r = await checkWorkboardReadiness({ workboard, server });
  expect(codes(r)).toEqual(['VALUE_NOT_ON_SERVER', 'VALUE_NOT_ON_SERVER']);
  expect(r.issues.map((i) => i.message).join('\n')).toContain('anima-lllite-lineart-1.safetensors` (필드 "컨트롤 패치" 선택지)');
});

test('기본 모델을 숨기는 거름 (Qwen 판에 Z-Image 타입) — 걸린 제한과 그 파일의 분류를 알린다', async () => {
  const workboard = {
    workflowData: wf({ 1: { class_type: 'UNETLoader', inputs: { unet_name: '{{##base_model##}}', weight_dtype: 'default' } } }),
    additionalInputFields: [baseField('qwen\\qwen_image_2.1_int8_convrot.safetensors')],
    allowedModelTypes: ['ZImageTurbo', 'ZImageBase'],
  };
  const r = await checkWorkboardReadiness({ workboard, server });
  expect(codes(r)).toEqual(['DEFAULT_MODEL_FILTERED']);
  expect(r.issues[0].message).toContain('허용 모델 타입(ZImageTurbo, ZImageBase — 이 파일의 Civitai 분류: 없음)');
  expect(r.checked.defaultModel).toBe('checked');
});

test('폴더 제한 밖 기본 모델, 모델 목록에 없는 기본 모델', async () => {
  const wfData = wf({ 1: { class_type: 'UNETLoader', inputs: { unet_name: '{{##base_model##}}', weight_dtype: 'default' } } });
  const outside = await checkWorkboardReadiness({
    workboard: { workflowData: wfData, additionalInputFields: [baseField('Krea2\\krea2TurboOfficialComfy_krea2TurboInt8.safetensors')], allowedModelFolders: ['qwen/'] },
    server,
  });
  expect(outside.issues[0].message).toContain('허용 모델 폴더(qwen/)');

  const notCached = await checkWorkboardReadiness({
    workboard: { workflowData: wfData, additionalInputFields: [baseField('Z-Image\\z.safetensors')] },
    server,
  });
  expect(codes(notCached)).toEqual(['DEFAULT_MODEL_NOT_IN_LIST']);
});

test('노드가 없으면 알리고, 구분자만 다른 값은 따로 알린다', async () => {
  const workboard = {
    workflowData: wf({
      1: { class_type: 'H3VideoUpsampler', inputs: {} },
      2: { class_type: 'UNETLoader', inputs: { unet_name: 'qwen/qwen_image_2.1_int8_convrot.safetensors', weight_dtype: 'default' } },
    }),
    additionalInputFields: [],
  };
  const r = await checkWorkboardReadiness({ workboard, server });
  expect(codes(r)).toEqual(['NODE_MISSING', 'VALUE_SEPARATOR_MISMATCH']);
  expect(r.issues[1].message).toContain('qwen\\qwen_image_2.1_int8_convrot.safetensors');
});

test('실행 때 우회되는 "끄는 값", 첨부 필드, 링크·숫자·섞인 문자열은 검사하지 않는다', async () => {
  const workboard = {
    workflowData: wf({
      8: { class_type: 'UpscaleModelLoader', inputs: { model_name: '{{##upscale_model##}}' } },
      9: { class_type: 'ImageUpscaleWithModel', inputs: { upscale_model: ['8', 0], image: ['5', 0] },
        _vcc: { bypassUnless: { condition: '{{##upscale_model##}}', passthrough: { 0: 'image' } } } },
      1: { class_type: 'LoadImage', inputs: { image: '{{##sketch##}}' } },
      12: { class_type: 'KSampler', inputs: { sampler_name: 'euler', steps: 8 } },
    }),
    additionalInputFields: [
      { name: 'upscale_model', type: 'select', defaultValue: '0', options: [{ key: '없음', value: '0' }, { key: 'AnimeSharp', value: '2x-AnimeSharpV4_RCAN.safetensors' }] },
      { name: 'sketch', type: 'image' },
    ],
  };
  const r = await checkWorkboardReadiness({ workboard, server });
  expect(r.issues).toEqual([]);
  expect(r.checked).toEqual({ nodes: 4, values: 2, defaultModel: false }); // AnimeSharp 선택지 + sampler 리터럴
});

test('같은 값이 _vcc 조건이 아니면 "0" 도 검사한다', async () => {
  const workboard = {
    workflowData: wf({ 8: { class_type: 'UpscaleModelLoader', inputs: { model_name: '{{##upscale_model##}}' } } }),
    additionalInputFields: [{ name: 'upscale_model', type: 'select', defaultValue: '0', options: [{ key: '없음', value: '0' }] }],
  };
  const r = await checkWorkboardReadiness({ workboard, server });
  expect(codes(r)).toEqual(['VALUE_NOT_ON_SERVER']);
});

test('ComfyUI 에 닿지 못하면 "확인 못 함", ComfyUI 가 아니면 "해당 없음"', async () => {
  comfyUIService.getObjectInfo.mockRejectedValue(new Error('Failed to get object info: ECONNREFUSED'));
  const r = await checkWorkboardReadiness({ workboard: { workflowData: '{}' }, server });
  expect(r.unavailable).toContain('ECONNREFUSED');

  const saas = await checkWorkboardReadiness({ workboard: {}, server: { serverType: 'OpenAI' } });
  expect(saas.skipped).toContain('OpenAI');
});

test('같은 서버의 object_info 는 잠깐 재사용한다 (판마다 import 를 한 번씩 부른다)', async () => {
  const workboard = { workflowData: wf({ 12: { class_type: 'KSampler', inputs: { sampler_name: 'euler' } } }), additionalInputFields: [] };
  await checkWorkboardReadiness({ workboard, server });
  await checkWorkboardReadiness({ workboard, server });
  expect(comfyUIService.getObjectInfo).toHaveBeenCalledTimes(1);
});

describe('스크립트 출력 (scripts/lib/readinessReport)', () => {
  test('문제가 0 이어도 검사 수를 한 줄 남긴다', () => {
    expect(formatReadiness({ checked: { nodes: 17, values: 14, defaultModel: 'checked' }, issues: [] }))
      .toEqual({ status: 'ok', lines: ['준비 검사: 노드 17 · 선택값 14 · 기본 모델 목록 확인 — 문제 0'] });
  });

  test('문제는 줄마다 ✗, 옛 서버·못 닿음·해당 없음은 구분한다', () => {
    const r = formatReadiness({ checked: { nodes: 1, values: 1 }, issues: [{ code: 'NODE_MISSING', message: 'm' }] });
    expect(r.status).toBe('issues');
    expect(r.lines[0]).toBe('✗ [NODE_MISSING] m');
    expect(formatReadiness({ checked: { nodes: 1, values: 1, defaultModel: 'missing' }, issues: [] }).lines[0]).toContain('건너뜀 (기본 모델 파일 없음)');
    expect(formatReadiness(undefined).status).toBe('unsupported');
    expect(formatReadiness({ unavailable: 'x' }).status).toBe('unavailable');
    expect(formatReadiness({ skipped: 'x' }).status).toBe('skipped');
  });

  test('요약', () => {
    expect(summarizeReadiness([{ status: 'ok', issueCount: 0 }, { status: 'issues', issueCount: 2 }, { status: 'unavailable', issueCount: 0 }]))
      .toBe('서버 준비 검사 — 판 3개: 문제 있음 1 (2건) · 확인 못 함 1 · 해당 없음 0 · 지원 안 함 0');
  });
});
