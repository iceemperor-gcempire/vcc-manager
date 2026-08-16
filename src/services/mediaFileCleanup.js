/**
 * 미디어 문서에 딸린 **디스크 파일** 일괄 삭제 (#806).
 *
 * 개별 콘텐츠 삭제 라우트는 `deleteFile` 을 제대로 부르는데, 일괄 삭제 경로가 전부
 * 빠져 있었다 — 계정 삭제(userDeletionService)와 소유자 orphan 정제
 * (integrityService.cleanupOwnerOrphans) 가 `deleteMany` 만 호출해 DB 문서만 지웠다.
 * 알파 기준 파일 110개 중 59개(54%)가 참조 없는 고아였다.
 *
 * 단순한 용량 문제가 아니다. **계정을 지워도 그 사람이 만든 이미지·영상·오디오가 디스크에
 * 남는다** — 탈퇴 처리로서 불완전하다.
 *
 * 파일을 먼저 지우고 문서를 지운다. 순서를 뒤집으면 문서를 잃은 시점에 경로를 알 수 없어
 * 파일이 영구 고아가 된다. 반대로 파일 삭제가 실패해도 문서 삭제는 진행한다 — 남은 파일은
 * 정합성 검사가 고아로 잡아낼 수 있지만, 문서가 남으면 삭제 자체가 실패한 것이 된다.
 */
const { GENERATED_MEDIA_MODELS, UPLOADED_MEDIA_MODELS } = require('../constants/mediaTypes');
const { deleteFile, uploadUrlToDiskPath } = require('../utils/fileUpload');

const MEDIA_MODELS = {
  GeneratedImage: require('../models/GeneratedImage'),
  GeneratedVideo: require('../models/GeneratedVideo'),
  GeneratedAudio: require('../models/GeneratedAudio'),
  UploadedImage: require('../models/UploadedImage'),
  UploadedVideo: require('../models/UploadedVideo'),
  UploadedAudio: require('../models/UploadedAudio'),
};

/** 본체 외에 별도 파일로 만들어지는 파생 산출물(썸네일)이 있는 모델 */
const THUMBNAIL_MODELS = new Set(['GeneratedVideo', 'UploadedVideo']);

/** 파일을 가진 미디어 모델 이름 — 디스크 정리 대상의 단일 소스 */
const MEDIA_FILE_MODEL_NAMES = Object.freeze([...GENERATED_MEDIA_MODELS, ...UPLOADED_MEDIA_MODELS]);

/**
 * 주어진 필터에 해당하는 미디어 문서들의 디스크 파일을 삭제한다. **문서는 지우지 않는다.**
 *
 * @param {Object} filter - mongoose 필터 (예: `{ userId }`, `{ userId: { $in: [...] } }`)
 * @param {Object} [options]
 * @param {string} [options.uploadRoot] - 업로드 루트 (기본 UPLOAD_PATH)
 * @returns {Promise<{deleted: number, absent: number, byCollection: Array<{collection, docs, deleted, absent}>}>}
 *   `absent` 는 경로는 알았는데 디스크에 이미 없던 것 — 실패가 아니라 이미 정리된 상태다.
 */
async function deleteMediaFilesFor(filter, { uploadRoot = process.env.UPLOAD_PATH || './uploads' } = {}) {
  const byCollection = [];
  let deleted = 0;
  let absent = 0;

  for (const name of MEDIA_FILE_MODEL_NAMES) {
    const Model = MEDIA_MODELS[name];
    const projection = { path: 1, ...(THUMBNAIL_MODELS.has(name) ? { thumbnailUrl: 1 } : {}) };
    const docs = await Model.find(filter, projection).lean();

    const targets = [];
    for (const doc of docs) {
      if (doc.path) targets.push(doc.path);
      // 썸네일은 별도 경로 필드가 없어 URL 에서 환산한다 (routes/images.js 와 같은 규칙)
      if (doc.thumbnailUrl) {
        const thumbPath = uploadUrlToDiskPath(doc.thumbnailUrl, uploadRoot);
        if (thumbPath) targets.push(thumbPath);
      }
    }

    const results = await Promise.allSettled(targets.map((p) => deleteFile(p)));
    // deleteFile 은 파일이 없으면 false 를 돌려준다 (예외 아님)
    const removed = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
    const notFound = targets.length - removed;

    deleted += removed;
    absent += notFound;
    byCollection.push({ collection: name, docs: docs.length, deleted: removed, absent: notFound });
  }

  // 0건이어도 남긴다 — "대상이 없었다" 와 "이 단계가 안 돌았다" 가 로그에서 구분되어야 한다
  console.log(
    `🧹 미디어 파일 정리: 삭제 ${deleted}건 · 이미 없음 ${absent}건 | ` +
    byCollection.map((c) => `${c.collection} ${c.deleted}/${c.docs}`).join(', ')
  );

  return { deleted, absent, byCollection };
}

module.exports = { deleteMediaFilesFor, MEDIA_FILE_MODEL_NAMES };
