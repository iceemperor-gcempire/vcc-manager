/**
 * 데이터 정합성 진단·정제 서비스 (#662 P0/P1).
 *
 * 백업은 "있는 그대로의 스냅샷"이라 정합성 문제를 고치지 않는다(의도) — 정합성은
 * 백업과 분리된 이 서비스가 담당한다. 진단(읽기전용)과 정제(dry-run 기본)를 제공.
 *
 * - 소유자 orphan: 현존하지 않는 User 를 가리키는 개인 콘텐츠 (USER_CONTENT_MODELS
 *   — #660 단일 소스 재사용). 정제 대상.
 * - 구조 리소스 orphan: Project/Tag/Workboard/Pipeline/Server/Group 의 소유 필드가
 *   끊긴 경우. 소유권 이전 정책이 별개라 **리포트만** 하고 정제하지 않는다.
 * - 끊긴 그룹 참조 (#743): User.groupIds / Workboard.allowedGroupIds 가 삭제된
 *   Group 을 가리키는 경우 — 리포트만 (정제는 부팅 시 마이그레이션 담당).
 * - 끊긴 jobId: GeneratedImage/Video 의 jobId 가 없는 Job 을 가리키는 경우.
 *   정상 삭제 플로우는 jobId 를 $unset 하므로(routes/jobs.js) 값이 남아 있는데
 *   Job 이 없으면 비정상 — 리포트만 (jobId:null 은 보존 설계라 정상).
 * - 파일↔DB (P1): DB 가 가리키는 파일의 디스크 부재 / DB 참조 없는 고아 파일.
 */
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const UploadedImage = require('../models/UploadedImage');
const UploadedVideo = require('../models/UploadedVideo');
const { GENERATED_MEDIA_MODELS, UPLOADED_MEDIA_MODELS } = require('../constants/mediaTypes');
const { BACKUP_FILE_DIRS } = require('./backupCollections');
const { uploadUrlToDiskPath } = require('../utils/fileUpload');
const UploadedAudio = require('../models/UploadedAudio');
const GeneratedAudio = require('../models/GeneratedAudio');
const Project = require('../models/Project');
const Tag = require('../models/Tag');
const Workboard = require('../models/Workboard');
const Pipeline = require('../models/Pipeline');
const Server = require('../models/Server');
const Group = require('../models/Group');
const { USER_CONTENT_MODELS } = require('./userDeletionService');
const { deleteMediaFilesFor } = require('./mediaFileCleanup');

// 구조 리소스 — 소유 필드가 끊겨도 삭제하지 않는다 (소유권 이전 정책 별개, 리포트 전용)
const STRUCTURAL_CHECKS = [
  { Model: Project, field: 'userId' },
  { Model: Tag, field: 'userId' },
  { Model: Workboard, field: 'createdBy' },
  { Model: Pipeline, field: 'userId' },
  { Model: Server, field: 'createdBy' },
  { Model: Group, field: 'createdBy' },
];

const SAMPLE_LIMIT = 5;

async function loadExistingUserIdSet() {
  const users = await User.find({}, { _id: 1 }).lean();
  return new Set(users.map((u) => String(u._id)));
}

async function findOrphanOwnersForModel(Model, field, userIdSet) {
  const owners = await Model.distinct(field);
  return owners
    .filter((id) => id && !userIdSet.has(String(id)))
    .map((id) => String(id));
}

/**
 * 소유자 orphan 진단 (개인 콘텐츠 + 구조 리소스).
 * @returns {{ userContent: Array, structural: Array, totalOrphanDocs: number }}
 */
