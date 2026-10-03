/**
 * 버전 업데이트 공지 (#999) — 어떤 업데이트 로그 섹션을 보여줄지 판정한다.
 *
 * 내용 출처는 docs/updatelogs/v{major}.md 의 "## vX.Y.Z" 섹션이다. 공지 전용 문구를 따로 두지 않는다.
 * 현재 버전의 기준은 package.json (프런트 config 에는 major/minor 만 있어 패치를 가리지 못한다).
 */

// 업데이트 로그에 이 소제목이 있으면 공지에서 강조한다
const ACTION_HEADING = /^###\s+기존 사용자가 할 일/m;

// 오래 안 들어온 사용자에게 보여줄 최대 섹션 수
const MAX_SECTIONS = 5;

function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '').trim());
  return m ? m.slice(1).map(Number) : null;
}

/** a < b → 음수, 같으면 0, a > b → 양수. 해석 못 하는 값은 가장 작게 본다. */
function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/** 업데이트 로그 마크다운 → [{ version, markdown }] ("## vX.Y.Z" 단위, 문서 순서 그대로) */
function extractSections(markdown) {
  const lines = String(markdown || '').split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = /^##\s+v(\d+\.\d+\.\d+)\s*$/.exec(line);
    if (m) {
      if (current) sections.push(current);
      current = { version: m[1], lines: [line] };
    } else if (/^##\s/.test(line)) {
      // 버전이 아닌 h2 를 만나면 섹션을 닫는다
      if (current) sections.push(current);
      current = null;
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections.map(({ version, lines: ls }) => ({ version, markdown: ls.join('\n').trim() }));
}

function hasActionItems(markdown) {
  return ACTION_HEADING.test(markdown || '');
}

/**
 * 보여줄 섹션을 고른다.
 * - lastSeen 이 current 이상이면 아무것도 안 보여준다
 * - lastSeen 이 없으면(기능 도입 전부터 있던 계정) 현재 버전 섹션만
 * - 아니면 lastSeen < v <= current 를 최신순으로, 최대 MAX_SECTIONS 개 — 넘치면 truncated
 *
 * @param {{ current: string, lastSeen?: string, sections: {version: string, markdown: string}[], max?: number }} args
 */
function pickNoticeSections({ current, lastSeen, sections, max = MAX_SECTIONS }) {
  if (lastSeen && compareVersions(lastSeen, current) >= 0) return { show: false, sections: [], truncated: false };

  const inRange = sections
    .filter((s) => compareVersions(s.version, current) <= 0)
    .filter((s) => (lastSeen ? compareVersions(s.version, lastSeen) > 0 : s.version === current))
    .sort((a, b) => compareVersions(b.version, a.version));

  const picked = inRange.slice(0, max).map((s) => ({ ...s, hasActionItems: hasActionItems(s.markdown) }));
  return { show: picked.length > 0, sections: picked, truncated: inRange.length > picked.length };
}

module.exports = {
  MAX_SECTIONS,
  parseVersion,
  compareVersions,
  extractSections,
  hasActionItems,
  pickNoticeSections,
};
