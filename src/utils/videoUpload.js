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

// MKV 는 컨테이너만 받고 mp4 로 재포장한다 (#844) — Safari 가 MKV 를 재생하지 못해
// 그대로 저장하면 첨부는 되는데 미리보기가 깨지는 반쪽 지원이 된다.
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];
const VIDEO_EXT_BY_MIME = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv'
};
// 이미지와 같은 상한을 쓴다 (#813) — MAX_FILE_SIZE 단일 설정
const { MAX_FILE_SIZE: MAX_VIDEO_SIZE } = require('./fileUpload');

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
  // 브라우저는 MKV 의 mimetype 을 모른다 — Chrome 이 application/octet-stream 으로
  // 보내는 것을 실측으로 확인 (#844). mimetype 이 generic 일 때는 확장자로 판정한다.
  // 내용 검증은 어차피 remux 단계의 ffmpeg 이 한다 (가짜 .mkv 는 거기서 400).
  const genericMime = !file.mimetype || file.mimetype === 'application/octet-stream';
  const mkvByName = /\.mkv$/i.test(file.originalname || '');
  if (genericMime && mkvByName) return cb(null, true);
  if (!ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    // status 400 을 명시한다 (#842). 없으면 errorHandler 가 500 으로 취급해 메시지를 숨기고,
    // 사용자에게는 "Internal server error" 만 남는다. 수신 mimetype 을 함께 적어
    // "왜 거부됐나" 를 사용자·로그 양쪽이 알 수 있게 한다.
    const err = new Error(`지원하지 않는 영상 형식입니다 (${file.mimetype || '알 수 없음'}). MP4·WebM·MOV·MKV 만 업로드할 수 있습니다.`);
    err.status = 400;
    return cb(err, false);
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
// MKV → MP4 재포장 (#844). 재인코딩 없음(-c copy) — 컨테이너만 바꾸므로 수 초 안에 끝난다.
// H.264/AAC 계열(대부분의 ComfyUI 산출물)은 그대로 통과하고, mp4 가 받지 못하는 코덱
// (VP9/Opus 등)은 ffmpeg 이 실패한다 → 400 으로 사유를 알린다 (#842 팝업 경로).
const remuxMkvToMp4 = (srcPath) =>
  new Promise((resolve, reject) => {
    const outPath = srcPath.replace(/\.mkv$/i, '.mp4');
    execFile('ffmpeg', ['-y', '-i', srcPath, '-c', 'copy', '-movflags', '+faststart', outPath],
      { timeout: 120000 }, (error, _stdout, stderr) => {
        if (error) {
          fs.promises.unlink(outPath).catch(() => {});
          const err = new Error('MKV 영상의 코덱을 MP4 로 재포장할 수 없습니다. H.264/AAC 로 인코딩된 파일이거나 MP4·WebM·MOV 형식을 사용해 주세요.');
          err.status = 400;
          console.warn('⚠️ MKV remux 실패:', (stderr || error.message).slice(-400));
          return reject(err);
        }
        resolve(outPath);
      });
  });

const processUploadedVideo = async (file) => {
  // MKV 는 저장 직후 mp4 로 재포장하고 원본을 지운다 — 이후 단계(ffprobe·썸네일·DB)는
  // 전부 mp4 파일 기준으로 진행된다.
  if (/\.mkv$/i.test(file.filename)) {
    const mp4Path = await remuxMkvToMp4(file.path);
    await fs.promises.unlink(file.path);
    const stat = await fs.promises.stat(mp4Path);
    file = {
      ...file,
      path: mp4Path,
      filename: path.basename(mp4Path),
      mimetype: 'video/mp4',
      size: stat.size,
    };
    console.log(`🔁 MKV → MP4 재포장 완료: ${file.filename} (${(stat.size / 1048576).toFixed(1)}MB)`);
  }

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
  remuxMkvToMp4,   // 테스트용 (#844)
  fileFilter,   // 테스트용 (#842)
  processUploadedVideo,
  probeVideoMetadata,
  ALLOWED_VIDEO_TYPES,
  MAX_VIDEO_SIZE,   // = MAX_FILE_SIZE (#813)
};
