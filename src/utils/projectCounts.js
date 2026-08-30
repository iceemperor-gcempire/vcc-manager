// 프로젝트 콘텐츠 집계 (#838). 즐겨찾기 목록 · 목록 · 상세 세 곳이 같은 계산을 각자 들고 있었고,
// 셋 다 오디오를 빠뜨렸다. 여기 하나로 모은다 — 한 곳만 고치면 세 화면이 같이 어긋나지 않는다.
//
// 반환값의 `images` 는 이름과 달리 **이미지+영상+오디오 전체** 다 (이전부터 이미지+영상이었다).
// 프론트가 아직 `counts.images` 를 읽어 호환을 위해 남기고, 의미가 맞는 이름은 `media` 다.
// 종류별 내역은 `byType` — 탭에 없는 것을 세는 일이 없도록 화면이 이걸로 맞춘다.

const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const GeneratedAudio = require('../models/GeneratedAudio');
const PromptData = require('../models/PromptData');
const ImageGenerationJob = require('../models/ImageGenerationJob');

/**
 * @param {ObjectId|string} userId
 * @param {ObjectId|string} tagId — 프로젝트 태그
 * @returns {Promise<{ images:number, media:number, byType:{image:number,video:number,audio:number}, promptData:number, jobs:number }>}
 */
async function buildProjectCounts(userId, tagId) {
  const [image, video, audio, promptData, jobs] = await Promise.all([
    GeneratedImage.countDocuments({ userId, tags: tagId }),
    GeneratedVideo.countDocuments({ userId, tags: tagId }),
    GeneratedAudio.countDocuments({ userId, tags: tagId }),
    PromptData.countDocuments({ createdBy: userId, tags: tagId }),
    ImageGenerationJob.countDocuments({ userId, 'inputData.tags': tagId }),
  ]);
  const media = image + video + audio;
  return { images: media, media, byType: { image, video, audio }, promptData, jobs };
}

module.exports = { buildProjectCounts };
