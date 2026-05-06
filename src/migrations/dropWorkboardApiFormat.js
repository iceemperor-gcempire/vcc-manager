const Workboard = require('../models/Workboard');

// Phase 6 (#181): Workboard.apiFormat 필드 완전 제거.
// v1.8.0+ 부터 (server.serverType, outputFormat) 조합으로 라우팅하면서 apiFormat 은
// deprecated 표기로만 유지됐음. Phase 6 에서 schema 정의 + 모든 참조 제거.
async function dropWorkboardApiFormat() {
  try {
    const result = await Workboard.collection.updateMany(
      { apiFormat: { $exists: true } },
      { $unset: { apiFormat: '' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Migration] Workboard.apiFormat 필드 제거 (${result.modifiedCount}건)`);
    } else {
      console.log('[Migration] Workboard.apiFormat 필드 제거 불필요 (대상 없음)');
    }
  } catch (error) {
    console.error('[Migration] Workboard.apiFormat 제거 오류:', error);
  }
}

module.exports = dropWorkboardApiFormat;
