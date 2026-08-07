const mongoose = require('mongoose');

// 모델별 프롬프트 작성 가이드 (#766).
//
// UploadedText 와 결정적으로 다른 점: **소유자 개념이 없다.**
// UploadedText 는 userId 가 required 이고 조회가 전부 `{ userId }` 로 하드 필터링돼
// (jobs.js / pipelineRunService.js), admin 이 만든 문서를 작업판에 걸면 다른 사용자에게는
// 오류 없이 조용히 빠진 채 실행된다. 가이드는 작업판을 보는 모든 사용자에게 동일하게
// 적용돼야 하므로 소유 필드를 두지 않고, 접근 통제는 기존 작업판 접근 그룹
// (Workboard.allowedGroupIds) 이 그대로 담당한다 — 작업판을 볼 수 있으면 가이드도 적용.
//
// createdBy 는 감사용 기록일 뿐 접근 판정에 쓰지 않는다.
//
// ⚠️ 작업판의 system_prompt 기본값을 자동으로 이 컬렉션으로 옮기지 말 것.
// 한때 "길이가 임계값을 넘으면 가이드로 분리" 하는 부팅 마이그레이션을 넣었다가 되돌렸다.
// 작업판 필드값과 PromptGuide 는 **관리 주체 레벨이 다르다**:
//   - 작업판 필드: 그 작업판 안에서만 보이고, 작업판을 지우면 함께 사라진다
//   - PromptGuide: 전역 목록에 노출되고, 다른 작업판이 연결할 수 있으며,
//     작업판을 지워도 남고, 수정하면 연결된 모든 작업판에 영향을 준다
// 승격은 거버넌스 결정이지 크기로 판단할 문제가 아니다. 길지만 그 작업판 전용인
// 지침은 얼마든지 있을 수 있고, 코드는 그걸 구분할 정보를 갖고 있지 않다.
// 이전이 필요하면 관리자가 명시적으로 가이드를 만들어 연결한다.

const MAX_CONTENT_LENGTH = 1_000_000; // 100만자 (UploadedText 와 동일 상한)

const promptGuideSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: '',
  },
  content: {
    type: String,
    required: true,
    maxlength: MAX_CONTENT_LENGTH,
  },
  // 목록 필터·식별용 자유 문자열 (예: 'MiniMax H3', 'Seedance 2.5'). enum 으로 묶지 않는다 —
  // 신규 모델이 나올 때마다 상수 동기화를 강제하면 가이드 추가가 코드 변경을 부른다.
  targetModel: {
    type: String,
    trim: true,
    maxlength: 100,
    default: '',
  },
  // 업스트림 출처 추적 (#766 문제 3). 가이드가 외부 문서에서 왔을 때 갱신 판단 근거.
  source: {
    url: { type: String, trim: true, maxlength: 500, default: '' },
    ref: { type: String, trim: true, maxlength: 100, default: '' }, // commit sha / 버전 태그
  },
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

promptGuideSchema.index({ isActive: 1, updatedAt: -1 });
promptGuideSchema.index({ targetModel: 1 });

module.exports = mongoose.model('PromptGuide', promptGuideSchema);
module.exports.MAX_CONTENT_LENGTH = MAX_CONTENT_LENGTH;
