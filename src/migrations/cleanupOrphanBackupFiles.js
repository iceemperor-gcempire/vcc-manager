const fs = require('fs');
const path = require('path');

// #624 / #640: 백업 디렉토리의 임시(transient) 잔재만 정리.
// 크래시(디스크 부족 등)로 백업이 죽으면 스트리밍 임시 디렉토리(.db-tmp-*) / 추출 임시(restore-temp)가
// 정리되지 못해 남는다 — 이것들만 삭제한다.
//
// ⚠️ zip 파일은 삭제하지 않는다 (#640): 외부에서 복원용으로 넣은 백업(서버사이드 복원 #634)은
// BackupJob 레코드가 없어 "미참조"이지만 정당한 파일이다. 이전엔 미참조 zip 을 고아로 삭제했는데,
// 그게 복원용 백업을 구동/재시작 시 지워버렸다. 부분 zip(크래시 잔재) 회수 이득보다 위험이 커서 제거.
// 부분 zip 은 디스크 사전점검(#622) + UI 수동삭제로 완화.

const BACKUP_DIR = process.env.BACKUP_PATH || './backups';
const UPLOAD_DIR = process.env.UPLOAD_PATH || './uploads';
const RESTORE_TEMP_DIR = process.env.TEMP_PATH || path.join(UPLOAD_DIR, 'restore-temp');

/**
 * 순수 로직: 디렉토리 엔트리 → 삭제 대상(임시 디렉토리만). zip 은 절대 포함하지 않는다 (#640).
 * @param {{name:string,isDir:boolean}[]} entries
 */
function selectOrphans(entries) {
  const tmpDirs = [];
  for (const e of entries) {
    if (e.isDir && e.name.startsWith('.db-tmp-')) tmpDirs.push(e.name);
  }
  return { tmpDirs };
}

async function cleanupOrphanBackupFiles() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      console.log('[Migration] 백업 디렉토리 없음 — 고아 정리 불필요');
      return;
    }

    const dirents = fs.readdirSync(BACKUP_DIR, { withFileTypes: true });
    const entries = dirents.map((d) => ({ name: d.name, isDir: d.isDirectory() }));

    // 임시 디렉토리(.db-tmp-*)만 삭제. zip 은 절대 건드리지 않음 (#640).
    const { tmpDirs } = selectOrphans(entries);
    for (const d of tmpDirs) fs.rmSync(path.join(BACKUP_DIR, d), { recursive: true, force: true });

    // restore 추출 임시 디렉토리(항상 transient)도 정리
    let restoreTemps = 0;
    if (fs.existsSync(RESTORE_TEMP_DIR)) {
      for (const d of fs.readdirSync(RESTORE_TEMP_DIR)) {
        if (d.startsWith('restore-')) {
          fs.rmSync(path.join(RESTORE_TEMP_DIR, d), { recursive: true, force: true });
          restoreTemps += 1;
        }
      }
    }

    const total = tmpDirs.length + restoreTemps;
    if (total > 0) {
      console.log(`[Migration] 백업 임시 잔재 정리: .db-tmp ${tmpDirs.length} + 복원임시 ${restoreTemps} (zip 은 보존)`);
    } else {
      console.log('[Migration] 백업 임시 잔재 정리 불필요 (대상 없음)');
    }
  } catch (error) {
    console.error('[Migration] 고아 백업 파일 정리 오류:', error.message);
  }
}

cleanupOrphanBackupFiles.selectOrphans = selectOrphans; // 테스트용
module.exports = cleanupOrphanBackupFiles;
