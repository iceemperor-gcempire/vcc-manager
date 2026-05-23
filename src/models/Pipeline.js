const mongoose = require('mongoose');

// 프로젝트 종속 작업판 파이프라인 (#397 Phase 2.A).
// 직선 (linear) 시퀀스. 분기 / DAG / 영속화 실행은 Phase 2.B 로 분리.
// 단계의 출력 타입이 다음 단계의 입력 필드 타입과 일치하면 자동 주입 (autoInject).

const pipelineStepSchema = new mongoose.Schema({
  workboardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workboard',
    required: true,
  },
  // 이전 단계 출력을 다음 단계 입력에 자동 주입 여부.
  // 첫 단계는 의미 없음 (이전 단계가 없으므로). 두번째 단계부터 적용.
  autoInject: {
    type: Boolean,
    default: true,
  },
  // 단계별 사전 입력 (#397 후속). 작업판의 customField name → 값 매핑.
  // 자동 주입되는 필드 (예: 텍스트 결과 → prompt) 는 autoInject 가 우선 덮어씀.
  inputs: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // 사용자 메모 (단계 설명) — 선택
  note: String,
}, { _id: false });

const pipelineSchema = new mongoose.Schema({
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
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
  },
  steps: [pipelineStepSchema],
  // 파이프라인 전체 세계관 사용 토글 — LLM 단계에 적용
  useWorldview: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

pipelineSchema.index({ projectId: 1, createdAt: -1 });
pipelineSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Pipeline', pipelineSchema);
