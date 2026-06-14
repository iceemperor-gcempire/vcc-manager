/**
 * 백업 / 복원 진행 중 데이터 변경 차단 미들웨어 (유지보수 락)
 *
 * 백업 중에는 일관된 스냅샷을 위해, 복원 중에는 동시 쓰기로 인한 정합성 손상을
 * 막기 위해 쓰기 요청을 차단한다 (#589).
 */

// 유지보수 상태 관리
let backupInProgress = false;
let currentBackupJobId = null;
let restoreInProgress = false;
let currentRestoreJobId = null;

/**
 * 백업 시작
 */
function startBackupLock(jobId) {
  backupInProgress = true;
  currentBackupJobId = jobId;
  console.log(`🔒 백업 잠금 시작: ${jobId}`);
}

/**
 * 백업 종료
 */
function endBackupLock() {
  console.log(`🔓 백업 잠금 해제: ${currentBackupJobId}`);
  backupInProgress = false;
  currentBackupJobId = null;
}

/**
 * 복원 시작 (#589)
 */
function startRestoreLock(jobId) {
  restoreInProgress = true;
  currentRestoreJobId = jobId;
  console.log(`🔒 복원 잠금 시작: ${jobId}`);
}

/**
 * 복원 종료 (#589)
 */
function endRestoreLock() {
  console.log(`🔓 복원 잠금 해제: ${currentRestoreJobId}`);
  restoreInProgress = false;
  currentRestoreJobId = null;
}

/**
 * 백업 진행 중인지 확인
 */
function isBackupInProgress() {
  return backupInProgress;
}

/**
 * 복원 진행 중인지 확인 (#589)
 */
function isRestoreInProgress() {
  return restoreInProgress;
}

/**
 * 현재 백업 작업 ID
 */
function getCurrentBackupJobId() {
  return currentBackupJobId;
}

/**
 * 현재 복원 작업 ID (#589)
 */
function getCurrentRestoreJobId() {
  return currentRestoreJobId;
}

/**
 * 백업/복원 중 쓰기 작업 차단 미들웨어
 * POST, PUT, PATCH, DELETE 요청 중 데이터 변경 API를 차단.
 * (이름은 호환 위해 유지하나 복원 중에도 동일하게 차단함 #589)
 */
function blockDuringBackup(req, res, next) {
  // 읽기 전용 요청은 허용
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  if (!backupInProgress && !restoreInProgress) {
    return next();
  }

  // NOTE: app.use('/api', ...) 로 마운트되므로 req.path 에는 '/api' prefix 가 없음 (#529)

  // 로그인/로그아웃은 유지보수 중에도 허용 (관리자 진입 경로).
  // signup / 비밀번호 재설정은 User 컬렉션 쓰기라 차단 유지.
  if (req.path === '/auth/signin' || req.path === '/auth/logout') {
    return next();
  }

  // 백업 중에는 백업 제어 API 허용 (백업 시작은 핸들러 자체 가드로 중복 방지).
  // 단 복원(restore)은 진행 중 백업과 동시 실행 금지.
  // 복원 중에는 어떤 백업/복원 제어 쓰기도 차단 (재시작/중복 방지) — 상태 조회는 GET 이라 위에서 통과.
  if (backupInProgress && !restoreInProgress
      && req.path.startsWith('/admin/backup')
      && !req.path.startsWith('/admin/backup/restore')) {
    return next();
  }

  return res.status(503).json({
    success: false,
    message: restoreInProgress
      ? '복원이 진행 중입니다. 복원 완료 후 다시 시도해주세요.'
      : '백업이 진행 중입니다. 잠시 후 다시 시도해주세요.',
    backupJobId: currentBackupJobId,
    restoreJobId: currentRestoreJobId
  });
}

module.exports = {
  startBackupLock,
  endBackupLock,
  startRestoreLock,
  endRestoreLock,
  isBackupInProgress,
  isRestoreInProgress,
  getCurrentBackupJobId,
  getCurrentRestoreJobId,
  blockDuringBackup
};
