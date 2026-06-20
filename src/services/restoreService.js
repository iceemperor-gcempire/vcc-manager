const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const unzipper = require('unzipper');
const RestoreJob = require('../models/RestoreJob');
const backupService = require('./backupService');
const { ENCRYPTION_KEY } = backupService;

// 복원 대상 컬렉션 — backup/restore 공유 단일 소스 (#588).
// 복호화 대상은 백업 시 암호화한 필드(encryptFields)와 동일하게 적용.
const { BACKUP_COLLECTIONS } = require('./backupCollections');

const UPLOAD_DIR = process.env.UPLOAD_PATH || './uploads';
const TEMP_DIR = process.env.TEMP_PATH || path.join(UPLOAD_DIR, 'restore-temp');
const ALGORITHM = 'aes-256-gcm';

/**
 * 암호화 키 유효성 확인
 */
function isEncryptionKeyValid() {
  return ENCRYPTION_KEY && /^[a-fA-F0-9]{64}$/.test(ENCRYPTION_KEY);
}

/**
 * AES-256-GCM으로 데이터 복호화
 */
function decryptData(encryptedObj) {
  if (!encryptedObj || !encryptedObj.encrypted) return null;

  // 암호화 키가 없으면 복호화 불가
  if (!isEncryptionKeyValid()) {
    return null;
  }

  try {
    const { iv, authTag, encrypted } = encryptedObj;
    const key = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32);
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    return null;
  }
}

/**
 * 문서에서 암호화된 필드 복호화
 */
function decryptFields(doc, fieldsToDecrypt) {
  const processedDoc = { ...doc };

  for (const field of fieldsToDecrypt) {
    const parts = field.split('.');
    let obj = processedDoc;

    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]]) {
        obj = obj[parts[i]];
      } else {
        obj = null;
        break;
      }
    }

    const lastKey = parts[parts.length - 1];
    if (obj && lastKey && obj[lastKey] && typeof obj[lastKey] === 'object') {
      obj[lastKey] = decryptData(obj[lastKey]);
    }
  }

  return processedDoc;
}

/**
 * 단일 문서 복구 (복호화 → _id 보존 create / overwrite upsert). (#591 스트리밍 분리)
 * 성공 시 true. 통계는 statistics 에 누적.
 */
// 실패 항목 상세 기록 (#631). errorDetails 과다 방지 상한 — 초과분은 카운트만.
const MAX_ERROR_DETAILS = 100;
function recordError(statistics, detail) {
  statistics.errors++;
  if (detail.type === 'file') statistics.fileErrors = (statistics.fileErrors || 0) + 1;
  else statistics.dbErrors = (statistics.dbErrors || 0) + 1;
  if (!statistics.errorDetails) statistics.errorDetails = [];
  if (statistics.errorDetails.length < MAX_ERROR_DETAILS) statistics.errorDetails.push(detail);
}

async function restoreOneDoc(doc, config, options, statistics) {
  let docId;
  try {
    // 암호화 필드 복호화 (백업 시 암호화한 encryptFields 와 동일)
    let processedDoc = doc;
    if (config.encryptFields) {
      processedDoc = decryptFields(doc, config.encryptFields);
    }

    docId = processedDoc._id;
    delete processedDoc._id;

    if (options.overwriteExisting) {
      await config.model.findByIdAndUpdate(docId, processedDoc, { upsert: true, new: true });
    } else {
      const existing = await config.model.findById(docId);
      if (!existing) {
        processedDoc._id = docId;
        await config.model.create(processedDoc);
      } else {
        statistics.skipped++;
      }
    }
    return true;
  } catch (docError) {
    console.error(`${config.name} 문서 복구 오류:`, docError.message);
    recordError(statistics, { type: 'db', collection: config.name, docId: docId ? String(docId) : undefined, message: docError.message });
    return false;
  }
}

/**
 * 컬렉션 복구 — NDJSON(#591) 우선 스트리밍, 없으면 구버전 .json 배열 fallback.
 * 반환: 복구 시도한 문서 수.
 */
