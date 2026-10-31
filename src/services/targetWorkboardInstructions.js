// AI 프롬프트 생성의 대상 작업판 지침 (#1109).
//
// 이미지·영상 판의 실행 화면에서 AI 프롬프트 생성을 열면, 프론트가 그 판의 id 를 targetWorkboardId 로
// 함께 보낸다. 프롬프트를 쓰는 건 텍스트 판이지만 "어떤 형식으로 쓸지" 는 받는 판이 정한다.
//
// 대상 판은 요청자가 고른 텍스트 판과 별개의 판이므로 접근 검사를 따로 한다. 하지 않으면 id 만 알면
// 볼 수 없는 판의 지침을 시스템 프롬프트로 끌어다 읽을 수 있다. 판정은 단건 조회(GET /api/workboards/:id)와
// 같다 — 없으면 404, 비활성이거나 권한이 없으면 403.

const mongoose = require('mongoose');
const Workboard = require('../models/Workboard');
const { userHasWorkboardAccess } = require('../middleware/auth');

/**
 * @param {Object} args
 * @param {string} [args.targetWorkboardId]
 * @param {Object} args.user — req.user
 * @returns {Promise<{ instructions: string, workboard?: Object } | { error: { status: number, message: string } }>}
 *   targetWorkboardId 가 없으면 빈 지침. 대상 판에 지침이 비어 있어도 오류가 아니다.
 */
async function loadTargetWorkboardInstructions({ targetWorkboardId, user }) {
  if (!targetWorkboardId) return { instructions: '' };
  if (!mongoose.isValidObjectId(targetWorkboardId)) {
    return { error: { status: 400, message: '대상 작업판 id 가 올바르지 않습니다.' } };
  }
  const workboard = await Workboard.findById(targetWorkboardId)
    .select('name isActive allowedGroupIds promptGeneratorInstructions')
    .lean();
  if (!workboard) {
    return { error: { status: 404, message: '대상 작업판을 찾을 수 없습니다.' } };
  }
  if (!workboard.isActive || !userHasWorkboardAccess(user, workboard)) {
    return { error: { status: 403, message: '대상 작업판에 접근할 권한이 없습니다.' } };
  }
  return { workboard, instructions: (workboard.promptGeneratorInstructions || '').trim() };
}

module.exports = { loadTargetWorkboardInstructions };
