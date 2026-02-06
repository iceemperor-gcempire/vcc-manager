const Workboard = require('../models/Workboard');

async function migrateWorkboardApiFormat() {
  try {
    // apiFormat이 설정되지 않은 워크보드 수 확인
    const count = await Workboard.countDocuments({
      $or: [
        { apiFormat: { $exists: false } },
        { apiFormat: null }
      ]
    });

    if (count === 0) {
      console.log('[Migration] No workboards need apiFormat migration.');
      return;
    }

    console.log(`[Migration] Migrating ${count} workboards to apiFormat/outputFormat...`);

    // prompt 타입 워크보드 업데이트 (validation 우회를 위해 updateMany 사용)
    const promptResult = await Workboard.updateMany(
      {
        workboardType: 'prompt',
        $or: [
          { apiFormat: { $exists: false } },
          { apiFormat: null }
        ]
      },
      {
        $set: {
          apiFormat: 'OpenAI Compatible',
          outputFormat: 'text'
        }
      }
    );

    // image 타입 (또는 미설정) 워크보드 업데이트
    const imageResult = await Workboard.updateMany(
      {
        workboardType: { $ne: 'prompt' },
        $or: [
          { apiFormat: { $exists: false } },
          { apiFormat: null }
        ]
      },
      {
        $set: {
          apiFormat: 'ComfyUI',
          outputFormat: 'image'
        }
      }
    );

    const total = (promptResult.modifiedCount || 0) + (imageResult.modifiedCount || 0);
    console.log(`[Migration] Successfully migrated ${total} workboards (prompt: ${promptResult.modifiedCount || 0}, image: ${imageResult.modifiedCount || 0}).`);
  } catch (error) {
    console.error('[Migration] Error migrating workboard apiFormat:', error);
  }
}

module.exports = migrateWorkboardApiFormat;