async function restoreCollection(config, tempExtractDir, options, statistics) {
  const ndjsonPath = path.join(tempExtractDir, 'database', `${config.name}.ndjson`);
  const jsonPath = path.join(tempExtractDir, 'database', `${config.name}.json`);
  let restoredCount = 0;

  if (fs.existsSync(ndjsonPath)) {
    // 신버전: 한 줄에 문서 1개 — 라인 스트리밍 (메모리 상수)
    const rl = readline.createInterface({
      input: fs.createReadStream(ndjsonPath),
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let doc;
      try {
        doc = JSON.parse(trimmed);
      } catch (parseErr) {
        console.error(`${config.name} NDJSON 파싱 오류:`, parseErr.message);
        recordError(statistics, { type: 'db', collection: config.name, message: `NDJSON 파싱 오류: ${parseErr.message}` });
        continue;
      }
      await restoreOneDoc(doc, config, options, statistics);
      restoredCount++;
    }
  } else if (fs.existsSync(jsonPath)) {
    // 구버전 호환: 통째 JSON 배열
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    for (const doc of data) {
      await restoreOneDoc(doc, config, options, statistics);
      restoredCount++;
    }
  } else {
    return null; // 해당 컬렉션 파일 없음
  }

  return restoredCount;
}

/**
 * ZIP 파일에서 메타데이터 추출
 */
async function extractMetadata(zipPath) {
  return new Promise((resolve, reject) => {
    let metadata = null;

    fs.createReadStream(zipPath)
      .pipe(unzipper.Parse())
      .on('entry', async (entry) => {
        if (entry.path === 'metadata.json') {
          const content = await entry.buffer();
          metadata = JSON.parse(content.toString());
        } else {
          entry.autodrain();
        }
      })
      .on('close', () => {
        if (metadata) {
          resolve(metadata);
        } else {
          reject(new Error('metadata.json을 찾을 수 없습니다.'));
        }
      })
      .on('error', reject);
  });
}

/**
 * 백업 파일 검증
 */
async function validateBackup(zipPath, userId) {
  const job = new RestoreJob({
    status: 'validating',
    backupFileName: path.basename(zipPath),
    tempFilePath: zipPath,
    createdBy: userId
  });
  await job.save();

  const errors = [];
  const warnings = [];

  try {
    // 파일 존재 확인
    if (!fs.existsSync(zipPath)) {
      errors.push('백업 파일을 찾을 수 없습니다.');
      await job.setValidationResult(false, errors, warnings);
      return job;
    }

    // 메타데이터 추출
    let metadata;
    try {
      metadata = await extractMetadata(zipPath);
    } catch {
      errors.push('백업 파일 형식이 올바르지 않습니다.');
      await job.setValidationResult(false, errors, warnings);
      return job;
    }

    // 버전 확인
    if (!metadata.version) {
      errors.push('백업 버전 정보가 없습니다.');
    }

    // 암호화 키 확인
    if (!isEncryptionKeyValid()) {
      warnings.push('BACKUP_ENCRYPTION_KEY가 설정되지 않았습니다. 암호화된 데이터(API 키 등)는 복구되지 않습니다.');
    } else if (metadata.encryptionKeyHash) {
      const currentKeyHash = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest('hex').slice(0, 16);
      if (metadata.encryptionKeyHash !== currentKeyHash) {
        warnings.push('백업 암호화 키가 현재 시스템과 다릅니다. 암호화된 데이터(API 키 등)가 복구되지 않을 수 있습니다.');
      }
    }

    // 컬렉션 확인 — 보강된 단일 소스 목록 기준으로 누락 경고 (#588)
    const requiredCollections = BACKUP_COLLECTIONS.map((c) => c.name);
    for (const col of requiredCollections) {
      if (metadata.collections && metadata.collections[col] === undefined) {
        warnings.push(`${col} 컬렉션이 백업에 없습니다. (구버전 백업일 수 있음 — 해당 데이터는 복원되지 않습니다)`);
      }
    }

    // 메타데이터 저장
    job.backupMetadata = {
      version: metadata.version,
      createdAt: metadata.createdAt,
      collections: metadata.collections,
      files: metadata.files
    };

    const isValid = errors.length === 0;
    await job.setValidationResult(isValid, errors, warnings);

    return job;
  } catch (error) {
    errors.push(`검증 중 오류: ${error.message}`);
    await job.setValidationResult(false, errors, warnings);
    return job;
  }
}

/**
 * 복구 실행
 */
async function executeRestore(jobId, zipPath, options = {}) {
  const job = await RestoreJob.findById(jobId);

  if (!job) {
    throw new Error('복구 작업을 찾을 수 없습니다.');
  }

  job.status = 'processing';
  job.options = options;
  await job.save();

  // 복원 직전 자동 스냅샷 (#590) — 잘못된 복원 시 롤백 경로 확보.
  // best-effort: 실패해도 복원은 진행하되 RestoreJob 에 경고를 남긴다 (options.skipSnapshot 로 명시 생략 가능).
  if (!options.skipSnapshot) {
    try {
      await job.updateProgress(0, 1, '복원 전 스냅샷 생성 중...');
      const snapshot = await backupService.initBackupJob(job.createdBy, 'snapshot');
      await backupService.executeBackup(snapshot._id);
      job.preRestoreSnapshotId = snapshot._id;
      await job.save();
      console.log(`📸 복원 전 스냅샷 생성 완료: ${snapshot._id}`);
    } catch (snapErr) {
      job.snapshotWarning = `복원 전 스냅샷 생성 실패: ${snapErr.message} (롤백 스냅샷 없이 복원이 진행됩니다)`;
      await job.save();
      console.error(`⚠️ 복원 전 스냅샷 생성 실패: ${snapErr.message}`);
    }
  }

  const statistics = {
    collectionsRestored: {},
    filesRestored: {
      generated: 0,
      reference: 0,
      videos: 0
    },
    skipped: 0,
    errors: 0,
    dbErrors: 0,
    fileErrors: 0,
    errorDetails: []
  };

  const totalSteps = BACKUP_COLLECTIONS.length + 3; // 컬렉션 + 파일 디렉토리 3개
  let currentStep = 0;

  // 임시 디렉토리 생성
  const tempExtractDir = path.join(TEMP_DIR, `restore-${jobId}`);
  if (!fs.existsSync(tempExtractDir)) {
    fs.mkdirSync(tempExtractDir, { recursive: true });
  }

  try {
    // ZIP 추출
    await job.updateProgress(currentStep, totalSteps, 'ZIP 파일 추출 중...');

    await new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: tempExtractDir }))
        .on('close', resolve)
        .on('error', reject);
    });

    // 데이터베이스 복구
    if (!options.skipDatabase) {
      for (const config of BACKUP_COLLECTIONS) {
        const name = config.name;
        currentStep++;
        await job.updateProgress(currentStep, totalSteps, `${name} 컬렉션 복구 중...`);

        try {
          const restoredCount = await restoreCollection(config, tempExtractDir, options, statistics);
          if (restoredCount !== null) {
            statistics.collectionsRestored[name] = restoredCount;
          }
        } catch (colError) {
          console.error(`${name} 컬렉션 복구 오류:`, colError.message);
          recordError(statistics, { type: 'db', collection: name, message: `컬렉션 복구 오류: ${colError.message}` });
        }
      }
    }

    // 파일 복구
    if (!options.skipFiles) {
      const fileDirs = ['generated', 'reference', 'videos'];

      for (const dir of fileDirs) {
        currentStep++;
        await job.updateProgress(currentStep, totalSteps, `${dir} 파일 복구 중...`);

        const sourceDir = path.join(tempExtractDir, 'files', dir);
        const targetDir = path.join(UPLOAD_DIR, dir);

        if (fs.existsSync(sourceDir)) {
          // 타겟 디렉토리 생성
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          const files = fs.readdirSync(sourceDir);

          for (const file of files) {
            const sourcePath = path.join(sourceDir, file);
            const targetPath = path.join(targetDir, file);

            try {
              if (options.overwriteExisting || !fs.existsSync(targetPath)) {
                fs.copyFileSync(sourcePath, targetPath);
                statistics.filesRestored[dir]++;
              } else {
                statistics.skipped++;
              }
            } catch (fileError) {
              console.error(`파일 복구 오류 (${file}):`, fileError.message);
              recordError(statistics, { type: 'file', dir, file, message: fileError.message });
            }
          }
        }
      }
    }

    // 임시 디렉토리 정리
    fs.rmSync(tempExtractDir, { recursive: true, force: true });

    await job.complete(statistics);

    return job;
  } catch (error) {
    // 임시 디렉토리 정리
    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }

    await job.fail(error);
    throw error;
  }
}

/**
 * 복구 상태 조회
 */
async function getRestoreStatus(jobId) {
  return RestoreJob.findById(jobId).populate('createdBy', 'nickname email');
}

/**
 * 복구 목록 조회
 */
async function listRestores(page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  const [restores, total] = await Promise.all([
    RestoreJob.find()
      .populate('createdBy', 'nickname email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    RestoreJob.countDocuments()
  ]);

  return {
    restores,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total
    }
  };
}

module.exports = {
  validateBackup,
  executeRestore,
  getRestoreStatus,
  listRestores,
  // 테스트용 내부 헬퍼 (#591, #631)
  restoreOneDoc,
  restoreCollection,
  recordError
};
