// 작업판 export 규격 — 단일 소스 (#404 P0 에서 workboards.js 인라인에서 추출).
// 작업판 단건 export(routes/workboards.js)와 프로젝트 export(routes/projects.js)가 공용.

const WORKBOARD_EXPORT_VERSION = 1;

// 앱 버전은 package.json 을 단일 소스로 삼는다 (#779).
// 이전에는 `{ major: 1, minor: 3 }` 이 하드코딩돼 있었다. export 와 import 가 같은 상수를
// 참조하므로 경고가 뜨지는 않았지만, 두 가지가 문제였다:
//   1. 내보낸 파일에 실제와 다른 버전(v1.3)이 박힌다 — 배포용 파일에는 치명적
//   2. routes/workboards.js 의 메이저 호환성 검사가 죽은 코드가 된다 (항상 자기 자신과 비교)
// 릴리스 시 package.json 의 version 을 갱신하면 여기도 따라온다.
const { version: PKG_VERSION } = require('../../package.json');

function parseAppVersion(v) {
  const [major, minor] = String(v || '').split('.').map((n) => parseInt(n, 10));
  return {
    major: Number.isFinite(major) ? major : 0,
    minor: Number.isFinite(minor) ? minor : 0,
  };
}

const APP_VERSION = parseAppVersion(PKG_VERSION);

// 작업판 문서 → export entry. allowedGroupIds 는 제외 — ObjectId 가 instance 간
// 매칭되지 않아 import 시 기본 그룹 자동 할당이 안전한 default (#기존 규격 유지).
function buildWorkboardExportEntry(workboard, server) {
  return {
    workboard: {
      name: workboard.name,
      description: workboard.description,
      workboardType: workboard.workboardType,
      outputFormat: workboard.outputFormat,
      additionalInputFields: workboard.additionalInputFields,
      workflowData: workboard.workflowData,
      allowedModelTypes: workboard.allowedModelTypes || [],
      modelExposurePolicy: workboard.modelExposurePolicy || 'full',
      modelWhitelist: workboard.modelWhitelist || [],
      loraExposurePolicy: workboard.loraExposurePolicy || 'full',
      loraWhitelist: workboard.loraWhitelist || [],
      version: workboard.version,
    },
    server: server ? { name: server.name, serverType: server.serverType } : null,
  };
}

module.exports = { WORKBOARD_EXPORT_VERSION, APP_VERSION, buildWorkboardExportEntry, parseAppVersion };
