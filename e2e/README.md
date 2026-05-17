# E2E 테스트 (Playwright)

VCC Manager 의 critical user journey 자동 회귀 검증.

## 사전 조건

로컬 docker-compose dev 환경이 떠 있어야 함:

```bash
docker-compose up -d
```

(`http://localhost:8136` 으로 frontend 접근 가능해야 함)

## 실행

```bash
# 첫 실행 — Playwright 브라우저 다운로드
npx playwright install chromium

# 헤드리스 실행
npm run test:e2e

# UI 모드 (인터랙티브)
npm run test:e2e:ui

# 헤드 모드 (브라우저 창 보이게)
npm run test:e2e:headed

# baseURL 오버라이드
E2E_BASE_URL=http://localhost:8080 npm run test:e2e
```

## 디렉토리 구조

```
e2e/
├── helpers/
│   └── auth.js          # signup / login helper
├── smoke.spec.js        # critical user journey smoke 테스트
└── README.md            # 이 문서
```

## 사용자 생성 정책

매 테스트가 unique email 로 신규 사용자 생성 (`e2e-{ts}-{rnd}@e2e.test`). DB 격리 환경 없이도 충돌 없음.

## 정책 (테스트 유지보수)

- UI 변경 (셀렉터, 네비게이션 흐름, 텍스트 라벨 등) 시 관련 e2e 테스트도 함께 업데이트.
- 핵심 user journey 추가 시 smoke 테스트 1개 이상 추가 권장.
- PR 머지 전 로컬에서 `npm run test:e2e` 통과 확인.

## 향후

- CI (GitHub Actions) 연동
- visual regression / screenshot diff
- AI-augmented (Stagehand 등) 선택적 사용
- 회원가입 직후 admin 처리 (현재 첫 signup 이 admin 이 됨) — 별도 admin 시나리오 분리 필요 시 fixture 활용
