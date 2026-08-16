/**
 * #660 User 삭제 cascade — 개인 콘텐츠 모델 누락 방지
 */
// userDeletionService 가 구조분해로 가져가므로 모듈 자체를 대체해야 가로챌 수 있다
jest.mock('../services/mediaFileCleanup', () => ({
  deleteMediaFilesFor: jest.fn().mockResolvedValue({ deleted: 0, absent: 0, byCollection: [] }),
  MEDIA_FILE_MODEL_NAMES: [],
}));

const svc = require('../services/userDeletionService');
const User = require('../models/User');
const mediaFileCleanup = require('../services/mediaFileCleanup');

beforeEach(() => mediaFileCleanup.deleteMediaFilesFor.mockClear());

describe('#660 userDeletionService', () => {
  test('USER_CONTENT_MODELS 가 개인 콘텐츠/작업 모델을 전부 포함 (누락 회귀 방지)', () => {
    const names = svc.USER_CONTENT_MODELS.map((M) => M.modelName).sort();
    expect(names).toEqual([
      'ApiKey',
      'ConversationJob',
      'GeneratedAudio',
      'GeneratedImage',
      'GeneratedText',
      'GeneratedVideo',
      'ImageGenerationJob',
      'PipelineRun',
      'UploadedAudio',
      'UploadedImage',
      'UploadedText',
      'UploadedVideo',
    ]);
  });

  test('deleteUserAndContent 가 모든 콘텐츠 모델 deleteMany({userId}) + User 삭제 호출', async () => {
    const spies = svc.USER_CONTENT_MODELS.map((M) => jest.spyOn(M, 'deleteMany').mockResolvedValue({ deletedCount: 0 }));
    const userSpy = jest.spyOn(User, 'findByIdAndDelete').mockResolvedValue({});

    await svc.deleteUserAndContent('uid-123');

    for (const s of spies) expect(s).toHaveBeenCalledWith({ userId: 'uid-123' });
    expect(userSpy).toHaveBeenCalledWith('uid-123');

    spies.forEach((s) => s.mockRestore());
    userSpy.mockRestore();
  });

  // #806 — 예전에는 deleteMany 만 호출해 디스크 파일이 남았다. 계정을 지워도 그 사람이
  // 만든 이미지·영상·오디오가 남는 건 용량 문제이자 탈퇴 처리의 불완전함이다.
  test('디스크 파일을 문서보다 먼저 지운다', async () => {
    const order = [];
    mediaFileCleanup.deleteMediaFilesFor.mockImplementation(async () => {
      order.push('files');
      return { deleted: 0, absent: 0, byCollection: [] };
    });
    const spies = svc.USER_CONTENT_MODELS.map((M) =>
      jest.spyOn(M, 'deleteMany').mockImplementation(async () => {
        order.push('docs');
        return { deletedCount: 0 };
      })
    );
    const userSpy = jest.spyOn(User, 'findByIdAndDelete').mockImplementation(async () => {
      order.push('user');
      return {};
    });

    await svc.deleteUserAndContent('uid-123');

    expect(mediaFileCleanup.deleteMediaFilesFor).toHaveBeenCalledWith({ userId: 'uid-123' });
    // 순서가 뒤집히면 문서를 잃은 시점에 경로를 알 수 없어 파일이 영구 고아가 된다
    expect(order[0]).toBe('files');
    expect(order[order.length - 1]).toBe('user');

    spies.forEach((s) => s.mockRestore());
    userSpy.mockRestore();
  });
});
