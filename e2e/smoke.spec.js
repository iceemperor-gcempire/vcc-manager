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
  // E2E_ADMIN_SECRET 미설정 시 signup 계정이 승인 대기(pending) 상태라 페이지 접근이 막힘 (#381)
  test.skip(!process.env.E2E_ADMIN_SECRET, 'E2E_ADMIN_SECRET 미설정 — 가입 승인 게이트로 skip (#381)');

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

  test('내 컨텐츠 페이지 접근 (레거시 /images 리다이렉트 포함)', async ({ page }) => {
    // /images 는 콘텐츠 라이브러리 통합으로 /content 로 리다이렉트된다 (App.js)
    await page.goto('/images');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/content');
  });

  test('작업 절차 페이지 접근 — 목록·실행 기록 탭 (#952)', async ({ page }) => {
    await page.goto('/sequences');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('tab', { name: '작업 절차' })).toBeVisible();
    await page.getByRole('tab', { name: '실행 기록' }).click();
    await expect(page).toHaveURL(/tab=runs/);
  });

  test('채팅 페이지 접근 — 쓸 수 있는 입력란 또는 작업판 안내 (#1267)', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/chat');
    // 대화 상대로 쓸 텍스트 작업판이 있으면 입력란이, 없으면 만들라는 안내가 보인다 — 인스턴스에 따라 다르다
    const composer = page.getByPlaceholder(/메시지를 입력하세요/);
    const noBoard = page.getByText('대화 상대로 쓸 작업판이 없습니다');
    await expect(composer.or(noBoard).first()).toBeVisible();
    // 판이 있으면 입력란이 열려 있어야 한다 — 판 조회가 실패해 잠긴 입력란만 보고 통과하지 않게
    if (!(await noBoard.isVisible())) await expect(composer).toBeEnabled();
  });
});

test.describe('Signup flow', () => {
  test('beforeAll 의 회원가입 API 가 정상 token 반환', async () => {
    expect(sharedSession.token).toBeTruthy();
    expect(sharedSession.user?.email).toBeTruthy();
    expect(typeof sharedSession.user?.isAdmin).toBe('boolean');
  });
});
