const ServerLoraCache = require('../models/ServerLoraCache');
const ServerModelCache = require('../models/ServerModelCache');

// #256: backend 재시작 시 in-flight sync 는 fire-and-forget 이라 죽지만,
// cache 의 status='fetching' 은 그대로 남아 무한 "동기화 중" 상태로 보임.
// 시작 시점에 모두 실패로 정리 — admin 이 다시 sync 트리거 가능.
async function cleanupStuckSyncs() {
  try {
    const reason = 'Sync interrupted by server restart';

    const loraResult = await ServerLoraCache.updateMany(
      { status: 'fetching' },
      { $set: { status: 'failed', errorMessage: reason } }
    );
    if (loraResult.modifiedCount > 0) {
      console.log(`[Migration] ServerLoraCache stuck sync 정리: ${loraResult.modifiedCount}건`);
    }

    const modelResult = await ServerModelCache.updateMany(
      { status: 'fetching' },
      { $set: { status: 'failed', errorMessage: reason } }
    );
    if (modelResult.modifiedCount > 0) {
      console.log(`[Migration] ServerModelCache stuck sync 정리: ${modelResult.modifiedCount}건`);
    }

    if (loraResult.modifiedCount === 0 && modelResult.modifiedCount === 0) {
      console.log('[Migration] stuck sync cleanup 불필요 (대상 없음)');
    }
  } catch (error) {
    console.error('[Migration] stuck sync cleanup 오류:', error);
  }
}

module.exports = cleanupStuckSyncs;
