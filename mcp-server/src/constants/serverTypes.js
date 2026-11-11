// generated — 수정 금지. source: src/constants/serverTypes.js (#745)
// 재생성: node scripts/sync-server-type-mirrors.js
// 이 파일은 backend 단일 source 의 mirror 이며, 동기화는 serverTypesMirror.test.js 가 검증한다.

export const SERVER_TYPES = [
  "ComfyUI",
  "OpenAI",
  "OpenAI Compatible",
  "Gemini",
  "d-ice-all"
];
export const OUTPUT_FORMATS = [
  "image",
  "video",
  "audio",
  "text"
];
// 파일을 첨부받는 필드 타입 — 백엔드 constants/mediaTypes 가 단일 소스. 기본값 채우기에서 뺀다 (#1088)
export const ATTACHMENT_FIELD_TYPES = [
  "image",
  "video",
  "audio"
];
