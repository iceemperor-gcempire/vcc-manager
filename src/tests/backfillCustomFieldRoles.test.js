const migration = require('../migrations/backfillCustomFieldRoles');
const { buildEntryFromLegacy } = migration;
const { LEGACY_BASE_FIELD_TO_ROLE, FIELD_ROLES } = require('../constants/fieldRoles');

describe('backfillCustomFieldRoles — buildEntryFromLegacy (#199 Phase B)', () => {
  describe('legacy 매핑 메타', () => {
    test('모든 legacy key → role 매핑이 FIELD_ROLES 의 값', () => {
      const validRoles = new Set(Object.values(FIELD_ROLES));
      for (const [_, role] of Object.entries(LEGACY_BASE_FIELD_TO_ROLE)) {
        expect(validRoles.has(role)).toBe(true);
      }
    });

    test('baseInputFields 의 well-known 키 9개 모두 매핑됨', () => {
      const expectedKeys = [
        'aiModel', 'imageSizes', 'referenceImageMethods', 'stylePresets',
        'upscaleMethods', 'systemPrompt', 'referenceImages', 'temperature', 'maxTokens'
      ];
      for (const k of expectedKeys) {
        expect(LEGACY_BASE_FIELD_TO_ROLE).toHaveProperty(k);
      }
    });

    test('마이그레이션 함수 export', () => {
      expect(typeof migration).toBe('function');
    });
  });

  describe('selectOption 배열 → select 필드', () => {
    test('aiModel 변환', () => {
      const entry = buildEntryFromLegacy('aiModel', [
        { key: 'sdxl', value: 'SDXL 1.0' },
        { key: 'flux', value: 'Flux Dev' }
      ]);
      expect(entry).toEqual({
        name: 'aiModel',
        label: 'AI 모델',
        type: 'select',
        role: FIELD_ROLES.MODEL,
        options: [
          { key: 'sdxl', value: 'SDXL 1.0' },
          { key: 'flux', value: 'Flux Dev' }
        ],
        required: false
      });
    });

    test('referenceImages 는 image 타입', () => {
      const entry = buildEntryFromLegacy('referenceImages', [{ key: 'ref1', value: 'reference image 1' }]);
      expect(entry.type).toBe('image');
      expect(entry.role).toBe(FIELD_ROLES.REFERENCE_IMAGE);
    });

    test('imageSizes / referenceImageMethods / stylePresets / upscaleMethods 모두 select', () => {
      const opts = [{ key: 'a', value: 'A' }];
      expect(buildEntryFromLegacy('imageSizes', opts).type).toBe('select');
      expect(buildEntryFromLegacy('imageSizes', opts).role).toBe(FIELD_ROLES.IMAGE_SIZE);
      expect(buildEntryFromLegacy('referenceImageMethods', opts).role).toBe(FIELD_ROLES.REFERENCE_IMAGE_METHOD);
      expect(buildEntryFromLegacy('stylePresets', opts).role).toBe(FIELD_ROLES.STYLE_PRESET);
      expect(buildEntryFromLegacy('upscaleMethods', opts).role).toBe(FIELD_ROLES.UPSCALE_METHOD);
    });
  });

  describe('number → number 필드 + defaultValue', () => {
    test('temperature', () => {
      const entry = buildEntryFromLegacy('temperature', 0.7);
      expect(entry).toEqual({
        name: 'temperature',
        label: 'Temperature',
        type: 'number',
        role: FIELD_ROLES.TEMPERATURE,
        defaultValue: 0.7,
        required: false
      });
    });

    test('maxTokens', () => {
      const entry = buildEntryFromLegacy('maxTokens', 2048);
      expect(entry.type).toBe('number');
      expect(entry.defaultValue).toBe(2048);
      expect(entry.role).toBe(FIELD_ROLES.MAX_TOKENS);
    });
  });

  describe('string → string 필드 + defaultValue', () => {
    test('systemPrompt', () => {
      const entry = buildEntryFromLegacy('systemPrompt', 'You are helpful');
      expect(entry).toEqual({
        name: 'systemPrompt',
        label: '시스템 프롬프트',
        type: 'string',
        role: FIELD_ROLES.SYSTEM_PROMPT,
        defaultValue: 'You are helpful',
        required: false
      });
    });
  });

  describe('알 수 없는 키 / 잘못된 값', () => {
    test('legacy 매핑에 없는 키는 null', () => {
      expect(buildEntryFromLegacy('unknownKey', 'foo')).toBeNull();
    });

    test('boolean / object 값은 null', () => {
      expect(buildEntryFromLegacy('aiModel', true)).toBeNull();
      expect(buildEntryFromLegacy('aiModel', { foo: 'bar' })).toBeNull();
    });
  });
});
