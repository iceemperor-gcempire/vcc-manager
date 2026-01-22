const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB

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
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE
};