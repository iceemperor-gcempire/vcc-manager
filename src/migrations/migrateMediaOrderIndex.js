const ImageGenerationJob = require('../models/ImageGenerationJob');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');

async function migrateMediaOrderIndex() {
  try {
    // orderIndex가 설정되지 않은 이미지/비디오가 있는지 확인
    const unindexedImageCount = await GeneratedImage.countDocuments({
      orderIndex: { $exists: false }
    });
    const unindexedVideoCount = await GeneratedVideo.countDocuments({
      orderIndex: { $exists: false }
    });

    if (unindexedImageCount === 0 && unindexedVideoCount === 0) {
      console.log('[Migration] Media orderIndex: 마이그레이션 불필요 (이미 완료됨)');
      return;
    }

    console.log(`[Migration] Media orderIndex: 미설정 이미지 ${unindexedImageCount}개, 비디오 ${unindexedVideoCount}개 발견`);

    // resultImages/resultVideos가 있는 Job들을 조회
    const jobs = await ImageGenerationJob.find({
      $or: [
        { resultImages: { $exists: true, $ne: [] } },
        { resultVideos: { $exists: true, $ne: [] } }
      ]
    }).lean();

    let updatedImages = 0;
    let updatedVideos = 0;

    for (const job of jobs) {
      // resultImages 배열 순서대로 orderIndex 설정
      if (job.resultImages && job.resultImages.length > 0) {
        for (let i = 0; i < job.resultImages.length; i++) {
          const result = await GeneratedImage.updateOne(
            { _id: job.resultImages[i], orderIndex: { $exists: false } },
            { $set: { orderIndex: i } }
          );
          if (result.modifiedCount > 0) updatedImages++;
        }
      }

      // resultVideos 배열 순서대로 orderIndex 설정
      if (job.resultVideos && job.resultVideos.length > 0) {
        for (let i = 0; i < job.resultVideos.length; i++) {
          const result = await GeneratedVideo.updateOne(
            { _id: job.resultVideos[i], orderIndex: { $exists: false } },
            { $set: { orderIndex: i } }
          );
          if (result.modifiedCount > 0) updatedVideos++;
        }
      }
    }

    // Job에 연결되지 않은 미디어는 orderIndex: 0으로 설정
    const orphanImageResult = await GeneratedImage.updateMany(
      { orderIndex: { $exists: false } },
      { $set: { orderIndex: 0 } }
    );
    const orphanVideoResult = await GeneratedVideo.updateMany(
      { orderIndex: { $exists: false } },
      { $set: { orderIndex: 0 } }
    );

    console.log(`[Migration] Media orderIndex 완료: 이미지 ${updatedImages}개 + 고아 ${orphanImageResult.modifiedCount}개, 비디오 ${updatedVideos}개 + 고아 ${orphanVideoResult.modifiedCount}개 업데이트`);
  } catch (error) {
    console.error('[Migration] Media orderIndex 실패:', error);
  }
}

module.exports = migrateMediaOrderIndex;
