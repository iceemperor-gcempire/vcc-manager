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
const Project = require('../models/Project');
const Tag = require('../models/Tag');
const Workboard = require('../models/Workboard');
const Pipeline = require('../models/Pipeline');
const Server = require('../models/Server');
const Group = require('../models/Group');
const { USER_CONTENT_MODELS } = require('./userDeletionService');

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
 * @returns {{ apply: boolean, results: Array<{collection, matched, deleted}> }}
 */
async function cleanupOwnerOrphans({ apply = false } = {}) {
  const userIdSet = await loadExistingUserIdSet();
  const results = [];

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

  return { apply, results };
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

// DB 의 /uploads/... 경로를 디스크 경로로 변환. uploads 밖(비정상)은 null.
function uploadUrlToDiskPath(url, uploadRoot) {
  if (!url || typeof url !== 'string') return null;
  const normalized = url.split('?')[0];
  if (!normalized.startsWith('/uploads/')) return null;
  const rel = normalized.slice('/uploads/'.length);
  if (rel.includes('..') || rel.includes('\0')) return null;
  return path.join(uploadRoot, rel);
}

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
const FILE_CHECKS = [
  { Model: GeneratedImage, urlFields: ['url'] },
  { Model: GeneratedVideo, urlFields: ['url', 'thumbnailUrl'] },
  { Model: UploadedImage, urlFields: ['url'] },
];

// uploads 하위 중 파일 정합성 검사 대상 서브디렉토리 (임시/백업 디렉토리는 제외)
const CHECKED_SUBDIRS = ['generated', 'reference', 'videos'];

/**
 * 파일↔DB 정합성 진단 (P1).
 * - missing: DB 가 가리키는데 디스크에 없는 파일
 * - orphanFiles: 검사 대상 서브디렉토리에 있는데 DB 어디에도 참조가 없는 파일
 */
async function checkFileIntegrity({ uploadRoot = process.env.UPLOAD_PATH || './uploads' } = {}) {
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

  return {
    missingCount: missing.length,
    missing: missing.slice(0, 50),
    orphanFileCount: orphanFiles.length,
    orphanFiles: orphanFiles.slice(0, 50),
  };
}

module.exports = {
  checkOwnerOrphans,
  cleanupOwnerOrphans,
  checkDanglingJobRefs,
  checkFileIntegrity,
  uploadUrlToDiskPath,
  STRUCTURAL_CHECKS,
};
