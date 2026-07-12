// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Playwright 설정 (#359).
// 로컬 docker-compose dev 환경 (http://localhost:8136) 대상으로 e2e 실행.
// CI 도입 시 baseURL / webServer / reporter 추가 가능.

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8136';

// E2E_ADMIN_SECRET (#381) 을 리포 .env 에서 로드 (process.env 우선).
// 백엔드는 docker-compose 가 같은 .env 값을 주입하므로 양쪽이 자동으로 일치한다.
if (!process.env.E2E_ADMIN_SECRET) {
  try {
    const envFile = require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8');
    const match = envFile.match(/^E2E_ADMIN_SECRET=(.+)$/m);
    if (match) process.env.E2E_ADMIN_SECRET = match[1].trim();
  } catch (_) { /* .env 없으면 무시 — 시크릿 없는 상태로 진행 */ }
}

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: { timeout: 5 * 1000 },
  fullyParallel: false,  // signup 등 사용자 생성 테스트는 직렬 실행 (DB 격리 없음)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ko-KR',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
