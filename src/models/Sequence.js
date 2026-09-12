const mongoose = require('mongoose');

// 작업 절차 (#952, Epic #951) — 운영자가 작업판들을 정형화해 제공하는 공유 자산.
//
// 개인 파이프라인(Pipeline)과 단계 구조는 같지만 성격이 다르다:
//   - 소유자가 없다. createdBy 는 감사 기록일 뿐 접근 판정에 쓰지 않는다 (PromptGuide 선례)
//   - 접근은 그룹 (allowedGroupIds, 작업판과 같은 축). 비어 있으면 admin 전용
//   - 참조로 실행한다. 복제본이 없으므로 관리자가 단계·문서를 고치면 다음 실행부터 전원에게 반영된다
//   - 작업판 접근은 여기서 열리지 않는다. 단계마다 작업판의 allowedGroupIds 가 따로 판정한다 (#802)

const sequenceStepSchema = new mongoose.Schema({
  workboardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workboard',
    required: true,
  },
  // 앞 단계 출력을 이 단계 입력에 자동 주입할지. 첫 단계에는 의미 없음.
  autoInject: {
    type: Boolean,
    default: true,
  },
  // 단계 사전 입력 — 작업판 필드 name → 값.
  // 미디어(이미지·영상·오디오·파일) 필드는 저장하지 않는다: 값이 운영자 개인 소유 업로드를
  // 가리키므로 실행자에게 넘길 수 없다. 실행자 입력은 입력 노출 단계(#953)에서 연다.
  inputs: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // 작업 절차 문서 (SequenceDoc) — LLM(텍스트) 단계에만 주입된다
  contextDocIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SequenceDoc',
  }],
  systemPromptDocId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SequenceDoc',
  },
  note: {
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
  },
});
// 단계 _id 는 일부러 남긴다. 입력 노출(#953)과 향후 멀티인풋에서 "어느 단계의 출력인가" 를
// 순서가 아니라 id 로 가리켜야 단계 순서를 바꿔도 연결이 끊기지 않는다. 편집 시 클라이언트가
// 돌려보낸 _id 를 보존한다 (utils/sequenceSteps).

const sequenceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: '',
  },
  steps: [sequenceStepSchema],
  allowedGroupIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

sequenceSchema.index({ isActive: 1, updatedAt: -1 });
sequenceSchema.index({ allowedGroupIds: 1 });

module.exports = mongoose.model('Sequence', sequenceSchema);
