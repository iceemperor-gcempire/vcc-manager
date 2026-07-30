// serverType 단일 source (#745).
//
// 서버(provider) 타입 목록과 타입별 capability/메타데이터의 유일한 정의처.
// backend 는 이 모듈을 직접 import 하고, frontend/mcp-server 는 모듈 시스템이 달라
// (ESM vs CJS) 공유가 불가능하므로 `scripts/sync-server-type-mirrors.js` 로 생성된
// mirror 파일을 사용한다. mirror 동기화 회귀는 `src/tests/serverTypesMirror.test.js` 가 잡는다.
//
// 신규 serverType 추가 절차: docs/DEVELOPMENT.md 의 "신규 serverType 추가" 런북 참고.
// 요약: 이 파일에 spec 추가 → 템플릿 JSON 추가 → sync 스크립트 실행 → SERVICE_MAP 핸들러 연결.

// 타입별 spec:
// - label/color: UI 표시용 (frontend mirror 로 전파)
// - outputFormats: 지원하는 출력 형식 — 작업판 capability matrix 의 단일 source.
//   'image'/'video' 는 queueService SERVICE_MAP 에 대응 핸들러가 있어야 함 (coverage 테스트로 강제).
//   'text' 는 Bull 큐를 타지 않는 동기 SSE 경로 (routes/jobs.js).
// - modelSource: 모델 목록 동기화 방식. 'checkpoint'(ComfyUI 파일 스캔) / 'openai'(GET /v1/models)
//   / 'gemini'(GET /v1beta/models). 없으면 모델 동기화 미지원.
// - healthCheck.path: serverUrl 뒤에 붙는 헬스체크 경로 (null 이면 serverUrl 자체 GET).
// - healthCheck.auth: 'bearer'(Authorization 헤더) / 'query-key'(?key= 쿼리, Gemini 방식).
// - defaultUrl: 서버 등록 UI 의 URL 자동 입력 프리셋 (공식 base URL 이 알려진 provider 만, 없으면 null).
// - icon: 서버 카드 아이콘 키 — frontend 가 MUI 컴포넌트로 매핑 ('computer'/'text'/'storage').
const SERVER_TYPE_SPECS = Object.freeze({
  'ComfyUI': Object.freeze({
    label: 'ComfyUI',
    color: '#7e57c2', // 보라 — 서드파티/오픈소스 느낌
    outputFormats: Object.freeze(['image', 'video']),
    modelSource: 'checkpoint',
    healthCheck: Object.freeze({ path: '/system_stats', auth: 'bearer' }),
    defaultUrl: null,
    icon: 'computer',
  }),
  'OpenAI': Object.freeze({
    label: 'OpenAI',
    color: '#10a37f', // OpenAI brand teal
    outputFormats: Object.freeze(['image', 'text']),
    modelSource: 'openai',
    healthCheck: Object.freeze({ path: '/v1/models', auth: 'bearer' }),
    defaultUrl: 'https://api.openai.com',
    icon: 'text',
  }),
  'OpenAI Compatible': Object.freeze({
    label: 'OpenAI Compatible',
    color: '#607d8b', // 회색-파랑 — 호환 레이어
    outputFormats: Object.freeze(['text']),
    modelSource: 'openai',
    healthCheck: Object.freeze({ path: '/v1/models', auth: 'bearer' }),
    defaultUrl: null,
    icon: 'text',
  }),
  'Gemini': Object.freeze({
    label: 'Gemini',
    color: '#4285f4', // Google blue
    outputFormats: Object.freeze(['image', 'text']),
    modelSource: 'gemini',
    healthCheck: Object.freeze({ path: '/v1beta/models', auth: 'query-key' }),
    defaultUrl: 'https://generativelanguage.googleapis.com',
    icon: 'storage',
  }),
  // 로컬 LLM 게이트웨이 (Codex CLI ImageGen 경유 — 구독 과금, 종량 비용 없음) (#747)
  'd-ice-all': Object.freeze({
    label: 'd-ice-all',
    color: '#00acc1', // cyan — 로컬 게이트웨이 (ice 시리즈)
    outputFormats: Object.freeze(['image']),
    modelSource: null, // 모델 동기화 미지원 — aiModel 은 게이트웨이 provider 이름 (템플릿 select)
    healthCheck: Object.freeze({ path: '/health', auth: 'bearer' }),
    defaultUrl: null,
    icon: 'storage',
  }),
});

// deprecated 타입: 신규 생성은 차단하되 stale 문서의 Mongoose 검증은 통과시킨다.
// migrateTo 는 마이그레이션/작업판 import 폴백 매핑에 사용 (Phase 2 #181, #182 와 동일).
const DEPRECATED_SERVER_TYPE_SPECS = Object.freeze({
  'GPT Image': Object.freeze({
    label: 'GPT Image',
    icon: 'text',
    migrateTo: 'OpenAI',
    healthCheck: Object.freeze({ path: '/v1/models', auth: 'bearer' }),
  }),
});

// ─── 파생 목록 (직접 하드코딩 금지 — 반드시 여기서 import) ───────────────

// 활성 타입 목록 — 신규 서버 생성 허용 대상
const SERVER_TYPES = Object.freeze(Object.keys(SERVER_TYPE_SPECS));

// Mongoose enum 용 — deprecated 포함 (stale 문서 검증 통과)
const SERVER_TYPES_WITH_DEPRECATED = Object.freeze([
  ...SERVER_TYPES,
  ...Object.keys(DEPRECATED_SERVER_TYPE_SPECS),
]);

// 모델 목록 동기화 지원 타입
const MODEL_SYNC_SERVER_TYPES = Object.freeze(
  SERVER_TYPES.filter((t) => SERVER_TYPE_SPECS[t].modelSource)
);

// 구버전 export 문서의 serverType 폴백 매핑 (deprecated → 현행)
const SERVER_TYPE_LEGACY_FALLBACK = Object.freeze(
  Object.fromEntries(
    Object.entries(DEPRECATED_SERVER_TYPE_SPECS).map(([t, spec]) => [t, spec.migrateTo])
  )
);

// deprecated 포함 spec 조회 (healthCheck 등 기존 문서 대응용)
const getServerTypeSpec = (serverType) =>
  SERVER_TYPE_SPECS[serverType] || DEPRECATED_SERVER_TYPE_SPECS[serverType] || null;

module.exports = {
  SERVER_TYPE_SPECS,
  DEPRECATED_SERVER_TYPE_SPECS,
  SERVER_TYPES,
  SERVER_TYPES_WITH_DEPRECATED,
  MODEL_SYNC_SERVER_TYPES,
  SERVER_TYPE_LEGACY_FALLBACK,
  getServerTypeSpec,
};
