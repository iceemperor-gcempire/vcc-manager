/**
 * 이미지·영상 방향 불일치 가드 (#862)
 *
 * 계약: anchorSizeField 가 선언된 image 필드에서, 맞춤 방식이 '늘리기'(disabled)이고
 * 첨부 이미지와 캔버스의 방향이 어긋나면 사용자용 사유를 돌려준다.
 * 크롭 모드·정사각형·판정 불가는 허용.
 */
const UploadedImage = require('../models/UploadedImage');
const GeneratedImage = require('../models/GeneratedImage');
const { findOrientationViolation, parseSize, orientationOf } = require('../services/imageOrientationGuard');

const WB = {
  additionalInputFields: [
    { name: 'first_frame', label: '시작 프레임', type: 'image',
      anchorSizeField: 'image_size', anchorFitField: 'first_frame_fit' },
    { name: 'first_frame_fit', label: '첫 프레임 맞춤', type: 'select', defaultValue: 'center',
      options: [{ key: '크롭', value: 'center' }, { key: '늘리기', value: 'disabled' }] },
    { name: 'image_size', label: '영상 크기', type: 'select' },
  ],
};

const portrait = { metadata: { width: 1664, height: 2432 } };
const landscape = { metadata: { width: 1920, height: 1080 } };

const mockImage = (doc) => {
  jest.spyOn(UploadedImage, 'findById').mockResolvedValue(null);
  jest.spyOn(GeneratedImage, 'findById').mockResolvedValue(doc);
};

afterEach(() => jest.restoreAllMocks());

const input = (over = {}) => ({
  additionalParams: {
    first_frame: [{ imageId: 'img1' }],
    image_size: '864x480',
    first_frame_fit: 'disabled',
    ...over,
  },
});

describe('#862 findOrientationViolation', () => {
  test('늘리기 + 세로 이미지 + 가로 캔버스 → 라벨·수치가 담긴 사유', async () => {
    mockImage(portrait);
    const msg = await findOrientationViolation(WB, input());
    expect(msg).toContain('시작 프레임');
    expect(msg).toContain('1664x2432');
    expect(msg).toContain('864x480');
    expect(msg).toContain('크롭');
  });

  test('크롭 모드면 방향이 어긋나도 통과', async () => {
    mockImage(portrait);
    const msg = await findOrientationViolation(WB, input({ first_frame_fit: 'center' }));
    expect(msg).toBeNull();
  });

  test('맞춤 방식 미제출 시 필드 기본값(center)으로 판정 → 통과', async () => {
    mockImage(portrait);
    const params = input(); delete params.additionalParams.first_frame_fit;
    const msg = await findOrientationViolation(WB, params);
    expect(msg).toBeNull();
  });

  test('방향 일치(가로+가로)는 통과', async () => {
    mockImage(landscape);
    const msg = await findOrientationViolation(WB, input());
    expect(msg).toBeNull();
  });

  test('세로 캔버스 + 세로 이미지는 통과', async () => {
    mockImage(portrait);
    const msg = await findOrientationViolation(WB, input({ image_size: '480x864' }));
    expect(msg).toBeNull();
  });

  test('정사각형 이미지는 어느 캔버스든 통과', async () => {
    mockImage({ metadata: { width: 1024, height: 1024 } });
    const msg = await findOrientationViolation(WB, input());
    expect(msg).toBeNull();
  });

  test('메타데이터 없으면(판정 불가) 통과', async () => {
    mockImage({ metadata: {} });
    const msg = await findOrientationViolation(WB, input());
    expect(msg).toBeNull();
  });

  test('이미지 미첨부면 통과', async () => {
    const msg = await findOrientationViolation(WB, input({ first_frame: [] }));
    expect(msg).toBeNull();
  });

  test('anchorFitField 미선언 필드는 항상 검사한다', async () => {
    mockImage(portrait);
    const wb = { additionalInputFields: [
      { name: 'first_frame', label: '시작 프레임', type: 'image', anchorSizeField: 'image_size' },
      { name: 'image_size', label: '영상 크기', type: 'select' },
    ]};
    const msg = await findOrientationViolation(wb, input());
    expect(msg).not.toBeNull();
  });
});

describe('#862 helpers', () => {
  test.each([
    ['864x480', { w: 864, h: 480 }],
    ['480X864', { w: 480, h: 864 }],
    ['garbage', null],
    ['', null],
  ])('parseSize(%s)', (v, expected) => expect(parseSize(v)).toEqual(expected));

  test('orientationOf — 정사각형·결측은 null', () => {
    expect(orientationOf(100, 100)).toBeNull();
    expect(orientationOf(0, 100)).toBeNull();
    expect(orientationOf(200, 100)).toBe('landscape');
    expect(orientationOf(100, 200)).toBe('portrait');
  });
});
