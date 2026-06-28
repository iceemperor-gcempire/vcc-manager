/**
 * #660 User 삭제 cascade — 개인 콘텐츠 모델 누락 방지
 */
const svc = require('../services/userDeletionService');
const User = require('../models/User');

describe('#660 userDeletionService', () => {
  test('USER_CONTENT_MODELS 가 개인 콘텐츠/작업 모델을 전부 포함 (누락 회귀 방지)', () => {
    const names = svc.USER_CONTENT_MODELS.map((M) => M.modelName).sort();
    expect(names).toEqual([
      'ApiKey',
      'ConversationJob',
      'GeneratedImage',
      'GeneratedText',
      'GeneratedVideo',
      'ImageGenerationJob',
      'PipelineRun',
      'UploadedImage',
      'UploadedText',
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
});
