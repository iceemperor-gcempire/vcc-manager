const ConversationJob = require('../models/ConversationJob');
const Project = require('../models/Project');

// projectId 가 있고 tags 가 비어 있는 ConversationJob 들에 프로젝트 태그를 backfill (#397 후속).
// 태그 기반 필터링 통일을 위함. idempotent.
async function backfillConversationTags() {
  const targets = await ConversationJob.find({
    projectId: { $ne: null, $exists: true },
    $or: [{ tags: { $exists: false } }, { tags: { $size: 0 } }],
  }).select('_id projectId').lean();

  if (targets.length === 0) {
    console.log('[Migration] ConversationJob tags backfill 불필요 (대상 없음)');
    return;
  }

  // 프로젝트별 tagId 캐시
  const projectIdSet = new Set(targets.map((t) => String(t.projectId)));
  const projects = await Project.find({ _id: { $in: Array.from(projectIdSet) } }).select('_id tagId').lean();
  const tagByProject = {};
  for (const p of projects) {
    if (p.tagId) tagByProject[String(p._id)] = p.tagId;
  }

  let updated = 0;
  for (const conv of targets) {
    const tagId = tagByProject[String(conv.projectId)];
    if (!tagId) continue;
    await ConversationJob.updateOne({ _id: conv._id }, { $set: { tags: [tagId] } });
    updated += 1;
  }
  console.log(`[Migration] ConversationJob tags backfill: ${updated}건 처리`);
}

module.exports = backfillConversationTags;
