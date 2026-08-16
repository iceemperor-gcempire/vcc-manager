/**
 * MKV 업로드 계약 (#844)
 *
 * MKV 는 허용하되 **저장물은 항상 mp4** 다 — Safari 가 MKV 를 재생하지 못해 그대로 두면
 * 첨부는 되는데 미리보기가 깨지는 반쪽 지원이 된다. 재포장(-c copy)이라 재인코딩은 없다.
 *
 * ffmpeg 실행이 필요한 실제 재포장은 컨테이너에서 실물 검증하고, 여기서는 계약만 고정한다:
 * (1) mkv mimetype 이 필터를 통과한다 (2) 재포장 실패는 400 + 사용자 사유다.
 */
const { fileFilter, ALLOWED_VIDEO_TYPES } = require('../utils/videoUpload');

describe('MKV 업로드 (#844)', () => {
  test('video/x-matroska 가 허용 목록에 있다', () => {
    expect(ALLOWED_VIDEO_TYPES).toContain('video/x-matroska');
  });

  test('mkv 가 필터를 통과한다', () => {
    let captured = 'unset';
    fileFilter({}, { mimetype: 'video/x-matroska', originalname: 'a.mkv' }, (err) => { captured = err; });
    expect(captured).toBeNull();
  });

  test('remux 실패 오류는 400 + 사용자가 읽을 사유를 갖는다', async () => {
    // ffmpeg 이 없는 환경에서도 돌도록 실패 경로를 직접 밟는다 — 존재하지 않는 파일
    const { remuxMkvToMp4 } = require('../utils/videoUpload');
    expect(typeof remuxMkvToMp4).toBe('function');
    await expect(remuxMkvToMp4('/nonexistent/x.mkv')).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('재포장'),
    });
  });
});
