const pkg = require('../../package.json');
const { APP_VERSION, parseAppVersion, WORKBOARD_EXPORT_VERSION } = require('../utils/workboardExport');

// #779 — 이전에는 APP_VERSION 이 { major: 1, minor: 3 } 으로 하드코딩돼 있었다.
// export/import 가 같은 상수를 참조해 경고는 안 떴지만, 내보낸 파일에 실제와 다른 버전이
// 박히고 메이저 호환성 검사가 죽은 코드가 됐다. package.json 을 단일 소스로 삼는다.

describe('workboardExport APP_VERSION (#779)', () => {
  test('package.json 의 version 에서 파생된다', () => {
    const [major, minor] = pkg.version.split('.').map(Number);
    expect(APP_VERSION).toEqual({ major, minor });
  });

  test('하드코딩된 옛 값(1.3)이 아니다', () => {
    expect(APP_VERSION).not.toEqual({ major: 1, minor: 3 });
  });

  test('메이저는 실제 릴리스 대와 일치 (v3.x)', () => {
    expect(APP_VERSION.major).toBeGreaterThanOrEqual(3);
  });

  describe('parseAppVersion', () => {
    test('semver 문자열 파싱', () => {
      expect(parseAppVersion('3.16.1')).toEqual({ major: 3, minor: 16 });
      expect(parseAppVersion('10.0.0')).toEqual({ major: 10, minor: 0 });
    });

    test('비정상 입력은 0으로 — export 가 죽지 않도록', () => {
      expect(parseAppVersion('')).toEqual({ major: 0, minor: 0 });
      expect(parseAppVersion(null)).toEqual({ major: 0, minor: 0 });
      expect(parseAppVersion('abc')).toEqual({ major: 0, minor: 0 });
    });
  });

  test('export 규격 버전은 앱 버전과 별개로 유지된다', () => {
    expect(WORKBOARD_EXPORT_VERSION).toBe(1);
  });
});
