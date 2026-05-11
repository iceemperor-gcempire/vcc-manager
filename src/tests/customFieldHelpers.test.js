const {
  getFieldByRole,
  getFieldValueByRole,
  indexFieldsByRole
} = require('../utils/customFieldHelpers');
const { FIELD_ROLES } = require('../constants/fieldRoles');

describe('customFieldHelpers (#199 Phase F4)', () => {
  // F4: role 스키마 필드 제거 — type=baseModel/lora 또는 well-known name 으로 추론.
  const workboard = {
    additionalInputFields: [
      { name: 'mainModel', label: '모델', type: 'baseModel' },
      { name: 'note', label: '메모', type: 'string' }
    ]
  };

  describe('getFieldByRole', () => {
    test('type=baseModel 필드가 role=model 으로 조회됨', () => {
      const f = getFieldByRole(workboard, FIELD_ROLES.MODEL);
      expect(f).toBeTruthy();
      expect(f.name).toBe('mainModel');
    });

    test('매칭되는 type 없으면 null', () => {
      expect(getFieldByRole(workboard, FIELD_ROLES.SEED)).toBeNull();
    });

    test('workboard / role 누락 시 null', () => {
      expect(getFieldByRole(null, FIELD_ROLES.MODEL)).toBeNull();
      expect(getFieldByRole(workboard, null)).toBeNull();
    });

    test('additionalInputFields 가 없어도 안전', () => {
      expect(getFieldByRole({}, FIELD_ROLES.MODEL)).toBeNull();
    });

    test('type=lora 도 role=lora 매칭', () => {
      const wb = { additionalInputFields: [{ name: 'myLora', type: 'lora' }] };
      expect(getFieldByRole(wb, FIELD_ROLES.LORA).name).toBe('myLora');
    });
  });

  describe('getFieldValueByRole', () => {
    test('top-level 값을 type=baseModel 필드 이름으로 추출', () => {
      const inputData = { mainModel: 'SDXL/illustrious.safetensors' };
      expect(getFieldValueByRole(workboard, inputData, FIELD_ROLES.MODEL)).toBe('SDXL/illustrious.safetensors');
    });

    test('legacy well-known 키 fallback (aiModel)', () => {
      const inputData = { aiModel: 'legacy-model-id' };
      const wbEmpty = { additionalInputFields: [] };
      expect(getFieldValueByRole(wbEmpty, inputData, FIELD_ROLES.MODEL)).toBe('legacy-model-id');
    });

    test('type 매치 필드가 well-known fallback 보다 우선', () => {
      const inputData = { mainModel: 'new', aiModel: 'legacy' };
      expect(getFieldValueByRole(workboard, inputData, FIELD_ROLES.MODEL)).toBe('new');
    });

    test('값 없으면 undefined', () => {
      expect(getFieldValueByRole(workboard, {}, FIELD_ROLES.MODEL)).toBeUndefined();
    });

    test('prompt / negativePrompt / seed 도 well-known fallback', () => {
      const wbEmpty = { additionalInputFields: [] };
      const inputData = { prompt: 'cat', negativePrompt: 'blur', seed: 42 };
      expect(getFieldValueByRole(wbEmpty, inputData, FIELD_ROLES.PROMPT)).toBe('cat');
      expect(getFieldValueByRole(wbEmpty, inputData, FIELD_ROLES.NEGATIVE_PROMPT)).toBe('blur');
      expect(getFieldValueByRole(wbEmpty, inputData, FIELD_ROLES.SEED)).toBe(42);
    });

    test('additionalParams 네임스페이스 fallback', () => {
      const wb = { additionalInputFields: [{ name: 'aiModel', type: 'baseModel' }] };
      const inputData = { additionalParams: { aiModel: 'sdxl-from-dynamic' } };
      expect(getFieldValueByRole(wb, inputData, FIELD_ROLES.MODEL)).toBe('sdxl-from-dynamic');
    });

    test('well-known fallback 도 additionalParams 확인', () => {
      const wbEmpty = { additionalInputFields: [] };
      const inputData = { additionalParams: { imageSize: '768x768', prompt: 'cat' } };
      expect(getFieldValueByRole(wbEmpty, inputData, FIELD_ROLES.IMAGE_SIZE)).toBe('768x768');
      expect(getFieldValueByRole(wbEmpty, inputData, FIELD_ROLES.PROMPT)).toBe('cat');
    });

    test('imageSize 단수형도 인식 (신규 템플릿 호환)', () => {
      const wb = { additionalInputFields: [{ name: 'imageSize', type: 'select' }] };
      expect(getFieldValueByRole(wb, { additionalParams: { imageSize: '1024x1024' } }, FIELD_ROLES.IMAGE_SIZE)).toBe('1024x1024');
    });

    test('top-level 값이 additionalParams 보다 우선', () => {
      const wb = { additionalInputFields: [{ name: 'aiModel', type: 'baseModel' }] };
      const inputData = { aiModel: 'top', additionalParams: { aiModel: 'nested' } };
      expect(getFieldValueByRole(wb, inputData, FIELD_ROLES.MODEL)).toBe('top');
    });

    test('legacy systemPrompt / referenceImageMethod / temperature / maxTokens 매핑', () => {
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

  describe('indexFieldsByRole', () => {
    test('type → role 인덱싱', () => {
      const wb = {
        additionalInputFields: [
          { name: 'm', type: 'baseModel' },
          { name: 'l', type: 'lora' },
          { name: 'note', type: 'string' }
        ]
      };
      const map = indexFieldsByRole(wb);
      expect(map[FIELD_ROLES.MODEL].name).toBe('m');
      expect(map[FIELD_ROLES.LORA].name).toBe('l');
    });

    test('동일 type 중복은 첫 번째만', () => {
      const wb = {
        additionalInputFields: [
          { name: 'first', type: 'baseModel' },
          { name: 'second', type: 'baseModel' }
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
