const PromptGuide = require('../models/PromptGuide');

// 작업판에 연결된 프롬프트 가이드 로드 (#766).
//
// **의도적으로 요청자(userId) 를 받지 않는다.** 가이드는 소유자가 없는 전역 문서이며,
// 접근 통제는 호출 지점에서 이미 끝난 작업판 접근 검사(userHasWorkboardAccess) 가 담당한다.
// 여기에 사용자 필터를 넣으면 UploadedText 와 같은 함정 — 사용자에 따라 가이드가 조용히
// 빠지는 상태 — 이 재현된다.
//
// 비활성(isActive:false) 가이드는 제외한다. 연결은 남기되 적용만 끄고 싶은 경우를 위해.

/**
 * @param {Object} workboard — promptGuideIds 를 가진 Workboard 문서 (lean/document 모두 가능)
 * @returns {Promise<Array<{_id, title, content}>>} 작업판에 지정된 순서대로 정렬
 */
async function loadGuidesForWorkboard(workboard) {
  const ids = (workboard?.promptGuideIds || []).map(String);
  if (ids.length === 0) return [];

  const docs = await PromptGuide.find(
    { _id: { $in: ids }, isActive: true },
    { title: 1, content: 1 }
  ).lean();

  // $in 결과 순서는 보장되지 않는다 — 작업판이 지정한 순서를 복원한다.
  // 합성 순서가 바뀌면 LLM 출력이 달라지므로 순서 보장은 기능 요구사항이다.
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

module.exports = { loadGuidesForWorkboard };