async function checkOwnerOrphans() {
  const userIdSet = await loadExistingUserIdSet();

  const userContent = [];
  for (const Model of USER_CONTENT_MODELS) {
    const orphanOwners = await findOrphanOwnersForModel(Model, 'userId', userIdSet);
    let count = 0;
    let sample = [];
    if (orphanOwners.length > 0) {
      count = await Model.countDocuments({ userId: { $in: orphanOwners } });
      sample = await Model.find(
        { userId: { $in: orphanOwners } },
        { _id: 1, userId: 1, createdAt: 1 }
      ).limit(SAMPLE_LIMIT).lean();
    }
    userContent.push({ collection: Model.modelName, field: 'userId', orphanOwners, count, sample });
  }

  const structural = [];
  for (const { Model, field } of STRUCTURAL_CHECKS) {
    const orphanOwners = await findOrphanOwnersForModel(Model, field, userIdSet);
    let count = 0;
    let sample = [];
    if (orphanOwners.length > 0) {
      count = await Model.countDocuments({ [field]: { $in: orphanOwners } });
      sample = await Model.find(
        { [field]: { $in: orphanOwners } },
        { _id: 1, [field]: 1, name: 1 }
      ).limit(SAMPLE_LIMIT).lean();
    }
    structural.push({ collection: Model.modelName, field, orphanOwners, count, sample });
  }

  const totalOrphanDocs = userContent.reduce((sum, r) => sum + r.count, 0);
  return { userContent, structural, totalOrphanDocs };
}

/**
 * 개인 콘텐츠 소유자 orphan 정제. 기본 dry-run — apply:true 일 때만 실제 삭제.
 * 구조 리소스는 대상에서 제외 (리포트 전용 정책).
 * 문서뿐 아니라 딸린 디스크 파일도 함께 지운다 (#806) — 예전에는 문서만 지워 고아 파일이 쌓였다.
 * @returns {{ apply: boolean, results: Array<{collection, matched, deleted}>, files: {deleted, absent, byCollection} }}
 */
async function cleanupOwnerOrphans({ apply = false } = {}) {
  const userIdSet = await loadExistingUserIdSet();
  const results = [];

  // 문서보다 파일을 먼저 지운다 — 문서를 잃으면 경로를 알 수 없어 영구 고아가 된다 (#806).
  // dry-run 에서는 당연히 지우지 않는다.
  let files = { deleted: 0, absent: 0, byCollection: [] };
  if (apply) {
    const owners = new Set();
    for (const Model of USER_CONTENT_MODELS) {
      (await findOrphanOwnersForModel(Model, 'userId', userIdSet)).forEach((id) => owners.add(id));
    }
    if (owners.size > 0) files = await deleteMediaFilesFor({ userId: { $in: [...owners] } });
  }

  for (const Model of USER_CONTENT_MODELS) {
    const orphanOwners = await findOrphanOwnersForModel(Model, 'userId', userIdSet);
    if (orphanOwners.length === 0) {
      results.push({ collection: Model.modelName, matched: 0, deleted: 0 });
      continue;
    }
    const filter = { userId: { $in: orphanOwners } };
    const matched = await Model.countDocuments(filter);
    let deleted = 0;
    if (apply && matched > 0) {
      const r = await Model.deleteMany(filter);
      deleted = r.deletedCount || 0;
    }
    results.push({ collection: Model.modelName, matched, deleted });
  }

  return { apply, results, files };
}

/**
 * 끊긴 그룹 참조 진단 (#743) — 이미 삭제된 Group 을 가리키는 멤버십/접근 참조.
 *
 * 이 검사가 없어서 #740 의 유령 권한 (작업판이 특정 사용자에게만 보이는 상태) 이
 * 오래 방치됐다. 백업은 "있는 그대로" 를 담으므로 이 상태가 백업·복원으로 계속
 * 전파된다 — 탐지는 정합성 검사의 몫이다.
 *
 * 리포트 전용. 정제는 서버 기동 시 migrations/repairDanglingGroupRefs 가 수행하며,
 * 작업판과 사용자의 복구 규칙이 달라 (접근 범위 유지 vs 잔재 제거) 여기서 일괄
 * 삭제하면 접근 권한이 조용히 바뀔 수 있다.
 */
