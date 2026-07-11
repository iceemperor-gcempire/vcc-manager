const sharp = require('sharp');
const UploadedImage = require('../models/UploadedImage');
const GeneratedImage = require('../models/GeneratedImage');

// 비전 LLM 첨부 이미지 처리 (#517).
// imageId 배열 → 비전 콘텐츠용 base64 이미지 배열로 변환한다.
// - 사용자 소유 이미지만 로드(권한)
// - 장변 MAX_DIM 으로 리사이즈 + jpeg 인코딩 (토큰/용량/비용 절감, 로컬 서버 한계 회피)
// - 입력 순서 보존
// 반환: [{ imageId, url, base64, mimeType }]  (LLM 호출엔 base64/mimeType, 영속/표시엔 imageId/url)

const MAX_DIM = 1536;   // 장변 최대 픽셀
const MAX_IMAGES = 4;   // 첨부 최대 장수

async function loadVisionImages(imageIds, userId) {
  if (!Array.isArray(imageIds) || imageIds.length === 0) return [];
  const ids = imageIds.filter(Boolean).slice(0, MAX_IMAGES);
  if (ids.length === 0) return [];

  // 업로드 이미지 + 생성 이미지 둘 다 조회 — 파이프라인 앞 단계 산출물(GeneratedImage)도 vision 입력으로 (#684).
  const [uploaded, generated] = await Promise.all([
    UploadedImage.find({ _id: { $in: ids }, userId }),
    GeneratedImage.find({ _id: { $in: ids }, userId }),
  ]);
  const byId = new Map([...uploaded, ...generated].map((d) => [String(d._id), d]));

  const out = [];
  for (const id of ids) {
    const doc = byId.get(String(id));
    if (!doc?.path) continue;
    try {
      const buf = await sharp(doc.path)
        .rotate() // EXIF orientation 반영
        .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      out.push({
        imageId: doc._id,
        url: doc.url,
        base64: buf.toString('base64'),
        mimeType: 'image/jpeg',
      });
    } catch (e) {
      console.error('[visionImages] 이미지 로드/변환 실패:', String(id), e.message);
    }
  }
  return out;
}

module.exports = { loadVisionImages, MAX_IMAGES, MAX_DIM };
