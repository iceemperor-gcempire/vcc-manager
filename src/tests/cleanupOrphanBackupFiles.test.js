/**
 * #624 / #640 백업 임시 잔재 정리 — selectOrphans 는 .db-tmp-* 디렉토리만 삭제 대상.
 * zip 은 (미참조여도) 절대 삭제하지 않는다 (#640: 외부 복원용 백업 보존).
 */
const cleanupOrphanBackupFiles = require('../migrations/cleanupOrphanBackupFiles');
const { selectOrphans } = cleanupOrphanBackupFiles;

test('.db-tmp-* 디렉토리는 삭제 대상', () => {
  const entries = [
    { name: '.db-tmp-abc', isDir: true },
    { name: '.db-tmp-def', isDir: true },
  ];
  const { tmpDirs } = selectOrphans(entries);
  expect(tmpDirs.sort()).toEqual(['.db-tmp-abc', '.db-tmp-def']);
});

test('zip 은 미참조여도 삭제 대상이 아님 (#640 — 외부 복원 백업 보존)', () => {
  const entries = [
    { name: 'vcc-backup-external.zip', isDir: false },
    { name: 'vcc-presnapshot-x.zip', isDir: false },
    { name: '.db-tmp-keep', isDir: true },
  ];
  const result = selectOrphans(entries);
  expect(result.tmpDirs).toEqual(['.db-tmp-keep']);
  expect(result.zips).toBeUndefined(); // zips 개념 자체가 제거됨
});

test('zip/일반 디렉토리만 있으면 삭제 대상 없음', () => {
  const entries = [
    { name: 'vcc-backup-A.zip', isDir: false },
    { name: 'somedir', isDir: true },
    { name: 'notes.txt', isDir: false },
  ];
  expect(selectOrphans(entries).tmpDirs).toEqual([]);
});

test('빈 입력', () => {
  expect(selectOrphans([])).toEqual({ tmpDirs: [] });
});
