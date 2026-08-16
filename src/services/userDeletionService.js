/**
 * User 삭제 + 개인 콘텐츠 cascade 정리 (#660).
 *
 * 사용자 본인 삭제(routes/users.js DELETE /account)와 관리자 삭제(routes/admin.js
 * DELETE /users/:id)가 각자 삭제 목록을 하드코딩하다 drift 가 생겨, 나중에 추가된
 * 영상/대화/텍스트/업로드텍스트/파이프라인실행이 누락돼 orphan 이 남았다. 단일 헬퍼로 통합.
 *
 * 정책:
 * - User 삭제 시 개인 소유 콘텐츠(userId 기준)는 무조건 전체 삭제 (preferences 미반영).
 * - 구조 리소스(Project/Workboard/Pipeline/Tag/Server/Group — createdBy)는 소유권 이전
 *   정책이 별개라 여기 포함하지 않음.
 * - 새 "개인 콘텐츠" 모델 추가 시 USER_CONTENT_MODELS 에 반드시 추가
 *   (userDeletionService.test.js 의 modelName 대조 테스트가 누락을 잡아준다).
 */
const User = require('../models/User');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const ConversationJob = require('../models/ConversationJob');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const GeneratedText = require('../models/GeneratedText');
const UploadedImage = require('../models/UploadedImage');
const UploadedVideo = require('../models/UploadedVideo');
const UploadedAudio = require('../models/UploadedAudio');
const GeneratedAudio = require('../models/GeneratedAudio');
const UploadedText = require('../models/UploadedText');
const PipelineRun = require('../models/PipelineRun');
const ApiKey = require('../models/ApiKey');
const { deleteMediaFilesFor } = require('./mediaFileCleanup');

// userId 로 소유자를 참조하는 개인 콘텐츠/작업 모델 — User 삭제 시 함께 제거.
const USER_CONTENT_MODELS = [
  ImageGenerationJob,
  ConversationJob,
  GeneratedImage,
  GeneratedVideo,
  GeneratedAudio,
  GeneratedText,
  UploadedImage,
  UploadedVideo,
  UploadedAudio,
  UploadedText,
  PipelineRun,
  ApiKey,
];

/**
 * 사용자와 그 개인 콘텐츠를 모두 삭제.
 *
 * 순서: **디스크 파일 → 콘텐츠 문서 → User 문서.**
 * 파일을 먼저 지우는 이유는 문서가 사라지면 경로를 알 수 없어 영구 고아가 되기 때문이다 (#806).
 * 예전에는 `deleteMany` 만 호출해 문서만 지웠고, 계정을 삭제해도 그 사람이 만든
 * 이미지·영상·오디오가 디스크에 그대로 남았다 — 용량 누적이자 탈퇴 처리의 불완전함이었다.
 */
async function deleteUserAndContent(userId) {
  await deleteMediaFilesFor({ userId });
  await Promise.all(USER_CONTENT_MODELS.map((Model) => Model.deleteMany({ userId })));
  await User.findByIdAndDelete(userId);
}

module.exports = { deleteUserAndContent, USER_CONTENT_MODELS };
