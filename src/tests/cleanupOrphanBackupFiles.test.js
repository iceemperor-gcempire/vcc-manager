/**
 * #624 백업 디렉토리 고아 파일 선택 로직 테스트 (순수 함수)
 */
const cleanupOrphanBackupFiles = require('../migrations/cleanupOrphanBackupFiles');
const { selectOrphans } = cleanupOrphanBackupFiles;

test('.db-tmp-* 디렉토리는 항상 삭제 대상', () => {
  const entries = [
    { name: '.db-tmp-abc', isDir: true },
    { name: '.db-tmp-def', isDir: true },
  ];
  const { tmpDirs } = selectOrphans(entries, new Set());
  expect(tmpDirs.sort()).toEqual(['.db-tmp-abc', '.db-tmp-def']);
});

test('참조된 zip 은 보존, 미참조 zip 만 삭제', () => {
  const entries = [
    { name: 'vcc-backup-keep.zip', isDir: false },
    { name: 'vcc-backup-orphan.zip', isDir: false },
    { name: 'vcc-presnapshot-orphan.zip', isDir: false },
  ];
  const referenced = new Set(['vcc-backup-keep.zip']);
  const { zips } = selectOrphans(entries, referenced);
  expect(zips.sort()).toEqual(['vcc-backup-orphan.zip', 'vcc-presnapshot-orphan.zip']);
});

test('zip 이 아닌 일반 파일/디렉토리는 건드리지 않음', () => {
  const entries = [
    { name: 'metadata.json', isDir: false },
    { name: 'somedir', isDir: true },
    { name: 'note.txt', isDir: false },
  ];
  const { tmpDirs, zips } = selectOrphans(entries, new Set());
  expect(tmpDirs).toEqual([]);
  expect(zips).toEqual([]);
});

test('빈 입력', () => {
  expect(selectOrphans([], new Set())).toEqual({ tmpDirs: [], zips: [] });
});
