const Workboard = require('../models/Workboard');

// #199 Phase F4: baseInputFields 와 additionalInputFields[].role 을 모든 작업판에서 $unset.
//
// Phase B/C/D 의 마이그레이션이 이미 데이터를 additionalInputFields 의 type=baseModel/lora 등으로 이전 완료.
// role 필드는 Phase D 에서 admin UI 가 제거되고 helper 가 type 기반 추론으로 대체됨.
// 이 마이그레이션은 mongoose 스키마에서 필드 자체가 제거된 후 DB 에 남은 잔존 데이터를 정리.
//
// 멱등 — modifiedCount 가 0 이면 skip 로그.

async function dropBaseInputFieldsSchema() {
  try {
    // 1) baseInputFields 통째로 unset
    const baseResult = await Workboard.collection.updateMany(
      { baseInputFields: { $exists: true } },
      { $unset: { baseInputFields: '' } }
    );

    // 2) 모든 additionalInputFields[].role 필드 unset
    const roleResult = await Workboard.collection.updateMany(
      { 'additionalInputFields.role': { $exists: true } },
      { $unset: { 'additionalInputFields.$[].role': '' } }
    );

    if (baseResult.modifiedCount > 0 || roleResult.modifiedCount > 0) {
      console.log(`[Migration] baseInputFields drop — ${baseResult.modifiedCount}건, customField.role drop — ${roleResult.modifiedCount}건`);
    } else {
      console.log('[Migration] baseInputFields / role drop 불필요 (모두 정리됨)');
    }
  } catch (error) {
    console.error('[Migration] baseInputFields schema drop 오류:', error);
  }
}

module.exports = dropBaseInputFieldsSchema;
