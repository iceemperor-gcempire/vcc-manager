/**
 * jobDeletionService (#902) — 단건/선택 삭제가 공유하는 규칙.
 * 모델·파일 삭제를 mock 해 "무엇을 지우고 무엇을 끊는지" 만 본다.
 */
jest.mock('../models/UploadedImage', () => ({ findByIdAndUpdate: jest.fn().mockResolvedValue(null), findById: jest.fn().mockResolvedValue(null) }));
jest.mock('../models/GeneratedImage', () => ({ findByIdAndDelete: jest.fn().mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue({}) }));
jest.mock('../models/GeneratedVideo', () => ({ findByIdAndDelete: jest.fn().mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue({}) }));
jest.mock('../models/GeneratedAudio', () => ({ findByIdAndDelete: jest.fn().mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue({}) }));
jest.mock('../models/ImageGenerationJob', () => ({ findByIdAndDelete: jest.fn().mockResolvedValue(null) }));
jest.mock('../utils/fileUpload', () => ({ deleteFile: jest.fn().mockResolvedValue(undefined) }));

const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const GeneratedAudio = require('../models/GeneratedAudio');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const UploadedImage = require('../models/UploadedImage');
const { deleteFile } = require('../utils/fileUpload');
const { deleteJobRecord, checkDeletable } = require('../services/jobDeletionService');

const job = () => ({
  _id: 'job-1', userId: 'u1', status: 'completed',
  inputData: { referenceImages: [{ imageId: 'ref-1' }] },
  resultImages: [{ _id: 'img-1', path: '/app/uploads/generated/a.png' }],
  resultVideos: [{ _id: 'vid-1', path: '/app/uploads/videos/a.mp4' }],
  resultAudios: [{ _id: 'aud-1', path: '/app/uploads/audio/a.mp3' }],
});

describe('checkDeletable', () => {
  test('없음 404 · 타인 403 · 처리중 400 · 본인/admin ok', () => {
    expect(checkDeletable(null, { _id: 'u1' }).status).toBe(404);
    expect(checkDeletable(job(), { _id: 'u2', isAdmin: false }).status).toBe(403);
    expect(checkDeletable({ ...job(), status: 'processing' }, { _id: 'u1' }).status).toBe(400);
    expect(checkDeletable(job(), { _id: 'u1' }).ok).toBe(true);
    expect(checkDeletable(job(), { _id: 'u2', isAdmin: true }).ok).toBe(true);
  });
});

describe('deleteJobRecord', () => {
  beforeEach(() => jest.clearAllMocks());

  test('콘텐츠 보존: 이미지·영상·오디오의 jobId 만 끊고 작업 레코드 삭제', async () => {
    const counts = await deleteJobRecord(job(), { deleteContent: false });
    expect(counts).toEqual({ deletedImagesCount: 0, deletedVideosCount: 0, deletedAudiosCount: 0 });
    expect(GeneratedImage.updateMany).toHaveBeenCalledWith({ _id: { $in: ['img-1'] } }, { $unset: { jobId: 1 } });
    expect(GeneratedVideo.updateMany).toHaveBeenCalledWith({ _id: { $in: ['vid-1'] } }, { $unset: { jobId: 1 } });
    expect(GeneratedAudio.updateMany).toHaveBeenCalledWith({ _id: { $in: ['aud-1'] } }, { $unset: { jobId: 1 } });
    expect(deleteFile).not.toHaveBeenCalled();
    expect(ImageGenerationJob.findByIdAndDelete).toHaveBeenCalledWith('job-1');
    expect(UploadedImage.findByIdAndUpdate).toHaveBeenCalledWith('ref-1', { $pull: { referencedBy: { jobId: 'job-1' } } });
  });

  test('콘텐츠 동반 삭제: 파일 + 레코드 삭제, 종류별 카운트', async () => {
    const counts = await deleteJobRecord(job(), { deleteContent: true });
    expect(counts).toEqual({ deletedImagesCount: 1, deletedVideosCount: 1, deletedAudiosCount: 1 });
    expect(deleteFile).toHaveBeenCalledTimes(3);
    expect(GeneratedImage.findByIdAndDelete).toHaveBeenCalledWith('img-1');
    expect(GeneratedAudio.findByIdAndDelete).toHaveBeenCalledWith('aud-1');
    expect(GeneratedImage.updateMany).not.toHaveBeenCalled();
  });

  test('파일 삭제 실패해도 레코드는 지우고 카운트한다', async () => {
    deleteFile.mockRejectedValueOnce(new Error('ENOENT'));
    const counts = await deleteJobRecord(job(), { deleteContent: true });
    expect(counts.deletedImagesCount).toBe(1);
    expect(GeneratedImage.findByIdAndDelete).toHaveBeenCalledWith('img-1');
  });
});
