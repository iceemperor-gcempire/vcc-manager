import { describe, expect, test } from 'vitest';
import {
  API_KEY_SCOPE_OPTIONS,
  DEFAULT_NEW_KEY_SCOPE,
  apiKeyScopeLabel,
  apiKeyScopeOf,
  apiKeyScopeTone,
} from './apiKeyScope';

describe('API 키 용도 (#995)', () => {
  test('용도 필드가 없는 예전 키는 범용(API)으로 본다', () => {
    expect(apiKeyScopeOf({ name: 'old' })).toBe('api');
    expect(apiKeyScopeLabel({ name: 'old' })).toBe('API');
  });

  test('MCP 키는 MCP 로 표시', () => {
    expect(apiKeyScopeOf({ scope: 'mcp' })).toBe('mcp');
    expect(apiKeyScopeLabel({ scope: 'mcp' })).toBe('MCP');
  });

  test('모르는 값은 범용으로 떨어진다 (좁은 쪽으로 잘못 표시하지 않음)', () => {
    expect(apiKeyScopeOf({ scope: 'weird' })).toBe('api');
    expect(apiKeyScopeOf({ scope: 'full' })).toBe('api');   // #1061 에서 없앤 용도
  });

  test('선택지는 api·mcp 두 가지이고, 기본값은 범위가 좁은 MCP', () => {
    expect(API_KEY_SCOPE_OPTIONS.map((o) => o.value).sort()).toEqual(['api', 'mcp']);
    expect(DEFAULT_NEW_KEY_SCOPE).toBe('mcp');
  });

  test('모든 용도에 라벨과 색이 있다', () => {
    for (const { value } of API_KEY_SCOPE_OPTIONS) {
      expect(apiKeyScopeLabel({ scope: value })).toBeTruthy();
      expect(apiKeyScopeTone({ scope: value })).toBeTruthy();
    }
  });
});
