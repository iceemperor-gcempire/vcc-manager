/**
 * 동영상 첫 프레임 썸네일 생성 (#672).
 * ffmpeg 를 CLI(별도 프로세스)로만 호출한다 — 앱 코드에 링크하지 않아 LGPL/GPL 전파 없음.
 * best-effort: 실패해도 호출측이 동영상 저장을 계속하도록 에러를 던지되 얇게 감싼다.
 */
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const FFMPEG_TIMEOUT_MS = 30000;
const THUMB_WIDTH = 480; // 프리뷰용 축소 폭 (높이는 비율 유지, 짝수 보정 -2)

/**
 * videoPath 의 첫 프레임을 jpg 로 추출해 thumbPath 에 저장.
 * @returns {Promise<string>} thumbPath (성공 시)
 */
function generateVideoThumbnail(videoPath, thumbPath) {
  return new Promise((resolve, reject) => {
    // -ss 0 을 -i 앞에 두어 빠른 seek. 첫 프레임 1장, 폭 480 리사이즈, 품질 q:v 4.
    const args = [
      '-y',
      '-ss', '0',
      '-i', videoPath,
      '-frames:v', '1',
      '-vf', `scale=${THUMB_WIDTH}:-2`,
      '-q:v', '4',
      thumbPath,
    ];
    execFile('ffmpeg', args, { timeout: FFMPEG_TIMEOUT_MS }, (err) => {
      if (err) return reject(err);
      // 산출 파일 존재 확인 (일부 코덱/손상 입력은 exit 0 이어도 파일이 없을 수 있음)
      fs.promises.access(thumbPath, fs.constants.R_OK)
        .then(() => resolve(thumbPath))
        .catch(() => reject(new Error('썸네일 파일이 생성되지 않았습니다')));
    });
  });
}

/**
 * 동영상 파일 경로로부터 같은 디렉토리에 `<name>_thumb.jpg` 썸네일 경로를 만든다.
 */
function thumbnailPathFor(videoFilePath) {
  const dir = path.dirname(videoFilePath);
  const base = path.basename(videoFilePath).replace(/\.[^.]+$/, '');
  return path.join(dir, `${base}_thumb.jpg`);
}

module.exports = { generateVideoThumbnail, thumbnailPathFor, THUMB_WIDTH };
