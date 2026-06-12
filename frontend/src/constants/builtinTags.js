// 시스템 인식 builtin 태그 이름 (#400). 백엔드의 src/constants/builtinTags.js 와 sync.
// flag 가 아닌 name 기반으로 식별. 모든 태그는 동등하게 취급.

export const BUILTIN_TAG_NAMES = Object.freeze({
  WORLDVIEW: '세계관',
  SYSTEM_PROMPT: '시스템 프롬프트',
});

export const BUILTIN_TAG_META = Object.freeze({
  [BUILTIN_TAG_NAMES.WORLDVIEW]: { label: '세계관', color: '#7A5CC4' },
  [BUILTIN_TAG_NAMES.SYSTEM_PROMPT]: { label: '시스템 프롬프트', color: '#4A7DBF' },
});

// 세계관 탭에 표시할 타입 chip 목록 (순서 고정)
export const BUILTIN_DOC_TYPES = [
  BUILTIN_TAG_NAMES.WORLDVIEW,
  BUILTIN_TAG_NAMES.SYSTEM_PROMPT,
];
