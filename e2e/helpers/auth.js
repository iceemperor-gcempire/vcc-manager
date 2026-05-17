// e2e 테스트용 회원가입 / 로그인 helper (#359).
// 매 실행마다 unique email 로 사용자 자동 생성 — DB 격리 환경 없이도 충돌 없음.

function uniqueEmail(prefix = 'e2e') {
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2, 8);
  // .test 등 일부 TLD 는 joi email 검증에서 reject — example.com 사용
  return `${prefix}-${ts}-${rnd}@example.com`;
}

function uniqueNickname(prefix = 'e2e') {
  const ts = Date.now().toString().slice(-6);
  const rnd = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${ts}${rnd}`;
}

/**
 * API 직접 호출로 회원가입 + 토큰 획득. UI signup 페이지보다 빠르고 안정적.
 * 반환: { email, password, nickname, token, user }
 */
async function signupViaAPI(request, overrides = {}) {
  const email = overrides.email || uniqueEmail();
  const password = overrides.password || 'TestPass!23';
  const nickname = overrides.nickname || uniqueNickname();
  const response = await request.post('/api/auth/signup', {
    data: { email, password, confirmPassword: password, nickname }
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Signup failed (${response.status()}): ${body}`);
  }
  const json = await response.json();
  return { email, password, nickname, token: json.token, user: json.user };
}

/**
 * UI 로 로그인 — signin 페이지의 input 필드 클릭/타이핑.
 * 시간이 더 걸리므로, 토큰 직접 주입이 가능하면 storage state 활용 권장.
 */
async function signinViaUI(page, { email, password }) {
  await page.goto('/login');
  await page.getByLabel(/이메일|email/i).fill(email);
  await page.getByLabel(/비밀번호|password/i).first().fill(password);
  await page.getByRole('button', { name: /로그인|sign\s*in/i }).click();
  await page.waitForURL(/\/(dashboard|workboards|$)/);
}

/**
 * 회원가입 + 토큰을 cookie 에 주입하여 로그인 상태로 만들기.
 * frontend 는 js-cookie 로 'token' cookie 를 사용 (AuthContext 참고).
 */
async function authenticatedSession(page, request, baseURL) {
  const { email, password, nickname, token, user } = await signupViaAPI(request);
  // baseURL 의 host 로 cookie 도메인 설정
  const url = new URL(baseURL || 'http://localhost:8136');
  await page.context().addCookies([{
    name: 'token',
    value: token,
    domain: url.hostname,
    path: '/',
    httpOnly: false,
    sameSite: 'Lax',
  }]);
  return { email, password, nickname, token, user };
}

module.exports = {
  uniqueEmail,
  uniqueNickname,
  signupViaAPI,
  signinViaUI,
  authenticatedSession,
};
