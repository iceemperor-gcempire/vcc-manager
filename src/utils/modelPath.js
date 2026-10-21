// 모델 경로 정규화·비교 — 라이선스 대상(#1073)과 작업판 모델 폴더 제한(#1086)이 같은 규칙을 쓴다.
//
// 경로는 ComfyUI 가 보고하는 로더 폴더 기준 상대 경로다. Windows 서버는 `minimax\file` 처럼 `\` 를
// 쓰고 대소문자를 가리지 않는다.

// 비교용 — 구분자를 `/` 로, 소문자로
const comparableModelPath = (s) => String(s || '').replace(/\\/g, '/').toLowerCase();

/**
 * 상대 경로를 저장 형태로 정규화한다.
 * - 구분자는 `/` 로, 겹친 `/` 는 하나로, 앞의 `./` 는 뗀다
 * - 절대 경로·드라이브·`..` 은 받지 않는다
 *
 * @returns {{ path: string|null, error: string|null }}
 */
function normalizeModelPath(raw, { maxLength } = {}) {
  if (typeof raw !== 'string') return { path: null, error: '경로는 문자열이어야 합니다.' };
  let path = raw.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  while (path.startsWith('./')) path = path.slice(2);
  if (!path || path === '/') return { path: null, error: '빈 경로는 쓸 수 없습니다.' };
  if (maxLength && path.length > maxLength) return { path: null, error: `경로는 ${maxLength}자 이내여야 합니다.` };
  if (path.startsWith('/') || /^[a-z]:/i.test(path)) return { path: null, error: `절대 경로는 쓸 수 없습니다: ${raw}` };
  if (path.split('/').includes('..')) return { path: null, error: `'..' 이 든 경로는 쓸 수 없습니다: ${raw}` };
  return { path, error: null };
}

module.exports = { comparableModelPath, normalizeModelPath };
