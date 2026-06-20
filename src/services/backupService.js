const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { once } = require('events');
const archiver = require('archiver');
const BackupJob = require('../models/BackupJob');

// 백업 대상 컬렉션 — backup/restore 공유 단일 소스 (#588)
const { BACKUP_COLLECTIONS } = require('./backupCollections');

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

  const iv = crypto.randomBytes(12); // AES-GCM 표준 IV 길이 (복호화는 저장된 iv 길이를 사용하므로 구버전 16바이트 백업도 호환)
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
 * 단일 문서 처리 (민감 필드 제거 + 필드 암호화)
 */
function processDoc(doc, config) {
  const { sensitiveFields = [], encryptFields: fieldsToEncrypt = [] } = config;
  let processedDoc = doc;
  if (sensitiveFields.length > 0) {
    processedDoc = removeSensitiveFields(processedDoc, sensitiveFields);
  }
  if (fieldsToEncrypt.length > 0) {
    processedDoc = encryptFields(processedDoc, fieldsToEncrypt);
  }
  return processedDoc;
}

/**
 * 컬렉션을 cursor 로 스트리밍하며 NDJSON(문서 1개/줄) 파일로 기록 (#591).
 * 컬렉션 전체를 메모리에 적재하지 않아 대용량에서도 OOM 없이 동작.
 * 반환: 기록한 문서 수.
 */
async function writeCollectionNdjson(config, outPath) {
  const ws = fs.createWriteStream(outPath);
  const cursor = config.model.find({}).lean().cursor();
  let count = 0;
  try {
    for await (const doc of cursor) {
      const line = JSON.stringify(processDoc(doc, config)) + '\n';
      if (!ws.write(line)) {
        await once(ws, 'drain'); // backpressure 존중
      }
      count++;
    }
  } finally {
    await cursor.close().catch(() => {});
  }
  ws.end();
  await once(ws, 'finish');
  return count;
}

/**
 * 백업 작업 초기화 (DB에 작업 기록만 생성)
 */
/**
 * 디렉토리의 총 바이트 크기 (재귀, 심볼릭링크 무시). 접근 불가 항목은 건너뜀.
 */
function dirSizeBytes(dir) {
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    try {
      if (e.isDirectory()) total += dirSizeBytes(p);
      else if (e.isFile()) total += fs.statSync(p).size;
    } catch {
      // 접근 불가 항목 무시
    }
  }
  return total;
}

/**
 * 디스크 점검 판정 (순수 함수, 테스트 용이).
 * @param {{estimatedBytes:number, availableBytes:number|null, safetyFactor:number}} p
 */
function decideDiskSpace({ estimatedBytes, availableBytes, safetyFactor = 1.5 }) {
  const requiredBytes = Math.ceil(estimatedBytes * safetyFactor);
  if (availableBytes === null || availableBytes === undefined) {
    return { ok: true, availableBytes: null, estimatedBytes, requiredBytes, reason: 'disk-unmeasurable' };
  }
  if (availableBytes < requiredBytes) {
    return { ok: false, availableBytes, estimatedBytes, requiredBytes, reason: 'insufficient-space' };
  }
  return { ok: true, availableBytes, estimatedBytes, requiredBytes };
}

/**
 * 백업 디스크 여유 사전 점검 (#622).
 * 추정 필요 공간 = (uploads 디렉토리 크기 + DB dataSize) 에 안전 배수 적용.
 * 반환: { ok, availableBytes|null, estimatedBytes, requiredBytes, reason? }
 * 가용 공간을 측정할 수 없으면(statfs 미지원 등) ok:true + warning 으로 통과(현행 동작 유지).
 */
async function checkDiskSpace({ safetyFactor = 1.5 } = {}) {
  // 1) 추정 크기: uploads + DB dataSize
  const uploadsBytes = dirSizeBytes(UPLOAD_DIR);
  let dbBytes = 0;
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection?.db) {
      const stats = await mongoose.connection.db.stats();
      dbBytes = (stats.dataSize || 0);
    }
  } catch {
    // DB stats 실패 시 uploads 만으로 추정
  }
  const estimatedBytes = uploadsBytes + dbBytes;

  // 2) 가용 공간 (BACKUP_DIR 가 위치한 파일시스템)
  let availableBytes = null;
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    if (typeof fs.statfsSync === 'function') {
      const fsStats = fs.statfsSync(BACKUP_DIR);
      availableBytes = fsStats.bavail * fsStats.bsize;
    }
  } catch {
    availableBytes = null;
  }

  return decideDiskSpace({ estimatedBytes, availableBytes, safetyFactor });
}

async function initBackupJob(userId, type = 'full') {
  // 암호화 키 유효성 검사
  validateEncryptionKey();

  // 백업 디렉토리 생성
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // 백업 작업 생성 (type: 'full' 수동 / 'snapshot' 복원 직전 자동 #590)
  const job = new BackupJob({
    status: 'pending',
    type,
    createdBy: userId,
    progress: {
      current: 0,
      total: BACKUP_COLLECTIONS.length + 3, // 컬렉션 + 파일 디렉토리 3개
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
  const prefix = job.type === 'snapshot' ? 'vcc-presnapshot' : 'vcc-backup';
  const fileName = `${prefix}-${timestamp}.zip`;
  const filePath = path.join(BACKUP_DIR, fileName);

  // 컬렉션 NDJSON 임시 디렉토리 (스트리밍 후 아카이브에 추가, 종료 시 정리) (#591)
  const dbTmpDir = path.join(BACKUP_DIR, `.db-tmp-${job._id}`);

  try {
    fs.mkdirSync(dbTmpDir, { recursive: true });
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

    // 컬렉션 백업 — cursor 스트리밍 → NDJSON 임시파일 → 아카이브 (#591)
    let progress = 0;
    for (const config of BACKUP_COLLECTIONS) {
      const name = config.name;
      await job.updateProgress(progress, job.progress.total, `${name} 컬렉션 백업 중...`);

      const ndjsonPath = path.join(dbTmpDir, `${name}.ndjson`);
      const count = await writeCollectionNdjson(config, ndjsonPath);
      metadata.collections[name] = count;

      archive.file(ndjsonPath, { name: `database/${name}.ndjson` });

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

    // NDJSON 임시 디렉토리 정리 (아카이브에 다 담긴 후)
    fs.rmSync(dbTmpDir, { recursive: true, force: true });

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
    // 실패 시 파일 / 임시 디렉토리 삭제
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    fs.rmSync(dbTmpDir, { recursive: true, force: true });

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
    // 복원 직전 자동 스냅샷(#590)은 수동 백업 rate limit 계산에서 제외
    type: { $ne: 'snapshot' },
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
  checkDiskSpace,
  decideDiskSpace,
  ENCRYPTION_KEY,
  // 테스트용 내부 헬퍼 (#591)
  processDoc,
  writeCollectionNdjson
};
