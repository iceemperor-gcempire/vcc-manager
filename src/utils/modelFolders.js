// 작업판 모델 폴더 제한 (#1086).
//
// 판이 쓸 수 있는 베이스 모델을 폴더로 정한다 (예: `qwen/`). 모델 종류 제한(allowedModelTypes)은
// Civitai 분류로 걸러서 Civitai 에 없는 파일(Comfy-Org·Hugging Face 공식 파일)을 판단하지 못한다.
// 폴더는 파일 이름만으로 판단되므로 출처와 상관없이 쓸 수 있고, 서버가 실행을 거절하는 근거도 된다.
//
// - 빈 목록이면 폴더로 거르지 않는다
// - 폴더 아래 하위 폴더도 포함한다
// - 경로 구분자(`/`·`\`)와 대소문자는 가리지 않는다 (Windows ComfyUI 는 `qwen\file` 로 준다)

const { comparableModelPath, normalizeModelPath } = require('./modelPath');

const MODEL_FOLDER_LIMITS = Object.freeze({
  count: 20, // 판 하나에 두는 폴더 수
  length: 200, // 폴더 경로 하나의 길이
});

/**
 * 폴더 하나를 저장 형태(`qwen/`, 끝은 항상 `/`)로 정규화한다.
 * @returns {{ folder: string|null, error: string|null }}
 */
function normalizeModelFolder(raw) {
  const { path, error } = normalizeModelPath(raw, { maxLength: MODEL_FOLDER_LIMITS.length });
  if (error) return { folder: null, error };
  return { folder: path.endsWith('/') ? path : `${path}/`, error: null };
}

/**
 * 폴더 목록을 정규화한다. 같은 폴더(대소문자·구분자만 다른 것 포함)는 하나만 남긴다.
 * @returns {{ folders: string[], errors: string[] }}
 */
function normalizeModelFolders(list) {
  if (list === undefined || list === null) return { folders: [], errors: [] };
  if (!Array.isArray(list)) return { folders: [], errors: ['모델 폴더는 목록이어야 합니다.'] };
  const folders = [];
  const errors = [];
  const seen = new Set();
  for (const raw of list) {
    const { folder, error } = normalizeModelFolder(raw);
    if (error) { errors.push(error); continue; }
    const key = comparableModelPath(folder);
    if (seen.has(key)) continue;
    seen.add(key);
    folders.push(folder);
  }
  if (folders.length > MODEL_FOLDER_LIMITS.count) {
    errors.push(`모델 폴더는 ${MODEL_FOLDER_LIMITS.count}개까지 둘 수 있습니다.`);
  }
  return { folders, errors };
}

/** 모델 파일이 폴더 목록 안에 있는가. 목록이 비면 항상 true */
function isInModelFolders(filename, folders) {
  if (!Array.isArray(folders) || folders.length === 0) return true;
  const file = comparableModelPath(filename);
  if (!file) return false;
  return folders.some((d) => {
    const dir = comparableModelPath(d);
    return dir && file.startsWith(dir.endsWith('/') ? dir : `${dir}/`);
  });
}

/**
 * 모델 파일 목록에서 폴더 후보를 뽑는다 — 편집기의 입력 후보용. 하위 폴더도 각각 후보가 된다.
 * 표시는 처음 본 철자를 쓰되 `/` 로 맞춘다.
 */
function foldersOfModels(filenames) {
  const out = new Map();
  for (const name of filenames || []) {
    const parts = String(name || '').replace(/\\/g, '/').split('/');
    parts.pop(); // 파일 이름
    let prefix = '';
    for (const part of parts) {
      if (!part) continue;
      prefix += `${part}/`;
      const key = prefix.toLowerCase();
      if (!out.has(key)) out.set(key, prefix);
    }
  }
  return [...out.values()].sort((a, b) => a.localeCompare(b));
}

module.exports = {
  MODEL_FOLDER_LIMITS,
  normalizeModelFolder,
  normalizeModelFolders,
  isInModelFolders,
  foldersOfModels,
};
