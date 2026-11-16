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
  // 단계별 컨텍스트 문서 — UploadedText 다중 선택 (#401). LLM 호출 시 system 메시지의
  // [배경 / 사전 컨텍스트] 섹션으로 concat 주입.
  contextDocIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UploadedText',
  }],
  // 단계별 시스템 프롬프트 문서 — UploadedText 단일 (#401). system 메시지의 [작업 지침]
  // 섹션으로 주입. 작업판의 system_prompt customField 보다 우선.
  systemPromptDocId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UploadedText',
  },
  // AI 프롬프트로 먼저 늘려 쓰기 (#1212) — 이미지·영상 단계 전용.
  // 생성 화면의 "AI 프롬프트 생성" 과 같은 합성이다: 텍스트 판(workboardId)이 어느 LLM 으로 쓸지,
  // 이 단계의 판이 가진 promptGeneratorInstructions 가 어떤 형식으로 쓸지를 정한다 (#1109).
  // 켜면 단계 문서(contextDocIds / systemPromptDocId)도 이 LLM 호출에 들어간다.
  promptEnhance: {
    type: new mongoose.Schema({
      enabled: { type: Boolean, default: false },
      // 프롬프트를 쓸 텍스트 판 (outputFormat 'text')
      workboardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workboard' },
      // 텍스트 판의 필드 값 (모델·온도 등). 비운 칸은 실행 때 판 기본값으로 채운다
      inputs: { type: mongoose.Schema.Types.Mixed, default: {} },
      // 이 단계의 이미지 필드 값(첫 프레임·참조 등)을 LLM 에 함께 보낼지
      includeImages: { type: Boolean, default: true },
    }, { _id: false }),
    default: undefined,
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
  // useWorldview flag 제거 (#401). 단계별 contextDocIds / systemPromptDocId 로 대체.
  // 기존 문서가 가졌던 값은 무시 — 마이그레이션 안 함.
}, { timestamps: true });

pipelineSchema.index({ projectId: 1, createdAt: -1 });
pipelineSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Pipeline', pipelineSchema);
