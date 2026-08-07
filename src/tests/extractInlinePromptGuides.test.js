const migration = require('../migrations/extractInlinePromptGuides');
const { isInlineGuideField, findInlineGuideField, INLINE_GUIDE_THRESHOLD } = migration;

// #766 — 작업판 필드에 인라인된 대형 가이드 추출 판정.
// 잘못 잡으면 정상적인 "작업 지침" 이 가이드로 옮겨져 합성 층이 바뀌므로
// 대상 판정이 이 마이그레이션의 핵심이다.

const long = (n) => 'x'.repeat(n);

describe('extractInlinePromptGuides — 대상 판정 (#766)', () => {
  test('마이그레이션 함수 export', () => {
    expect(typeof migration).toBe('function');
  });

  describe('isInlineGuideField', () => {
    test('system_prompt + 임계값 초과 → 대상', () => {
      expect(isInlineGuideField({ name: 'system_prompt', defaultValue: long(INLINE_GUIDE_THRESHOLD + 1) })).toBe(true);
    });

    test('camelCase 별칭(systemPrompt) 도 대상', () => {
      expect(isInlineGuideField({ name: 'systemPrompt', defaultValue: long(41387) })).toBe(true);
    });

    test('임계값 이하는 제외 — 통상적인 작업 지침을 옮기지 않는다', () => {
      expect(isInlineGuideField({ name: 'system_prompt', defaultValue: long(INLINE_GUIDE_THRESHOLD) })).toBe(false);
      expect(isInlineGuideField({ name: 'system_prompt', defaultValue: '짧은 지침' })).toBe(false);
    });

    test('다른 role 의 필드는 길어도 제외', () => {
      expect(isInlineGuideField({ name: 'prompt', defaultValue: long(50000) })).toBe(false);
      expect(isInlineGuideField({ name: 'base_model', defaultValue: long(50000) })).toBe(false);
    });

    test('알 수 없는 이름은 제외', () => {
      expect(isInlineGuideField({ name: 'my_custom_field', defaultValue: long(50000) })).toBe(false);
    });

    test('문자열이 아닌 defaultValue 는 제외', () => {
      expect(isInlineGuideField({ name: 'system_prompt', defaultValue: null })).toBe(false);
      expect(isInlineGuideField({ name: 'system_prompt', defaultValue: 12345 })).toBe(false);
      expect(isInlineGuideField({ name: 'system_prompt' })).toBe(false);
    });

    test('빈 입력', () => {
      expect(isInlineGuideField(null)).toBe(false);
      expect(isInlineGuideField(undefined)).toBe(false);
    });
  });

  describe('findInlineGuideField', () => {
    test('대상 필드의 인덱스를 돌려준다', () => {
      const wb = { additionalInputFields: [
        { name: 'base_model', defaultValue: '' },
        { name: 'system_prompt', defaultValue: long(41387) },
        { name: 'conversation_mode', defaultValue: '' },
      ] };
      const found = findInlineGuideField(wb);
      expect(found.index).toBe(1);
      expect(found.field.name).toBe('system_prompt');
    });

    test('대상이 없으면 null', () => {
      expect(findInlineGuideField({ additionalInputFields: [{ name: 'system_prompt', defaultValue: '짧음' }] })).toBeNull();
      expect(findInlineGuideField({ additionalInputFields: [] })).toBeNull();
      expect(findInlineGuideField({})).toBeNull();
      expect(findInlineGuideField(null)).toBeNull();
    });

    test('이전 완료 상태(빈 defaultValue)는 재대상이 아니다 — 멱등', () => {
      const wb = { additionalInputFields: [{ name: 'system_prompt', defaultValue: '' }] };
      expect(findInlineGuideField(wb)).toBeNull();
    });
  });
});
