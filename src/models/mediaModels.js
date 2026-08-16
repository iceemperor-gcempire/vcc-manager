/**
 * 미디어 모델 이름 → 모델 객체 해석 (#807).
 *
 * `constants/mediaTypes` 는 축과 모델 **이름**만 안다 (순환 참조 회피). 실제 모델이
 * 필요한 곳마다 각자 require 목록을 적으면 축이 늘 때 한두 곳이 빠진다 — 통계가
 * 이미지만 세고 있던 것이 그 사례다. 해석을 여기 한 곳에 모은다.
 */
const {
  GENERATED_MEDIA_MODEL_BY_TYPE,
  UPLOADED_MEDIA_MODEL_BY_TYPE,
} = require('../constants/mediaTypes');

const BY_NAME = {
  GeneratedImage: require('./GeneratedImage'),
  GeneratedVideo: require('./GeneratedVideo'),
  GeneratedAudio: require('./GeneratedAudio'),
  UploadedImage: require('./UploadedImage'),
  UploadedVideo: require('./UploadedVideo'),
  UploadedAudio: require('./UploadedAudio'),
};

const resolve = (byType) =>
  Object.freeze(
    Object.fromEntries(Object.entries(byType).map(([type, name]) => [type, BY_NAME[name]]))
  );

/** { image: GeneratedImage, video: GeneratedVideo, audio: GeneratedAudio } */
const GENERATED_MEDIA_MODELS_BY_TYPE = resolve(GENERATED_MEDIA_MODEL_BY_TYPE);

/** { image: UploadedImage, video: UploadedVideo, audio: UploadedAudio } */
const UPLOADED_MEDIA_MODELS_BY_TYPE = resolve(UPLOADED_MEDIA_MODEL_BY_TYPE);

module.exports = {
  BY_NAME,
  GENERATED_MEDIA_MODELS_BY_TYPE,
  UPLOADED_MEDIA_MODELS_BY_TYPE,
};
