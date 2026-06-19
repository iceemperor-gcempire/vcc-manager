const BackupJob = require('../models/BackupJob');
const RestoreJob = require('../models/RestoreJob');

// #620: 백업/복원은 in-memory 락 + 단일 프로세스 실행이라 서버 재시작을 넘어 이어질 수 없다.
// 디스크 부족 등으로 프로세스(또는 Mongo)가 죽으면 BackupJob.status 가 'processing' 에
// 멈춘 채 DB 에 남아 UI 가 무한 '진행중' 으로 표시된다. 부팅 시점에 남아있는
// pending/processing 잡은 정의상 orphan 이므로 failed 로 정리한다.
// (RestoreJob 'pending' 은 검증 완료 후 사용자 실행 대기 상태라 건드리지 않는다.)
async function cleanupStuckBackupRestoreJobs() {
  try {
    const now = new Date();

    const backupResult = await BackupJob.updateMany(
      { status: { $in: ['pending', 'processing'] } },
      { $set: { status: 'failed', completedAt: now, error: { message: '서버 재시작으로 중단된 백업입니다 (디스크 부족 등으로 중단됐을 수 있습니다).' } } }
    );
    if (backupResult.modifiedCount > 0) {
      console.log(`[Migration] 중단된 백업 작업 정리: ${backupResult.modifiedCount}건 (processing/pending → failed)`);
    }

    const restoreResult = await RestoreJob.updateMany(
      { status: { $in: ['processing', 'validating'] } },
      { $set: { status: 'failed', completedAt: now, error: { message: '서버 재시작으로 중단된 복원입니다.' } } }
    );
    if (restoreResult.modifiedCount > 0) {
      console.log(`[Migration] 중단된 복원 작업 정리: ${restoreResult.modifiedCount}건 (processing/validating → failed)`);
    }

    if (backupResult.modifiedCount === 0 && restoreResult.modifiedCount === 0) {
      console.log('[Migration] 중단된 백업/복원 작업 정리 불필요 (대상 없음)');
    }
  } catch (error) {
    console.error('[Migration] 중단된 백업/복원 작업 정리 오류:', error.message);
  }
}

module.exports = cleanupStuckBackupRestoreJobs;
