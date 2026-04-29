const Server = require('../models/Server');

// Phase 2 (#181, #182): 'GPT Image' Server 를 'OpenAI' 로 이전 + outputType 필드 제거.
async function migrateServerTypeToOpenAI() {
  try {
    const renameResult = await Server.updateMany(
      { serverType: 'GPT Image' },
      { $set: { serverType: 'OpenAI' } }
    );
    if (renameResult.modifiedCount > 0) {
      console.log(`[Migration] Server.serverType: 'GPT Image' → 'OpenAI' (${renameResult.modifiedCount} 건)`);
    } else {
      console.log("[Migration] Server.serverType 'GPT Image' 마이그레이션 불필요 (대상 없음)");
    }

    const dropResult = await Server.updateMany(
      { outputType: { $exists: true } },
      { $unset: { outputType: '' } }
    );
    if (dropResult.modifiedCount > 0) {
      console.log(`[Migration] Server.outputType 필드 제거 (${dropResult.modifiedCount} 건)`);
    } else {
      console.log("[Migration] Server.outputType 마이그레이션 불필요 (대상 없음)");
    }
  } catch (error) {
    console.error('[Migration] Server type/outputType 마이그레이션 오류:', error);
  }
}

module.exports = migrateServerTypeToOpenAI;
