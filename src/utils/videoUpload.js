const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { generateVideoThumbnail } = require('./videoThumbnail');

// 참조 비디오 업로드 (#753).
// 이미지(fileUpload.js)와 달리 memoryStorage 를 쓰지 않는다 — 수십~수백 MB 가
// Node 힙에 통째로 올라가는 것을 피하기 위해 diskStorage 로 최종 경로에 직접 기록.
// 재인코딩 없음(원본 보존) — 메타데이터는 ffprobe, 포스터는 기존 videoThumbnail.js.

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const VIDEO_EXT_BY_MIME = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov'
};
const MAX_VIDEO_SIZE = parseInt(process.env.MAX_VIDEO_SIZE) || 100 * 1024 * 1024; // 100MB

// 이미지와 같은 reference/ 서브디렉토리 사용 — files.js allowlist·백업/무결성 스캔 재사용
const REFERENCE_SUBDIR = 'reference';

const referenceDir = () => {
  const dir = path.join(process.env.UPLOAD_PATH || './uploads', REFERENCE_SUBDIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      cb(null, referenceDir());
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = VIDEO_EXT_BY_MIME[file.mimetype] || path.extname(file.originalname) || '.mp4';
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return cb(new Error('Only MP4, WebM, and MOV video files are allowed'), false);
  }
  cb(null, true);
};

const videoUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE
  }
});

// ffprobe 로 비디오 메타데이터 추출 (ffmpeg 패키지에 동봉 — Dockerfile.backend 에서 설치됨)
const probeVideoMetadata = (filePath) => {
  return new Promise((resolve) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,codec_name,avg_frame_rate:format=duration,format_name',
      '-of', 'json',
      filePath
    ], { timeout: 15000 }, (error, stdout) => {
      if (error) {
        console.warn('⚠️ ffprobe failed, saving video without metadata:', error.message);
        return resolve({});
      }
      try {
        const parsed = JSON.parse(stdout);
        const stream = parsed.streams?.[0] || {};
        const format = parsed.format || {};
        let frameRate;
        if (stream.avg_frame_rate && stream.avg_frame_rate !== '0/0') {
          const [num, den] = stream.avg_frame_rate.split('/').map(Number);
          if (den) frameRate = Math.round((num / den) * 100) / 100;
        }
        resolve({
          width: stream.width,
          height: stream.height,
          duration: format.duration ? Math.round(parseFloat(format.duration) * 100) / 100 : undefined,
          frameRate,
          codec: stream.codec_name,
          format: format.format_name
        });
      } catch {
        resolve({});
      }
    });
  });
};

// diskStorage 로 저장된 파일에 대해 메타데이터·썸네일을 만들어 UploadedVideo 문서 데이터로 반환
const processUploadedVideo = async (file) => {
  const metadata = await probeVideoMetadata(file.path);

  let thumbnailUrl = null;
  try {
    const thumbFilename = `${path.parse(file.filename).name}_thumb.jpg`;
    const thumbPath = path.join(referenceDir(), thumbFilename);
    await generateVideoThumbnail(file.path, thumbPath);
    thumbnailUrl = `/uploads/${REFERENCE_SUBDIR}/${thumbFilename}`;
  } catch (err) {
    console.warn('⚠️ Video thumbnail generation failed:', err.message);
  }

  return {
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: file.path,
    url: `/uploads/${REFERENCE_SUBDIR}/${file.filename}`,
    thumbnailUrl,
    metadata
  };
};

module.exports = {
  videoUpload,
  processUploadedVideo,
  probeVideoMetadata,
  ALLOWED_VIDEO_TYPES,
  MAX_VIDEO_SIZE
};
