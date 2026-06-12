const fs = require('fs');
const path = require('path');
const { BUILTIN_TAG_NAMES, BUILTIN_TAG_META } = require('../constants/builtinTags');

/**
 * #546 — builtinTags 백엔드 ↔ 프론트 미러 동기화 회귀 테스트.
 * 두 파일은 모듈 시스템이 달라(CJS vs ESM) 공유가 불가능한 의도적 미러 —
 * 한쪽만 바뀌는 회귀를 여기서 잡는다 (single-source-of-truth 정책).
 */
describe('builtinTags 미러 동기화', () => {
  const frontendSrc = fs.readFileSync(
    path.join(__dirname, '../../frontend/src/constants/builtinTags.js'),
    'utf8'
  );

  test('태그 이름이 프론트 미러와 일치', () => {
    for (const name of Object.values(BUILTIN_TAG_NAMES)) {
      expect(frontendSrc).toContain(`'${name}'`);
    }
  });

  test('태그 색이 프론트 미러와 일치', () => {
    for (const meta of Object.values(BUILTIN_TAG_META)) {
      expect(frontendSrc).toContain(meta.color);
    }
  });
});
