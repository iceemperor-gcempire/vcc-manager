// 판의 LoRA 폴더 밖의 LoRA 태그로 들어온 실행을 막는다 (#1099).
//
// LoRA 선택 목록은 판의 폴더 제한으로 걸러지지만, 프롬프트에 태그를 직접 적거나 API·MCP 로 부르면
// 목록을 거치지 않는다. 계열이 다른 LoRA 는 ComfyUI 가 `lora key not loaded` 를 로그에만 남기고
// LoRA 없이 그려서, 사용자는 LoRA 가 걸린 줄 안다. 태그는 LoRA 태그 로더와 같은 규칙으로 파일로 푼다
// (utils/loraTags). 서버 LoRA 목록에 없는 이름은 판단할 파일이 없어 막지 않는다.

const ServerLoraCache = require('../models/ServerLoraCache');
const { isInModelFolders } = require('../utils/modelFolders');
const { extractLoraTagNames, resolveLoraTag } = require('../utils/loraTags');

/**
 * @param {Object} workboard — allowedLoraFolders · serverId 를 가진 작업판
 * @param {string} prompt — LoRA 태그가 들어가는 프롬프트
 * @param {{ loraFilenames?: string[] }} [opts] — 서버 LoRA 목록 (없으면 서버 LoRA 캐시에서 읽는다)
 * @returns {Promise<string|null>} 막을 때 사용자에게 보일 메시지, 통과면 null
 */
async function findLoraFolderViolation(workboard, prompt, { loraFilenames } = {}) {
  const folders = workboard && workboard.allowedLoraFolders;
  if (!Array.isArray(folders) || folders.length === 0) return null;
  const names = extractLoraTagNames(prompt);
  if (names.length === 0) return null;

  let filenames = loraFilenames;
  if (!filenames) {
    const serverId = workboard.serverId && workboard.serverId._id ? workboard.serverId._id : workboard.serverId;
    if (!serverId) return null;
    const cache = await ServerLoraCache.findOne({ serverId }).select('loraModels.filename').lean();
    filenames = (cache && cache.loraModels ? cache.loraModels : []).map((l) => l.filename);
  }

  const outside = [];
  for (const name of names) {
    const file = resolveLoraTag(name, filenames);
    if (file && !isInModelFolders(file, folders) && !outside.includes(file)) outside.push(file);
  }
  if (outside.length === 0) return null;
  return `이 작업판은 ${folders.join(', ')} 폴더의 LoRA 만 쓸 수 있습니다 (받은 LoRA: ${outside.join(', ')}). LoRA 목록에서 다시 골라 주세요.`;
}

const valueOf = (v) => (v && typeof v === 'object' && v.value !== undefined ? v.value : v);

/**
 * `lora` 타입 입력 칸의 값이 판의 LoRA 폴더 밖이면 막는다 (#1157).
 * 칸 값은 파일 경로 그대로라 서버 LoRA 목록 없이 판단한다. 판에 칸이 여럿이면 모두 본다.
 *
 * @param {Object} workboard — allowedLoraFolders · additionalInputFields 를 가진 작업판
 * @param {Object} inputLike — 작업 입력 (top-level 또는 additionalParams 에 칸 값)
 * @returns {string|null} 막을 때 사용자에게 보일 메시지, 통과면 null
 */
function findLoraFieldViolation(workboard, inputLike) {
  const folders = workboard && workboard.allowedLoraFolders;
  if (!Array.isArray(folders) || folders.length === 0) return null;
  const input = inputLike || {};
  const params = input.additionalParams || {};
  for (const field of workboard.additionalInputFields || []) {
    if (!field || field.type !== 'lora' || !field.name) continue;
    const raw = Object.prototype.hasOwnProperty.call(input, field.name) ? input[field.name] : params[field.name];
    const file = valueOf(raw);
    if (!file || typeof file !== 'string') continue; // 비었으면 LoRA 를 걸지 않는다
    if (isInModelFolders(file, folders)) continue;
    return `이 작업판의 「${field.label || field.name}」 칸에는 ${folders.join(', ')} 폴더의 LoRA 만 쓸 수 있습니다 (받은 LoRA: ${file}). LoRA 목록에서 다시 골라 주세요.`;
  }
  return null;
}

module.exports = { findLoraFolderViolation, findLoraFieldViolation };
