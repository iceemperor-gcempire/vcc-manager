/**
 * 생성 요청의 입력 칸 값을 판 스키마로 거르고 채우기 (#1284).
 * LLM 이 값을 채우는 채팅 도구가 없는 칸·선택지 밖 값을 등록까지 가져가지 못하게 한다.
 */
const { normalizeGenerationParams, MAX_LISTED_OPTIONS } = require('../services/generationParams');

const A = 'a'.repeat(24);
const B = 'b'.repeat(24);

const board = (extra = {}) => ({
  additionalInputFields: [
    { name: 'base_model', type: 'baseModel', required: true, defaultValue: 'flux/dev.safetensors' },
    { name: 'size', type: 'select', required: true, defaultValue: '1024x1024', options: [{ key: '정사각', value: '1024x1024' }, { key: '가로', value: '1344x768' }] },
    { name: 'steps', type: 'number', defaultValue: 20 },
    { name: 'upscale', type: 'select', options: [{ key: '없음', value: 0 }, { key: '2배', value: 2 }] },
    { name: 'hires', type: 'boolean', defaultValue: false },
    { name: 'note', type: 'string' },
    { name: 'ref', type: 'image', imageConfig: { maxImages: 1 } },
    { name: 'refs', type: 'image', imageConfig: { maxImages: 3 } },
    { name: 'clip', type: 'video', videoConfig: { maxVideos: 1 } },
  ],
  ...extra,
});

describe('normalizeGenerationParams', () => {
  test('아무 값도 안 주면 기본값으로 채운다 — select 는 {key, value}, 기본값 없는 select 는 첫 선택지', () => {
    const r = normalizeGenerationParams(board(), undefined);
    expect(r.errors).toEqual([]);
    expect(r.additionalParams).toEqual({
      base_model: 'flux/dev.safetensors',
      size: { key: '정사각', value: '1024x1024' },
      steps: 20,
      upscale: { key: '없음', value: 0 },
      hires: false,
    });
    expect(r.filled.sort()).toEqual(['base_model', 'hires', 'size', 'steps', 'upscale']);
  });

  test('기본값도 값도 없는 칸과 첨부 칸은 비워 둔다', () => {
    const r = normalizeGenerationParams(board(), {});
    expect(r.additionalParams).not.toHaveProperty('note');
    expect(r.additionalParams).not.toHaveProperty('ref');
    expect(r.additionalParams).not.toHaveProperty('clip');
  });

  test('select 는 값·표시 이름·글자로 견줘 {key, value} 로 맞춘다', () => {
    expect(normalizeGenerationParams(board(), { size: '1344x768' }).additionalParams.size).toEqual({ key: '가로', value: '1344x768' });
    expect(normalizeGenerationParams(board(), { size: '가로' }).additionalParams.size).toEqual({ key: '가로', value: '1344x768' });
    expect(normalizeGenerationParams(board(), { size: { key: '가로', value: '1344x768' } }).additionalParams.size).toEqual({ key: '가로', value: '1344x768' });
    expect(normalizeGenerationParams(board(), { upscale: '2' }).additionalParams.upscale).toEqual({ key: '2배', value: 2 });
  });

  test('선택지 밖 값은 오류 — 고를 수 있는 값을 함께 알려 준다', () => {
    const r = normalizeGenerationParams(board(), { size: '4096x4096' });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/"size"/);
    expect(r.errors[0]).toMatch(/1024x1024/);
    expect(r.errors[0]).toMatch(/1344x768/);
  });

  test('없는 칸은 오류 — 있는 칸 이름을 알려 준다', () => {
    const r = normalizeGenerationParams(board(), { cfg_scale: 7 });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/"cfg_scale"/);
    expect(r.errors[0]).toMatch(/"steps"/);
  });

  test('숫자·불리언 변환과 오류', () => {
    expect(normalizeGenerationParams(board(), { steps: '30' }).additionalParams.steps).toBe(30);
    expect(normalizeGenerationParams(board(), { steps: 0 }).additionalParams.steps).toBe(0);
    expect(normalizeGenerationParams(board(), { steps: 'many' }).errors[0]).toMatch(/숫자/);
    expect(normalizeGenerationParams(board(), { hires: 'true' }).additionalParams.hires).toBe(true);
    expect(normalizeGenerationParams(board(), { hires: 'yes' }).errors[0]).toMatch(/true 또는 false/);
  });

  test('첨부: id 문자열·객체·배열을 칸의 개수에 맞는 꼴로', () => {
    const r = normalizeGenerationParams(board(), { ref: A, refs: [A, { imageId: B }], clip: { videoId: A } });
    expect(r.errors).toEqual([]);
    expect(r.additionalParams.ref).toEqual({ imageId: A });
    expect(r.additionalParams.refs).toEqual([{ imageId: A }, { imageId: B }]);
    expect(r.additionalParams.clip).toEqual({ videoId: A });
  });

  test('첨부: 지어낸 id 와 개수 초과는 오류', () => {
    expect(normalizeGenerationParams(board(), { ref: 'image-1' }).errors[0]).toMatch(/첨부 id/);
    expect(normalizeGenerationParams(board(), { ref: [A, B] }).errors[0]).toMatch(/최대 1개/);
  });

  test('모델: 허용 목록 정책인 판은 목록 밖 모델을 거절, 전체 노출 판은 통과 (폴더 검사는 등록 쪽)', () => {
    const wl = board({ modelExposurePolicy: 'whitelist', modelWhitelist: ['flux/dev.safetensors', 'flux/schnell.safetensors'] });
    expect(normalizeGenerationParams(wl, { base_model: 'flux/schnell.safetensors' }).errors).toEqual([]);
    const bad = normalizeGenerationParams(wl, { base_model: 'sdxl/other.safetensors' });
    expect(bad.errors[0]).toMatch(/쓸 수 없는 모델/);
    expect(bad.errors[0]).toMatch(/schnell/);
    expect(normalizeGenerationParams(board(), { base_model: 'sdxl/other.safetensors' }).errors).toEqual([]);
  });

  test('오류가 여럿이면 전부 돌려준다', () => {
    const r = normalizeGenerationParams(board(), { size: 'x', steps: 'y', nope: 1 });
    expect(r.errors).toHaveLength(3);
  });

  test('선택지가 많으면 안내를 자르고 몇 개 더 있는지 적는다', () => {
    const many = { additionalInputFields: [{ name: 'style', type: 'select', options: Array.from({ length: MAX_LISTED_OPTIONS + 12 }, (_, i) => ({ key: `k${i}`, value: `v${i}` })) }] };
    const r = normalizeGenerationParams(many, { style: 'none' });
    expect(r.errors[0]).toMatch(/외 12개/);
  });

  test('칸이 없는 판, params 가 객체가 아닌 경우도 안전', () => {
    expect(normalizeGenerationParams({}, { a: 1 }).errors).toHaveLength(1);
    expect(normalizeGenerationParams(board(), 'oops').errors).toEqual([]);
    expect(normalizeGenerationParams(board(), [1, 2]).errors).toEqual([]);
  });
});
