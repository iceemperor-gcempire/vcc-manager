import { describe, expect, test } from 'vitest';
import { getWorkboardTemplate, getWorkboardTemplateOptions } from './index';

describe('작업판 템플릿 고르기 (#1142)', () => {
  test('OpenAI 이미지는 2.5 이하 · 2.6 · 2.6 GIF 세 가지이고 첫 항목이 기본', () => {
    const options = getWorkboardTemplateOptions('OpenAI', 'image');
    expect(options.map((o) => o.id)).toEqual(['gpt-image', 'gpt-image-2.6', 'gpt-image-2.6-gif']);
    expect(options.every((o) => o.label)).toBe(true);
  });

  test('고른 템플릿의 입력 칸과 모델 제한을 돌려준다', () => {
    const gif = getWorkboardTemplate('OpenAI', 'image', 'gpt-image-2.6-gif');
    expect(gif.modelWhitelist).toEqual(['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst']);
    const format = gif.additionalInputFields.find((f) => f.name === 'output_format');
    expect(format.options.map((o) => o.value)).toEqual(['gif']);

    const legacy = getWorkboardTemplate('OpenAI', 'image', 'gpt-image');
    expect(legacy.modelWhitelist).toContain('gpt-image-2.5-flare');
    expect(legacy.modelWhitelist).not.toContain('gpt-image-2.6-flare');
  });

  test('id 가 없거나 모르는 값이면 첫 템플릿', () => {
    const first = getWorkboardTemplate('OpenAI', 'image', 'gpt-image');
    expect(getWorkboardTemplate('OpenAI', 'image')).toEqual(first);
    expect(getWorkboardTemplate('OpenAI', 'image', 'no-such')).toEqual(first);
  });

  test('생성 메타(_template)는 작업판 데이터에 섞이지 않는다', () => {
    expect(getWorkboardTemplate('OpenAI', 'image', 'gpt-image-2.6')).not.toHaveProperty('_template');
  });

  test('템플릿이 하나뿐인 조합은 고르기 항목도 하나 — 화면이 고르기 칸을 그리지 않는다', () => {
    expect(getWorkboardTemplateOptions('ComfyUI', 'image')).toHaveLength(1);
    expect(getWorkboardTemplate('ComfyUI', 'image').additionalInputFields).toBeDefined();
  });

  test('등록되지 않은 조합은 빈 템플릿', () => {
    expect(getWorkboardTemplateOptions('Nope', 'image')).toEqual([]);
    expect(getWorkboardTemplate('Nope', 'image')).toEqual({ baseInputFields: {}, additionalInputFields: [], workflowData: '' });
  });
});
