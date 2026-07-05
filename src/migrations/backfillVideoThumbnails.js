/**
 * 기존 동영상 썸네일 백필 (#672).
 * thumbnailUrl 이 없는 GeneratedVideo 를 순회해 ffmpeg 로 첫 프레임 jpg 를 생성하고 채운다.
 * idempotent: 이미 thumbnailUrl 이 있으면 대상에서 빠지므로 재부팅 시 재실행 비용 최소.
 * best-effort: 개별 실패/파일 없음은 skip, 부팅을 막지 않는다.
 */
const path = require('path');
const fs = require('fs');
const GeneratedVideo = require('../models/GeneratedVideo');
const { generateVideoThumbnail, thumbnailPathFor } = require('../utils/videoThumbnail');

module.exports = async function backfillVideoThumbnails() {
  const UPLOAD_PATH = process.env.UPLOAD_PATH || './uploads';

  const targets = await GeneratedVideo.find({
    $or: [{ thumbnailUrl: { $exists: false } }, { thumbnailUrl: null }, { thumbnailUrl: '' }],
  }).select('_id url');

  if (!targets.length) return;
  console.log(`[Migration] 동영상 썸네일 백필: ${targets.length}건 대상`);

  let ok = 0;
  let skip = 0;
  for (const doc of targets) {
    try {
      if (!doc.url) { skip++; continue; }
      const rel = doc.url.replace(/^\/uploads\//, ''); // videos/xxx.mp4
      const videoPath = path.join(UPLOAD_PATH, rel);
      if (!fs.existsSync(videoPath)) { skip++; continue; } // 원본 파일 없으면 skip

      const thumbPath = thumbnailPathFor(videoPath);
      await generateVideoThumbnail(videoPath, thumbPath);
      const subDir = path.dirname(rel); // videos
      await GeneratedVideo.updateOne(
        { _id: doc._id },
        { $set: { thumbnailUrl: `/uploads/${subDir}/${path.basename(thumbPath)}` } }
      );
      ok++;
    } catch (err) {
      skip++;
      console.warn(`[Migration] 썸네일 백필 실패 ${doc._id}:`, err.message);
    }
  }
  console.log(`[Migration] 동영상 썸네일 백필 완료: 생성 ${ok}, skip/실패 ${skip}`);
};
