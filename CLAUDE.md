# VCC Manager - Claude Code 작업 지침

이 문서는 Claude Code가 대화 시작 시 자동으로 로드하여 프로젝트 컨텍스트를 파악할 수 있도록 작성되었습니다.

---

## 프로젝트 개요

VCC Manager는 ComfyUI 워크플로우 기반 이미지/비디오 생성 관리 시스템입니다.

- **Frontend**: React 18 + Material-UI + React Query
- **Backend**: Node.js + Express + MongoDB + Redis (Bull Queue)
- **배포**: Docker Compose

---

## Git 작업 체계

### 브랜치 전략

```
main                    # 프로덕션 브랜치
  └── dev/v{버전}       # 개발 브랜치 (예: dev/v1.2)
       └── feature/*    # 기능 개발 브랜치 (필요시)
```

### 브랜치 명명 규칙
- **개발 브랜치**: `dev/v{major}.{minor}` (예: `dev/v1.1`, `dev/v1.2`)
- **기능 브랜치**: `feature/{이슈번호}-{간략설명}` (예: `feature/38-user-settings`)
- **버그 수정**: `fix/{이슈번호}-{간략설명}` (예: `fix/42-download-error`)

### 커밋 메시지 컨벤션

```
<type>: <subject>

<body>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Type 종류:**
- `feat`: 새로운 기능
- `fix`: 버그 수정
- `refactor`: 리팩토링
- `docs`: 문서 변경
- `style`: 코드 스타일 변경 (기능 변화 없음)
- `chore`: 빌드, 설정 변경

### PR 워크플로우

1. `dev/v{버전}` 브랜치에서 작업
2. 작업 완료 후 PR 생성 → `main` 브랜치로 머지
3. PR 제목: `[v{버전}] 기능 설명` 또는 커밋 메시지 스타일
4. PR 본문에 변경사항 요약 포함

### 커밋 정책
- 현재 작업과 관련이 없는 신규 작업을 실행할 때, 기존 작업에 대한 커밋이 이루어지지 않았다면 커밋을 진행.
- 반면, 작업이 현재 작업과 연관있는 작업, 기존 작업의 지속이나 버그 수정 및 개선작업이라면 커밋을 진행하지 않아도 됨.

---

## GitHub Issue 처리

### Issue 참조 방식
```bash
# 커밋에서 이슈 참조
git commit -m "feat: add user settings (#38)"

# PR로 이슈 자동 종료
closes #38
fixes #38
```

### Issue 처리 절차
1. Issue 내용 확인 및 요구사항 파악
2. 관련 코드 분석
3. 구현 및 테스트
4. 커밋 (이슈 번호 참조)
5. 필요시 PR 생성

---

## 개발 환경

### 테스트 방법
**반드시 Docker Compose를 통해 테스트** (로컬 node 실행 금지)

```bash
# 서비스 재시작
docker-compose down && docker-compose up --build -d

# 로그 확인
docker-compose logs -f backend
```

### 환경 변수 파일
- `.env` - 로컬 개발용
- `.env.production` - 프로덕션용
- `frontend/.env` - 프론트엔드 빌드용

### 배포 스크립트
```bash
# 프로덕션 배포
./deploy-prod.sh
```

### 작업 시 유의사항
- port, secret, token 및 환경 변수를 가정하기 전, 반드시 샘플인 .env.example과 실 적용 환경변수인 .env 에 정의된 기존 값을 우선 확인할 것.
- 포트 및 자격 증명을 하드 코딩하지 말 것.
- .env.example 이 변경되었다면 프로덕션 환경인 .env.production.example 도 같이 고려할 것.

---

## 주요 디렉토리 구조

```
/
├── src/                    # 백엔드 소스
│   ├── models/             # MongoDB 모델
│   ├── routes/             # API 라우트
│   ├── services/           # 비즈니스 로직
│   └── middleware/         # Express 미들웨어
├── frontend/src/           # 프론트엔드 소스
│   ├── components/         # React 컴포넌트
│   │   ├── common/         # 공통 컴포넌트
│   │   └── admin/          # 관리자 컴포넌트
│   ├── pages/              # 페이지 컴포넌트
│   └── services/           # API 서비스
├── docs/                   # 프로젝트 문서
└── uploads/                # 업로드 파일 저장소
```

---

## 코딩 컨벤션

### 백엔드 (Node.js)
- Express 라우터 패턴 사용
- 에러는 `errorHandler` 미들웨어로 전달
- 모든 API 응답은 `{ success, data/error, message }` 형식

### 프론트엔드 (React)
- 함수형 컴포넌트 + Hooks 사용
- React Query로 서버 상태 관리
- Material-UI 컴포넌트 사용
- `useForm` (react-hook-form)으로 폼 관리

### 공통 컴포넌트 활용
- `ImageSelectDialog`: 이미지 선택 다이얼로그
- `ImageViewerDialog`: 이미지 뷰어
- `VideoViewerDialog`: 비디오 뷰어
- `Pagination`: 페이지네이션
- `TagInput`: 태그 입력

---

## 알려진 패턴 및 주의사항

### 1. 모델 스키마 변경
- `GeneratedImage`, `GeneratedVideo`의 `jobId`는 `required: false`
- 히스토리 삭제 시 콘텐츠 보존을 위한 설계

### 2. 작업판 상태
- **활성화**: 일반 사용자에게 표시
- **비활성화**: 관리자만 볼 수 있음 (소프트 삭제)
- **삭제**: DB에서 완전 제거 (복구 불가)

### 3. 사용자 설정
- `preferences.deleteContentWithHistory`: 히스토리 삭제 시 콘텐츠도 삭제
- `preferences.deleteHistoryWithContent`: 콘텐츠 삭제 시 히스토리도 삭제
- `preferences.useRandomSeedOnContinue`: 계속하기 시 랜덤 시드 사용

### 4. 워크플로우 변수 형식
- ComfyUI 플레이스홀더: `{{##변수명##}}`
- 매핑: `workflowMapping` 객체에서 변수명 → 워크플로우 노드 경로 매핑

---

## 기타 개발 정책

### 디버깅
- 버그를 수정할 때는 수정을 제안하기 전에 항상 실제 오류 로그/출력을 요청하거나 확인.
- 근본 원인을 추측하지 말 것 — 먼저 진단하고, 그 다음에 해결.
- 첫 번째 접근 방식이 작동하지 않을 경우, 같은 접근 방식을 변형하려고 시도하기보다 한 걸음 물러서서서 아키텍처를 재고할 것.

### 시스템 요소 추가
- 명시적으로 요청되지 않는 한 인프라 구성 요소(nginx, 신규 서비스, 타임아웃 시스템)를 추가하지 말 것
- 의심스러울 경우, 새로운 종속성이나 아키텍처 변경을 추가하기 전에 문의.

---

## 문서 참조

- `docs/DEVELOPMENT.md` - 전체 개발 문서
- `docs/CLAUDE_CODE.md` - Docker 테스트 가이드
- `docs/TEST_CHECKLIST.md` - 테스트 체크리스트
- `docs/COMFYUI_WORKFLOW.md` - ComfyUI 워크플로우 가이드
- `docs/API.md` - API 문서
- `docs/DEPLOYMENT.md` - 배포 가이드

---

## 현재 버전 정보

- **현재 개발 브랜치**: `dev/v1.2`
- **마지막 업데이트**: 2026-02-03
