import { describe, expect, test } from 'vitest';
import { isPromptHidden } from './promptVisibility';

describe('프롬프트 칸 숨김 (#1035)', () => {
  test('프롬프트를 쓰지 않는 ComfyUI 판은 숨긴다', () => {
    expect(isPromptHidden({ serverType: 'ComfyUI', supportedInputs: { prompt: false } })).toBe(true);
  });
  test('프롬프트를 쓰는 ComfyUI 판은 보인다', () => {
    expect(isPromptHidden({ serverType: 'ComfyUI', supportedInputs: { prompt: true } })).toBe(false);
  });
  test('API 판(워크플로 없음)은 판정이 false 여도 보인다 — 서비스가 프롬프트를 직접 쓴다', () => {
    expect(isPromptHidden({ serverType: 'OpenAI', supportedInputs: { prompt: false } })).toBe(false);
    expect(isPromptHidden({ serverType: 'Gemini', supportedInputs: { prompt: false } })).toBe(false);
  });
  test('supportedInputs 가 없는 예전 응답은 보인다', () => {
    expect(isPromptHidden({ serverType: 'ComfyUI' })).toBe(false);
    expect(isPromptHidden()).toBe(false);
  });
});
