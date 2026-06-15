#!/usr/bin/env node
/**
 * env-doctor (#600)
 *
 * .env.example 을 기준 스키마로 실제 .env 를 진단/보정한다.
 *
 *   node scripts/env-doctor.js                 # 진단만 (dev: .env.example → .env)
 *   node scripts/env-doctor.js --prod          # 진단만 (.env.production.example → .env.production)
 *   node scripts/env-doctor.js --fix           # 누락 키를 .env 끝에 추가(기존값 보존, .env.bak 백업)
 *   node scripts/env-doctor.js --fix --generate-secrets   # 빈 시크릿(*_SECRET/*_ENCRYPTION_KEY) 자동 생성
 *   node scripts/env-doctor.js --example <path> --file <path>   # 경로 직접 지정
 *
 * 원칙: 기존 값/주석은 절대 건드리지 않는다. 알 수 없는 키는 삭제하지 않고 경고만 한다.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

const isProd = has('--prod');
const doFix = has('--fix');
const genSecrets = has('--generate-secrets');

const root = path.resolve(__dirname, '..');
const examplePath = valOf('--example') || path.join(root, isProd ? '.env.production.example' : '.env.example');
const targetPath = valOf('--file') || path.join(root, isProd ? '.env.production' : '.env');

const SECRET_RE = /(_SECRET|_ENCRYPTION_KEY)$/i;

const C = { red: '\x1b[31m', yellow: '\x1b[33m', dim: '\x1b[2m', green: '\x1b[32m', cyan: '\x1b[36m', reset: '\x1b[0m', bold: '\x1b[1m' };
const paint = (c, s) => `${c}${s}${C.reset}`;

// KEY=VALUE 라인을 파싱 (주석/빈 줄 제외). 값에 = 가 있어도 첫 = 만 분리.
function parseEnvKeys(content) {
  const map = new Map();
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    const value = t.slice(eq + 1).trim();
    if (key) map.set(key, value);
  }
  return map;
}

// example 을 순서대로 파싱해 각 키에 직전 주석 블록을 붙인다.
function parseExample(content) {
  const entries = [];
  let comments = [];
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (t.startsWith('#')) { comments.push(line); continue; }
    if (!t) { comments = []; continue; }
    const eq = t.indexOf('=');
    if (eq < 0) { comments = []; continue; }
    const key = t.slice(0, eq).trim();
    const exampleValue = t.slice(eq + 1).trim();
    entries.push({ key, exampleValue, comments });
    comments = [];
  }
  return entries;
}

function main() {
  if (!fs.existsSync(examplePath)) {
    console.error(paint(C.red, `❌ 기준 파일이 없습니다: ${examplePath}`));
    process.exit(2);
  }
  const exampleEntries = parseExample(fs.readFileSync(examplePath, 'utf8'));
  const exampleKeys = new Set(exampleEntries.map((e) => e.key));

  const targetExists = fs.existsSync(targetPath);
  const targetContent = targetExists ? fs.readFileSync(targetPath, 'utf8') : '';
  const targetMap = parseEnvKeys(targetContent);

  console.log(paint(C.bold, `\nenv-doctor — 기준: ${path.basename(examplePath)} / 대상: ${path.basename(targetPath)}${targetExists ? '' : ' (없음)'}\n`));

  const missing = exampleEntries.filter((e) => !targetMap.has(e.key));
  const emptyRequired = exampleEntries.filter((e) => targetMap.has(e.key) && targetMap.get(e.key) === '' && e.exampleValue !== '');
  const unknown = [...targetMap.keys()].filter((k) => !exampleKeys.has(k));
  const emptySecrets = exampleEntries.filter(
    (e) => SECRET_RE.test(e.key) && (!targetMap.has(e.key) || targetMap.get(e.key) === '')
  );

  if (missing.length) {
    console.log(paint(C.red, `🔴 누락된 키 (${missing.length})`));
    missing.forEach((e) => console.log(`   ${e.key}`));
  }
  if (emptyRequired.length) {
    console.log(paint(C.yellow, `🟡 비어 있는데 기본값이 있던 키 (${emptyRequired.length}) — 확인 필요`));
    emptyRequired.forEach((e) => console.log(`   ${e.key}  ${paint(C.dim, `(예시값: ${e.exampleValue})`)}`));
  }
  if (unknown.length) {
    console.log(paint(C.dim, `⚪ 기준에 없는 키 (${unknown.length}) — 오타/구 변수일 수 있음 (삭제 안 함)`));
    unknown.forEach((k) => console.log(paint(C.dim, `   ${k}`)));
  }
  if (emptySecrets.length) {
    console.log(paint(C.cyan, `🔑 비어 있는 시크릿 키 (${emptySecrets.length}) — \`openssl rand -hex 32\` 또는 --generate-secrets`));
    emptySecrets.forEach((e) => console.log(`   ${e.key}`));
  }
  if (!missing.length && !emptyRequired.length && !unknown.length && !emptySecrets.length) {
    console.log(paint(C.green, '✅ .env 가 기준 스키마와 일치합니다.'));
  }

  if (!doFix) {
    if (missing.length) {
      console.log(paint(C.dim, `\n→ 누락 키를 추가하려면: node scripts/env-doctor.js${isProd ? ' --prod' : ''} --fix${emptySecrets.length ? ' --generate-secrets' : ''}\n`));
      process.exit(1);
    }
    console.log('');
    return;
  }

  // --fix: 누락 키만 추가 (기존 값/주석 보존)
  if (!missing.length) {
    console.log(paint(C.green, '\n추가할 누락 키가 없습니다.\n'));
    return;
  }

  if (targetExists) {
    fs.copyFileSync(targetPath, targetPath + '.bak');
    console.log(paint(C.dim, `\n백업: ${path.basename(targetPath)}.bak`));
  }

  const lines = [];
  const ts = new Date().toISOString().slice(0, 10);
  lines.push('', `# --- env-doctor 추가 (${ts}) ---`);
  let generated = 0;
  for (const e of missing) {
    if (e.comments.length) lines.push(...e.comments);
    let value = e.exampleValue;
    if (genSecrets && SECRET_RE.test(e.key) && (value === '' || /CHANGE/i.test(value))) {
      value = crypto.randomBytes(32).toString('hex');
      generated++;
    }
    lines.push(`${e.key}=${value}`);
  }

  const prefix = targetContent && !targetContent.endsWith('\n') ? '\n' : '';
  fs.appendFileSync(targetPath, prefix + lines.join('\n') + '\n');
  console.log(paint(C.green, `✅ ${missing.length}개 키 추가 완료${generated ? ` (시크릿 ${generated}개 생성)` : ''} → ${path.basename(targetPath)}`));
  if (!genSecrets && emptySecrets.length) {
    console.log(paint(C.cyan, `   남은 시크릿 키는 직접 채우거나 --generate-secrets 로 생성하세요.`));
  }
  console.log('');
}

main();
