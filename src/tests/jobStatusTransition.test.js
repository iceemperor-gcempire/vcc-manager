const mongoose = require('mongoose');
const ImageGenerationJob = require('../models/ImageGenerationJob');

/**
 * #521 작업 취소 상태 전이 가드 회귀 테스트
 *
 * cancelled 는 종결 상태 — Bull worker 의 active('processing')/completed/failed 이벤트가
 * 취소된 잡의 상태를 덮어쓰면 안 된다. DB 연결 없이 save 를 스텁해 전이 로직만 검증.
 */

function makeJob(status = 'pending') {
  const job = new ImageGenerationJob({
    userId: new mongoose.Types.ObjectId(),
    workboardId: new mongoose.Types.ObjectId(),
    inputData: { prompt: 'test prompt' }
  });
  job.status = status;
  job.save = jest.fn(async () => job); // DB 미연결 — 저장 호출 여부만 추적
  return job;
}

describe('ImageGenerationJob.updateStatus 전이 가드 (#521)', () => {
  test('cancelled → processing 덮어쓰기 차단 (worker active 이벤트)', async () => {
    const job = makeJob('cancelled');
    await job.updateStatus('processing');
    expect(job.status).toBe('cancelled');
    expect(job.save).not.toHaveBeenCalled();
  });

  test('cancelled → completed 덮어쓰기 차단 (worker completed 이벤트)', async () => {
    const job = makeJob('cancelled');
    await job.updateStatus('completed', { resultImages: [new mongoose.Types.ObjectId()] });
    expect(job.status).toBe('cancelled');
    expect(job.resultImages).toHaveLength(0);
    expect(job.save).not.toHaveBeenCalled();
  });

  test('cancelled → failed 덮어쓰기 차단', async () => {
    const job = makeJob('cancelled');
    await job.updateStatus('failed', { error: { message: 'x' } });
    expect(job.status).toBe('cancelled');
    expect(job.save).not.toHaveBeenCalled();
  });

  test('정상 전이는 그대로 동작 (pending → processing → completed)', async () => {
    const job = makeJob('pending');
    await job.updateStatus('processing');
    expect(job.status).toBe('processing');
    expect(job.startedAt).toBeInstanceOf(Date);

    await job.updateStatus('completed');
    expect(job.status).toBe('completed');
    expect(job.completedAt).toBeInstanceOf(Date);
    expect(job.save).toHaveBeenCalledTimes(2);
  });

  test('processing → cancelled 전이는 허용 (사용자 취소)', async () => {
    const job = makeJob('processing');
    await job.updateStatus('cancelled');
    expect(job.status).toBe('cancelled');
    expect(job.save).toHaveBeenCalled();
  });

  test('queueJobId 가 스키마에 저장됨 (strict strip 회귀 방지)', async () => {
    const job = makeJob('pending');
    await job.updateStatus('pending', { queueJobId: 12345 });
    expect(job.queueJobId).toBe('12345');
    // 스키마에 정의되어 있어야 toObject 에서 살아남음
    expect(job.toObject().queueJobId).toBe('12345');
  });
});
