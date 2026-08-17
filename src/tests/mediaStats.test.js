/**
 * 생성물 통계가 세 축을 모두 센다 (#807)
 *
 * 대시보드 추이 그래프와 관리자 저장소 통계가 `GeneratedImage` 만 세고 있었다.
 * **비디오는 v3.16.0 부터, 오디오는 v4.0.0(#805)부터 계속 빠져 있었다** — 축이 늘 때마다
 * 반복된 자리다. 영상·음악을 주로 만드는 사용자는 통계가 거의 비어 보였다.
 *
 * 여기서 고정하는 것은 "세 축을 다 센다" 와 "축 목록을 리터럴로 다시 적지 않는다" 두 가지다.
 */
const fs = require('fs');
const path = require('path');

const {
  GENERATED_MEDIA_MODEL_BY_TYPE,
  UPLOADED_MEDIA_MODEL_BY_TYPE,
  GENERATED_MEDIA_MODELS,
  UPLOADED_MEDIA_MODELS,
  GENERATED_MEDIA_DIRS,
} = require('../constants/mediaTypes');
const { GENERATED_MEDIA_MODELS_BY_TYPE, UPLOADED_MEDIA_MODELS_BY_TYPE, BY_NAME } = require('../models/mediaModels');

const readSrc = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

describe('축 → 모델 매핑 (#807)', () => {
  test('생성물·업로드본 모두 저장 디렉토리와 같은 축을 가진다', () => {
    const axes = Object.keys(GENERATED_MEDIA_DIRS).sort();
    expect(Object.keys(GENERATED_MEDIA_MODEL_BY_TYPE).sort()).toEqual(axes);
    expect(Object.keys(UPLOADED_MEDIA_MODEL_BY_TYPE).sort()).toEqual(axes);
  });

  test('배열 상수는 매핑에서 파생된다 — 따로 적히면 어긋난다', () => {
    expect(GENERATED_MEDIA_MODELS).toEqual(Object.values(GENERATED_MEDIA_MODEL_BY_TYPE));
    expect(UPLOADED_MEDIA_MODELS).toEqual(Object.values(UPLOADED_MEDIA_MODEL_BY_TYPE));
  });

  test('이름이 실제 모델로 해석된다 (오타·미등록이면 undefined 로 샌다)', () => {
    for (const [type, name] of Object.entries(GENERATED_MEDIA_MODEL_BY_TYPE)) {
      expect(GENERATED_MEDIA_MODELS_BY_TYPE[type]).toBeDefined();
      expect(GENERATED_MEDIA_MODELS_BY_TYPE[type].modelName).toBe(name);
    }
    for (const [type, name] of Object.entries(UPLOADED_MEDIA_MODEL_BY_TYPE)) {
      expect(UPLOADED_MEDIA_MODELS_BY_TYPE[type].modelName).toBe(name);
    }
    // BY_NAME 이 여섯 모델을 모두 담아야 한다 — 하나 빠지면 그 축이 조용히 사라진다
    expect(Object.keys(BY_NAME).sort()).toEqual(
      [...GENERATED_MEDIA_MODELS, ...UPLOADED_MEDIA_MODELS].sort()
    );
  });
});

describe('통계 경로가 이미지 전용 집계로 되돌아가지 않는다 (#807)', () => {
  // 두 라우트 모두 GeneratedImage 를 직접 집계하다 비디오·오디오를 놓쳤다.
  // 모델을 직접 require 하는 순간 같은 실수가 재발하므로 그것을 금지한다.
  test.each([
    ['routes', 'dashboard.js'],
    ['routes', 'admin.js'],
  ])('%s/%s 가 축 매핑을 경유한다', (dir, file) => {
    const src = readSrc(dir, file);
    expect(src).toContain('GENERATED_MEDIA_MODELS_BY_TYPE');
    expect(src).not.toMatch(/require\(['"]\.\.\/models\/GeneratedImage['"]\)/);
  });

  test('추이 응답이 축별 내역을 함께 낸다', () => {
    // count(합계)만 내면 "왜 늘었는지" 를 화면에서 되짚을 수 없다
    const src = readSrc('routes', 'dashboard.js');
    expect(src).toContain('byType');
  });
});
