/**
 * 백업 파일 디렉토리 단일 소스 (#805)
 *
 * backupService 와 restoreService 가 각자 배열을 하드코딩하고 있어서, 오디오 축을
 * 추가할 때 collections 만 챙기고 파일 디렉토리를 놓쳤다. 문서는 백업되는데 파일이
 * 빠져 **복원 시 오디오가 전부 깨지는** 상태였다.
 *
 * 미디어를 저장하는 모델이 늘면 그 저장 디렉토리도 여기 들어와야 한다.
 */
const fs = require('fs');
const path = require('path');
const { BACKUP_FILE_DIRS } = require('../services/backupCollections');

describe('백업 파일 디렉토리 (#805)', () => {
  test('생성물·업로드본 저장 디렉토리를 모두 포함', () => {
    // queueService 의 subDir 매핑(generated/videos/audios)과 업로드 경로(reference)
    expect([...BACKUP_FILE_DIRS].sort()).toEqual(['audios', 'generated', 'reference', 'videos']);
  });

  test('backupService 와 restoreService 가 배열을 다시 하드코딩하지 않는다', () => {
    for (const file of ['backupService.js', 'restoreService.js']) {
      const src = fs.readFileSync(path.join(__dirname, '..', 'services', file), 'utf8');
      expect(src).toContain('BACKUP_FILE_DIRS');
      // 예전처럼 리터럴 배열을 다시 만들면 같은 사고가 재발한다
      expect(src).not.toMatch(/\[\s*'generated'\s*,\s*'reference'\s*,\s*'videos'\s*\]/);
    }
  });

  test('생성물 저장 디렉토리와 업로드 디렉토리가 모두 백업 대상이다', () => {
    // 예전에는 queueService 소스에서 리터럴을 정규식으로 긁어 대조했는데, #808 에서
    // 양쪽 모두 constants/mediaTypes 파생으로 바뀌어 상수끼리 직접 비교한다.
    const { GENERATED_MEDIA_DIRS, UPLOAD_MEDIA_DIR } = require('../constants/mediaTypes');
    for (const dir of Object.values(GENERATED_MEDIA_DIRS)) {
      expect(BACKUP_FILE_DIRS).toContain(dir);
    }
    expect(BACKUP_FILE_DIRS).toContain(UPLOAD_MEDIA_DIR);
  });

  test('무결성 검사 대상 서브디렉토리가 백업 대상과 일치', () => {
    // 백업에는 들어가는데 무결성 검사에서 빠지면 고아 파일을 영영 못 찾는다
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'integrityService.js'), 'utf8');
    expect(src).toMatch(/CHECKED_SUBDIRS = BACKUP_FILE_DIRS/);
  });
});