async function checkDanglingGroupRefs() {
  const groupIds = await Group.distinct('_id');
  const groupIdSet = new Set(groupIds.map((id) => String(id)));

  const targets = [
    { Model: User, field: 'groupIds', labelField: 'username' },
    { Model: Workboard, field: 'allowedGroupIds', labelField: 'name' },
  ];

  const results = [];
  for (const { Model, field, labelField } of targets) {
    const refs = await Model.distinct(field);
    const dangling = refs
      .filter((id) => id && !groupIdSet.has(String(id)))
      .map((id) => String(id));
    let count = 0;
    let sample = [];
    if (dangling.length > 0) {
      const filter = { [field]: { $in: dangling } };
      count = await Model.countDocuments(filter);
      sample = await Model.find(filter, { _id: 1, [labelField]: 1, [field]: 1 })
        .limit(SAMPLE_LIMIT).lean();
    }
    results.push({ collection: Model.modelName, field, danglingGroupIds: dangling, count, sample });
  }
  return results;
}

/**
 * 끊긴 jobId 진단 — jobId 값이 있는데 해당 ImageGenerationJob 이 없는 콘텐츠.
 * (jobId 미보유는 히스토리 삭제 시 콘텐츠 보존 설계라 정상 — 검사 제외)
 */
async function checkDanglingJobRefs() {
  const jobIds = await ImageGenerationJob.distinct('_id');
  const jobIdSet = new Set(jobIds.map((id) => String(id)));

  const results = [];
  for (const Model of [GeneratedImage, GeneratedVideo]) {
    const refs = await Model.distinct('jobId');
    const dangling = refs
      .filter((id) => id && !jobIdSet.has(String(id)))
      .map((id) => String(id));
    let count = 0;
    let sample = [];
    if (dangling.length > 0) {
      count = await Model.countDocuments({ jobId: { $in: dangling } });
      sample = await Model.find(
        { jobId: { $in: dangling } },
        { _id: 1, jobId: 1, filename: 1 }
      ).limit(SAMPLE_LIMIT).lean();
    }
    results.push({ collection: Model.modelName, danglingJobIds: dangling, count, sample });
  }
  return results;
}

// ── P1: 파일↔DB 정합성 ─────────────────────────────────────────

// DB 의 /uploads/... 경로 → 디스크 경로 변환은 utils/fileUpload 이 단일 소스다 (#806).
// 삭제 경로(mediaFileCleanup)와 같은 규칙이어야 "지웠다고 했는데 남는" 어긋남이 없다.
// 기존 import 경로 호환을 위해 여기서도 재export 한다.

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

// 파일 정합성 대상 — 미디어 콘텐츠 (url + 파생 파일)
// 미디어 모델 목록은 constants/mediaTypes 가 단일 소스 (#808).
// urlFields 는 모델마다 다르므로(비디오만 thumbnailUrl 이 있다) 여기서 보완한다.
const THUMBNAIL_MODELS = new Set(['GeneratedVideo', 'UploadedVideo']);
const MEDIA_MODELS = { GeneratedImage, GeneratedVideo, GeneratedAudio, UploadedImage, UploadedVideo, UploadedAudio };
const FILE_CHECKS = [...GENERATED_MEDIA_MODELS, ...UPLOADED_MEDIA_MODELS].map((name) => ({
  Model: MEDIA_MODELS[name],
  urlFields: THUMBNAIL_MODELS.has(name) ? ['url', 'thumbnailUrl'] : ['url'],
}));

// uploads 하위 중 파일 정합성 검사 대상 서브디렉토리 (임시/백업 디렉토리는 제외)
const CHECKED_SUBDIRS = BACKUP_FILE_DIRS;   // #808 — 백업 대상과 같은 목록이어야 한다

/**
 * 파일↔DB 대조 — 진단과 정제가 공유하는 계산. 잘라내지 않은 전체 목록을 돌려준다.
 * (리포트용 슬라이스는 호출자가 한다 — 정제는 전체가 필요하다)
 */
