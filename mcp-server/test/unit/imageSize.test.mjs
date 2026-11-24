/**
 * 작업판 크기 칸 (#1290) — generate·continue_job 의 top-level imageSize 를 칸에 넣기.
 * 배포 판의 크기 칸은 `image_size` (select, 기본값 있음)다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findImageSizeField, applyImageSize } from '../../src/utils/imageSize.js';
import { fillFieldDefaults } from '../../src/utils/fieldDefaults.js';

const SIZE_FIELD = {
  name: 'image_size', label: '크기', type: 'select', required: true, defaultValue: '1024x1024',
  options: [
    { key: '1024x1024 (1:1)', value: '1024x1024' },
    { key: '2752x1536 (가로 16:9 · 2K)', value: '2752x1536' },
  ],
};
const WB = {
  additionalInputFields: [
    { name: 'prompt', label: '프롬프트', type: 'string', required: true },
    SIZE_FIELD,
    { name: 'steps', label: '스텝', type: 'number', defaultValue: 8 },
  ],
};
const NO_SIZE_WB = { additionalInputFields: [{ name: 'steps', label: '스텝', type: 'number', defaultValue: 8 }] };

// generate 가 하는 순서 — imageSize 를 칸에 넣고, 남은 칸은 기본값으로
const prepare = (wb, params, imageSize) => {
  const r = applyImageSize(wb, params, imageSize);
  const d = fillFieldDefaults(wb, r.additionalParams);
  return { ...r, additionalParams: d.additionalParams, filled: d.filled };
};

test('옛 순서(기본값을 먼저 채움)는 요청한 크기 대신 판 기본 크기가 칸에 들어간다 — 고치기 전 동작의 재현', () => {
  const d = fillFieldDefaults(WB, {});
  assert.equal(d.additionalParams.image_size.value, '1024x1024');
});

test('크기 칸은 image_size 가 먼저이고, 없으면 imageSize 다', () => {
  assert.equal(findImageSizeField(WB).name, 'image_size');
  assert.equal(findImageSizeField({ additionalInputFields: [{ name: 'imageSize', type: 'string' }] }).name, 'imageSize');
  assert.equal(findImageSizeField({
    additionalInputFields: [{ name: 'imageSize', type: 'string' }, { name: 'image_size', type: 'string' }],
  }).name, 'image_size');
  assert.equal(findImageSizeField(NO_SIZE_WB), null);
  assert.equal(findImageSizeField(undefined), null);
});

test('top-level imageSize 를 값으로 주면 크기 칸에 {key, value} 로 들어가고 top-level 로는 보내지 않는다', () => {
  const r = prepare(WB, {}, '2752x1536');
  assert.deepEqual(r.additionalParams.image_size, { key: '2752x1536 (가로 16:9 · 2K)', value: '2752x1536' });
  assert.equal(r.imageSize, undefined);
  assert.deepEqual(r.warnings, []);
  assert.ok(!r.filled.includes('image_size'));
  assert.ok(r.filled.includes('steps'));
});

test('표시 이름(key)이나 {key, value} 로 줘도 같은 선택지를 찾는다', () => {
  const byKey = applyImageSize(WB, {}, '2752x1536 (가로 16:9 · 2K)');
  assert.equal(byKey.additionalParams.image_size.value, '2752x1536');
  const byObject = applyImageSize(WB, {}, { key: 'x', value: '2752x1536' });
  assert.deepEqual(byObject.additionalParams.image_size, { key: '2752x1536 (가로 16:9 · 2K)', value: '2752x1536' });
});

test('imageSize 를 안 주면 칸을 비워 두고 fillFieldDefaults 가 기본값을 넣는다', () => {
  assert.equal(applyImageSize(WB, {}, undefined).additionalParams.image_size, undefined);
  assert.equal(applyImageSize(WB, {}, '').additionalParams.image_size, undefined);
  const r = prepare(WB, {}, undefined);
  assert.equal(r.additionalParams.image_size.value, '1024x1024');
  assert.ok(r.filled.includes('image_size'));
});

test('additionalParams 에 크기 칸 값이 있으면 그 값이 먼저이고, 다른 imageSize 는 경고와 함께 무시된다', () => {
  const explicit = { image_size: { key: '1024x1024 (1:1)', value: '1024x1024' } };
  const r = applyImageSize(WB, explicit, '2752x1536');
  assert.equal(r.additionalParams.image_size.value, '1024x1024');
  assert.equal(r.imageSize, undefined);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /2752x1536/);
});

test('둘이 같은 크기면 경고가 없다 (값과 표시 이름으로 섞어 줘도)', () => {
  const explicit = { image_size: { key: '2752x1536 (가로 16:9 · 2K)', value: '2752x1536' } };
  assert.deepEqual(applyImageSize(WB, explicit, '2752x1536').warnings, []);
  assert.deepEqual(applyImageSize(WB, { image_size: '2752x1536' }, '2752x1536 (가로 16:9 · 2K)').warnings, []);
});

test('선택지에 없는 크기는 받은 그대로 칸에 넣고 경고한다', () => {
  const r = applyImageSize(WB, {}, '640x640');
  assert.equal(r.additionalParams.image_size, '640x640');
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /640x640/);
});

test('select 가 아닌 크기 칸은 받은 값을 그대로 넣고 경고하지 않는다', () => {
  const wb = { additionalInputFields: [{ name: 'image_size', type: 'string', defaultValue: '1024x1024' }] };
  const r = applyImageSize(wb, {}, '640x640');
  assert.equal(r.additionalParams.image_size, '640x640');
  assert.deepEqual(r.warnings, []);
});

test('크기 칸이 없는 판은 imageSize 를 top-level 로 그대로 넘긴다', () => {
  const params = { steps: 4 };
  const r = applyImageSize(NO_SIZE_WB, params, { key: 'a', value: '512x512' });
  assert.deepEqual(r.imageSize, { key: 'a', value: '512x512' });
  assert.deepEqual(r.additionalParams, { steps: 4 });
  assert.deepEqual(r.warnings, []);
});

test('받은 additionalParams 객체는 바꾸지 않는다', () => {
  const params = {};
  applyImageSize(WB, params, '2752x1536');
  assert.deepEqual(params, {});
});
