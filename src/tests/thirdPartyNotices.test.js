/**
 * 오픈소스 라이선스 고지 생성기 (#1063) — scripts/third-party-notices.cjs.
 *
 * 원문 찾기·검토 목록 대조는 임시 폴더로 고정하고, 마지막에 저장소의 목록 문서가
 * 직접 의존성을 빠짐없이 싣고 있는지 본다. 의존성을 넣고 `pnpm run licenses:update` 를
 * 안 돌리면 여기서 깨진다 — 새 의존성의 라이선스를 그 PR 에서 보게 하려는 것이다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  PERMISSIVE, COMPONENTS, flattenLicenses, addInstalledOptional, readmeLicenseSection, findLicenseText, findReview, classify, renderNotice,
} = require('../../scripts/third-party-notices.cjs');

const ROOT = path.join(__dirname, '../..');

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpn-'));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
  return dir;
}

describe('flattenLicenses', () => {
  test('라이선스별 묶음을 이름순 목록으로 편다', () => {
    const out = flattenLicenses({
      MIT: [{ name: 'zeta', versions: ['1.0.0'], paths: ['/z'], license: 'MIT' }],
      ISC: [{ name: 'alpha', versions: ['2.0.0'], paths: ['/a'] }],
    });
    expect(out.map((p) => p.name)).toEqual(['alpha', 'zeta']);
    expect(out[0].license).toBe('ISC'); // 항목에 license 가 없으면 묶음 키를 쓴다
  });
});

describe('addInstalledOptional', () => {
  // pnpm 배치: .pnpm/<pkg>@<ver>/node_modules/<pkg> 의 의존성은 같은 node_modules/ 아래 (실제로는 심볼릭 링크)
  function pnpmLayout() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tpn-pnpm-'));
    const put = (store, name, pj) => {
      const dir = path.join(root, '.pnpm', store, 'node_modules', ...name.split('/'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pj));
      return dir;
    };
    const sharp = put('sharp@0.34.5', 'sharp', {
      name: 'sharp', version: '0.34.5',
      optionalDependencies: { '@img/sharp-linuxmusl-arm64': '0.34.5', '@img/sharp-win32-x64': '0.34.5' },
    });
    // 이 플랫폼에 깔린 것만 sharp 옆에 있다 (win32 는 없다)
    put('sharp@0.34.5', '@img/sharp-linuxmusl-arm64', {
      name: '@img/sharp-linuxmusl-arm64', version: '0.34.5', license: 'Apache-2.0',
      optionalDependencies: { '@img/sharp-libvips-linuxmusl-arm64': '1.2.4' },
    });
    put('sharp@0.34.5', '@img/sharp-libvips-linuxmusl-arm64', {
      name: '@img/sharp-libvips-linuxmusl-arm64', version: '1.2.4', license: 'LGPL-3.0-or-later', author: 'Lovell Fuller <x@example.com>',
    });
    return sharp;
  }

  test('목록에 없지만 설치된 플랫폼별 선택 의존성을 보탠다 — 선택 의존성의 선택 의존성까지', () => {
    const pkgs = [{ name: 'sharp', versions: ['0.34.5'], paths: [pnpmLayout()], license: 'Apache-2.0', author: '', homepage: '' }];
    const added = addInstalledOptional(pkgs);
    expect(added.map((p) => p.name)).toEqual(['@img/sharp-linuxmusl-arm64', '@img/sharp-libvips-linuxmusl-arm64']);
    expect(pkgs.map((p) => p.name)).toEqual(['@img/sharp-libvips-linuxmusl-arm64', '@img/sharp-linuxmusl-arm64', 'sharp']);
    const libvips = pkgs.find((p) => p.name === '@img/sharp-libvips-linuxmusl-arm64');
    expect(libvips).toMatchObject({ versions: ['1.2.4'], license: 'LGPL-3.0-or-later', author: 'Lovell Fuller' });
  });

  test('이미 목록에 있으면 겹쳐 넣지 않는다', () => {
    const sharp = pnpmLayout();
    const pkgs = [
      { name: 'sharp', versions: ['0.34.5'], paths: [sharp], license: 'Apache-2.0' },
      { name: '@img/sharp-linuxmusl-arm64', versions: ['0.34.5'], paths: [path.join(path.dirname(sharp), '@img', 'sharp-linuxmusl-arm64')], license: 'Apache-2.0' },
    ];
    expect(addInstalledOptional(pkgs).map((p) => p.name)).toEqual(['@img/sharp-libvips-linuxmusl-arm64']);
  });
});

describe('readmeLicenseSection', () => {
  test('## License 절 — 다음 같은 수준 제목 전까지', () => {
    expect(readmeLicenseSection('# x\n\n## License\n\nMIT 원문\n\n### 세부\n이어짐\n\n## 다음\n빠짐')).toBe('MIT 원문\n\n### 세부\n이어짐');
  });
  test('밑줄형 제목 (License + -----)', () => {
    expect(readmeLicenseSection('Intro\n=====\n\nLicense\n-------\n\n(The MIT License)\n\nCopyright')).toBe('(The MIT License)\n\nCopyright');
  });
  test('## Licensing 도 찾는다', () => {
    expect(readmeLicenseSection('## Licensing\n\nLGPL')).toBe('LGPL');
  });
  test('License 절이 없으면 null', () => {
    expect(readmeLicenseSection('# x\n\nlicense 라는 말만 본문에 있다')).toBeNull();
  });
});

describe('findLicenseText', () => {
  test('LICENSE 와 NOTICE 를 읽는다', () => {
    const r = findLicenseText(fixture({ LICENSE: 'Apache 원문', NOTICE: '저작권 고지', 'index.js': '' }));
    expect(r).toEqual({ text: 'Apache 원문', source: 'file', notice: '저작권 고지' });
  });
  test('MIT-LICENSE.txt 같은 이름도 원문 파일로 본다', () => {
    expect(findLicenseText(fixture({ 'MIT-LICENSE.txt': 'MIT 원문' })).source).toBe('file');
  });
  test('이중 라이선스 파일은 둘 다 싣는다', () => {
    expect(findLicenseText(fixture({ 'LICENSE-APACHE': 'A', 'LICENSE-MIT': 'M' })).text).toBe('A\n\nM');
  });
  test('license.js 같은 코드 파일은 원문이 아니다 — README 로 넘어간다', () => {
    const r = findLicenseText(fixture({ 'license.js': 'module.exports = 1', 'README.md': '## License\n\nMIT' }));
    expect(r).toMatchObject({ text: 'MIT', source: 'readme' });
  });
  test('원문이 어디에도 없으면 null', () => {
    expect(findLicenseText(fixture({ 'README.md': '# 사용법' }))).toEqual({ text: null, source: null, notice: null });
  });
  test('없는 폴더면 null', () => {
    expect(findLicenseText(path.join(os.tmpdir(), 'tpn-없는-폴더')).source).toBeNull();
  });
});

describe('검토 목록 대조', () => {
  const reviews = [
    { match: '@img/sharp-libvips-*', license: 'LGPL-3.0-or-later', decision: 'ok' },
    { match: 'dompurify', license: '(MPL-2.0 OR Apache-2.0)', use: 'Apache-2.0', decision: 'ok' },
  ];
  const pkg = (name, license) => ({ name, license, versions: ['1.0.0'], paths: [] });

  test('끝의 * 는 접두사 — 플랫폼별 이름이 달라도 같은 판단', () => {
    expect(findReview(pkg('@img/sharp-libvips-linuxmusl-x64', 'LGPL-3.0-or-later'), reviews)).toBe(reviews[0]);
    expect(findReview(pkg('@img/sharp-libvips-darwin-arm64', 'LGPL-3.0-or-later'), reviews)).toBe(reviews[0]);
  });
  test('라이선스가 바뀌면 다시 검토해야 한다', () => {
    expect(findReview(pkg('dompurify', 'MPL-2.0'), reviews)).toBeNull();
  });
  test('허용형 / 검토됨 / 검토 필요로 나눈다', () => {
    const r = classify([pkg('a', 'MIT'), pkg('dompurify', '(MPL-2.0 OR Apache-2.0)'), pkg('b', 'GPL-3.0')], reviews);
    expect(r.permissive.map((p) => p.name)).toEqual(['a']);
    expect(r.reviewed.map((p) => p.name)).toEqual(['dompurify']);
    expect(r.unreviewed.map((p) => p.name)).toEqual(['b']);
  });
  test('카피레프트·표기 없음은 허용형 목록에 없다', () => {
    for (const l of ['GPL-3.0', 'AGPL-3.0', 'LGPL-3.0-or-later', 'MPL-2.0', 'Unknown', 'UNLICENSED']) expect(PERMISSIVE.has(l)).toBe(false);
  });
});

describe('renderNotice', () => {
  test('패키지마다 이름·버전·라이선스·원문, 이중 라이선스는 따르는 쪽을 적는다', () => {
    const dir = fixture({ LICENSE: 'DOMPurify 원문' });
    const { text, counts } = renderNotice({
      title: '시험',
      pkgs: [
        { name: 'dompurify', versions: ['3.4.11'], paths: [dir], license: '(MPL-2.0 OR Apache-2.0)', author: '', homepage: '' },
        { name: 'nolicense', versions: ['1.0.0'], paths: [fixture({})], license: 'MIT', author: '누군가', homepage: '' },
      ],
      reviews: [{ match: 'dompurify', license: '(MPL-2.0 OR Apache-2.0)', use: 'Apache-2.0' }],
      system: ['ffmpeg — 시스템 패키지'],
    });
    expect(text.startsWith('﻿')).toBe(true); // .txt 를 브라우저가 UTF-8 로 읽게
    expect(text).toContain('dompurify 3.4.11\nLicense: (MPL-2.0 OR Apache-2.0) (이 배포에서 따르는 라이선스: Apache-2.0)');
    expect(text).toContain('DOMPurify 원문');
    expect(text).toContain('package.json 의 표기 MIT, 저작자 누군가');
    expect(text).toContain('- ffmpeg — 시스템 패키지');
    expect(counts).toEqual({ file: 1, readme: 0, missing: 1 });
  });
});

describe('저장소의 라이선스 목록 (docs/THIRD_PARTY_LICENSES.md)', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs/THIRD_PARTY_LICENSES.md'), 'utf8');
  const section = (c) => {
    const start = doc.indexOf(`## ${c.label} (\`${c.dir}\`)`);
    if (start < 0) return '';
    const next = doc.indexOf('\n## ', start + 1);
    return doc.slice(start, next < 0 ? undefined : next);
  };

  test.each(COMPONENTS.map((c) => [c.label, c]))('%s 의 직접 의존성이 모두 실려 있다', (label, c) => {
    const pj = JSON.parse(fs.readFileSync(path.join(ROOT, c.dir, 'package.json'), 'utf8'));
    const body = section(c);
    const missing = Object.keys(pj.dependencies || {}).filter((name) => !body.includes(`| \`${name}\``));
    // 의존성을 넣었으면 `pnpm run licenses:update` 로 목록을 다시 만든다 (라이선스 검토 포함)
    expect(missing).toEqual([]);
  });

  test('검토 목록의 항목마다 판단이 적혀 있다', () => {
    const { packages } = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/third-party-license-review.json'), 'utf8'));
    for (const r of packages) {
      expect(r.match).toBeTruthy();
      expect(r.license).toBeTruthy();
      expect(r.decision).toBeTruthy();
    }
  });
});
