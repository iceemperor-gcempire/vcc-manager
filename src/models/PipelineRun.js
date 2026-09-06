const mongoose = require('mongoose');

// 파이프라인 실행 영속 (#407). 백그라운드 worker 가 단계를 순차 실행하며 상태 갱신.
// 사용자는 페이지를 떠나도 진행되며, 부분 retry 가능.

const pipelineRunStepSchema = new mongoose.Schema({
  workboardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workboard',
    required: true,
  },
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

const pipelineRunSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  pipelineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pipeline',
    required: true,
  },
  // 결과물을 담을 프로젝트 (#923). 비어 있으면 projectId(파이프라인의 프로젝트)와 같다.
  // 공유 프로젝트의 파이프라인을 독자가 돌릴 때 결과를 자기 프로젝트로 보내는 용도 —
  // 파이프라인 정의의 소속(projectId)과 결과의 귀속(targetProjectId)을 분리한다.
  targetProjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  startedAt: Date,
  completedAt: Date,
  // 첫 단계 사용자 프롬프트
  initialPrompt: { type: String, default: '' },
  // 시작 / retry 횟수
  triggerCount: { type: Number, default: 0 },
  steps: [pipelineRunStepSchema],
  error: {
    message: String,
  },
}, { timestamps: true });

pipelineRunSchema.index({ projectId: 1, createdAt: -1 });
pipelineRunSchema.index({ pipelineId: 1, createdAt: -1 });
pipelineRunSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('PipelineRun', pipelineRunSchema);
