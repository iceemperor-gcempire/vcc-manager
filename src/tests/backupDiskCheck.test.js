/**
 * #622 백업 디스크 사전 점검 판정 로직 테스트
 */
const { decideDiskSpace } = require('../services/backupService');

const GB = 1024 * 1024 * 1024;

test('가용 공간이 필요량보다 크면 ok', () => {
  const r = decideDiskSpace({ estimatedBytes: 2 * GB, availableBytes: 10 * GB, safetyFactor: 1.5 });
  expect(r.ok).toBe(true);
  expect(r.requiredBytes).toBe(3 * GB); // 2GB * 1.5
});

test('가용 공간이 필요량보다 작으면 거부', () => {
  const r = decideDiskSpace({ estimatedBytes: 10 * GB, availableBytes: 12 * GB, safetyFactor: 1.5 });
  expect(r.ok).toBe(false);
  expect(r.reason).toBe('insufficient-space');
  expect(r.requiredBytes).toBe(15 * GB);
});

test('경계값: 정확히 같으면 통과', () => {
  const r = decideDiskSpace({ estimatedBytes: 8 * GB, availableBytes: 12 * GB, safetyFactor: 1.5 });
  expect(r.ok).toBe(true); // required 12GB == available 12GB
});

test('가용 공간 측정 불가(null)면 통과 + reason', () => {
  const r = decideDiskSpace({ estimatedBytes: 100 * GB, availableBytes: null });
  expect(r.ok).toBe(true);
  expect(r.reason).toBe('disk-unmeasurable');
});

test('safetyFactor 기본값 1.5 적용', () => {
  const r = decideDiskSpace({ estimatedBytes: 4 * GB, availableBytes: 5 * GB });
  expect(r.requiredBytes).toBe(6 * GB);
  expect(r.ok).toBe(false); // 6GB 필요 > 5GB 가용
});
