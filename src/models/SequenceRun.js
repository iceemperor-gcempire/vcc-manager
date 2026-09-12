const mongoose = require('mongoose');
const { buildRunStepSchema } = require('./runStepSchema');

// 작업 절차 실행 기록 (#952). 실행자 개인 자산이다 — 사용자 삭제 시 함께 지워진다.
//
// PipelineRun 과 모델을 나눈 이유: 개인 파이프라인은 분리 예정이고(Epic #951), 작업 절차 실행은
// 일반 작업 히스토리와 섞지 않고 따로 보여준다. 단계 작업(ImageGenerationJob · ConversationJob)은
// sequenceRunId 로 이 기록을 가리키며 일반 히스토리 목록에서 빠진다 (utils/historyFilters).
// 단계 상태의 모양은 PipelineRun 과 공유한다 — 같은 실행 루프가 갱신한다.

const sequenceRunSchema = new mongoose.Schema({
  // 실행자
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sequenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sequence',
    required: true,
  },
  // 실행 시점의 이름 — 작업 절차가 삭제되거나 이름이 바뀌어도 기록에서 알아볼 수 있게
  sequenceName: {
    type: String,
    default: '',
  },
  // 결과물을 담을 프로젝트 (#923 과 같은 뜻). 비어 있으면 프로젝트에 붙이지 않는다.
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
  steps: [buildRunStepSchema()],
  error: {
    message: String,
  },
}, { timestamps: true });

sequenceRunSchema.index({ userId: 1, createdAt: -1 });
sequenceRunSchema.index({ userId: 1, status: 1 });
sequenceRunSchema.index({ sequenceId: 1, createdAt: -1 });

module.exports = mongoose.model('SequenceRun', sequenceRunSchema);
