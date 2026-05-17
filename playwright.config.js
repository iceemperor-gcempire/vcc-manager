// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Playwright 설정 (#359).
// 로컬 docker-compose dev 환경 (http://localhost:8136) 대상으로 e2e 실행.
// CI 도입 시 baseURL / webServer / reporter 추가 가능.

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8136';

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
