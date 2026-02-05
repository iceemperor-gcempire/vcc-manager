/**
 * 백업 진행 중 데이터 변경 차단 미들웨어
 */

// 백업 상태 관리
let backupInProgress = false;
let currentBackupJobId = null;

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
 * 백업 진행 중인지 확인
 */
function isBackupInProgress() {
  return backupInProgress;
}

/**
 * 현재 백업 작업 ID
 */
function getCurrentBackupJobId() {
  return currentBackupJobId;
}

/**
 * 백업 중 쓰기 작업 차단 미들웨어
 * POST, PUT, PATCH, DELETE 요청 중 데이터 변경 API를 차단
 */
function blockDuringBackup(req, res, next) {
  // 읽기 전용 요청은 허용
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // 백업 관련 API는 허용 (상태 조회 등)
  if (req.path.startsWith('/api/admin/backup')) {
    return next();
  }

  // 인증 API는 허용
  if (req.path.startsWith('/api/auth')) {
    return next();
  }

  // 백업 진행 중이면 차단
  if (backupInProgress) {
    return res.status(503).json({
      success: false,
      message: '백업이 진행 중입니다. 잠시 후 다시 시도해주세요.',
      backupJobId: currentBackupJobId
    });
  }

  next();
}

module.exports = {
  startBackupLock,
  endBackupLock,
  isBackupInProgress,
  getCurrentBackupJobId,
  blockDuringBackup
};
