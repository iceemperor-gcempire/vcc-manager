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

  if (!backupInProgress) {
    return next();
  }

  // NOTE: app.use('/api', ...) 로 마운트되므로 req.path 에는 '/api' prefix 가 없음 (#529)

  // 로그인/로그아웃은 백업 중에도 허용 (관리자 진입 경로).
  // signup / 비밀번호 재설정은 User 컬렉션 쓰기라 차단 유지.
  if (req.path === '/auth/signin' || req.path === '/auth/logout') {
    return next();
  }

  // 백업 제어 API 는 허용 (백업 시작은 핸들러 자체 가드로 중복 방지).
  // 단 복원(restore)은 진행 중 백업과 동시 실행 금지.
  if (req.path.startsWith('/admin/backup') && !req.path.startsWith('/admin/backup/restore')) {
    return next();
  }

  return res.status(503).json({
    success: false,
    message: '백업이 진행 중입니다. 잠시 후 다시 시도해주세요.',
    backupJobId: currentBackupJobId
  });
}

module.exports = {
  startBackupLock,
  endBackupLock,
  isBackupInProgress,
  getCurrentBackupJobId,
  blockDuringBackup
};
