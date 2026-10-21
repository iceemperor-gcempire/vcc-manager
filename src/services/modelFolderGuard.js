// 판의 모델 폴더 밖의 베이스 모델로 들어온 실행을 막는다 (#1086).
//
// 모델 선택 목록은 판의 폴더 제한으로 걸러지지만, API·MCP 호출과 예전 작업의 재시도는 목록을 거치지
// 않는다. 짝이 안 맞는 모델이 ComfyUI 까지 가면 원인을 알기 어려운 오류로 실패한다(10-20 Qwen 판에
// Z-Image 모델이 들어가 normalized_shape 오류). 판단은 파일 경로만으로 한다 — 모델 종류 제한은
// Civitai 정보가 없으면 판단할 수 없어 여기서 막지 않는다.

const { getFieldValueByRole } = require('../utils/customFieldHelpers');
const { FIELD_ROLES } = require('../constants/fieldRoles');
const { isInModelFolders } = require('../utils/modelFolders');

const valueOf = (v) => (v && typeof v === 'object' && v.value !== undefined ? v.value : v);

/**
 * @param {Object} workboard — allowedModelFolders · additionalInputFields 를 가진 작업판
 * @param {Object} inputLike — 작업 입력 (top-level 또는 additionalParams 에 베이스 모델 값)
 * @returns {string|null} 막을 때 사용자에게 보일 메시지, 통과면 null
 */
function findModelFolderViolation(workboard, inputLike) {
  const folders = workboard && workboard.allowedModelFolders;
  if (!Array.isArray(folders) || folders.length === 0) return null;
  if (!(workboard.additionalInputFields || []).some((f) => f.type === 'baseModel')) return null;
  // 워크플로에 실제로 들어갈 값 — queueService 도 같은 조회로 {{##base_model##}} 을 채운다
  const input = inputLike || {};
  const model = valueOf(getFieldValueByRole(workboard, input, FIELD_ROLES.MODEL)) || valueOf(input.aiModel);
  if (!model || typeof model !== 'string') return null; // 비었으면 필수값 검사가 막는다
  if (isInModelFolders(model, folders)) return null;
  return `이 작업판은 ${folders.join(', ')} 폴더의 모델만 쓸 수 있습니다 (받은 모델: ${model}). 모델 선택 목록에서 다시 골라 주세요.`;
}

module.exports = { findModelFolderViolation };
