const mongoose = require('mongoose');
const { COMMERCIAL_USE, MODEL_LICENSE_LIMITS } = require('../constants/modelLicense');

// 모델 라이선스 (#1073) — 관리자가 등록하고 모델 폴더·파일에 붙인다.
//
// 모델 목록 캐시(ServerModelCache)에 넣지 않는다. 그 캐시는 동기화·캐시 비우기·옛 목록 새로고침이
// 통째로 다시 쓰고, 백업 대상도 아니다. 라이선스는 사람이 판단해 적은 것이라 동기화와 무관하게 남고
// 백업에도 들어가야 한다 (backupCollections.js).
//
// 서버를 가리지 않는다 — 경로로 붙이므로 서버가 여럿이면 폴더 배치를 맞춘다.
// 경로 하나는 라이선스 하나에만 붙는다 (라우트가 409 로 막는다).

const targetSchema = new mongoose.Schema({
  // 정규화된 상대 경로 — 끝이 `/` 면 폴더, 아니면 파일 (constants/modelLicense.js normalizeLicenseTarget)
  match: { type: String, required: true, trim: true, maxlength: MODEL_LICENSE_LIMITS.target },
}, { _id: false });

const modelLicenseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: MODEL_LICENSE_LIMITS.name },
  // 라이선스 원문 링크
  url: { type: String, trim: true, maxlength: MODEL_LICENSE_LIMITS.url, default: '' },
  commercialUse: { type: String, enum: COMMERCIAL_USE, required: true },
  note: { type: String, trim: true, maxlength: MODEL_LICENSE_LIMITS.note, default: '' },
  targets: { type: [targetSchema], default: [] },
  // 감사용 기록 — 접근 판정에 쓰지 않는다
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('ModelLicense', modelLicenseSchema);
