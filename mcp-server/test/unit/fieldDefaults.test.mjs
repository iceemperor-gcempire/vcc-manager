/**
 * 작업판 칸 기본값 채우기 (#1088) — 웹 생성 화면이 판을 열 때 미리 채우는 규칙과 같다.
 * 알파 실호출에서 드러났다: 모델 칸만 채워서는 Z-Image 판이 image_size·upscale_model 필수 칸에서 막혔다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillFieldDefaults } from '../../src/utils/fieldDefaults.js';

// 배포 판 Z-Image 와 같은 모양 — 모델·크기·업스케일이 모두 필수이고 기본값이 있다
const WB = {
  additionalInputFields: [
    { name: 'base_model', type: 'baseModel', required: true, defaultValue: 'Z-Image\\z.safetensors' },
    { name: 'image_size', type: 'select', required: true, defaultValue: '1024x1024',
      options: [{ key: '정사각 1024', value: '1024x1024' }, { key: '가로 1344', value: '1344x768' }] },
    { name: 'upscale_model', type: 'select', required: true,
      options: [{ key: '없음', value: 'none' }, { key: '4x', value: '4x.pth' }] },
    { name: 'steps', type: 'number', defaultValue: 8 },
    { name: 'denoise_upscale', type: 'boolean', required: true, defaultValue: false },
    { name: 'note', type: 'string', defaultValue: '' },
    { name: 'image', type: 'image', required: true },
  ],
};
const missingRequired = (wb, params) => wb.additionalInputFields
  .filter((f) => f.required && f.type !== 'image' && (params[f.name] === undefined || params[f.name] === ''))
  .map((f) => f.name);

test('아무것도 안 주면 필수 칸이 빠졌다고 나온다 — 고치기 전 실패의 재현', () => {
  assert.deepEqual(missingRequired(WB, {}), ['base_model', 'image_size', 'upscale_model', 'denoise_upscale']);
});

test('기본값을 채우면 첨부 칸 말고는 필수 칸이 다 찬다', () => {
  const { additionalParams, filled } = fillFieldDefaults(WB, {});
  assert.deepEqual(missingRequired(WB, additionalParams), []);
  assert.deepEqual(filled, ['base_model', 'image_size', 'upscale_model', 'steps', 'denoise_upscale']);
});

test('select 는 기본값의 선택지를, 기본값이 없으면 첫 선택지를 {key, value} 로 넣는다 (웹 화면과 같다)', () => {
  const { additionalParams } = fillFieldDefaults(WB, {});
  assert.deepEqual(additionalParams.image_size, { key: '정사각 1024', value: '1024x1024' });
  assert.deepEqual(additionalParams.upscale_model, { key: '없음', value: 'none' });
});

test('select 기본값이 표시 이름(key)이나 {key, value} 로 저장돼 있어도 찾는다', () => {
  const byKey = { additionalInputFields: [{ ...WB.additionalInputFields[1], defaultValue: '가로 1344' }] };
  assert.deepEqual(fillFieldDefaults(byKey, {}).additionalParams.image_size, { key: '가로 1344', value: '1344x768' });
  const byObj = { additionalInputFields: [{ ...WB.additionalInputFields[1], defaultValue: { key: '가로 1344', value: '1344x768' } }] };
  assert.deepEqual(fillFieldDefaults(byObj, {}).additionalParams.image_size, { key: '가로 1344', value: '1344x768' });
});

test('false·0 기본값도 기본값이다. 빈 문자열 기본값은 채우지 않는다', () => {
  const { additionalParams } = fillFieldDefaults(WB, {});
  assert.equal(additionalParams.denoise_upscale, false);
  assert.equal('note' in additionalParams, false);
});

test('호출자가 준 값은 그대로 두고, 첨부 칸은 건드리지 않는다', () => {
  const given = { image_size: { key: '가로 1344', value: '1344x768' }, steps: 4, image: { imageId: 'x' } };
  const { additionalParams, filled } = fillFieldDefaults(WB, given);
  assert.deepEqual(additionalParams.image_size, { key: '가로 1344', value: '1344x768' });
  assert.equal(additionalParams.steps, 4);
  assert.deepEqual(additionalParams.image, { imageId: 'x' });
  assert.equal(filled.includes('image_size'), false);
  assert.equal(filled.includes('image'), false);
});

test('받은 객체를 바꾸지 않는다', () => {
  const given = { steps: 4 };
  fillFieldDefaults(WB, given);
  assert.deepEqual(given, { steps: 4 });
});
