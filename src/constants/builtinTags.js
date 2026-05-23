// 시스템이 인식하는 well-known 태그 이름 (#400).
// 특별한 boolean flag 대신 NAME 으로 식별 — 모든 태그는 동등하게 취급되며,
// 시스템은 특정 역할이 필요할 때 이 상수의 name 으로 사용자의 태그를 조회 / 자동 생성한다.

const BUILTIN_TAG_NAMES = Object.freeze({
  WORLDVIEW: '세계관',        // 사전 컨텍스트 / 배경 / 인물 등
  SYSTEM_PROMPT: '시스템 프롬프트', // LLM 작업 지침 문서
});

// UI 표시용 메타 (한국어 라벨 + 기본 색)
const BUILTIN_TAG_META = Object.freeze({
  [BUILTIN_TAG_NAMES.WORLDVIEW]: { label: '세계관', color: '#9c27b0' },
  [BUILTIN_TAG_NAMES.SYSTEM_PROMPT]: { label: '시스템 프롬프트', color: '#2196f3' },
});

module.exports = { BUILTIN_TAG_NAMES, BUILTIN_TAG_META };
