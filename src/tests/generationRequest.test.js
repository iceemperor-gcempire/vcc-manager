/**
 * submitGenerationRequest (#1269) — 라우트 밖에서 직접 불러도 같은 검증을 거친다.
 *
 * 라우트를 거친 검증 내용은 jobsAttachmentOwnership · jobsModelFolders · jobsLoraFolders 가 이미 고정한다
 * (그 테스트들이 이 서비스를 지나간다). 여기서는 서비스의 계약 — 상태 코드가 실린 오류, 검증에 걸리면
 * 작업을 만들지 않는다, 통과하면 작업 문서를 돌려준다 — 를 본다.
 */
let mockHasAccess = true;

jest.mock('../middleware/auth', () => ({ userHasWorkboardAccess: () => mockHasAccess }));
jest.mock('../services/queueService', () => ({
  addImageGenerationJob: jest.fn(async () => ({ _id: 'job-new', status: 'pending', progress: 0, createdAt: new Date() })),
}));
jest.mock('../models/Workboard', () => ({ findById: jest.fn() }));
jest.mock('../models/UploadedImage', () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock('../services/videoAudioGuard', () => ({ findSilentVideoViolation: jest.fn(async () => null) }));
jest.mock('../services/imageOrientationGuard', () => ({ findOrientationViolation: jest.fn(async () => null) }));
jest.mock('../services/loraFolderGuard', () => ({
  findLoraFolderViolation: jest.fn(async () => null),
  findLoraFieldViolation: jest.fn(() => null),
}));
jest.mock('../services/attachmentOwnership', () => ({
  findUnusableAttachments: jest.fn(async () => []),
  describeUnusableAttachments: jest.fn(() => ''),
}));

const Workboard = require('../models/Workboard');
const UploadedImage = require('../models/UploadedImage');
const { addImageGenerationJob } = require('../services/queueService');
const { findSilentVideoViolation } = require('../services/videoAudioGuard');
const { submitGenerationRequest, GenerationRequestError } = require('../services/generationRequest');

const user = { _id: 'user-1', isAdmin: false };
const board = (over = {}) => ({
  _id: 'wb-1', isActive: true, outputFormat: 'image', additionalInputFields: [], ...over,
});

const rejection = async (body) => {
  try {
    await submitGenerationRequest({ user, body });
  } catch (e) {
    return e;
  }
  throw new Error('검증에 걸려야 하는데 통과했다');
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHasAccess = true;
  Workboard.findById.mockResolvedValue(board());
});

describe('submitGenerationRequest — 검증 실패는 상태 코드가 실린 오류, 작업은 만들지 않는다', () => {
  test.each([
    ['workboardId 없음', {}, () => {}, 400, /Missing required fields/],
    ['없는 작업판', { workboardId: 'x', prompt: 'p' }, () => Workboard.findById.mockResolvedValue(null), 404, /Workboard not found/],
    ['접근 권한 없음', { workboardId: 'wb-1', prompt: 'p' }, () => { mockHasAccess = false; }, 403, /접근할 권한/],
    ['프롬프트 없음', { workboardId: 'wb-1' }, () => {}, 400, /Missing required fields/],
    ['텍스트 작업판', { workboardId: 'wb-1', prompt: 'p' }, () => Workboard.findById.mockResolvedValue(board({ outputFormat: 'text' })), 400, /generate-prompt/],
    ['필수 첨부 누락', { workboardId: 'wb-1', prompt: 'p' },
      () => Workboard.findById.mockResolvedValue(board({ additionalInputFields: [{ name: 'start', label: '시작 이미지', type: 'image', required: true }] })),
      400, /필수 첨부가 누락되었습니다: 시작 이미지/],
    ['무음 영상 가드', { workboardId: 'wb-1', prompt: 'p' }, () => findSilentVideoViolation.mockResolvedValueOnce('소리가 없는 영상입니다'), 400, /소리가 없는 영상/],
    ['베이스 모델 칸은 있는데 값 없음', { workboardId: 'wb-1', prompt: 'p' },
      () => Workboard.findById.mockResolvedValue(board({ additionalInputFields: [{ name: 'base_model', label: '모델', type: 'baseModel' }] })),
      400, /베이스 모델이 지정되지 않았습니다/],
  ])('%s', async (_name, body, arrange, status, message) => {
    arrange();
    const e = await rejection(body);
    expect(e).toBeInstanceOf(GenerationRequestError);
    expect(e.status).toBe(status);
    expect(e.message).toMatch(message);
    expect(addImageGenerationJob).not.toHaveBeenCalled();
  });
});

describe('submitGenerationRequest — 통과', () => {
  test('작업을 등록하고 작업 문서를 돌려준다. 안 보낸 부정 프롬프트는 판 기본값', async () => {
    Workboard.findById.mockResolvedValue(board({ defaultNegativePrompt: 'blurry' }));
    const job = await submitGenerationRequest({ user, body: { workboardId: 'wb-1', prompt: '  고양이  ', tags: 'not-array' } });
    expect(job._id).toBe('job-new');
    expect(addImageGenerationJob).toHaveBeenCalledTimes(1);
    const [userId, workboardId, inputData] = addImageGenerationJob.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(workboardId).toBe('wb-1');
    expect(inputData).toMatchObject({ prompt: '고양이', negativePrompt: 'blurry', referenceImages: [], additionalParams: {}, tags: [] });
  });

  test('참조 이미지에는 이 작업이 참조했다고 표시한다', async () => {
    await submitGenerationRequest({
      user, body: { workboardId: 'wb-1', prompt: 'p', referenceImages: [{ imageId: 'img-1' }, { imageId: 'img-2' }] },
    });
    expect(UploadedImage.findByIdAndUpdate.mock.calls.map((c) => c[0])).toEqual(['img-1', 'img-2']);
    expect(UploadedImage.findByIdAndUpdate.mock.calls[0][1]).toEqual({ $push: { referencedBy: { jobId: 'job-new' } }, isReferenced: true });
  });

  test('큐 등록 실패 같은 그 밖의 오류는 GenerationRequestError 가 아니다 (라우트가 예전처럼 400 으로 답한다)', async () => {
    addImageGenerationJob.mockRejectedValueOnce(new Error('queue down'));
    const e = await rejection({ workboardId: 'wb-1', prompt: 'p' });
    expect(e).not.toBeInstanceOf(GenerationRequestError);
    expect(e.message).toBe('queue down');
  });
});
