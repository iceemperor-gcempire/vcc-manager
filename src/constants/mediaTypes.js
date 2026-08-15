// 미디어 축 단일 소스 (#808).
//
// 이미지·비디오·오디오처럼 "축" 이 늘 때마다 같은 목록을 여러 곳에 리터럴로 적어왔고,
// 그때마다 한두 곳이 빠져 사고가 났다 (#805 백업 디렉토리 누락으로 복원 시 오디오 소실,
// MCP 미러 OUTPUT_FORMATS 미반영 등). 축을 늘릴 때 **여기만 고치면 되도록** 모은다.
//
// serverTypes.js 와 역할이 다르다 — 저기는 "어떤 서버가 무엇을 낼 수 있나"(capability),
// 여기는 "미디어 축 자체의 성질"(첨부형 필드 타입, 저장 디렉토리, 생성물 모델)이다.

/**
 * 파일을 첨부받는 필드 타입.
 *
 * 공통 성질: 업로드 → ComfyUI 전송 → `{{##필드명##}}` 은 파일명으로 치환되고,
 * `{{##필드명_attached##}}` 가 1/0 으로 자동 제공된다 (#758, #772).
 * 일반 필드(string/select/number...)와 달리 required 검증도 별도 경로를 탄다.
 */
const ATTACHMENT_FIELD_TYPES = Object.freeze(['image', 'video', 'audio']);

/**
 * 생성물이 저장되는 미디어 종류 → 저장 서브디렉토리.
 *
 * 이 목록이 곧 백업 대상 파일 디렉토리의 근거다 (`reference` 는 업로드본용으로 별도).
 * queueService 의 saveGeneratedMedia 가 이 매핑으로 경로를 정한다.
 */
const GENERATED_MEDIA_DIRS = Object.freeze({
  image: 'generated',
  video: 'videos',
  audio: 'audios',
});

/** 업로드본이 저장되는 디렉토리 (이미지·비디오·오디오 공용) */
const UPLOAD_MEDIA_DIR = 'reference';

/**
 * 생성물 미디어 모델 이름.
 *
 * 백업·무결성 검사·계정 삭제가 전부 이 셋을 함께 다뤄야 한다.
 * 모델 객체가 아니라 **이름**으로 두는 이유는 순환 참조를 피하기 위해서다 —
 * 각 서비스가 자기 시점에 require 한다.
 */
const GENERATED_MEDIA_MODELS = Object.freeze(['GeneratedImage', 'GeneratedVideo', 'GeneratedAudio']);

/** 업로드본 미디어 모델 이름 */
const UPLOADED_MEDIA_MODELS = Object.freeze(['UploadedImage', 'UploadedVideo', 'UploadedAudio']);

module.exports = {
  ATTACHMENT_FIELD_TYPES,
  GENERATED_MEDIA_DIRS,
  UPLOAD_MEDIA_DIR,
  GENERATED_MEDIA_MODELS,
  UPLOADED_MEDIA_MODELS,
};
