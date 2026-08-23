/**
 * 무음 영상 + "소리도 참조" 가드 (#859)
 *
 * 계약: audioOfVideoField 가 선언된 boolean 필드가 켜져 있고, 그 video 필드의 첨부물에
 * 오디오 트랙이 없으면 사용자용 사유를 돌려준다. 판정 불가(미상)는 허용 — 막을 근거가 없다.
 */
jest.mock('../utils/videoUpload', () => ({
  probeVideoMetadata: jest.fn(),
}));

const fs = require('fs');
const UploadedVideo = require('../models/UploadedVideo');
const GeneratedVideo = require('../models/GeneratedVideo');
const { probeVideoMetadata } = require('../utils/videoUpload');
const { videoHasAudioTrack, findSilentVideoViolation } = require('../services/videoAudioGuard');

const WB = {
  additionalInputFields: [
    { name: 'ref_video_1', label: '참조 영상 1 (선택)', type: 'video' },
    { name: 'use_video_audio_1', label: '참조 영상 1의 소리도 참조', type: 'boolean', audioOfVideoField: 'ref_video_1' },
    { name: 'prompt_style', label: '스타일', type: 'select' },
  ],
};

const mockUploadedDoc = (doc) => jest.spyOn(UploadedVideo, 'findById').mockResolvedValue(doc);
const mockGeneratedDoc = (doc) => jest.spyOn(GeneratedVideo, 'findById').mockResolvedValue(doc);

afterEach(() => jest.restoreAllMocks());
beforeEach(() => probeVideoMetadata.mockReset());   // jest.mock factory 의 fn 은 restoreAllMocks 대상이 아니다

describe('#859 videoHasAudioTrack', () => {
  test('metadata.hasAudio 가 있으면 probe 없이 그 값을 쓴다', async () => {
    mockUploadedDoc({ _id: 'v1', metadata: { hasAudio: false }, path: '/x.mp4' });
    expect(await videoHasAudioTrack('v1')).toBe(false);
    expect(probeVideoMetadata).not.toHaveBeenCalled();
  });

  test('문서가 없으면 미상(null)', async () => {
    mockUploadedDoc(null);
    mockGeneratedDoc(null);
    expect(await videoHasAudioTrack('ghost')).toBeNull();
  });

  test('구 레코드(hasAudio 없음)는 파일을 probe 하고 결과를 backfill 한다', async () => {
    mockUploadedDoc({ _id: 'v2', metadata: {}, path: '/old.mp4' });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    probeVideoMetadata.mockResolvedValue({ hasAudio: false });
    const update = jest.spyOn(UploadedVideo, 'updateOne').mockResolvedValue({});

    expect(await videoHasAudioTrack('v2')).toBe(false);
    expect(probeVideoMetadata).toHaveBeenCalledWith('/old.mp4');
    expect(update).toHaveBeenCalledWith({ _id: 'v2' }, { $set: { 'metadata.hasAudio': false } });
  });

  test('파일이 사라졌으면 미상(null) — 오판으로 막지 않는다', async () => {
    mockUploadedDoc({ _id: 'v3', metadata: {}, path: '/gone.mp4' });
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(await videoHasAudioTrack('v3')).toBeNull();
    expect(probeVideoMetadata).not.toHaveBeenCalled();
  });

  test('업로드본에 없으면 생성물(GeneratedVideo)에서 찾는다', async () => {
    mockUploadedDoc(null);
    mockGeneratedDoc({ _id: 'g1', metadata: { hasAudio: true }, path: '/gen.mp4' });
    expect(await videoHasAudioTrack('g1')).toBe(true);
  });
});

describe('#859 findSilentVideoViolation', () => {
  test('스위치 on + 무음 영상 → 영상 라벨과 스위치 라벨이 담긴 사유', async () => {
    mockUploadedDoc({ _id: 'v1', metadata: { hasAudio: false }, path: '/x.mp4' });
    const msg = await findSilentVideoViolation(WB, {
      additionalParams: { use_video_audio_1: true, ref_video_1: [{ videoId: 'v1' }] },
    });
    expect(msg).toContain('참조 영상 1 (선택)');
    expect(msg).toContain('참조 영상 1의 소리도 참조');
    expect(msg).toContain('오디오 트랙이 없습니다');
  });

  test("문자열 'true' 도 켜짐으로 취급한다", async () => {
    mockUploadedDoc({ _id: 'v1', metadata: { hasAudio: false }, path: '/x.mp4' });
    const msg = await findSilentVideoViolation(WB, {
      additionalParams: { use_video_audio_1: 'true', ref_video_1: [{ videoId: 'v1' }] },
    });
    expect(msg).not.toBeNull();
  });

  test('스위치 off 면 무음 영상이어도 통과 (판정 자체를 안 한다)', async () => {
    const find = mockUploadedDoc({ _id: 'v1', metadata: { hasAudio: false }, path: '/x.mp4' });
    const msg = await findSilentVideoViolation(WB, {
      additionalParams: { use_video_audio_1: false, ref_video_1: [{ videoId: 'v1' }] },
    });
    expect(msg).toBeNull();
    expect(find).not.toHaveBeenCalled();
  });

  test('영상 미첨부면 통과 — omit 조건이 오디오 입력째 제거한다', async () => {
    const msg = await findSilentVideoViolation(WB, {
      additionalParams: { use_video_audio_1: true, ref_video_1: [] },
    });
    expect(msg).toBeNull();
  });

  test('오디오 있는 영상은 통과', async () => {
    mockUploadedDoc({ _id: 'v1', metadata: { hasAudio: true }, path: '/x.mp4' });
    const msg = await findSilentVideoViolation(WB, {
      additionalParams: { use_video_audio_1: true, ref_video_1: [{ videoId: 'v1' }] },
    });
    expect(msg).toBeNull();
  });

  test('판정 미상(구 레코드 + probe 실패)은 허용 — 서버가 오판으로 막지 않는다', async () => {
    mockUploadedDoc({ _id: 'v1', metadata: {}, path: '/x.mp4' });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    probeVideoMetadata.mockResolvedValue({});
    const msg = await findSilentVideoViolation(WB, {
      additionalParams: { use_video_audio_1: true, ref_video_1: [{ videoId: 'v1' }] },
    });
    expect(msg).toBeNull();
  });

  test('retry 경로 — job.inputData 의 additionalParams 형태도 같은 결과', async () => {
    mockUploadedDoc({ _id: 'v1', metadata: { hasAudio: false }, path: '/x.mp4' });
    const msg = await findSilentVideoViolation(WB, {
      prompt: 'p',
      additionalParams: { use_video_audio_1: true, ref_video_1: [{ videoId: 'v1' }] },
    });
    expect(msg).not.toBeNull();
  });
});
