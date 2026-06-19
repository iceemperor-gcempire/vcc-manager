const fs = require('fs');
const path = require('path');
const BackupJob = require('../models/BackupJob');

// #624: 백업 디렉토리의 고아 파일 정리.
// 크래시(디스크 부족 등)로 백업이 죽으면 ① 스트리밍 임시 디렉토리(.db-tmp-*)의 정리가
// 실행되지 못해 남고, ② 완료 안 된 백업의 부분 zip 은 job.filePath 에 안 박혀 UI 삭제로도
// 안 지워진다 → 디스크를 영구 점유. 부팅 시점엔 진행 중 백업이 없으므로(=in-memory 락 +
// #620 stuck 정리 이후) BackupJob 에 참조되지 않는 zip 은 안전하게 고아로 간주해 삭제한다.

const BACKUP_DIR = process.env.BACKUP_PATH || './backups';
const UPLOAD_DIR = process.env.UPLOAD_PATH || './uploads';
const RESTORE_TEMP_DIR = process.env.TEMP_PATH || path.join(UPLOAD_DIR, 'restore-temp');

/**
 * 순수 로직: 디렉토리 엔트리 + 참조된 파일명 집합 → 삭제 대상 분류.
 * @param {{name:string,isDir:boolean}[]} entries
 * @param {Set<string>} referenced  BackupJob 가 참조하는 basename 집합
 */
function selectOrphans(entries, referenced) {
  const tmpDirs = [];
  const zips = [];
  for (const e of entries) {
    if (e.isDir) {
      if (e.name.startsWith('.db-tmp-')) tmpDirs.push(e.name);
    } else if (e.name.endsWith('.zip') && !referenced.has(e.name)) {
      zips.push(e.name);
    }
  }
  return { tmpDirs, zips };
}

async function cleanupOrphanBackupFiles() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      console.log('[Migration] 백업 디렉토리 없음 — 고아 정리 불필요');
      return;
    }

    const dirents = fs.readdirSync(BACKUP_DIR, { withFileTypes: true });
    const entries = dirents.map((d) => ({ name: d.name, isDir: d.isDirectory() }));

    const jobs = await BackupJob.find({}).select('fileName filePath').lean();
    const referenced = new Set();
    for (const j of jobs) {
      if (j.fileName) referenced.add(j.fileName);
      if (j.filePath) referenced.add(path.basename(j.filePath));
    }

    const { tmpDirs, zips } = selectOrphans(entries, referenced);
    for (const d of tmpDirs) fs.rmSync(path.join(BACKUP_DIR, d), { recursive: true, force: true });
    for (const z of zips) fs.rmSync(path.join(BACKUP_DIR, z), { force: true });

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

    const total = tmpDirs.length + zips.length + restoreTemps;
    if (total > 0) {
      console.log(`[Migration] 고아 백업 파일 정리: 임시디렉토리 ${tmpDirs.length} + 미참조 zip ${zips.length} + 복원임시 ${restoreTemps}`);
    } else {
      console.log('[Migration] 고아 백업 파일 정리 불필요 (대상 없음)');
    }
  } catch (error) {
    console.error('[Migration] 고아 백업 파일 정리 오류:', error.message);
  }
}

cleanupOrphanBackupFiles.selectOrphans = selectOrphans; // 테스트용
module.exports = cleanupOrphanBackupFiles;
