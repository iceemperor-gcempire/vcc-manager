const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const unzipper = require('unzipper');
const RestoreJob = require('../models/RestoreJob');
const { ENCRYPTION_KEY } = require('./backupService');

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

// 복구할 컬렉션 목록 (순서 중요 - 의존성 고려)
const COLLECTIONS = {
  User: { model: User },
  Server: { model: Server, decryptFields: ['configuration.apiKey'] },
  Tag: { model: Tag },
  Workboard: { model: Workboard },
  UploadedImage: { model: UploadedImage },
  PromptData: { model: PromptData },
  ImageGenerationJob: { model: ImageGenerationJob },
  GeneratedImage: { model: GeneratedImage },
  GeneratedVideo: { model: GeneratedVideo },
  LoraCache: { model: LoraCache }
};

const UPLOAD_DIR = process.env.UPLOAD_PATH || './uploads';
const TEMP_DIR = process.env.TEMP_PATH || path.join(UPLOAD_DIR, 'restore-temp');
const ALGORITHM = 'aes-256-gcm';

/**
 * AES-256-GCM으로 데이터 복호화
 */
function decryptData(encryptedObj) {
  if (!encryptedObj || !encryptedObj.encrypted) return null;

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
    const currentKeyHash = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest('hex').slice(0, 16);
    if (metadata.encryptionKeyHash && metadata.encryptionKeyHash !== currentKeyHash) {
      warnings.push('백업 암호화 키가 현재 시스템과 다릅니다. 암호화된 데이터(API 키 등)가 복구되지 않을 수 있습니다.');
    }

    // 컬렉션 확인
    const requiredCollections = Object.keys(COLLECTIONS);
    for (const col of requiredCollections) {
      if (metadata.collections && metadata.collections[col] === undefined) {
        warnings.push(`${col} 컬렉션이 백업에 없습니다.`);
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

  const statistics = {
    collectionsRestored: {},
    filesRestored: {
      generated: 0,
      reference: 0,
      videos: 0
    },
    skipped: 0,
    errors: 0
  };

  const totalSteps = Object.keys(COLLECTIONS).length + 3; // 컬렉션 + 파일 디렉토리 3개
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
      for (const [name, config] of Object.entries(COLLECTIONS)) {
        currentStep++;
        await job.updateProgress(currentStep, totalSteps, `${name} 컬렉션 복구 중...`);

        const jsonPath = path.join(tempExtractDir, 'database', `${name}.json`);

        if (fs.existsSync(jsonPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            let restoredCount = 0;

            for (const doc of data) {
              try {
                // 암호화 필드 복호화
                let processedDoc = doc;
                if (config.decryptFields) {
                  processedDoc = decryptFields(doc, config.decryptFields);
                }

                // _id와 날짜 필드 변환
                const docId = processedDoc._id;
                delete processedDoc._id;

                if (options.overwriteExisting) {
                  await config.model.findByIdAndUpdate(
                    docId,
                    processedDoc,
                    { upsert: true, new: true }
                  );
                } else {
                  // 존재 여부 확인
                  const existing = await config.model.findById(docId);
                  if (!existing) {
                    processedDoc._id = docId;
                    await config.model.create(processedDoc);
                  } else {
                    statistics.skipped++;
                  }
                }

                restoredCount++;
              } catch (docError) {
                console.error(`${name} 문서 복구 오류:`, docError.message);
                statistics.errors++;
              }
            }

            statistics.collectionsRestored[name] = restoredCount;
          } catch (colError) {
            console.error(`${name} 컬렉션 복구 오류:`, colError.message);
            statistics.errors++;
          }
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
              statistics.errors++;
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
  listRestores
};
