const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const BackupJob = require('../models/BackupJob');

// MongoDB 모델들
const User = require('../models/User');
const Server = require('../models/Server');
const Workboard = require('../models/Workboard');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const UploadedImage = require('../models/UploadedImage');
const PromptData = require('../models/PromptData');
const Tag = require('../models/Tag');
const LoraCache = require('../models/LoraCache');

// 백업할 컬렉션 목록
const COLLECTIONS = {
  User: { model: User, sensitiveFields: ['googleId'] },
  Server: { model: Server, encryptFields: ['configuration.apiKey'] },
  Workboard: { model: Workboard },
  ImageGenerationJob: { model: ImageGenerationJob },
  GeneratedImage: { model: GeneratedImage },
  GeneratedVideo: { model: GeneratedVideo },
  UploadedImage: { model: UploadedImage },
  PromptData: { model: PromptData },
  Tag: { model: Tag },
  LoraCache: { model: LoraCache }
};

// 백업 디렉토리
const BACKUP_DIR = process.env.BACKUP_PATH || './backups';
const UPLOAD_DIR = process.env.UPLOAD_PATH || './uploads';

// 암호화 키 (환경변수에서 필수로 가져옴)
const ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

/**
 * 암호화 키 유효성 검사
 */
function validateEncryptionKey() {
  if (!ENCRYPTION_KEY) {
    throw new Error('BACKUP_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. 백업을 생성하려면 64자리 hex 키를 설정하세요.');
  }
  if (!/^[a-fA-F0-9]{64}$/.test(ENCRYPTION_KEY)) {
    throw new Error('BACKUP_ENCRYPTION_KEY는 64자리 hex 문자열이어야 합니다. (openssl rand -hex 32 로 생성)');
  }
}

/**
 * AES-256-GCM으로 데이터 암호화
 */
function encryptData(text) {
  if (!text) return null;

  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted
  };
}

/**
 * 문서에서 민감 필드 제외
 */
function removeSensitiveFields(doc, sensitiveFields) {
  const cleanDoc = doc.toObject ? doc.toObject() : { ...doc };

  for (const field of sensitiveFields) {
    const parts = field.split('.');
    let obj = cleanDoc;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]]) {
        obj = obj[parts[i]];
      }
    }
    delete obj[parts[parts.length - 1]];
  }

  return cleanDoc;
}

/**
 * 문서에서 특정 필드 암호화
 */
function encryptFields(doc, encryptFields) {
  const processedDoc = doc.toObject ? doc.toObject() : { ...doc };

  for (const field of encryptFields) {
    const parts = field.split('.');
    let obj = processedDoc;
    let parent = null;
    let lastKey = null;

    for (let i = 0; i < parts.length; i++) {
      if (i === parts.length - 1) {
        lastKey = parts[i];
      } else {
        parent = obj;
        if (obj[parts[i]]) {
          obj = obj[parts[i]];
        } else {
          obj = null;
          break;
        }
      }
    }

    if (obj && lastKey && obj[lastKey]) {
      obj[lastKey] = encryptData(obj[lastKey]);
    }
  }

  return processedDoc;
}

/**
 * 컬렉션 데이터 추출
 */
async function exportCollection(collectionName, config, job) {
  const { model, sensitiveFields = [], encryptFields: fieldsToEncrypt = [] } = config;

  const documents = await model.find({}).lean();
  const processedDocs = [];

  for (const doc of documents) {
    let processedDoc = doc;

    // 민감 필드 제거
    if (sensitiveFields.length > 0) {
      processedDoc = removeSensitiveFields(processedDoc, sensitiveFields);
    }

    // 필드 암호화
    if (fieldsToEncrypt.length > 0) {
      processedDoc = encryptFields(processedDoc, fieldsToEncrypt);
    }

    processedDocs.push(processedDoc);
  }

  return processedDocs;
}

/**
 * 백업 작업 초기화 (DB에 작업 기록만 생성)
 */
async function initBackupJob(userId) {
  // 암호화 키 유효성 검사
  validateEncryptionKey();

  // 백업 디렉토리 생성
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // 백업 작업 생성
  const job = new BackupJob({
    status: 'pending',
    type: 'full',
    createdBy: userId,
    progress: {
      current: 0,
      total: Object.keys(COLLECTIONS).length + 3, // 컬렉션 + 파일 디렉토리 3개
      stage: '대기 중...'
    }
  });
  await job.save();

  return job;
}

/**
 * 백업 실행 (비동기)
 */
