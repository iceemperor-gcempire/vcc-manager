/**
 * #672 동영상 썸네일 유틸 — 경로 규칙 (순수 함수).
 * 실제 ffmpeg 첫 프레임 추출은 ffmpeg 설치된 컨테이너에서 e2e 로 검증.
 */
const path = require('path');
const { thumbnailPathFor, THUMB_WIDTH } = require('../utils/videoThumbnail');

describe('#672 videoThumbnail', () => {
  test('thumbnailPathFor: 같은 디렉토리에 <name>_thumb.jpg', () => {
    expect(thumbnailPathFor('/app/uploads/videos/generated_123_0.mp4'))
      .toBe(path.join('/app/uploads/videos', 'generated_123_0_thumb.jpg'));
  });

  test('thumbnailPathFor: 확장자 무관하게 .jpg 로', () => {
    expect(thumbnailPathFor('/x/y/clip.webm')).toBe(path.join('/x/y', 'clip_thumb.jpg'));
    expect(thumbnailPathFor('/x/y/clip.mov')).toBe(path.join('/x/y', 'clip_thumb.jpg'));
  });

  test('THUMB_WIDTH 는 합리적 프리뷰 폭', () => {
    expect(THUMB_WIDTH).toBeGreaterThan(0);
    expect(THUMB_WIDTH).toBeLessThanOrEqual(640);
  });
});
