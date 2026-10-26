// 프롬프트의 LoRA 태그(`<lora:이름:가중치>`)를 LoRA 파일로 푼다 (#1099).
//
// vcc 는 LoRA 를 프롬프트 태그로 넘기고, ComfyUI 의 LoRA 태그 로더(comfyui_lora_tag_loader 의
// LoraTagLoader)가 태그를 읽어 파일을 고른다. 판의 LoRA 폴더 제한을 실행 전에 판단하려면 로더가
// 고를 파일을 똑같이 골라야 한다 — 그래서 규칙을 로더 구현 그대로 옮긴다:
//
// - 태그 모양: `<` 와 `>` 사이가 영숫자·`:` `_` `-` `.` 공백 `/` `(` `)` `\` 로만 이루어진 것
// - `:` 로 나눈 첫 조각이 정확히 `lora`, 둘째 조각(이름)이 비어 있지 않을 것
// - 파일: 서버 LoRA 목록(ComfyUI 는 정렬된 목록을 준다)에서 파일 이름이 태그 이름으로 **시작하는**
//   첫 파일, 또는 경로가 태그 이름으로 시작하는 첫 파일. 대소문자를 가린다
//
// 로더는 가중치를 숫자로 못 읽으면 그 태그를 건너뛰지만, 여기서는 이름이 있으면 모두 대상으로 본다 —
// 폴더 밖 LoRA 를 적은 태그는 가중치와 상관없이 판에 맞지 않는 입력이다.

const TAG_RE = /<[0-9a-zA-Z:_\-.\s/()\\]+>/g;

/** 프롬프트의 LoRA 태그 이름들 (나온 순서, 중복 포함) */
function extractLoraTagNames(text) {
  if (typeof text !== 'string' || !text) return [];
  const names = [];
  for (const m of text.matchAll(TAG_RE)) {
    const parts = m[0].slice(1, -1).split(':');
    if (parts[0] !== 'lora') continue;
    if (parts.length > 1 && parts[1].length > 0) names.push(parts[1]);
  }
  return names;
}

// 경로의 파일 이름 — Windows ComfyUI 는 `style\openmoss\file` 로 준다
const basenameOf = (p) => String(p).split(/[/\\]/).pop();

/**
 * 태그 이름으로 로더가 고를 파일.
 * @param {string} name — 태그 이름
 * @param {string[]} filenames — 서버 LoRA 목록
 * @returns {string|null} 못 찾으면 null (로더도 그 태그를 건너뛴다)
 */
function resolveLoraTag(name, filenames) {
  if (!name || !Array.isArray(filenames)) return null;
  const sorted = [...filenames].filter((f) => typeof f === 'string').sort();
  for (const file of sorted) {
    if (basenameOf(file).startsWith(name) || file.startsWith(name)) return file;
  }
  return null;
}

module.exports = { extractLoraTagNames, resolveLoraTag };
