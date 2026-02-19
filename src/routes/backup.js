const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAdmin } = require('../middleware/auth');
const backupService = require('../services/backupService');
const restoreService = require('../services/restoreService');
const { startBackupLock, endBackupLock, isBackupInProgress, getCurrentBackupJobId } = require('../middleware/backupLock');

const router = express.Router();

// 업로드 설정 - uploads 폴더 하위에 생성
const UPLOAD_BASE = process.env.UPLOAD_PATH || './uploads';
const UPLOAD_DIR = process.env.BACKUP_UPLOAD_PATH || path.join(UPLOAD_BASE, 'backup-temp');

// 디렉토리 생성을 안전하게 처리
const ensureUploadDir = () => {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('백업 업로드 디렉토리 생성 실패:', err.message);
  }
};
ensureUploadDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `restore-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024 // 10GB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || path.extname(file.originalname) === '.zip') {
      cb(null, true);
    } else {
      cb(new Error('ZIP 파일만 업로드 가능합니다.'));
    }
  }
});

// Rate limiting (시간당 1회)
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1시간

/**
 * GET /api/admin/backup/lock-status
 * 백업 잠금 상태 조회
 */
router.get('/lock-status', requireAdmin, (req, res) => {
  res.json({
    success: true,
    data: {
      isBackupInProgress: isBackupInProgress(),
      currentBackupJobId: getCurrentBackupJobId()
    }
  });
});

/**
 * POST /api/admin/backup
 * 백업 생성 시작
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    // 이미 백업 진행 중인지 확인
    if (isBackupInProgress()) {
      return res.status(409).json({
        success: false,
        message: '이미 백업이 진행 중입니다.',
        backupJobId: getCurrentBackupJobId()
      });
    }

    // Rate limit 확인
    const lastBackupTime = await backupService.getLastBackupTime(req.user._id);
    if (lastBackupTime) {
      const timeSince = Date.now() - new Date(lastBackupTime).getTime();
      if (timeSince < RATE_LIMIT_MS) {
        const remainingMinutes = Math.ceil((RATE_LIMIT_MS - timeSince) / 60000);
        return res.status(429).json({
          success: false,
          message: `백업은 시간당 1회만 가능합니다. ${remainingMinutes}분 후에 다시 시도해주세요.`
        });
      }
    }

    // 백업 작업 생성 (DB에만 기록)
    const job = await backupService.initBackupJob(req.user._id);
    const jobId = job._id.toString();

    // 백업 잠금 시작
    startBackupLock(jobId);

    // 즉시 응답 반환
    res.json({
      success: true,
      data: {
        jobId: job._id,
        status: job.status,
        message: '백업이 시작되었습니다. 백업 중에는 데이터 변경이 제한됩니다.'
      }
    });

    // 비동기로 백업 실행
    backupService.executeBackup(job._id)
      .catch((error) => {
        console.error('백업 실행 오류:', error);
      })
      .finally(() => {
        // 백업 완료/실패 시 잠금 해제
        endBackupLock();
      });

  } catch (error) {
    // 에러 발생 시 잠금 해제
    endBackupLock();
    console.error('백업 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/admin/backup/status/:id
 * 백업 진행 상태 조회
 */
router.get('/status/:id', requireAdmin, async (req, res) => {
  try {
    const job = await backupService.getBackupStatus(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: '백업 작업을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/admin/backup/download/:id
 * 백업 파일 다운로드
 */
router.get('/download/:id', requireAdmin, async (req, res) => {
  try {
    const { filePath, fileName } = await backupService.getBackupFilePath(req.params.id);

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('다운로드 오류:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: '파일 다운로드 중 오류가 발생했습니다.'
          });
        }
      }
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/admin/backup/list
 * 백업 목록 조회
 */
router.get('/list', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await backupService.listBackups(
      parseInt(page),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * DELETE /api/admin/backup/:id
 * 백업 삭제
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await backupService.deleteBackup(req.params.id);

    res.json({
      success: true,
      message: '백업이 삭제되었습니다.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/admin/restore/validate
 * 백업 파일 검증
 */
router.post('/restore/validate', requireAdmin, upload.single('backup'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '백업 파일이 필요합니다.'
      });
    }

    const job = await restoreService.validateBackup(req.file.path, req.user._id);

    res.json({
      success: true,
      data: {
        jobId: job._id,
        validationResult: job.validationResult,
        backupMetadata: job.backupMetadata
      }
    });
  } catch (error) {
    // 업로드된 파일 삭제
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/admin/restore
 * 복구 실행
 */
router.post('/restore', requireAdmin, async (req, res) => {
  try {
    const { jobId, options = {} } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'jobId가 필요합니다.'
      });
    }

    // 검증된 작업인지 확인
    const validationJob = await restoreService.getRestoreStatus(jobId);
    if (!validationJob || !validationJob.validationResult?.isValid) {
      return res.status(400).json({
        success: false,
        message: '검증되지 않은 백업 파일입니다. 먼저 검증을 수행해주세요.'
      });
    }

    // 서버 측에서 저장된 임시 파일 경로 사용 (클라이언트 입력 신뢰 제거)
    const filePath = validationJob.tempFilePath;
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: '임시 파일 경로를 찾을 수 없습니다. 다시 검증을 수행해주세요.'
      });
    }

    // 경로 검증: backup-temp 디렉토리 하위인지 확인
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadDir = path.resolve(UPLOAD_DIR);
    if (!resolvedPath.startsWith(resolvedUploadDir + path.sep) && resolvedPath !== resolvedUploadDir) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // 복구 실행 (비동기로 시작하고 바로 응답)
    restoreService.executeRestore(jobId, filePath, options)
      .then(() => {
        // 복구 완료 후 임시 파일 삭제
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      })
      .catch((err) => {
        console.error('복구 실행 오류:', err);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });

    res.json({
      success: true,
      data: {
        jobId,
        message: '복구가 시작되었습니다.'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/admin/restore/status/:id
 * 복구 진행 상태 조회
 */
router.get('/restore/status/:id', requireAdmin, async (req, res) => {
  try {
    const job = await restoreService.getRestoreStatus(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: '복구 작업을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/admin/restore/list
 * 복구 목록 조회
 */
router.get('/restore/list', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await restoreService.listRestores(
      parseInt(page),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
