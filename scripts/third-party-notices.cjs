#!/usr/bin/env node
/**
 * 오픈소스 라이선스 고지 (#1063).
 *
 *   node scripts/third-party-notices.cjs notice --out <파일> [--title <이름>] [--system "<한 줄>"]...
 *     현재 디렉터리 프로젝트의 운영 의존성 고지 원문을 만든다. Docker 빌드에서 부른다.
 *     라이선스 검토는 하지 않는다 — 설치자의 빌드를 멈추지 않는다 (플랫폼별 바이너리 이름이 환경마다 다르다).
 *
 *   node scripts/third-party-notices.cjs update      (pnpm run licenses:update)
 *     백엔드·프런트·MCP 를 검사해 docs/THIRD_PARTY_LICENSES.md 를 다시 만든다. 릴리스 전 절차.
 *     허용형 목록 밖 라이선스가 검토 목록(scripts/third-party-license-review.json)에 없으면 실패한다.
 *
 * 의존성 목록은 `pnpm licenses list --prod --json`, 원문은 각 패키지 폴더의 LICENSE·NOTICE 파일
 * (없으면 README 의 License 절)에서 읽는다. 새 의존성을 쓰지 않는다.
 *
 * 확장자가 .cjs 인 것은 "type": "module" 패키지(mcp-server) 안에 복사돼도 CommonJS 로 돌게 하려는 것이다.
 *
 * CRA 시절에는 webpack 이 번들마다 *.js.LICENSE.txt 를 만들었는데 #526 Vite 전환 때 사라졌다.
 * 그 빠짐을 아무도 몰라서 이 파일과 릴리스 절차를 함께 둔다.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REVIEW_FILE = path.join(__dirname, 'third-party-license-review.json');
const DOC_FILE = path.join(ROOT, 'docs', 'THIRD_PARTY_LICENSES.md');

// 고지만 하면 되는 허용형 라이선스 (SPDX). 이 밖은 검토 목록에 판단을 남겨야 update 가 통과한다.
const PERMISSIVE = new Set([
  'MIT', 'MIT-0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD',
  'BlueOak-1.0.0', 'Unlicense', 'CC0-1.0', 'Zlib',
]);

// 문서에 싣는 구성 — dir 는 저장소 루트 기준
const COMPONENTS = [
  { key: 'backend', label: '백엔드', dir: '.' },
  { key: 'frontend', label: '웹 화면', dir: 'frontend' },
  { key: 'mcp', label: 'MCP 서버', dir: 'mcp-server' },
];

/** `pnpm licenses list --json` 결과(라이선스별 묶음)를 이름순 목록으로 편다. */
function flattenLicenses(json) {
  const out = [];
  for (const [license, pkgs] of Object.entries(json || {})) {
    for (const p of pkgs) {
      out.push({
        name: p.name,
        versions: p.versions || (p.version ? [p.version] : []),
        paths: p.paths || (p.path ? [p.path] : []),
        license: p.license || license,
        author: p.author || '',
        homepage: p.homepage || '',
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const licenseOf = (pj) => (typeof pj.license === 'string' ? pj.license : pj.license && pj.license.type) || 'Unknown';
const authorOf = (pj) => (typeof pj.author === 'string' ? pj.author.replace(/\s*[<(].*$/, '') : (pj.author && pj.author.name) || '');

/**
 * 목록에 오른 패키지의 선택 의존성(optionalDependencies) 중 실제로 설치된 것을 보탠다.
 * `pnpm licenses list` 가 Alpine(musl) 이미지에서 플랫폼별 바이너리 — sharp 의 libvips(LGPL),
 * msgpackr-extract 바이너리 — 를 빠뜨린다. 설치는 돼 있으므로 pnpm 폴더 배치에서 직접 찾는다:
 * `.pnpm/<pkg>@<ver>/node_modules/<pkg>` 의 의존성은 같은 `node_modules/` 아래에 있다.
 */
function addInstalledOptional(pkgs) {
  const names = new Set(pkgs.map((p) => p.name));
  const queue = [...pkgs];
  const added = [];
  while (queue.length) {
    const p = queue.shift();
    for (const dir of p.paths) {
      let pj;
      try { pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { continue; }
      const suffix = `${path.sep}${p.name.split('/').join(path.sep)}`;
      if (!dir.endsWith(suffix)) continue;
      const nodeModules = dir.slice(0, -suffix.length);
      for (const dep of Object.keys(pj.optionalDependencies || {})) {
        if (names.has(dep)) continue;
        const depDir = path.join(nodeModules, ...dep.split('/'));
        let dpj;
        try { dpj = JSON.parse(fs.readFileSync(path.join(depDir, 'package.json'), 'utf8')); } catch { continue; } // 이 플랫폼에는 안 깔림
        const np = {
          name: dpj.name, versions: [dpj.version], paths: [fs.realpathSync(depDir)],
          license: licenseOf(dpj), author: authorOf(dpj), homepage: dpj.homepage || '',
        };
        names.add(np.name);
        pkgs.push(np);
        added.push(np);
        queue.push(np);
      }
    }
  }
  pkgs.sort((a, b) => a.name.localeCompare(b.name));
  return added;
}

function listLicenses(cwd) {
  const raw = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
    cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
  });
  const pkgs = flattenLicenses(JSON.parse(raw));
  const added = addInstalledOptional(pkgs);
  console.log(`[licenses] ${path.basename(path.resolve(cwd))}: pnpm 목록 ${pkgs.length - added.length}개 + 목록에 없던 설치된 선택 의존성 ${added.length}개${added.length ? ` (${added.map((p) => p.name).join(', ')})` : ''}`);
  return pkgs;
}

// LICENSE, LICENSE.md, LICENSE-MIT, MIT-LICENSE.txt, COPYING … (코드 파일은 뺀다)
const LICENSE_FILE = /^([^.]*[-_])?(licen[sc]e|copying|unlicense)([-_][^.]*)?(\.(txt|md|markdown|rst|mit|apache2?|bsd))?$/i;
const NOTICE_FILE = /^notice(\.(txt|md))?$/i;

const LICENSE_HEADING = /^licen[sc](e|es|ing)\b/i;

/** 제목 수준 — ATX(`## License`)는 # 개수, 밑줄형(`License` + `-----`/`=====`)은 1·2. 제목이 아니면 0. */
function headingAt(lines, i) {
  const l = lines[i].trim();
  const atx = l.match(/^(#{1,6})\s+(.*)$/);
  if (atx) return { level: atx[1].length, text: atx[2], span: 1 };
  const next = (lines[i + 1] || '').trim();
  if (l && /^=+$/.test(next)) return { level: 1, text: l, span: 2 };
  if (l && /^-+$/.test(next) && !/^[-*|]/.test(l)) return { level: 2, text: l, span: 2 };
  return null;
}

/** README 의 License 절 — 다음 같은 수준 이상의 제목 전까지. 없으면 null. */
function readmeLicenseSection(text) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const h = headingAt(lines, i);
    if (!h || !LICENSE_HEADING.test(h.text)) continue;
    let end = lines.length;
    for (let j = i + h.span; j < lines.length; j++) {
      const n = headingAt(lines, j);
      if (n && n.level <= h.level) { end = j; break; }
    }
    const body = lines.slice(i + h.span, end).join('\n').trim();
    if (body) return body;
  }
  return null;
}

/**
 * 패키지 폴더에서 라이선스 원문을 찾는다.
 * @returns {{ text: string|null, source: 'file'|'readme'|null, notice: string|null }}
 */
function findLicenseText(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return { text: null, source: null, notice: null }; }
  const read = (n) => fs.readFileSync(path.join(dir, n), 'utf8').trim();
  const isFile = (n) => { try { return fs.statSync(path.join(dir, n)).isFile(); } catch { return false; } };
  const licenseFiles = names.filter((n) => LICENSE_FILE.test(n) && isFile(n)).sort();
  const noticeFiles = names.filter((n) => NOTICE_FILE.test(n) && isFile(n)).sort();
  const notice = noticeFiles.length ? noticeFiles.map(read).join('\n\n') : null;
  if (licenseFiles.length) {
    return { text: licenseFiles.map(read).join('\n\n'), source: 'file', notice };
  }
  const readme = names.find((n) => /^readme(\..*)?$/i.test(n) && isFile(n));
  if (readme) {
    const section = readmeLicenseSection(read(readme));
    if (section) return { text: section, source: 'readme', notice };
  }
  return { text: null, source: null, notice };
}

/** 검토 목록에서 이 패키지의 판단을 찾는다. match 는 정확한 이름이거나 끝에 * (접두사). 라이선스가 바뀌면 다시 검토한다. */
function findReview(pkg, reviews) {
  return (reviews || []).find((r) => {
    const nameOk = r.match.endsWith('*') ? pkg.name.startsWith(r.match.slice(0, -1)) : pkg.name === r.match;
    return nameOk && r.license === pkg.license;
  }) || null;
}

/** 허용형 / 검토됨 / 검토 필요로 나눈다. */
function classify(pkgs, reviews) {
  const result = { permissive: [], reviewed: [], unreviewed: [] };
  for (const p of pkgs) {
    if (PERMISSIVE.has(p.license)) { result.permissive.push(p); continue; }
    const review = findReview(p, reviews);
    if (review) result.reviewed.push({ ...p, review });
    else result.unreviewed.push(p);
  }
  return result;
}

function loadReviews() {
  return JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf8')).packages;
}

/** 플랫폼별 바이너리 패키지인가 (package.json 의 os/cpu) — 설치 환경마다 이름이 다르다. */
function isPlatformSpecific(pkg) {
  try {
    const pj = JSON.parse(fs.readFileSync(path.join(pkg.paths[0], 'package.json'), 'utf8'));
    return Boolean(pj.os || pj.cpu);
  } catch { return false; }
}

const RULE = '-'.repeat(78);

/** 고지 원문 텍스트. 받는 사람이 그대로 읽는 파일이라 패키지마다 이름·버전·라이선스·원문을 싣는다. */
function renderNotice({ title, pkgs, reviews, system = [] }) {
  const counts = { file: 0, readme: 0, missing: 0 };
  const blocks = pkgs.map((p) => {
    const found = p.paths.map(findLicenseText).find((f) => f.text) || findLicenseText(p.paths[0] || '');
    counts[found.source || 'missing']++;
    const review = findReview(p, reviews);
    const head = [
      `${p.name} ${p.versions.join(', ')}`,
      `License: ${p.license}${review && review.use ? ` (이 배포에서 따르는 라이선스: ${review.use})` : ''}`,
      p.homepage ? `Homepage: ${p.homepage}` : null,
      p.author ? `Author: ${p.author}` : null,
    ].filter(Boolean).join('\n');
    const text = found.text || `(패키지에 라이선스 원문이 없다. package.json 의 표기 ${p.license}${p.author ? `, 저작자 ${p.author}` : ''} 를 따른다.)`;
    return `${RULE}\n${head}\n\n${text}${found.notice ? `\n\nNOTICE:\n${found.notice}` : ''}\n`;
  });
  const header = [
    `${title} — 오픈소스 라이선스 고지 (Third-Party Notices)`,
    '',
    `이 구성에 포함된 오픈소스 패키지 ${pkgs.length}개의 라이선스 고지다. 운영 의존성만 싣는다.`,
    '빌드할 때 설치된 패키지에서 자동으로 만든다 (scripts/third-party-notices.cjs).',
    system.length ? `\n함께 설치되는 시스템 구성요소:\n${system.map((s) => `- ${s}`).join('\n')}` : null,
    '',
  ].filter((l) => l !== null).join('\n');
  // BOM — nginx 가 .txt 에 charset 을 붙이지 않아도 브라우저가 UTF-8 로 읽게 한다
  return { text: `﻿${header}\n${blocks.join('\n')}`, counts };
}

function tally(pkgs) {
  const t = {};
  for (const p of pkgs) t[p.license] = (t[p.license] || 0) + 1;
  return Object.entries(t).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const mdCell = (s) => String(s).replace(/\|/g, '\\|');

/** docs/THIRD_PARTY_LICENSES.md — 저장소에서 읽는 사용 라이브러리 목록. */
function renderDoc(components, reviews) {
  const lines = [
    '# 사용 중인 오픈소스 라이브러리',
    '',
    '> **생성 파일 — 직접 고치지 않는다.** 릴리스 전에 `pnpm run licenses:update` 로 다시 만든다',
    '> (source: 각 구성의 `pnpm-lock.yaml` 과 설치된 패키지, 생성기 `scripts/third-party-notices.cjs`).',
    '',
    '운영 의존성만 싣는다 (개발·테스트 도구 제외). 라이선스 **원문**은 빌드할 때 만들어지는 고지 파일에 있다.',
    '',
    '- 웹 화면: 설정 → 정보 → 오픈소스 라이선스 (`/third-party-licenses.txt`)',
    '- 백엔드·MCP 서버: 각 컨테이너의 `/app/THIRD_PARTY_LICENSES.txt`',
    '',
    '## 요약',
    '',
    '| 구성 | 패키지 | 라이선스 |',
    '|---|---|---|',
    ...components.map((c) => `| ${c.label} | ${c.pkgs.length} | ${tally(c.pkgs).map(([l, n]) => `${mdCell(l)} ${n}`).join(' · ')} |`),
    '',
    '## 검토한 라이선스',
    '',
    '허용형(MIT·ISC·BSD·Apache-2.0 등) 밖의 라이선스는 들어올 때 사람이 보고 판단을 `scripts/third-party-license-review.json` 에 남긴다.',
    '',
    '| 패키지 | 라이선스 | 판단 |',
    '|---|---|---|',
    ...reviews.map((r) => `| \`${mdCell(r.match)}\` | ${mdCell(r.license)} | ${mdCell(r.decision)} |`),
  ];
  for (const c of components) {
    lines.push('', `## ${c.label} (\`${c.dir}\`)`, '', '| 패키지 | 버전 | 라이선스 |', '|---|---|---|');
    for (const p of c.pkgs) {
      lines.push(`| \`${mdCell(p.name)}\`${p.platform ? ' †' : ''} | ${p.versions.join(', ')} | ${mdCell(p.license)} |`);
    }
    if (c.pkgs.some((p) => p.platform)) {
      lines.push('', '† 플랫폼별 바이너리 — 이 문서를 만든 환경 기준이다. 설치 환경에 따라 패키지 이름이 바뀐다.');
    }
  }
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const o = { cmd: argv[0], system: [] };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--out') o.out = argv[++i];
    else if (argv[i] === '--title') o.title = argv[++i];
    else if (argv[i] === '--system') o.system.push(argv[++i]);
    else throw new Error(`알 수 없는 인자: ${argv[i]}`);
  }
  return o;
}

function cmdNotice(opt) {
  if (!opt.out) throw new Error('--out 이 필요합니다');
  let reviews = [];
  try { reviews = loadReviews(); } catch { /* 검토 목록이 없어도 고지는 만든다 */ }
  const pkgs = listLicenses(process.cwd());
  if (!pkgs.length) throw new Error('운영 의존성을 하나도 찾지 못했다 — pnpm install 이 먼저 돼야 한다');
  const { text, counts } = renderNotice({ title: opt.title || 'VCC Manager', pkgs, reviews, system: opt.system });
  fs.mkdirSync(path.dirname(path.resolve(opt.out)), { recursive: true });
  fs.writeFileSync(opt.out, text);
  console.log(`[licenses] ${opt.out}: 패키지 ${pkgs.length}개 — 원문 파일 ${counts.file}, README 에서 ${counts.readme}, 원문 없음 ${counts.missing}`);
}

function cmdUpdate() {
  const reviews = loadReviews();
  const components = COMPONENTS.map((c) => {
    const pkgs = listLicenses(path.join(ROOT, c.dir)).map((p) => ({ ...p, platform: isPlatformSpecific(p) }));
    return { ...c, pkgs };
  });
  let unreviewed = 0;
  for (const c of components) {
    const r = classify(c.pkgs, reviews);
    console.log(`[licenses] ${c.label}: 패키지 ${c.pkgs.length}개 — 허용형 ${r.permissive.length}, 검토됨 ${r.reviewed.length}, 검토 필요 ${r.unreviewed.length}`);
    for (const p of r.reviewed) console.log(`  검토됨  ${p.name}@${p.versions.join(',')}  ${p.license}  ← ${p.review.match}`);
    for (const p of r.unreviewed) console.log(`  검토 필요  ${p.name}@${p.versions.join(',')}  ${p.license}`);
    unreviewed += r.unreviewed.length;
  }
  // 검토 목록에 남았지만 더는 쓰지 않는 항목 — 지우라고 알린다 (실패는 아님)
  const all = components.flatMap((c) => c.pkgs);
  const stale = reviews.filter((r) => !all.some((p) => findReview(p, [r])));
  if (stale.length) console.log(`[licenses] 더는 해당 패키지가 없는 검토 항목 ${stale.length}개: ${stale.map((r) => r.match).join(', ')}`);
  if (unreviewed) {
    console.error(`[licenses] 검토하지 않은 라이선스 ${unreviewed}건 — 라이선스 조건을 확인하고 scripts/third-party-license-review.json 에 판단을 남긴 뒤 다시 돌린다`);
    process.exit(1);
  }
  fs.writeFileSync(DOC_FILE, renderDoc(components, reviews));
  console.log(`[licenses] ${path.relative(ROOT, DOC_FILE)} 갱신`);
}

if (require.main === module) {
  try {
    const opt = parseArgs(process.argv.slice(2));
    if (opt.cmd === 'notice') cmdNotice(opt);
    else if (opt.cmd === 'update') cmdUpdate();
    else { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(opt.cmd ? 1 : 0); }
  } catch (e) {
    console.error(`[licenses] 실패: ${e.message}`);
    process.exit(1);
  }
}

module.exports = {
  PERMISSIVE, COMPONENTS, flattenLicenses, addInstalledOptional, readmeLicenseSection, findLicenseText, findReview, classify, renderNotice, renderDoc,
};
