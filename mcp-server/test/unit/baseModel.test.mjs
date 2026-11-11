/**
 * 작업판 베이스 모델 칸 (#1088) — get_workboard 안내, generate·continue_job 의 aiModel 을 칸에 넣기.
 * 배포 판은 모두 `base_model` (type baseModel, 필수, 기본값은 경로 문자열)이다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findBaseModelField, describeBaseModel, applyBaseModel } from '../../src/utils/baseModel.js';

const MODEL_FIELD = {
  name: 'base_model', label: '베이스 모델', type: 'baseModel', required: true,
  defaultValue: 'qwen/default.safetensors',
};
const WB = {
  additionalInputFields: [
    { name: 'prompt', label: '프롬프트', type: 'string', required: true },
    MODEL_FIELD,
    { name: 'steps', label: '스텝', type: 'number', defaultValue: 8 },
  ],
  allowedModelFolders: ['qwen/'],
  allowedModelTypes: [],
  modelExposurePolicy: 'full',
  modelWhitelist: [],
};
const NO_MODEL_WB = { additionalInputFields: [{ name: 'image', label: '이미지', type: 'image', required: true }] };

// MCP generate 가 보내기 전에 하는 필수 칸 검사와 같은 판정
const missingRequired = (wb, params) => wb.additionalInputFields
  .filter((f) => f.required && f.name !== 'prompt' && (params[f.name] === undefined || params[f.name] === ''))
  .map((f) => f.name);

test('옛 방식(aiModel 을 칸에 넣지 않음)은 필수 칸 검사에서 base_model 이 빠진다 — 고치기 전 실패의 재현', () => {
  assert.deepEqual(missingRequired(WB, {}), ['base_model']);
});

test('aiModel 을 주면 베이스 모델 칸에 들어가고 top-level 로는 보내지 않는다', () => {
  const r = applyBaseModel(WB, {}, 'qwen/picked.safetensors');
  assert.equal(r.additionalParams.base_model, 'qwen/picked.safetensors');
  assert.equal(r.aiModel, undefined);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(missingRequired(WB, r.additionalParams), []);
});

test('aiModel 을 안 주면 칸 기본값을 넣는다 (화면이 기본값을 미리 채우는 것과 같다)', () => {
  const r = applyBaseModel(WB, {}, undefined);
  assert.equal(r.additionalParams.base_model, 'qwen/default.safetensors');
  assert.deepEqual(missingRequired(WB, r.additionalParams), []);
});

test('기본값도 없고 aiModel 도 없으면 비워 둔다 — 필수 칸 검사가 알린다', () => {
  const wb = { ...WB, additionalInputFields: [{ ...MODEL_FIELD, defaultValue: undefined }] };
  const r = applyBaseModel(wb, {}, '');
  assert.equal(r.additionalParams.base_model, undefined);
  assert.deepEqual(missingRequired(wb, r.additionalParams), ['base_model']);
});

test('additionalParams 에 칸 값을 직접 넣었으면 그 값이 우선이고, 다른 aiModel 은 경고로 알린다', () => {
  const r = applyBaseModel(WB, { base_model: 'qwen/explicit.safetensors' }, 'qwen/picked.safetensors');
  assert.equal(r.additionalParams.base_model, 'qwen/explicit.safetensors');
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /aiModel "qwen\/picked\.safetensors" was ignored/);
});

test('칸 값과 aiModel 이 같으면 경고하지 않는다', () => {
  const r = applyBaseModel(WB, { base_model: 'qwen/picked.safetensors' }, 'qwen/picked.safetensors');
  assert.deepEqual(r.warnings, []);
});

test('받은 additionalParams 객체를 바꾸지 않는다', () => {
  const input = { steps: 4 };
  applyBaseModel(WB, input, 'qwen/picked.safetensors');
  assert.deepEqual(input, { steps: 4 });
});

test('칸 이름이 base_model 이 아니어도 type 으로 찾는다', () => {
  const wb = { additionalInputFields: [{ ...MODEL_FIELD, name: 'checkpoint' }] };
  assert.equal(findBaseModelField(wb).name, 'checkpoint');
  assert.equal(applyBaseModel(wb, {}, 'a.safetensors').additionalParams.checkpoint, 'a.safetensors');
});

test('type 이 baseModel 인 칸이 우선이고, 없으면 이름이 base_model 인 칸 (백엔드 well-known 이름)', () => {
  const both = { additionalInputFields: [
    { name: 'base_model', label: '옛 칸', type: 'string' },
    { ...MODEL_FIELD, name: 'checkpoint' },
  ] };
  assert.equal(findBaseModelField(both).name, 'checkpoint');
  const nameOnly = { additionalInputFields: [{ name: 'base_model', label: '모델', type: 'string' }] };
  assert.equal(findBaseModelField(nameOnly).name, 'base_model');
});

test('베이스 모델 칸이 없는 판은 aiModel 을 top-level 로 그대로 넘긴다', () => {
  const r = applyBaseModel(NO_MODEL_WB, { image: 'x' }, 'codex');
  assert.equal(r.aiModel, 'codex');
  assert.deepEqual(r.additionalParams, { image: 'x' });
  assert.equal(describeBaseModel(NO_MODEL_WB), null);
});

// d-ice-all 판: 모델 칸이 이름 base_model 인 select (provider). 백엔드도 well-known 이름으로 이 칸을 먼저 읽는다
const SELECT_WB = { additionalInputFields: [{
  name: 'base_model', label: 'Provider', type: 'select', required: true, defaultValue: 'codex',
  options: [{ key: 'Codex (구독 · ImageGen)', value: 'codex' }, { key: 'Other', value: 'other' }],
}] };

test('select 모델 칸 — 표시 이름이나 값으로 선택지를 찾아 {key, value} 로 넣는다', () => {
  assert.deepEqual(applyBaseModel(SELECT_WB, {}, 'Other').additionalParams.base_model, { key: 'Other', value: 'other' });
  assert.deepEqual(applyBaseModel(SELECT_WB, {}, 'other').additionalParams.base_model, { key: 'Other', value: 'other' });
  assert.deepEqual(applyBaseModel(SELECT_WB, {}, undefined).additionalParams.base_model, { key: 'Codex (구독 · ImageGen)', value: 'codex' });
});

test('select 모델 칸 — 직접 넣은 {key, value} 와 같은 선택지를 표시 이름으로 줘도 경고하지 않는다', () => {
  const r = applyBaseModel(SELECT_WB, { base_model: { key: 'Other', value: 'other' } }, 'Other');
  assert.deepEqual(r.warnings, []);
});

test('select 모델 칸 — get_workboard 는 선택지 값을 options 로 보인다', () => {
  assert.deepEqual(describeBaseModel(SELECT_WB).options, ['codex', 'other']);
  assert.equal(describeBaseModel(SELECT_WB).default, 'codex');
});

test('get_workboard 안내 — 칸 이름·필수·기본값·폴더 제한', () => {
  assert.deepEqual(describeBaseModel(WB), {
    field: 'base_model',
    required: true,
    default: 'qwen/default.safetensors',
    allowedFolders: ['qwen/'],
    allowedModelTypes: [],
  });
});

test('get_workboard 안내 — whitelist 정책이면 그 목록을 options 로 보인다', () => {
  const wb = { ...WB, modelExposurePolicy: 'whitelist', modelWhitelist: ['qwen/a.safetensors', 'qwen/b.safetensors'] };
  assert.deepEqual(describeBaseModel(wb).options, ['qwen/a.safetensors', 'qwen/b.safetensors']);
});

test('get_workboard 안내 — {key, value} 기본값은 value 를, 빈 기본값은 null 을 보인다', () => {
  const withObj = { ...WB, additionalInputFields: [{ ...MODEL_FIELD, defaultValue: { key: '기본', value: 'qwen/obj.safetensors' } }] };
  assert.equal(describeBaseModel(withObj).default, 'qwen/obj.safetensors');
  const empty = { ...WB, additionalInputFields: [{ ...MODEL_FIELD, defaultValue: '' }] };
  assert.equal(describeBaseModel(empty).default, null);
});
