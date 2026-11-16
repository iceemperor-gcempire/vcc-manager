/**
 * MCP 파이프라인 응답 모양 — AI 프롬프트 늘려 쓰기 (#1212), 실패 사유.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pipelineStepView, runStepView } from '../../src/utils/pipelineView.js';

test('정의 단계 — 늘려 쓰기 설정을 텍스트 판 이름과 함께 보여 준다', () => {
  const v = pipelineStepView({
    workboardId: { _id: 'v1', name: 'H3 I2V', outputFormat: 'video' },
    promptEnhance: { enabled: true, workboardId: { _id: 't1', name: '프롬프트 LLM' }, inputs: { model: 'm' }, includeImages: false },
  }, 0);
  assert.deepEqual(v.promptEnhance, { enabled: true, workboardId: 't1', workboardName: '프롬프트 LLM', inputs: { model: 'm' }, includeImages: false });
  assert.equal(v.workboardName, 'H3 I2V');
});

test('정의 단계 — 설정이 없으면 promptEnhance 는 null', () => {
  assert.equal(pipelineStepView({ workboardId: 'v1' }, 0).promptEnhance, null);
});

test('실행 단계 — 늘려 쓴 프롬프트와 대신 여부', () => {
  const v = runStepView({ status: 'completed', output: { type: 'image', imageIds: ['i1'], enhancedPrompt: '늘려 쓴 글', promptEnhanceFallback: true } }, 1);
  assert.equal(v.enhancedPrompt, '늘려 쓴 글');
  assert.equal(v.promptEnhanceFallback, true);
  assert.deepEqual(v.imageIds, ['i1']);
});

test('실행 단계 — 늘려 쓰지 않았으면 그 칸이 없다', () => {
  const v = runStepView({ status: 'completed', output: { type: 'image', imageIds: [] } }, 0);
  assert.equal('enhancedPrompt' in v, false);
});

test('실행 단계 — 실패 사유는 error.message 에서 읽는다', () => {
  const v = runStepView({ status: 'failed', error: { message: 'AI 프롬프트 판 접근 권한이 없습니다: X' } }, 0);
  assert.equal(v.errorMessage, 'AI 프롬프트 판 접근 권한이 없습니다: X');
});
