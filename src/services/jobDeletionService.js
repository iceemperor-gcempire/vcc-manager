// 작업 삭제 공통 로직 (#902). DELETE /jobs/:id 와 POST /jobs/bulk-delete 가 같은 규칙을 쓴다.
//
// - 참조 이미지의 referencedBy 에서 이 작업을 뺀다
// - deleteContent=true 면 결과 이미지·영상·오디오의 파일과 레코드를 지우고, 아니면 jobId 만 끊는다
//   (히스토리 삭제 시 콘텐츠 보존 — GeneratedImage/Video/Audio 의 jobId 가 required:false 인 이유)
// - 마지막에 작업 레코드 삭제
//
// 예전 단건 라우트는 오디오를 빠뜨려 오디오 작업을 지우면 GeneratedAudio.jobId 가 사라진 작업을
// 가리킨 채 남았다. 여기로 모으면서 세 종류를 같은 방식으로 다룬다.

const UploadedImage = require('../models/UploadedImage');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const GeneratedAudio = require('../models/GeneratedAudio');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const { deleteFile } = require('../utils/fileUpload');

const CONTENT_KINDS = [
  { field: 'resultImages', Model: GeneratedImage, label: 'image', countKey: 'deletedImagesCount' },
  { field: 'resultVideos', Model: GeneratedVideo, label: 'video', countKey: 'deletedVideosCount' },
  { field: 'resultAudios', Model: GeneratedAudio, label: 'audio', countKey: 'deletedAudiosCount' },
];

/** 삭제 가능 여부 — 라우트가 상태 코드로 옮긴다 */
function checkDeletable(job, user) {
  if (!job) return { ok: false, status: 404, reason: 'Job not found' };
  if (job.userId.toString() !== user._id.toString() && !user.isAdmin) return { ok: false, status: 403, reason: 'Access denied' };
  if (job.status === 'processing') return { ok: false, status: 400, reason: 'Cannot delete job that is currently processing' };
  return { ok: true };
}

/**
 * @param {Object} job — resultImages/resultVideos/resultAudios 가 populate 된 ImageGenerationJob
 * @param {{ deleteContent: boolean }} opts
 * @returns {Promise<{deletedImagesCount:number, deletedVideosCount:number, deletedAudiosCount:number}>}
 */
async function deleteJobRecord(job, { deleteContent = false } = {}) {
  // 참조 이미지 연결 해제
  const refs = (job.inputData && job.inputData.referenceImages) || [];
  for (const refImg of refs) {
    if (!refImg || !refImg.imageId) continue;
    await UploadedImage.findByIdAndUpdate(refImg.imageId, { $pull: { referencedBy: { jobId: job._id } } });
    const updated = await UploadedImage.findById(refImg.imageId);
    if (updated) {
      updated.isReferenced = (updated.referencedBy || []).length > 0;
      await updated.save();
    }
  }

  const counts = { deletedImagesCount: 0, deletedVideosCount: 0, deletedAudiosCount: 0 };
  for (const kind of CONTENT_KINDS) {
    const items = (job[kind.field] || []).filter(Boolean);
    if (items.length === 0) continue;
    if (deleteContent) {
      for (const item of items) {
        const id = item._id || item;
        try {
          if (item.path) await deleteFile(item.path);
        } catch (fileError) {
          // 파일이 이미 없어도 레코드는 지운다 — 고아 레코드가 남는 쪽이 더 나쁘다
          console.error(`⚠️  ${kind.label} 파일 삭제 실패 ${id}: ${fileError.message}`);
        }
        await kind.Model.findByIdAndDelete(id);
        counts[kind.countKey]++;
      }
    } else {
      await kind.Model.updateMany({ _id: { $in: items.map((i) => i._id || i) } }, { $unset: { jobId: 1 } });
    }
  }

  await ImageGenerationJob.findByIdAndDelete(job._id);
  return counts;
}

module.exports = { deleteJobRecord, checkDeletable, CONTENT_KINDS };
