// API 키 용도 (#995, #1061) — 화면 문구를 한 곳에 둔다.
// 백엔드 정의는 src/constants/apiKeyScopes.js. 용도 값('api' | 'mcp')이 바뀌면 둘 다 고친다.

// 새 키의 기본 용도 — 범위가 좁은 쪽을 기본으로 둔다. 새면 MCP 로 할 수 있는 만큼만 열린다.
export const DEFAULT_NEW_KEY_SCOPE = 'mcp';

export const API_KEY_SCOPE_OPTIONS = [
  {
    value: 'mcp',
    label: 'MCP 용',
    description: 'Claude 같은 MCP 클라이언트에서 작업판을 보고, 생성하고, 결과를 받는 일만 할 수 있어요. 키가 새도 그 이상은 열리지 않아요.',
  },
  {
    value: 'api',
    label: 'API 용 (범용)',
    description: '스크립트나 자동화에서 계정의 API 를 폭넓게 씁니다. 키 관리, 계정 삭제, 백업 복원·내려받기는 어떤 키로도 안 되고 로그인해야 해요.',
  },
];

// 관리자 계정의 범용 키는 구성물 삭제·백업 실행까지 된다 (#1061) — 발급할 때 알린다
export const ADMIN_API_KEY_NOTICE = '관리자 계정의 API 용 키로는 작업판·서버·그룹 삭제와 백업 실행도 할 수 있어요. MCP 클라이언트에는 넣지 말고, 새었다고 의심되면 바로 파기하세요.';

// 용도 필드가 없던 예전 키는 범용이다
export function apiKeyScopeOf(apiKey) {
  return apiKey?.scope === 'mcp' ? 'mcp' : 'api';
}

const SCOPE_LABEL = { mcp: 'MCP', api: 'API' };

export function apiKeyScopeLabel(apiKey) {
  return SCOPE_LABEL[apiKeyScopeOf(apiKey)];
}

// 목록 칩 색
const SCOPE_TONE = { mcp: 'info', api: 'accent' };

export function apiKeyScopeTone(apiKey) {
  return SCOPE_TONE[apiKeyScopeOf(apiKey)];
}
