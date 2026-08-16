const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
// 업로드 크기 상한 — 이미지·비디오·오디오 공통 (#813).
// 예전에는 종류마다 따로 뒀는데(이미지 10MB / 비디오 100MB / 오디오 50MB) 나눌 실익이 없었다.
// 참조 비디오는 모델 스펙상 짧다 (MiniMax H3 는 15초가 한계) — 100MB 를 열어둘 이유가 없다.
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 30 * 1024 * 1024; // 30MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, and WebP image files are allowed'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

const processAndSaveImage = async (buffer, originalName, userId, subfolder = 'reference') => {
  const uploadDir = path.join(process.env.UPLOAD_PATH || './uploads', subfolder);
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const fileExtension = path.extname(originalName).toLowerCase() || '.png';
  const filename = `${uuidv4()}${fileExtension}`;
  const filepath = path.join(uploadDir, filename);
  
  const image = sharp(buffer);
  const metadata = await image.metadata();
  
  const maxDimension = 2048;
  let processedImage = image;
  
  if (metadata.width > maxDimension || metadata.height > maxDimension) {
    processedImage = image.resize(maxDimension, maxDimension, {
      fit: 'inside',
      withoutEnlargement: false
    });
  }
  
  const outputBuffer = await processedImage
    .png({ quality: 90 })
    .toBuffer();
  
  await fs.promises.writeFile(filepath, outputBuffer);
  
  const processedMetadata = await sharp(outputBuffer).metadata();
  
  return {
    filename,
    filepath,
    url: `/uploads/${subfolder}/${filename}`,
    size: outputBuffer.length,
    metadata: {
      width: processedMetadata.width,
      height: processedMetadata.height,
      format: processedMetadata.format,
      colorSpace: processedMetadata.space,
      hasAlpha: processedMetadata.hasAlpha,
      orientation: processedMetadata.orientation
    }
  };
};

const deleteFile = async (filepath) => {
  try {
    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

/**
 * DB 의 `/uploads/...` URL 을 디스크 경로로 변환. uploads 밖(비정상)은 null.
 *
 * 정합성 검사(integrityService)와 삭제 경로(mediaFileCleanup)가 같은 변환을 해야 한다 —
 * 한쪽만 다르게 계산하면 "지웠다고 보고했는데 남는" 또는 그 반대가 된다. 모델을 참조하지
 * 않는 순수 함수라 여기(util)에 둔다 (서비스에 두면 순환 참조가 생긴다).
 */
const uploadUrlToDiskPath = (url, uploadRoot) => {
  if (!url || typeof url !== 'string') return null;
  const normalized = url.split('?')[0];
  if (!normalized.startsWith('/uploads/')) return null;
  const rel = normalized.slice('/uploads/'.length);
  if (rel.includes('..') || rel.includes('\0')) return null;
  return path.join(uploadRoot, rel);
};

const getImageInfo = async (filepath) => {
  try {
    const metadata = await sharp(filepath).metadata();
    const stats = await fs.promises.stat(filepath);
    
    return {
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        colorSpace: metadata.space,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation
      },
      size: stats.size
    };
  } catch (error) {
    console.error('Error getting image info:', error);
    return null;
  }
};

const validateImageDimensions = (metadata, minWidth = 64, minHeight = 64, maxWidth = 4096, maxHeight = 4096) => {
  if (!metadata.width || !metadata.height) {
    return { valid: false, error: 'Invalid image dimensions' };
  }
  
  if (metadata.width < minWidth || metadata.height < minHeight) {
    return { valid: false, error: `Image too small. Minimum size: ${minWidth}x${minHeight}` };
  }
  
  if (metadata.width > maxWidth || metadata.height > maxHeight) {
    return { valid: false, error: `Image too large. Maximum size: ${maxWidth}x${maxHeight}` };
  }
  
  return { valid: true };
};

const createThumbnail = async (inputPath, outputPath, size = 256) => {
  try {
    await sharp(inputPath)
      .resize(size, size, {
        fit: 'cover',
        withoutEnlargement: false
      })
      .png()
      .toFile(outputPath);
    
    return true;
  } catch (error) {
    console.error('Error creating thumbnail:', error);
    return false;
  }
};

module.exports = {
  upload,
  processAndSaveImage,
  deleteFile,
  getImageInfo,
  validateImageDimensions,
  createThumbnail,
  uploadUrlToDiskPath,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE
};