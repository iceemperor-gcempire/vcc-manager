import { describe, expect, test } from 'vitest';
import {
  isImageOrVideoStep, stepUsesLlm, fromLoadedPromptEnhance, toPromptEnhancePayload, stepsMissingEnhancer,
} from './pipelinePromptEnhance';

const video = (promptEnhance) => ({ workboard: { outputFormat: 'video' }, promptEnhance });
const text = { workboard: { outputFormat: 'text' } };

describe('파이프라인 AI 프롬프트 늘려 쓰기 (#1212)', () => {
  test('이미지·영상 단계만 늘려 쓰기 대상', () => {
    expect(isImageOrVideoStep(video())).toBe(true);
    expect(isImageOrVideoStep({ workboard: { outputFormat: 'image' } })).toBe(true);
    expect(isImageOrVideoStep(text)).toBe(false);
    expect(isImageOrVideoStep({})).toBe(false);
  });

  test('LLM 을 부르는 단계 — 텍스트 단계, 또는 늘려 쓰기를 켠 이미지·영상 단계', () => {
    expect(stepUsesLlm(text)).toBe(true);
    expect(stepUsesLlm(video({ enabled: true, workboardId: 't1' }))).toBe(true);
    expect(stepUsesLlm(video({ enabled: false, workboardId: 't1' }))).toBe(false);
    expect(stepUsesLlm(video())).toBe(false);
  });

  test('불러온 정의 → 편집기 상태 (populate 된 판은 workboard 로)', () => {
    const board = { _id: 't1', name: 'LLM', additionalInputFields: [] };
    expect(fromLoadedPromptEnhance({ enabled: true, workboardId: board, inputs: { model: 'm' } })).toEqual({
      enabled: true, workboardId: 't1', workboard: board, inputs: { model: 'm' }, includeImages: true,
    });
    expect(fromLoadedPromptEnhance({ enabled: false, workboardId: 't1', includeImages: false })).toEqual({
      enabled: false, workboardId: 't1', workboard: undefined, inputs: {}, includeImages: false,
    });
    expect(fromLoadedPromptEnhance(undefined)).toBeUndefined();
  });

  test('저장 본문 — id 만 보내고, 아무것도 안 정했거나 텍스트 단계면 빼낸다', () => {
    expect(toPromptEnhancePayload(video({ enabled: true, workboardId: 't1', workboard: { _id: 't1' }, inputs: { model: 'm' } })))
      .toEqual({ enabled: true, workboardId: 't1', inputs: { model: 'm' }, includeImages: true });
    expect(toPromptEnhancePayload(video({ enabled: false, workboardId: 't1', includeImages: false })))
      .toEqual({ enabled: false, workboardId: 't1', inputs: {}, includeImages: false });
    expect(toPromptEnhancePayload(video({ enabled: false }))).toBeUndefined();
    expect(toPromptEnhancePayload(video())).toBeUndefined();
    expect(toPromptEnhancePayload({ ...text, promptEnhance: { enabled: true, workboardId: 't1' } })).toBeUndefined();
  });

  test('켰는데 텍스트 판이 없는 단계 번호', () => {
    expect(stepsMissingEnhancer([text, video({ enabled: true }), video({ enabled: true, workboardId: 't1' }), video({ enabled: false })]))
      .toEqual([2]);
    expect(stepsMissingEnhancer([])).toEqual([]);
  });
});
