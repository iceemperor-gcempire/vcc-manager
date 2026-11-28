/**
 * 워커가 생성 전 · 저장 전에 보는 "이 작업을 계속해도 되는가" (#521, #1325).
 *
 * 취소된 작업뿐 아니라 **지워진 작업**도 멈춘다. 작업 기록을 지웠는데 대기열에 남아 있던 작업이
 * 그대로 돌면 비용이 나가고, 결과물이 작업 기록 없이 내 콘텐츠에 나타난다.
 */
const ImageGenerationJob = require('../models/ImageGenerationJob');

/**
 * @returns {Promise<false | 'cancelled' | 'deleted'>} 계속해도 되면 false
 */
async function jobStopReason(jobId) {
  try {
    const doc = await ImageGenerationJob.findById(jobId).select('status').lean();
    if (!doc) return 'deleted';
    return doc.status === 'cancelled' ? 'cancelled' : false;
  } catch (error) {
    // 확인에 실패했다고 멈추지는 않는다 — 조회 장애가 모든 작업을 버리게 하지 않는다
    console.error(`Error checking cancel state for ${jobId}:`, error.message);
    return false;
  }
}

module.exports = { jobStopReason };
