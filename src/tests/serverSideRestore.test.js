/**
 * #634 서버사이드 복원 — 경로 안전성(traversal 방지) + 파일 목록 테스트
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

let tmpBackupDir;
let backupService;

beforeAll(() => {
  tmpBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vcc-bkdir-'));
  process.env.BACKUP_PATH = tmpBackupDir;
  process.env.BACKUP_ENCRYPTION_KEY = 'a'.repeat(64);
  // BACKUP_DIR 은 모듈 로드시 캡처되므로 env 설정 후 require
  backupService = require('../services/backupService');
  // 백업 파일 2개 + 비zip 1개 + 하위 디렉토리 1개
  fs.writeFileSync(path.join(tmpBackupDir, 'vcc-backup-A.zip'), 'x');
  fs.writeFileSync(path.join(tmpBackupDir, 'vcc-backup-B.zip'), 'xx');
  fs.writeFileSync(path.join(tmpBackupDir, 'notes.txt'), 'x');
  fs.mkdirSync(path.join(tmpBackupDir, 'sub'), { recursive: true });
});
afterAll(() => {
  fs.rmSync(tmpBackupDir, { recursive: true, force: true });
});

describe('#634 listServerBackupFiles', () => {
  test('.zip 파일만 목록(비zip/디렉토리 제외)', () => {
    const files = backupService.listServerBackupFiles().map((f) => f.fileName).sort();
    expect(files).toEqual(['vcc-backup-A.zip', 'vcc-backup-B.zip']);
  });
  test('size 포함', () => {
    const a = backupService.listServerBackupFiles().find((f) => f.fileName === 'vcc-backup-B.zip');
    expect(a.size).toBe(2);
  });
});

describe('#634 resolveServerBackupPath (traversal 방지)', () => {
  test('정상 파일명 → 절대경로', () => {
    const p = backupService.resolveServerBackupPath('vcc-backup-A.zip');
    expect(p).toBe(path.resolve(tmpBackupDir, 'vcc-backup-A.zip'));
  });
  test('경로 구분자/.. 포함 차단', () => {
    expect(backupService.resolveServerBackupPath('../etc/passwd')).toBeNull();
    expect(backupService.resolveServerBackupPath('sub/x.zip')).toBeNull();
    expect(backupService.resolveServerBackupPath('/abs/path.zip')).toBeNull();
  });
  test('.zip 아니면 차단', () => {
    expect(backupService.resolveServerBackupPath('notes.txt')).toBeNull();
  });
  test('존재하지 않는 파일 차단', () => {
    expect(backupService.resolveServerBackupPath('nope.zip')).toBeNull();
  });
  test('빈/비문자열 차단', () => {
    expect(backupService.resolveServerBackupPath('')).toBeNull();
    expect(backupService.resolveServerBackupPath(null)).toBeNull();
  });
});

describe('#634 isInBackupDir', () => {
  test('BACKUP_DIR 하위는 true', () => {
    expect(backupService.isInBackupDir(path.join(tmpBackupDir, 'vcc-backup-A.zip'))).toBe(true);
  });
  test('다른 경로는 false', () => {
    expect(backupService.isInBackupDir('/tmp/other/x.zip')).toBe(false);
    expect(backupService.isInBackupDir('')).toBe(false);
  });
});
