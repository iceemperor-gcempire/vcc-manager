/**
 * 파이프라인 이미지 → LLM 단계 전달: image 필드 값에서 imageId 추출 (유연 파싱).
 */
const { collectImageIds } = require('../services/pipelineRunService');

describe('collectImageIds — image 필드 imageId 추출', () => {
  test('{imageId} 객체 배열 (buildStepInput 형태)', () => {
    const inputData = { input_images: [{ imageId: 'a1' }, { imageId: 'a2' }] };
    expect(collectImageIds(inputData, ['input_images'])).toEqual(['a1', 'a2']);
  });

  test('id 문자열 배열 (프론트 사전입력 형태)', () => {
    const inputData = { input_images: ['b1', 'b2'] };
    expect(collectImageIds(inputData, ['input_images'])).toEqual(['b1', 'b2']);
  });

  test('단일 값(배열 아님)도 처리', () => {
    expect(collectImageIds({ imgs: 'c1' }, ['imgs'])).toEqual(['c1']);
    expect(collectImageIds({ imgs: { imageId: 'c2' } }, ['imgs'])).toEqual(['c2']);
  });

  test('여러 image 필드 합산 + falsy/빈값 제외', () => {
    const inputData = { a: ['x1', null, ''], b: [{ imageId: 'y1' }], c: undefined };
    expect(collectImageIds(inputData, ['a', 'b', 'c'])).toEqual(['x1', 'y1']);
  });

  test('image 필드 없음/빈 입력 → 빈 배열', () => {
    expect(collectImageIds({}, [])).toEqual([]);
    expect(collectImageIds(null, ['x'])).toEqual([]);
    expect(collectImageIds({ x: [] }, ['x'])).toEqual([]);
  });

  test('_id / id 키도 인식', () => {
    expect(collectImageIds({ m: [{ _id: 'd1' }, { id: 'd2' }] }, ['m'])).toEqual(['d1', 'd2']);
  });
});