async function scanFiles(uploadRoot) {
  const known = new Set();
  const missing = [];

  for (const { Model, urlFields } of FILE_CHECKS) {
    const projection = Object.fromEntries(urlFields.map((f) => [f, 1]));
    const docs = await Model.find({}, { _id: 1, ...projection }).lean();
    for (const doc of docs) {
      for (const field of urlFields) {
        const diskPath = uploadUrlToDiskPath(doc[field], uploadRoot);
        if (!diskPath) continue;
        known.add(path.resolve(diskPath));
        if (!fs.existsSync(diskPath)) {
          missing.push({ collection: Model.modelName, id: String(doc._id), field, url: doc[field] });
        }
      }
    }
  }

  const orphanFiles = [];
  for (const sub of CHECKED_SUBDIRS) {
    for (const file of walkFiles(path.join(uploadRoot, sub))) {
      if (!known.has(path.resolve(file))) orphanFiles.push(file);
    }
  }

  return { missing, orphanFiles };
}

/**
 * 파일↔DB 정합성 진단 (P1).
 * - missing: DB 가 가리키는데 디스크에 없는 파일
 * - orphanFiles: 검사 대상 서브디렉토리에 있는데 DB 어디에도 참조가 없는 파일
 */
async function checkFileIntegrity({ uploadRoot = process.env.UPLOAD_PATH || './uploads' } = {}) {
  const { missing, orphanFiles } = await scanFiles(uploadRoot);
  return {
    missingCount: missing.length,
    missing: missing.slice(0, 50),
    orphanFileCount: orphanFiles.length,
    orphanFiles: orphanFiles.slice(0, 50),
  };
}

/**
 * 고아 파일 회수 (#806). 기본 dry-run — apply:true 일 때만 실제 삭제.
 *
 * 삭제 경로를 고친 것(#806)은 **앞으로** 고아가 생기지 않게 할 뿐이다. 이미 쌓인 것은
 * 여기서만 회수된다 (알파 기준 62개 / 30MB+).
 *
 * **최근 파일은 건드리지 않는다.** 생성 파이프라인은 파일을 먼저 쓰고 DB 문서를 나중에
 * 만든다 — 그 사이에 스캔하면 정상 파일이 "참조 없음" 으로 보인다. `minAgeMs` 보다 젊은
 * 파일을 제외해 이 경합을 피한다. 이 가드가 없으면 진행 중인 작업의 결과물을 지울 수 있다.
 *
 * @returns {{apply, candidates, skippedRecent, deleted, failed, freedBytes, sample}}
 */
async function cleanupOrphanFiles({
  apply = false,
  uploadRoot = process.env.UPLOAD_PATH || './uploads',
  minAgeMs = 60 * 60 * 1000,   // 1시간
} = {}) {
  const { orphanFiles } = await scanFiles(uploadRoot);

  const cutoff = Date.now() - minAgeMs;
  const candidates = [];
  let skippedRecent = 0;
  let freedBytes = 0;

  for (const file of orphanFiles) {
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;   // 스캔과 여기 사이에 사라진 것 — 이미 정리됨
    }
    if (stat.mtimeMs > cutoff) { skippedRecent += 1; continue; }
    candidates.push(file);
    freedBytes += stat.size;
  }

  let deleted = 0;
  let failed = 0;
  if (apply) {
    for (const file of candidates) {
      try {
        fs.unlinkSync(file);
        deleted += 1;
      } catch (error) {
        failed += 1;
        console.error('고아 파일 삭제 실패:', file, error.message);
      }
    }
  }

  // 0건이어도 남긴다 — 스캔 결과가 비었는지, 최근 파일이라 걸러졌는지 구분되어야 한다
  console.log(
    `🗑️ 고아 파일 정제 (${apply ? 'apply' : 'dry-run'}): 스캔 ${orphanFiles.length}건 → ` +
    `대상 ${candidates.length}건 · 최근이라 제외 ${skippedRecent}건 · 삭제 ${deleted}건 · 실패 ${failed}건 · ` +
    `${(freedBytes / 1048576).toFixed(1)}MB`
  );

  return {
    apply,
    candidates: candidates.length,
    skippedRecent,
    deleted,
    failed,
    freedBytes,
    sample: candidates.slice(0, 50),
  };
}

module.exports = {
  checkOwnerOrphans,
  cleanupOwnerOrphans,
  checkDanglingJobRefs,
  checkDanglingGroupRefs,
  checkFileIntegrity,
  cleanupOrphanFiles,
  uploadUrlToDiskPath,
  STRUCTURAL_CHECKS,
};
