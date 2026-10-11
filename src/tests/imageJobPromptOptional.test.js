/**
 * 작업 모델이 빈 프롬프트를 받는다 (#1035) — 프롬프트를 쓰지 않는 ComfyUI 판.
 * 라우트 테스트는 큐를 목으로 바꿔 모델 검증을 거치지 않아, 실제 저장에서만 드러났다 (알파 QA).
 */
const mongoose = require('mongoose');
const ImageGenerationJob = require('../models/ImageGenerationJob');

const base = () => ({
  userId: new mongoose.Types.ObjectId(),
  workboardId: new mongoose.Types.ObjectId(),
});

test('inputData.prompt 가 빈 문자열이어도 검증을 통과한다', async () => {
  const job = new ImageGenerationJob({ ...base(), inputData: { prompt: '' } });
  await expect(job.validate()).resolves.toBeUndefined();
});

test('prompt 를 아예 빼면 빈 문자열로 채운다', async () => {
  const job = new ImageGenerationJob({ ...base(), inputData: {} });
  await job.validate();
  expect(job.inputData.prompt).toBe('');
});
