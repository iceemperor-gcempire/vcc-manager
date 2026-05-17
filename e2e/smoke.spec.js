// @ts-check
const { test, expect } = require('@playwright/test');
const { signupViaAPI } = require('./helpers/auth');

// VCC Manager 의 critical user journey smoke tests (#359).
// 사전 조건: docker-compose up -d 로 frontend (8136) / backend (3136) 실행 중.
//
// 사용자 공유 패턴: signup rate limit (1시간당 3건) 회피를 위해 worker scope 에서
// 단일 사용자만 생성하고 모든 test 가 공유. smoke 테스트는 read-only 이므로 공유 OK.

let sharedSession; // { email, password, nickname, token, user }

test.beforeAll(async ({ request }) => {
  sharedSession = await signupViaAPI(request);
});

test.describe('Anonymous', () => {
  test('랜딩 페이지가 로드되고 로그인 또는 회원가입 진입점이 보인다', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const hasLoginOrSignup = await page.getByText(/로그인|회원가입|sign\s*(in|up)/i).first().isVisible().catch(() => false);
    expect(hasLoginOrSignup).toBe(true);
  });
});

test.describe('Authenticated user', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const url = new URL(baseURL || 'http://localhost:8136');
    await context.addCookies([{
      name: 'token',
      value: sharedSession.token,
      domain: url.hostname,
      path: '/',
      httpOnly: false,
      sameSite: 'Lax',
    }]);
  });

  test('대시보드 진입', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const sidebarVisible = await page.getByText(/작업판|대시보드/).first().isVisible().catch(() => false);
    expect(sidebarVisible).toBe(true);
  });

  test('작업판 목록 페이지 접근', async ({ page }) => {
    await page.goto('/workboards');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/workboards');
  });

  test('내 이미지 페이지 접근', async ({ page }) => {
    await page.goto('/images');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/images');
  });
});

test.describe('Signup flow', () => {
  test('beforeAll 의 회원가입 API 가 정상 token 반환', async () => {
    expect(sharedSession.token).toBeTruthy();
    expect(sharedSession.user?.email).toBeTruthy();
    expect(typeof sharedSession.user?.isAdmin).toBe('boolean');
  });
});
