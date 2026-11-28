/**
 * 워커의 "계속해도 되는가" 확인 (#521, #1325).
 * 취소된 작업과 지워진 작업은 멈추고, 확인이 실패했다고 멈추지는 않는다.
 */
jest.mock('../models/ImageGenerationJob', () => ({ findById: jest.fn() }));
const ImageGenerationJob = require('../models/ImageGenerationJob');
const { jobStopReason } = require('../services/jobCancelCheck');

const found = (doc) => ImageGenerationJob.findById.mockReturnValue({ select: () => ({ lean: async () => doc }) });

describe('jobStopReason', () => {
  beforeEach(() => jest.clearAllMocks());

  test('지워진 작업(문서 없음)은 멈춘다', async () => {
    found(null);
    expect(await jobStopReason('j1')).toBe('deleted');
  });

  test('취소된 작업은 멈춘다', async () => {
    found({ status: 'cancelled' });
    expect(await jobStopReason('j1')).toBe('cancelled');
  });

  test.each(['pending', 'processing', 'completed', 'failed'])('%s 작업은 계속한다', async (status) => {
    found({ status });
    expect(await jobStopReason('j1')).toBe(false);
  });

  test('확인 조회가 실패하면 계속한다 — 조회 장애가 모든 작업을 버리게 하지 않는다', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    ImageGenerationJob.findById.mockReturnValue({ select: () => ({ lean: async () => { throw new Error('db down'); } }) });
    expect(await jobStopReason('j1')).toBe(false);
    err.mockRestore();
  });
});
