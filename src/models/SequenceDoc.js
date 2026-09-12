const mongoose = require('mongoose');

// 작업 절차 문서 (#952) — 작업 절차 단계가 LLM 에 주입하는 컨텍스트·시스템 프롬프트 문서.
//
// 개인 UploadedText 를 쓰지 않는 이유: 운영자 계정의 문서를 걸면 그 계정이 사라지거나 문서를
// 지울 때 모든 실행자에게서 조용히 빠진다(#923 이 공유 프로젝트에서 푼 문제의 반복).
// 소유자 없는 문서로 두면 소유권 이전이 필요 없고, 관리자가 고치면 이 문서를 쓰는 모든
// 작업 절차에 다음 실행부터 반영된다.
//
// 열람·변경은 admin 전용이다. 실행자에게는 주입만 되고 본문은 보이지 않는다.
// createdBy 는 감사 기록일 뿐 접근 판정에 쓰지 않는다.

const MAX_CONTENT_LENGTH = 1_000_000; // UploadedText · PromptGuide 와 같은 상한

const sequenceDocSchema = new mongoose.Schema({
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

sequenceDocSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('SequenceDoc', sequenceDocSchema);
module.exports.MAX_CONTENT_LENGTH = MAX_CONTENT_LENGTH;
