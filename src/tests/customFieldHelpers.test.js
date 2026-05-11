const {
  getFieldByRole,
  getFieldValueByRole,
  indexFieldsByRole
} = require('../utils/customFieldHelpers');
const { FIELD_ROLES } = require('../constants/fieldRoles');

describe('customFieldHelpers (#199 Phase A)', () => {
  const workboard = {
    additionalInputFields: [
      { name: 'mainModel', label: '모델', type: 'select', role: FIELD_ROLES.MODEL },
      { name: 'userPrompt', label: '프롬프트', type: 'string', role: FIELD_ROLES.PROMPT },
      { name: 'note', label: '메모', type: 'string' }  // role 없음
    ]
  };

  describe('getFieldByRole', () => {
    test('role 매치되는 필드 반환', () => {
      const f = getFieldByRole(workboard, FIELD_ROLES.MODEL);
      expect(f).toBeTruthy();
      expect(f.name).toBe('mainModel');
    });

    test('role 없는 필드는 무시', () => {
      const f = getFieldByRole(workboard, FIELD_ROLES.SEED);
      expect(f).toBeNull();
    });

    test('workboard / role 누락 시 null', () => {
      expect(getFieldByRole(null, FIELD_ROLES.MODEL)).toBeNull();
      expect(getFieldByRole(workboard, null)).toBeNull();
    });

    test('additionalInputFields 가 없어도 안전', () => {
      expect(getFieldByRole({}, FIELD_ROLES.MODEL)).toBeNull();
    });
  });

  describe('getFieldValueByRole', () => {
    test('필드 이름으로 inputData 에서 값 추출', () => {
      const inputData = { mainModel: 'SDXL/illustrious.safetensors', userPrompt: 'a cat' };
      expect(getFieldValueByRole(workboard, inputData, FIELD_ROLES.MODEL)).toBe('SDXL/illustrious.safetensors');
      expect(getFieldValueByRole(workboard, inputData, FIELD_ROLES.PROMPT)).toBe('a cat');
    });

    test('legacy baseInputFields 키 fallback', () => {
      const inputData = { aiModel: 'legacy-model-id' };
      const wbWithoutRole = { additionalInputFields: [] };
      expect(getFieldValueByRole(wbWithoutRole, inputData, FIELD_ROLES.MODEL)).toBe('legacy-model-id');
    });

    test('customFields 매치 우선, legacy 는 fallback', () => {
      const inputData = { mainModel: 'new', aiModel: 'legacy' };
      expect(getFieldValueByRole(workboard, inputData, FIELD_ROLES.MODEL)).toBe('new');
    });

    test('값 없으면 undefined', () => {
      expect(getFieldValueByRole(workboard, {}, FIELD_ROLES.MODEL)).toBeUndefined();
    });

    test('well-known additionalInputFields 이름 (prompt/negativePrompt/seed) 도 fallback', () => {
      const wbEmpty = { additionalInputFields: [] };
      const inputData = { prompt: 'cat', negativePrompt: 'blur', seed: 42 };
      expect(getFieldValueByRole(wbEmpty, inputData, FIELD_ROLES.PROMPT)).toBe('cat');
      expect(getFieldValueByRole(wbEmpty, inputData, FIELD_ROLES.NEGATIVE_PROMPT)).toBe('blur');
      expect(getFieldValueByRole(wbEmpty, inputData, FIELD_ROLES.SEED)).toBe(42);
    });

    test('legacy systemPrompt 와 referenceImageMethod 매핑', () => {
      const inputData = {
        systemPrompt: 'You are helpful',
        referenceImageMethods: 'inpaint',
        temperature: 0.5,
        maxTokens: 1024
      };
      const wbEmpty = { additionalInputFields: [] };
      expect(getFieldValueByRole(wbEmpty, inputData, FIELD_ROLES.SYSTEM_PROMPT)).toBe('You are helpful');
      expect(getFieldValueByRole(wbEmpty, inputData, FIELD_ROLES.REFERENCE_IMAGE_METHOD)).toBe('inpaint');
      expect(getFieldValueByRole(wbEmpty, inputData, FIELD_ROLES.TEMPERATURE)).toBe(0.5);
      expect(getFieldValueByRole(wbEmpty, inputData, FIELD_ROLES.MAX_TOKENS)).toBe(1024);
    });

    test('null/undefined 입력 안전', () => {
      expect(getFieldValueByRole(null, {}, FIELD_ROLES.MODEL)).toBeUndefined();
      expect(getFieldValueByRole(workboard, null, FIELD_ROLES.MODEL)).toBeUndefined();
      expect(getFieldValueByRole(workboard, {}, null)).toBeUndefined();
    });
  });

  describe('FIELD_TYPE_TO_ROLE mapping (#199 Phase D)', () => {
    test('type=baseModel 필드가 role=model 으로 조회됨', () => {
      const wb = {
        additionalInputFields: [
          { name: 'aiModel', type: 'baseModel' }
        ]
      };
      const f = getFieldByRole(wb, FIELD_ROLES.MODEL);
      expect(f).toBeTruthy();
      expect(f.name).toBe('aiModel');
    });

    test('type=lora 필드가 role=lora 으로 조회됨', () => {
      const wb = {
        additionalInputFields: [
          { name: 'myLora', type: 'lora' }
        ]
      };
      const f = getFieldByRole(wb, FIELD_ROLES.LORA);
      expect(f).toBeTruthy();
      expect(f.name).toBe('myLora');
    });

    test('명시적 role 이 type 기반 매핑보다 우선', () => {
      const wb = {
        additionalInputFields: [
          { name: 'foo', type: 'baseModel' },               // type 매핑 후보
          { name: 'bar', type: 'string', role: 'model' }    // 명시적 role 우선
        ]
      };
      expect(getFieldByRole(wb, FIELD_ROLES.MODEL).name).toBe('bar');
    });

    test('getFieldValueByRole 가 type=baseModel 도 인식', () => {
      const wb = { additionalInputFields: [{ name: 'aiModel', type: 'baseModel' }] };
      const inputData = { aiModel: 'sdxl-v1' };
      expect(getFieldValueByRole(wb, inputData, FIELD_ROLES.MODEL)).toBe('sdxl-v1');
    });
  });

  describe('indexFieldsByRole', () => {
    test('role 별 필드 인덱싱', () => {
      const map = indexFieldsByRole(workboard);
      expect(map[FIELD_ROLES.MODEL].name).toBe('mainModel');
      expect(map[FIELD_ROLES.PROMPT].name).toBe('userPrompt');
      expect(map[FIELD_ROLES.SEED]).toBeUndefined();
    });

    test('중복 role 은 첫 번째 매치만', () => {
      const wb = {
        additionalInputFields: [
          { name: 'first', role: FIELD_ROLES.MODEL },
          { name: 'second', role: FIELD_ROLES.MODEL }
        ]
      };
      expect(indexFieldsByRole(wb)[FIELD_ROLES.MODEL].name).toBe('first');
    });

    test('빈 / null 입력 안전', () => {
      expect(indexFieldsByRole(null)).toEqual({});
      expect(indexFieldsByRole({})).toEqual({});
    });
  });
});
