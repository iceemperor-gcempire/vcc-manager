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

module.exports = { findLoraFolderViolation };
