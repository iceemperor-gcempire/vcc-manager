#!/usr/bin/env node
// serverType mirror 생성 스크립트 (#745).
//
// backend 단일 source(src/constants/serverTypes.js)에서 frontend/mcp-server 용
// mirror 파일을 생성한다. 모듈 시스템이 달라(CJS vs ESM) 직접 공유가 불가능한
// 의도적 mirror — 손으로 고치지 말고 backend 상수 수정 후 이 스크립트를 재실행할 것.
//
//   node scripts/sync-server-type-mirrors.js          # mirror 재생성
//
// 동기화 회귀는 src/tests/serverTypesMirror.test.js 가 잡는다 (render 결과 ↔ 디스크 비교).

const fs = require('fs');
const path = require('path');
const {
  SERVER_TYPE_SPECS,
  DEPRECATED_SERVER_TYPE_SPECS,
  SERVER_TYPES,
  MODEL_SYNC_SERVER_TYPES,
} = require('../src/constants/serverTypes');

const REPO_ROOT = path.join(__dirname, '..');
const FRONTEND_TARGET = path.join(REPO_ROOT, 'frontend/src/templates/capabilities.js');
const MCP_TARGET = path.join(REPO_ROOT, 'mcp-server/src/constants/serverTypes.js');

const HEADER = `// generated — 수정 금지. source: src/constants/serverTypes.js (#745)
// 재생성: node scripts/sync-server-type-mirrors.js
// 이 파일은 backend 단일 source 의 mirror 이며, 동기화는 serverTypesMirror.test.js 가 검증한다.`;

const json = (v) => JSON.stringify(v, null, 2);

const pickMap = (field) =>
  Object.fromEntries(SERVER_TYPES.map((t) => [t, SERVER_TYPE_SPECS[t][field]]));

function renderFrontendCapabilities() {
  const capabilities = Object.fromEntries(
    SERVER_TYPES.map((t) => [t, [...SERVER_TYPE_SPECS[t].outputFormats]])
  );
  const knownUrls = Object.fromEntries(
    SERVER_TYPES.filter((t) => SERVER_TYPE_SPECS[t].defaultUrl)
      .map((t) => [t, SERVER_TYPE_SPECS[t].defaultUrl])
  );
  const deprecated = Object.fromEntries(
    Object.entries(DEPRECATED_SERVER_TYPE_SPECS).map(([t, spec]) => [
      t,
      { label: spec.label, icon: spec.icon },
    ])
  );
  const loraTypes = SERVER_TYPES.filter(
    (t) => SERVER_TYPE_SPECS[t].modelSource === 'checkpoint'
  );

  return `${HEADER}

// 서버 등록을 허용하는 활성 serverType 목록
export const SERVER_TYPES = ${json(SERVER_TYPES)};

// 각 server type 이 지원하는 outputFormat 목록.
// frontend/src/templates/index.js 의 TEMPLATES 키와 일치해야 함 (테스트로 검증).
export const CAPABILITIES = ${json(capabilities)};

const OUTPUT_FORMAT_LABELS = {
  image: '이미지',
  video: '비디오',
  text: '텍스트',
  audio: '오디오',
};

const SERVER_TYPE_LABELS = ${json(pickMap('label'))};

// serverType 별 distinct hex. brand-친화적 색상 사용 (시맨틱 컬러와 분리).
// chip 은 클릭/disabled 처리 없는 표시용이라 hover state 미고려.
// (CLAUDE.md hex 리터럴 금지 규칙의 문서화된 예외)
const SERVER_TYPE_COLORS = ${json(pickMap('color'))};

// 공식 base URL 이 알려진 provider — 서버 추가 시 자동 입력 (사용자 입력 우선)
export const KNOWN_SERVER_URLS = ${json(knownUrls)};

// 서버 카드 아이콘 키 — MUI 컴포넌트 매핑은 소비처(ServerManagement)에서 수행
const SERVER_TYPE_ICON_KEYS = ${json(pickMap('icon'))};

// deprecated 타입 표시 메타 (stale 데이터 렌더용 — 신규 생성 불가)
export const DEPRECATED_SERVER_TYPES = ${json(deprecated)};

// 모델 목록 동기화 지원 타입 / LoRA(checkpoint 기반) 지원 타입
export const MODEL_SYNC_SERVER_TYPES = ${json([...MODEL_SYNC_SERVER_TYPES])};
export const LORA_SERVER_TYPES = ${json(loraTypes)};

export function getCapableOutputFormats(serverType) {
  return CAPABILITIES[serverType] || [];
}

export function getOutputFormatLabel(outputFormat) {
  return OUTPUT_FORMAT_LABELS[outputFormat] || outputFormat;
}

export function getServerTypeLabel(serverType) {
  return SERVER_TYPE_LABELS[serverType] || serverType;
}

export function getServerTypeColor(serverType) {
  return SERVER_TYPE_COLORS[serverType] || '#9e9e9e';
}

export function getServerTypeIconKey(serverType) {
  return (
    SERVER_TYPE_ICON_KEYS[serverType] ||
    DEPRECATED_SERVER_TYPES[serverType]?.icon ||
    'storage'
  );
}
`;
}

function renderMcpConstants() {
  return `${HEADER}

export const SERVER_TYPES = ${json(SERVER_TYPES)};
export const OUTPUT_FORMATS = ${json(['image', 'video', 'text'])};
`;
}

function main() {
  fs.mkdirSync(path.dirname(MCP_TARGET), { recursive: true });
  fs.writeFileSync(FRONTEND_TARGET, renderFrontendCapabilities());
  fs.writeFileSync(MCP_TARGET, renderMcpConstants());
  console.log(`✅ mirror 갱신 완료:\n- ${path.relative(REPO_ROOT, FRONTEND_TARGET)}\n- ${path.relative(REPO_ROOT, MCP_TARGET)}`);
}

if (require.main === module) {
  main();
}

module.exports = { renderFrontendCapabilities, renderMcpConstants, FRONTEND_TARGET, MCP_TARGET };
