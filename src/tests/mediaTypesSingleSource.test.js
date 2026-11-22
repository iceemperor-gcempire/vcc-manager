/**
 * 미디어 축 단일 소스 (#808)
 *
 * 이미지·비디오·오디오처럼 축이 늘 때마다 같은 목록을 여러 곳에 리터럴로 적어왔고,
 * 그때마다 한두 곳이 빠져 사고가 났다. 리터럴이 다시 등장하면 여기서 잡는다.
 */
const fs = require('fs');
const path = require('path');
const {
  ATTACHMENT_FIELD_TYPES,
  GENERATED_MEDIA_DIRS,
  GENERATED_MEDIA_MODELS,
  UPLOADED_MEDIA_MODELS,
} = require('../constants/mediaTypes');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const readRepo = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

describe('미디어 축 상수 (#808)', () => {
  test('세 축이 모두 정의돼 있다', () => {
    expect(ATTACHMENT_FIELD_TYPES).toEqual(['image', 'video', 'audio']);
    expect(Object.keys(GENERATED_MEDIA_DIRS).sort()).toEqual(['audio', 'image', 'video']);
    expect(GENERATED_MEDIA_MODELS).toHaveLength(3);
    expect(UPLOADED_MEDIA_MODELS).toHaveLength(3);
  });

  test('생성물 모델과 저장 디렉토리의 축이 일치', () => {
    // GeneratedImage/Video/Audio ↔ generated/videos/audios — 하나가 늘면 다른 쪽도 늘어야 한다
    expect(GENERATED_MEDIA_MODELS.length).toBe(Object.keys(GENERATED_MEDIA_DIRS).length);
  });
});

describe('첨부형 필드 타입 리터럴 재도입 방지 (#808)', () => {
  // 실제로 이 목록이 4곳에 흩어져 있었다
  const targets = [
    ['routes', 'jobs.js'],
    ['services', 'queueService.js'],
  ];

  test.each(targets)('%s/%s 가 상수를 쓴다', (dir, file) => {
    const src = read(dir, file);
    expect(src).toContain('ATTACHMENT_FIELD_TYPES');
    expect(src).not.toMatch(/\['image',\s*'video',\s*'audio'\]/);
    expect(src).not.toMatch(/type === 'image' \|\| .*type === 'video' \|\| .*type === 'audio'/);
  });

  test('프론트엔드도 mirror 상수를 쓴다', () => {
    for (const p of [
      ['frontend', 'src', 'components', 'admin', 'workboardEditor', 'FieldInspector.js'],
      ['frontend', 'src', 'pages', 'ImageGeneration.js'],
    ]) {
      const src = readRepo(...p);
      expect(src).toContain('ATTACHMENT_FIELD_TYPES');
      expect(src).not.toMatch(/\['image',\s*'video',\s*'audio'\]/);
    }
  });

  test('mirror 가 백엔드 상수와 일치', () => {
    const src = readRepo('frontend', 'src', 'templates', 'capabilities.js');
    const m = src.match(/export const ATTACHMENT_FIELD_TYPES = (\[[\s\S]*?\]);/);
    expect(m).toBeTruthy();
    expect(JSON.parse(m[1])).toEqual([...ATTACHMENT_FIELD_TYPES]);
  });
});
