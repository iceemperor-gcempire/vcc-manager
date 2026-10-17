// 모델 라이선스 (#1073) — 관리자가 라이선스를 등록하고 모델 폴더·파일에 붙인다.
//
// 값 목록·길이 상한의 단일 source. frontend/src/constants/modelLicense.js 는 mirror (모듈 시스템이
// 달라 직접 import 불가) — 바꾸면 양쪽 모두 갱신 (modelLicense.test.js 가 어긋남을 잡는다).
// 화면 문구(가능·조건부·불가)는 프런트가 정한다.
//
// 라이선스 조건을 제품에 미리 넣어 두지 않는다 — 요약이 틀리면 설치한 쪽이 그대로 믿게 된다.

// 상업적 이용
const COMMERCIAL_USE = ['allowed', 'conditional', 'prohibited'];

const MODEL_LICENSE_LIMITS = {
  name: 100,
  url: 500,
  note: 200,
  targets: 50, // 라이선스 하나에 붙이는 폴더·파일 수
  target: 300, // 경로 하나의 길이
};

/**
 * 붙일 대상(폴더 또는 파일 경로)을 저장 형태로 정규화한다.
 * - 구분자는 `/` 로 (Windows ComfyUI 는 `minimax\` 처럼 준다)
 * - **끝이 `/` 면 폴더** — 그 아래 모든 파일(하위 폴더 포함). 아니면 파일 하나
 * - 절대 경로·드라이브·`..` 은 받지 않는다 — 대상은 ComfyUI 가 보고하는 로더 폴더 기준 상대 경로다
 *
 * @returns {{ match: string|null, error: string|null }}
 */
function normalizeLicenseTarget(raw) {
  if (typeof raw !== 'string') return { match: null, error: '경로는 문자열이어야 합니다.' };
  let match = raw.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  while (match.startsWith('./')) match = match.slice(2);
  if (!match || match === '/') return { match: null, error: '빈 경로는 붙일 수 없습니다.' };
  if (match.length > MODEL_LICENSE_LIMITS.target) return { match: null, error: `경로는 ${MODEL_LICENSE_LIMITS.target}자 이내여야 합니다.` };
  if (match.startsWith('/') || /^[a-z]:/i.test(match)) return { match: null, error: `절대 경로는 붙일 수 없습니다: ${raw}` };
  if (match.split('/').includes('..')) return { match: null, error: `'..' 이 든 경로는 붙일 수 없습니다: ${raw}` };
  return { match, error: null };
}

// 비교용 — Windows 서버의 경로는 대소문자를 가리지 않는다
const comparable = (s) => String(s || '').replace(/\\/g, '/').toLowerCase();

/**
 * 모델 파일에 붙은 라이선스를 찾는다. 파일로 붙인 것이 폴더보다, 깊은 폴더가 얕은 폴더보다 우선한다.
 * 로더 폴더(checkpoints / diffusion_models)는 가리지 않는다 — 같은 경로면 같은 라이선스다.
 *
 * @param {string} filename ComfyUI 가 보고하는 모델 경로 (예: `minimax\minimax_h3_fl2va_int8_convrot.safetensors`)
 * @param {Array<{ _id, name, url, commercialUse, note, targets: Array<{ match: string }> }>} licenses
 * @returns {{ licenseId, name, url, commercialUse, note, matchedBy: 'file'|'folder', target: string } | null}
 */
function resolveModelLicense(filename, licenses) {
  const file = comparable(filename);
  if (!file) return null;
  let best = null;
  for (const lic of licenses || []) {
    for (const t of lic.targets || []) {
      const target = comparable(t.match);
      if (!target) continue;
      const isFolder = target.endsWith('/');
      let score;
      if (!isFolder && file === target) score = Infinity;
      else if (isFolder && file.startsWith(target)) score = target.length;
      else continue;
      if (!best || score > best.score) best = { score, lic, target: t.match, isFolder };
    }
  }
  if (!best) return null;
  const { lic } = best;
  return {
    licenseId: String(lic._id),
    name: lic.name,
    url: lic.url || '',
    commercialUse: lic.commercialUse,
    note: lic.note || '',
    matchedBy: best.isFolder ? 'folder' : 'file',
    target: best.target,
  };
}

module.exports = {
  COMMERCIAL_USE,
  MODEL_LICENSE_LIMITS,
  normalizeLicenseTarget,
  resolveModelLicense,
  comparableLicenseTarget: comparable,
};
