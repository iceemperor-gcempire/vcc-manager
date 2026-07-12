// 작업판 export 규격 — 단일 소스 (#404 P0 에서 workboards.js 인라인에서 추출).
// 작업판 단건 export(routes/workboards.js)와 프로젝트 export(routes/projects.js)가 공용.

const WORKBOARD_EXPORT_VERSION = 1;
const APP_VERSION = { major: 1, minor: 3 };

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

module.exports = { WORKBOARD_EXPORT_VERSION, APP_VERSION, buildWorkboardExportEntry };
