/**
 * #620 부팅 시 멈춘 백업/복원 작업 정리 테스트
 */
jest.mock('../models/BackupJob', () => ({ updateMany: jest.fn() }));
jest.mock('../models/RestoreJob', () => ({ updateMany: jest.fn() }));

const BackupJob = require('../models/BackupJob');
const RestoreJob = require('../models/RestoreJob');
const cleanupStuckBackupRestoreJobs = require('../migrations/cleanupStuckBackupRestoreJobs');

beforeEach(() => {
  BackupJob.updateMany.mockReset();
  RestoreJob.updateMany.mockReset();
});

test('pending/processing 백업과 processing/validating 복원을 failed 로 정리', async () => {
  BackupJob.updateMany.mockResolvedValue({ modifiedCount: 1 });
  RestoreJob.updateMany.mockResolvedValue({ modifiedCount: 0 });

  await cleanupStuckBackupRestoreJobs();

  const [bFilter, bUpdate] = BackupJob.updateMany.mock.calls[0];
  expect(bFilter).toEqual({ status: { $in: ['pending', 'processing'] } });
  expect(bUpdate.$set.status).toBe('failed');
  expect(bUpdate.$set.completedAt).toBeInstanceOf(Date);
  expect(bUpdate.$set.error.message).toMatch(/재시작/);

  const [rFilter, rUpdate] = RestoreJob.updateMany.mock.calls[0];
  // RestoreJob 'pending'(검증완료·사용자대기)은 제외
  expect(rFilter).toEqual({ status: { $in: ['processing', 'validating'] } });
  expect(rUpdate.$set.status).toBe('failed');
});

test('대상이 없으면 그래도 두 컬렉션 모두 시도(멱등)', async () => {
  BackupJob.updateMany.mockResolvedValue({ modifiedCount: 0 });
  RestoreJob.updateMany.mockResolvedValue({ modifiedCount: 0 });
  await cleanupStuckBackupRestoreJobs();
  expect(BackupJob.updateMany).toHaveBeenCalledTimes(1);
  expect(RestoreJob.updateMany).toHaveBeenCalledTimes(1);
});

test('DB 오류가 나도 throw 하지 않음(부팅 차단 방지)', async () => {
  BackupJob.updateMany.mockRejectedValue(new Error('db down'));
  await expect(cleanupStuckBackupRestoreJobs()).resolves.toBeUndefined();
});