async function executeBackup(jobId) {
  const job = await BackupJob.findById(jobId);
  if (!job) {
    throw new Error('백업 작업을 찾을 수 없습니다.');
  }

  // 상태를 processing으로 변경
  job.status = 'processing';
  job.progress.stage = '초기화 중...';
  await job.save();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `vcc-backup-${timestamp}.zip`;
  const filePath = path.join(BACKUP_DIR, fileName);

  try {
    // ZIP 파일 생성
    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    const archivePromise = new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });

    archive.pipe(output);

    // 메타데이터 준비
    const metadata = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      createdBy: job.createdBy.toString(),
      collections: {},
      files: {
        generated: 0,
        reference: 0,
        videos: 0
      },
      encryptionKeyHash: crypto.createHash('sha256').update(ENCRYPTION_KEY).digest('hex').slice(0, 16)
    };

    // 컬렉션 백업
    let progress = 0;
    for (const [name, config] of Object.entries(COLLECTIONS)) {
      await job.updateProgress(progress, job.progress.total, `${name} 컬렉션 백업 중...`);

      const documents = await exportCollection(name, config, job);
      metadata.collections[name] = documents.length;

      archive.append(JSON.stringify(documents, null, 2), {
        name: `database/${name}.json`
      });

      progress++;
    }

    // 파일 백업
    const uploadDirs = [
      { name: 'generated', path: path.join(UPLOAD_DIR, 'generated') },
      { name: 'reference', path: path.join(UPLOAD_DIR, 'reference') },
      { name: 'videos', path: path.join(UPLOAD_DIR, 'videos') }
    ];

    for (const dir of uploadDirs) {
      await job.updateProgress(progress, job.progress.total, `${dir.name} 파일 백업 중...`);

      if (fs.existsSync(dir.path)) {
        const files = fs.readdirSync(dir.path);
        metadata.files[dir.name] = files.length;

        archive.directory(dir.path, `files/${dir.name}`);
      }

      progress++;
    }

    // 메타데이터 추가
    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

    await archive.finalize();
    await archivePromise;

    // 파일 크기 확인
    const stats = fs.statSync(filePath);

    // 통계 정보
    const statistics = {
      collections: metadata.collections,
      files: metadata.files,
      totalSize: stats.size
    };

    await job.complete(fileName, filePath, stats.size, statistics);

    console.log(`✅ 백업 완료: ${fileName} (${stats.size} bytes)`);
    return job;
  } catch (error) {
    // 실패 시 파일 삭제
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await job.fail(error);
    console.error(`❌ 백업 실패: ${error.message}`);
    throw error;
  }
}

/**
 * 백업 생성 (동기 - 하위 호환성)
 */
async function createBackup(userId) {
  const job = await initBackupJob(userId);
  return executeBackup(job._id);
}

/**
 * 백업 상태 조회
 */
async function getBackupStatus(jobId) {
  return BackupJob.findById(jobId).populate('createdBy', 'nickname email');
}

/**
 * 백업 목록 조회
 */
async function listBackups(page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  const [backups, total] = await Promise.all([
    BackupJob.find()
      .populate('createdBy', 'nickname email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    BackupJob.countDocuments()
  ]);

  return {
    backups,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total
    }
  };
}

/**
 * 백업 파일 경로 조회
 */
async function getBackupFilePath(jobId) {
  const job = await BackupJob.findById(jobId);

  if (!job) {
    throw new Error('백업을 찾을 수 없습니다.');
  }

  if (job.status !== 'completed') {
    throw new Error('백업이 완료되지 않았습니다.');
  }

  if (!fs.existsSync(job.filePath)) {
    throw new Error('백업 파일을 찾을 수 없습니다.');
  }

  return {
    filePath: job.filePath,
    fileName: job.fileName
  };
}

/**
 * 백업 삭제
 */
async function deleteBackup(jobId) {
  const job = await BackupJob.findById(jobId);

  if (!job) {
    throw new Error('백업을 찾을 수 없습니다.');
  }

  // 파일 삭제
  if (job.filePath && fs.existsSync(job.filePath)) {
    fs.unlinkSync(job.filePath);
  }

  // DB에서 삭제
  await BackupJob.findByIdAndDelete(jobId);

  return { success: true };
}

/**
 * 최근 백업 시간 확인 (rate limiting)
 */
async function getLastBackupTime(userId) {
  const lastBackup = await BackupJob.findOne({
    createdBy: userId,
    status: { $in: ['pending', 'processing', 'completed'] }
  }).sort({ createdAt: -1 });

  return lastBackup?.createdAt;
}

module.exports = {
  initBackupJob,
  executeBackup,
  createBackup,
  getBackupStatus,
  listBackups,
  getBackupFilePath,
  deleteBackup,
  getLastBackupTime,
  ENCRYPTION_KEY
};
