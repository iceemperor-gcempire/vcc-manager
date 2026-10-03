// API 키 용도 (#995) — 화면 문구를 한 곳에 둔다.
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
    description: '스크립트나 자동화에서 계정의 API 를 폭넓게 씁니다. 계정 삭제·백업 복원처럼 되돌릴 수 없는 작업은 어떤 키로도 할 수 없어요.',
  },
];

// 용도 필드가 없던 예전 키는 범용이다
export function apiKeyScopeOf(apiKey) {
  return apiKey?.scope === 'mcp' ? 'mcp' : 'api';
}

export function apiKeyScopeLabel(apiKey) {
  return apiKeyScopeOf(apiKey) === 'mcp' ? 'MCP' : 'API';
}
