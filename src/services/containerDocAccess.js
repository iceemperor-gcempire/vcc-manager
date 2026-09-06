const UploadedText = require('../models/UploadedText');
const { userHasProjectAccess } = require('../middleware/auth');
const { loadVisionImages } = require('../utils/visionImages');

// 컨테이너(프로젝트) 기준 문서·이미지 주입 로더 (#923, Epic #922 1단계).
//
// 문제: 파이프라인 단계 / 단발 잡의 contextDocIds · systemPromptDocId · 사전 첨부 이미지는
// 전부 `{ userId: 실행자 }` 로 조회됐다. 공유 프로젝트(#802)의 파이프라인을 소유자가 아닌
// 독자가 실행하면 소유자의 문서가 **오류 없이 조용히 빠진 채** 실행된다.
//
// 원칙 (PromptGuide #766 과 동일): **문서 접근은 문서가 걸린 컨테이너가 판정한다.**
// 문서는 개인 소유 그대로 두고, "실행자가 읽을 수 있는 프로젝트의 소유자" 문서를 실행 시
// 주입 목적에 한해 허용한다. 열람(목록·내용)은 열지 않는다 — 주입 전용.
//
// 파이프라인 실행(pipelineRunService)과 단발 잡(routes/jobs.js)이 **반드시 이 모듈을 함께**
// 쓴다. 두 경로가 각자 판정하면 #794/#802 처럼 한쪽만 고쳐지는 사고가 난다.
//
// 0건일 때도 로그를 남긴다 — "정상인데 없었다" 와 "잘못 걸러냈다" 를 구분하기 위해
// 빠진 id 마다 사유(not_found / owner_not_allowed)를 함께 적는다.

/**
 * 주입에 허용되는 문서 소유자 id 목록.
 * 실행자 본인 + (실행자가 읽을 수 있는 프로젝트라면) 프로젝트 소유자.
 */
function allowedOwnerIds({ viewer, project }) {
  const owners = [];
  if (viewer?._id) owners.push(String(viewer._id));
  if (project && userHasProjectAccess(viewer, project) && project.userId) {
    const owner = String(project.userId);
    if (!owners.includes(owner)) owners.push(owner);
  }
  return owners;
}

// 빠진 id 의 사유 분류 — 존재 자체가 없는지, 소유자가 허용 범위 밖인지.
async function classifyMissing(missingIds, owners) {
  if (missingIds.length === 0) return [];
  const found = await UploadedText.find({ _id: { $in: missingIds } }).select('_id userId').lean();
  const byId = new Map(found.map((d) => [String(d._id), d]));
  return missingIds.map((id) => {
    const d = byId.get(String(id));
    if (!d) return { id: String(id), reason: 'not_found' };
    return { id: String(id), reason: owners.includes(String(d.userId)) ? 'unknown' : 'owner_not_allowed' };
  });
}

function logResult(label, asked, foundCount, skipped) {
  const tail = skipped.length ? ` skipped=${JSON.stringify(skipped)}` : '';
  console.log(`[containerDocAccess] ${label}: asked=${asked} found=${foundCount}${tail}`);
}

/**
 * 컨텍스트 문서 다중 로드. 입력 순서가 아니라 createdAt 순 (기존 동작 유지).
 * @returns {Promise<Array>} UploadedText lean 문서 배열 (없으면 [])
 */
async function loadContextDocs({ docIds, viewer, project, label = 'contextDocs' }) {
  const ids = (Array.isArray(docIds) ? docIds : []).filter(Boolean).map(String);
  if (ids.length === 0) return [];
  const owners = allowedOwnerIds({ viewer, project });
  const docs = await UploadedText.find({ _id: { $in: ids }, userId: { $in: owners } })
    .sort({ createdAt: 1 }).lean();
  const foundIds = new Set(docs.map((d) => String(d._id)));
  const skipped = await classifyMissing(ids.filter((id) => !foundIds.has(id)), owners);
  logResult(label, ids.length, docs.length, skipped);
  return docs;
}

/**
 * 시스템 프롬프트 문서 단일 로드.
 * @returns {Promise<Object|null>}
 */
async function loadSystemPromptDoc({ docId, viewer, project, label = 'systemPromptDoc' }) {
  if (!docId) return null;
  const owners = allowedOwnerIds({ viewer, project });
  const doc = await UploadedText.findOne({ _id: docId, userId: { $in: owners } }).lean();
  const skipped = doc ? [] : await classifyMissing([String(docId)], owners);
  logResult(label, 1, doc ? 1 : 0, skipped);
  return doc;
}

/**
 * 비전 이미지 로드 — 소유자 범위를 컨테이너 기준으로 넓힌 loadVisionImages.
 */
async function loadVisionImagesForContainer({ imageIds, viewer, project }) {
  const ids = (Array.isArray(imageIds) ? imageIds : []).filter(Boolean);
  if (ids.length === 0) return [];
  const owners = allowedOwnerIds({ viewer, project });
  const out = await loadVisionImages(ids, owners);
  if (out.length !== ids.length) {
    console.log(`[containerDocAccess] visionImages: asked=${ids.length} found=${out.length}`);
  }
  return out;
}

/**
 * 결과물에 붙일 프로젝트 태그. 실행자가 읽을 수 있는 프로젝트의 tagId 만 돌려준다.
 * 예전 `Project.findOne({ _id, userId })` 는 공유 프로젝트 독자에게 항상 null 이었다.
 * @returns {import('mongoose').Types.ObjectId|null}
 */
function resolveProjectTag({ viewer, project }) {
  if (!project || !userHasProjectAccess(viewer, project)) return null;
  return project.tagId || null;
}

module.exports = {
  allowedOwnerIds,
  loadContextDocs,
  loadSystemPromptDoc,
  loadVisionImagesForContainer,
  resolveProjectTag,
};
