#!/usr/bin/env node
/**
 * 문서용 스크린샷 캡처 (#604)
 *
 * 실행 중인 인스턴스에 관리자로 로그인해 주요 화면을 docs/images/ 로 캡처한다.
 * 비밀번호는 스크립트에 박지 않고 런타임 환경변수로 전달한다.
 *
 *   SHOT_EMAIL=admin@example.com SHOT_PASSWORD='...' \
 *   SHOT_BASE_URL=http://localhost:8136 \
 *   node scripts/capture-docs-screenshots.js
 *
 * 의존: @playwright/test (chromium 설치 필요 — npx playwright install chromium)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const BASE = process.env.SHOT_BASE_URL || 'http://localhost:8136';
const EMAIL = process.env.SHOT_EMAIL;
const PASSWORD = process.env.SHOT_PASSWORD;
const OUT_DIR = path.resolve(__dirname, '..', 'docs', 'images');

async function getToken() {
  const res = await fetch(`${BASE}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`signin 실패 (${res.status}): ${await res.text()}`);
  const json = await res.json();
  if (!json.token) throw new Error('signin 응답에 token 없음');
  return json.token;
}

async function listProjectIds(token) {
  try {
    const res = await fetch(`${BASE}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const json = await res.json();
    const items = json?.data?.projects || json?.data?.items || json?.projects || [];
    return items.map((p) => p._id).filter(Boolean);
  } catch { return []; }
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('SHOT_EMAIL / SHOT_PASSWORD 환경변수가 필요합니다.');
    process.exit(2);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const token = await getToken();
  const projectIds = await listProjectIds(token);

  const shots = [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'workboards', path: '/workboards' },
    { name: 'projects', path: '/projects' },
  ];
  if (projectIds[0]) shots.push({ name: 'pipeline', path: `/projects/${projectIds[0]}` });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const url = new URL(BASE);
  await context.addCookies([{ name: 'token', value: token, domain: url.hostname, path: '/', httpOnly: false, sameSite: 'Lax' }]);

  const page = await context.newPage();
  const done = [];
  for (const shot of shots) {
    try {
      await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1500); // 차트/이미지 로드 여유
      const file = path.join(OUT_DIR, `${shot.name}.png`);
      await page.screenshot({ path: file });
      done.push(`${shot.name} → docs/images/${shot.name}.png`);
      console.log(`✅ ${shot.name}`);
    } catch (e) {
      console.error(`⚠️ ${shot.name} 캡처 실패: ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\n캡처 완료 (${done.length}/${shots.length}):\n  ${done.join('\n  ')}`);
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
