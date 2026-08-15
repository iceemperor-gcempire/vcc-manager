const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { v4: uuidv4 } = require('uuid');

// 참조 오디오 업로드 (#772) — videoUpload.js 와 같은 구조.
// diskStorage 를 쓰는 이유도 동일하다 (긴 오디오가 Node 힙에 통째로 올라가는 것을 피한다).
// 재인코딩 없음(원본 보존) — 메타데이터는 ffprobe. 썸네일은 없다.

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',   // mp3
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/ogg',
  'audio/mp4',    // m4a
  'audio/aac'
];

const AUDIO_EXT_BY_MIME = {
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/flac': '.flac',
  'audio/x-flac': '.flac',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac'
};

// 이미지·비디오와 같은 상한을 쓴다 (#813) — MAX_FILE_SIZE 단일 설정
const { MAX_FILE_SIZE: MAX_AUDIO_SIZE } = require('./fileUpload');

// 이미지·비디오와 같은 reference/ 서브디렉토리 — files.js allowlist·백업/무결성 스캔 재사용
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
    const ext = AUDIO_EXT_BY_MIME[file.mimetype] || path.extname(file.originalname) || '.mp3';
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
    return cb(new Error('Only MP3, WAV, FLAC, OGG, M4A, and AAC audio files are allowed'), false);
  }
  cb(null, true);
};

const audioUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_AUDIO_SIZE
  }
});

// ffprobe 로 오디오 메타데이터 추출 (ffmpeg 패키지에 동봉 — Dockerfile.backend 에서 설치됨)
const probeAudioMetadata = (filePath) => {
  return new Promise((resolve) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration,format_name',
      '-of', 'json',
      filePath
    ], { timeout: 15000 }, (error, stdout) => {
      if (error) {
        console.warn('⚠️ ffprobe failed, saving audio without metadata:', error.message);
        return resolve({});
      }
      try {
        const parsed = JSON.parse(stdout);
        const stream = parsed.streams?.[0] || {};
        const format = parsed.format || {};
        resolve({
          duration: format.duration ? Math.round(parseFloat(format.duration) * 100) / 100 : undefined,
          sampleRate: stream.sample_rate ? parseInt(stream.sample_rate, 10) : undefined,
          channels: stream.channels,
          codec: stream.codec_name,
          format: format.format_name
        });
      } catch {
        resolve({});
      }
    });
  });
};

// diskStorage 로 저장된 파일에 대해 메타데이터를 만들어 UploadedAudio 문서 데이터로 반환
const processUploadedAudio = async (file) => {
  const metadata = await probeAudioMetadata(file.path);

  return {
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: file.path,
    url: `/uploads/${REFERENCE_SUBDIR}/${file.filename}`,
    metadata
  };
};

module.exports = {
  audioUpload,
  processUploadedAudio,
  probeAudioMetadata,
  ALLOWED_AUDIO_TYPES,
  MAX_AUDIO_SIZE
};
