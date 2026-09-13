/**
 * 단계 입력의 작업판 기본값 채우기 (#952).
 *
 * 생성 화면은 필드 기본값을 채워 보내지만 파이프라인·작업 절차 실행기는 사전 입력만 봤다.
 * 그래서 모델을 따로 고르지 않은 LLM 단계가 "작업판에 모델이 선택되지 않음" 으로 실패했다.
 */
const { applyStepFieldDefaults } = require('../services/pipelineRunService');

const workboard = {
  additionalInputFields: [
    { name: 'base_model', type: 'baseModel', defaultValue: 'gpt-5.5' },
    { name: 'temperature', type: 'number', defaultValue: 0.7 },
    { name: 'quality', type: 'select', defaultValue: 'medium' },
    { name: 'style', type: 'select', defaultValue: 'photo' },
    { name: 'use_upscale', type: 'boolean', defaultValue: true },
    { name: 'system_prompt', type: 'string' },
    { name: 'ref_image', type: 'image', defaultValue: 'should-not-copy' },
  ],
};

describe('applyStepFieldDefaults', () => {
  test('사전 입력에 없는 필드는 기본값, 있는 값은 그대로', () => {
    const out = applyStepFieldDefaults(workboard, { quality: 'low' });
    expect(out).toMatchObject({ base_model: 'gpt-5.5', temperature: 0.7, quality: 'low', use_upscale: true });
  });

  test('빈 문자열(선택 없음)·false·0 은 사용자가 고른 값이라 덮지 않는다', () => {
    const out = applyStepFieldDefaults(workboard, { style: '', use_upscale: false, temperature: 0 });
    expect(out.style).toBe('');
    expect(out.use_upscale).toBe(false);
    expect(out.temperature).toBe(0);
  });

  test('기본값 없는 필드와 미디어 필드는 채우지 않는다', () => {
    const out = applyStepFieldDefaults(workboard, {});
    expect(out).not.toHaveProperty('system_prompt');
    expect(out).not.toHaveProperty('ref_image');
  });

  test('원본 사전 입력을 바꾸지 않는다', () => {
    const inputs = { quality: 'high' };
    applyStepFieldDefaults(workboard, inputs);
    expect(inputs).toEqual({ quality: 'high' });
  });

  test('작업판·사전 입력이 없어도 빈 객체', () => {
    expect(applyStepFieldDefaults(null, undefined)).toEqual({});
  });
});
