const mongoose = require('mongoose');

// 실행 기록의 단계 상태 — PipelineRun(#407) 과 SequenceRun(#952) 이 같은 모양을 쓴다.
// 단계 실행 루프(pipelineRunService.executeRunSteps)가 실행 종류를 가리지 않고 run.steps[i] 를
// 갱신하므로, 한쪽에만 필드를 더하면 다른 쪽 기록에서 그 값이 조용히 빠진다.
function buildRunStepSchema() {
  return new mongoose.Schema({
    workboardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workboard',
      required: true,
    },
    // 정의 단계의 _id (작업 절차만, #953) — 실행 입력이 단계 id 로 저장되므로, 같은 작업판이라도
    // 단계를 지우고 다시 넣으면 다른 단계로 보고 멈춘다. 파이프라인 단계는 _id 가 없어 비어 있다.
    stepId: { type: mongoose.Schema.Types.ObjectId },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
      default: 'pending',
    },
    startedAt: Date,
    completedAt: Date,
    // 텍스트 단계의 결과 ConversationJob 또는 이미지 단계의 ImageGenerationJob 참조
    conversationJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConversationJob' },
    imageGenerationJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImageGenerationJob' },
    // 출력 (다음 단계의 자동 주입 / 히스토리 표시용)
    // { type: 'text'|'image', value?: string, imageIds?: [ObjectId], ... }
    output: mongoose.Schema.Types.Mixed,
    error: {
      message: String,
    },
  }, { _id: false });
}

module.exports = { buildRunStepSchema };
