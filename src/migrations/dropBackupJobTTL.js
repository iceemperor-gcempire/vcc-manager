const BackupJob = require('../models/BackupJob');

// #195: BackupJob 의 expiresAt 기반 TTL 인덱스 + 필드 제거. 자동 삭제로 백업이 사라지던 문제 해결.
async function dropBackupJobTTL() {
  try {
    const indexes = await BackupJob.collection.indexes();
    const ttlIndex = indexes.find(
      (idx) => idx.key && idx.key.expiresAt === 1 && typeof idx.expireAfterSeconds === 'number'
    );
    if (ttlIndex) {
      await BackupJob.collection.dropIndex(ttlIndex.name);
      console.log(`[Migration] BackupJob TTL 인덱스 제거: ${ttlIndex.name}`);
    } else {
      console.log('[Migration] BackupJob TTL 인덱스 마이그레이션 불필요 (대상 없음)');
    }

    const unsetResult = await BackupJob.updateMany(
      { expiresAt: { $exists: true } },
      { $unset: { expiresAt: '' } }
    );
    if (unsetResult.modifiedCount > 0) {
      console.log(`[Migration] BackupJob.expiresAt 필드 제거 (${unsetResult.modifiedCount}건)`);
    } else {
      console.log('[Migration] BackupJob.expiresAt 필드 제거 불필요 (대상 없음)');
    }
  } catch (error) {
    console.error('[Migration] BackupJob TTL 제거 오류:', error);
  }
}

module.exports = dropBackupJobTTL;
