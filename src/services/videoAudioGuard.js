/**
 * 무음 영상 + "소리도 참조" 가드 (#859).
 *
 * 오디오 트랙이 없는 영상을 참조로 붙이고 소리 참조 스위치(audioOfVideoField 가 선언된
 * boolean 필드)를 켜면, ComfyUI 의 VHS_LoadVideo 오디오 출력에서 원인불명으로 실패한다.
 * 제출 시점에 오디오 트랙을 확인해 명확한 400 사유를 돌려준다 (#842 팝업 경로).
 *
 * 트랙 유무 판정 순서: metadata.hasAudio (신규 업로드/생성분) → 파일 ffprobe (구 레코드,
 * 결과는 metadata 에 backfill) → 둘 다 불가하면 미상으로 허용 (막을 근거가 없다).
 */
const UploadedVideo = require('../models/UploadedVideo');
const GeneratedVideo = require('../models/GeneratedVideo');
const { probeVideoMetadata } = require('../utils/videoUpload');
const fs = require('fs');

// true/false = 판정, null = 미상 (문서 없음 · 파일 없음 · probe 실패)
const videoHasAudioTrack = async (videoId) => {
  if (!videoId) return null;

  let Model = UploadedVideo;
  let doc = await UploadedVideo.findById(videoId).catch(() => null);
  if (!doc) {
    Model = GeneratedVideo;
    doc = await GeneratedVideo.findById(videoId).catch(() => null);
  }
  if (!doc) return null;

  if (typeof doc.metadata?.hasAudio === 'boolean') return doc.metadata.hasAudio;

  if (!doc.path || !fs.existsSync(doc.path)) return null;
  const probed = await probeVideoMetadata(doc.path);
  if (typeof probed.hasAudio !== 'boolean') return null;

  // 다음 제출부터는 probe 없이 판정하도록 저장 (구 레코드 점진 backfill)
  await Model.updateOne({ _id: doc._id }, { $set: { 'metadata.hasAudio': probed.hasAudio } })
    .catch((e) => console.warn('⚠️ hasAudio backfill 실패:', e.message));

  return probed.hasAudio;
};

// 제출 데이터에서 첨부값 조회 — additionalParams 우선, top-level fallback (generate 라우트 관례)
const fieldValueOf = (inputLike, name) => {
  const ap = inputLike.additionalParams || {};
  return ap[name] !== undefined ? ap[name] : inputLike[name];
};

const firstVideoId = (value) => {
  const entry = Array.isArray(value) ? value[0] : value;
  if (!entry) return null;
  return entry.videoId || entry.imageId || entry;
};

/**
 * 켜진 소리 참조 스위치가 무음 영상을 가리키면 사용자용 사유 문자열을, 문제없으면 null 을 반환.
 * @param workboard additionalInputFields 를 가진 Workboard 문서 (lean 가능)
 * @param inputLike { additionalParams, ...top-level } — generate 요청 body 또는 job.inputData
 */
const findSilentVideoViolation = async (workboard, inputLike) => {
  const fields = workboard.additionalInputFields || [];
  const checked = [];

  for (const field of fields) {
    if (field.type !== 'boolean' || !field.audioOfVideoField) continue;
    const flag = fieldValueOf(inputLike, field.name);
    if (!(flag === true || flag === 'true')) continue;

    const videoId = firstVideoId(fieldValueOf(inputLike, field.audioOfVideoField));
    if (!videoId) continue; // 영상 미첨부 — omit 조건이 오디오 입력째 제거하므로 문제 없음

    const hasAudio = await videoHasAudioTrack(videoId);
    checked.push({ field: field.name, videoId: String(videoId), hasAudio });

    if (hasAudio === false) {
      const videoField = fields.find((f) => f.name === field.audioOfVideoField);
      const videoLabel = videoField?.label || field.audioOfVideoField;
      console.log('🔇 무음 영상 + 소리 참조 차단 (#859):', JSON.stringify(checked));
      return `"${videoLabel}"에 첨부한 영상에는 오디오 트랙이 없습니다. ` +
        `"${field.label}" 옵션을 끄거나 소리가 있는 영상을 첨부해 주세요.`;
    }
  }

  // 0건 포함 결과 로그 — "검사 안 함"과 "검사했는데 문제 없음"을 로그로 구분
  console.log(`🔊 소리 참조 검사 (#859): ${checked.length}건 확인, 위반 없음`,
    checked.length ? JSON.stringify(checked) : '');
  return null;
};

module.exports = { videoHasAudioTrack, findSilentVideoViolation };
