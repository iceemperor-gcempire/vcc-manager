/**
 * 첨부 목록 ↔ 갤러리 선택 변환 (#1182)
 *
 * 갤러리(ImageSelectDialog)는 다중 선택일 때 처음 선택까지 포함한 전체 선택을 돌려주고, 단일 선택일 때는
 * 배열이 아니라 객체를 돌려준다. 이 차이를 모르고 덧붙이면 같은 이미지가 두 번 들어가 모델에 두 번 간다.
 */
import { galleryInitialSelection, gallerySlots, mergeGallerySelection } from './attachSelection';

const file = (name) => ({ file: { name }, preview: `blob:${name}` });
const existing = (id) => ({ _id: id, url: `/api/files/${id}` });
const pick = (id) => ({ imageId: id, imageType: 'GeneratedImage', image: { _id: id, url: `/api/files/${id}` } });

describe('galleryInitialSelection', () => {
  test('기존 이미지만 imageId 로 옮기고 새 파일은 뺀다', () => {
    expect(galleryInitialSelection([file('a'), existing('x'), existing('y')])).toEqual([
      { imageId: 'x', image: { _id: 'x', url: '/api/files/x' } },
      { imageId: 'y', image: { _id: 'y', url: '/api/files/y' } },
    ]);
  });

  test('비어 있으면 빈 배열', () => {
    expect(galleryInitialSelection([])).toEqual([]);
  });
});

describe('gallerySlots', () => {
  test('새 파일이 차지한 자리만 뺀다 — 기존 이미지는 갤러리에서 바꿀 수 있으니 자리에 넣는다', () => {
    expect(gallerySlots([file('a'), existing('x')], 3)).toBe(2);
  });

  test('새 파일로 다 차면 0', () => {
    expect(gallerySlots([file('a'), file('b')], 2)).toBe(0);
  });

  test('음수가 되지 않는다', () => {
    expect(gallerySlots([file('a'), file('b')], 1)).toBe(0);
  });
});

describe('mergeGallerySelection', () => {
  test('단일 선택(객체)도 받는다', () => {
    expect(mergeGallerySelection([], pick('x'), 1)).toEqual([existing('x')]);
  });

  test('단일 선택으로 바꾸면 앞서 고른 기존 이미지가 빠진다', () => {
    expect(mergeGallerySelection([existing('x')], pick('y'), 1)).toEqual([existing('y')]);
  });

  test('다중 선택 결과에 처음 선택이 들어 있어도 겹치지 않는다', () => {
    const before = [existing('x')];
    expect(mergeGallerySelection(before, [pick('x'), pick('y')], 3)).toEqual([existing('x'), existing('y')]);
  });

  test('새 파일은 자리 그대로 두고, 선택에서 빠진 기존 이미지는 빼고, 새로 고른 것은 뒤에 붙인다', () => {
    const a = file('a');
    const before = [existing('x'), a, existing('y')];
    expect(mergeGallerySelection(before, [pick('y'), pick('z')], 4)).toEqual([a, existing('y'), existing('z')]);
  });

  test('선택 안에서 같은 이미지가 반복돼도 한 번만', () => {
    expect(mergeGallerySelection([], [pick('x'), pick('x')], 3)).toEqual([existing('x')]);
  });

  test('최대 장수를 넘는 뒤쪽은 자른다 — 새 파일은 앞에 있어 잘리지 않는다', () => {
    const a = file('a');
    expect(mergeGallerySelection([a], [pick('x'), pick('y')], 2)).toEqual([a, existing('x')]);
  });

  test('id 가 숫자·문자열로 섞여도 같은 이미지로 본다', () => {
    expect(mergeGallerySelection([{ _id: 7, url: 'u' }], [{ imageId: '7', image: { url: 'u' } }], 2)).toEqual([
      { _id: 7, url: 'u' },
    ]);
  });

  test('imageId 없는 항목은 무시한다', () => {
    expect(mergeGallerySelection([], [null, { image: { url: 'u' } }, pick('x')], 3)).toEqual([existing('x')]);
  });
});
