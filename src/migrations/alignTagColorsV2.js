const Tag = require('../models/Tag');
const { BUILTIN_TAG_NAMES, BUILTIN_TAG_META } = require('../constants/builtinTags');

// #546 — 태그 색을 v2 팔레트로 정렬.
// 구 기본값과 "정확히 일치" 하는 색만 변경한다 — 사용자가 직접 고른 커스텀 색은 보존.
// (구 기본값: 일반 태그 #1976d2 / 세계관 #9c27b0 / 시스템 프롬프트 #2196f3)
const COLOR_MAP = Object.freeze({
  '#1976d2': '#C96A3B', // 구 MUI 블루 기본값 → v2 primary
  '#9c27b0': BUILTIN_TAG_META[BUILTIN_TAG_NAMES.WORLDVIEW].color,
  '#2196f3': BUILTIN_TAG_META[BUILTIN_TAG_NAMES.SYSTEM_PROMPT].color,
});

async function alignTagColorsV2() {
  let total = 0;
  for (const [from, to] of Object.entries(COLOR_MAP)) {
    const res = await Tag.updateMany({ color: from }, { $set: { color: to } });
    total += res.modifiedCount || 0;
  }
  if (total > 0) {
    console.log(`🎨 alignTagColorsV2: ${total}개 태그 색을 v2 팔레트로 이전`);
  }
  return total;
}

module.exports = alignTagColorsV2;
