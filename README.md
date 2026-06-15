# VCC Manager

**Visual Content Creator Manager** — ComfyUI / OpenAI / Gemini 기반 AI 이미지·비디오·텍스트 생성 관리 시스템

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-build-646CFF)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 프로젝트 개요

VCC Manager는 여러 생성 백엔드(ComfyUI · OpenAI 호환 · Gemini)를 한 곳에서 관리하고, 프로젝트 단위로 콘텐츠 생성을 자동화하는 종합 웹 애플리케이션입니다.

### 주요 기능

- **작업판(Workboard)** — 생성 작업의 단위. 서버(provider) + 출력 형식(image/video/text) 조합으로 입력 양식·워크플로우·기본값을 정의. 백업/복원(내보내기·가져오기) 지원
- **AI 콘텐츠 생성** — 비동기 작업 큐(Bull)를 통한 이미지·비디오·텍스트 생성. 취소 시 진행 중 외부 API 호출까지 즉시 중단
- **텍스트 대화** — LLM 응답 실시간 SSE 스트리밍, 멀티턴 대화, **이미지 첨부(비전)**, 작업판별 추가 LLM 파라미터(JSON) 전달
- **프로젝트 & 세계관** — 프로젝트 단위 워크스페이스 + **세계관/컨텍스트 문서**를 정의해 LLM 작업판에 자동 주입
- **작업판 파이프라인** — 여러 작업판을 직선으로 연결(예: 텍스트→이미지→영상), 단계별 사전 입력·문서 연결·자동 주입, 백그라운드 실행 + 부분 재시작
- **프롬프트 관리** — 프롬프트 저장/불러오기, 대화형 AI 프롬프트 생성(멀티턴)
- **태그 & 그룹 권한** — 사용자 태그로 콘텐츠 분류, 그룹 기반 작업판 접근 제어
- **LoRA 관리** — Civitai 메타데이터 동기화. LoRA는 권한 있는 작업판 컨텍스트에서만 조회
- **MCP 서버** — AI 에이전트 연동용 MCP(Model Context Protocol) 서버 내장(stdio + Streamable HTTP, API Key 멀티유저)
- **서버 백업/복원** — 전체 컬렉션 + 미디어 파일 백업, AES-256-GCM 암호화, 복원 중 쓰기 잠금 + 복원 전 자동 스냅샷, 대용량 스트리밍
- **보안** — JWT 인증, Signed URL 미디어 접근 제어, provider API 키 at-rest 암호화
- **디자인 & 모바일** — 디자인 시스템 v2(Warm Studio 라이트 / Console 다크), 반응형 UI

## 빠른 시작 (개발 환경)

### 사전 요구사항
- [Docker](https://www.docker.com/) & Docker Compose
- [Git](https://git-scm.com/)

```bash
# 1. 복제
git clone <repository-url>
cd vcc-manager

# 2. 환경 설정
cp .env.example .env
# .env 에서 JWT_SECRET, MONGODB_URI, BACKUP_ENCRYPTION_KEY 등 설정

# (선택) .env 진단 — 누락 변수 / 빈 시크릿 점검
npm run env:doctor

# 3. 실행 (개발 구성)
docker-compose up -d

# 4. 접속 확인
curl http://localhost:8136/api/auth/status
```

### 접속 URL (개발 기본 포트)
- **프론트엔드**: http://localhost:8136
- **백엔드 API**: http://localhost:3136/api
- **MCP 서버**: http://localhost:4136
- **관리자**: 첫 번째 가입 사용자가 자동으로 관리자 권한 획득

> 포트는 `.env` 의 `FRONTEND_PORT` / `BACKEND_PORT` / `MCP_PORT` 로 변경 가능합니다.

### 프로덕션 배포
프로덕션은 전용 구성으로 분리되어 있습니다 — `docker-compose.prod.yml` + `.env.production` + `scripts/deploy-prod.sh`. 자세한 내용은 [배포 가이드](./docs/DEPLOYMENT.md) 참고.

## 기술 스택

<table>
<tr>
<td><strong>Frontend</strong></td>
<td><strong>Backend</strong></td>
<td><strong>Infrastructure</strong></td>
</tr>
<tr>
<td>
• React 18 + Vite<br>
• Material-UI<br>
• @tanstack/react-query v5<br>
• React Router<br>
• React Hook Form
</td>
<td>
• Node.js + Express<br>
• MongoDB + Mongoose<br>
• Redis + Bull Queue<br>
• JWT Authentication<br>
• MCP Server (stdio / Streamable HTTP)
</td>
<td>
• Docker + Compose<br>
• Nginx<br>
• ComfyUI<br>
• OpenAI 호환 API · Gemini
</td>
</tr>
</table>

## 시스템 아키텍처

```mermaid
graph TB
    subgraph "Frontend (React + Vite)"
        A[Dashboard / Gallery]
        B[Admin Panel]
        C[Projects / Worldview / Pipeline]
        D[Workboards]
    end

    subgraph "Backend (Node.js)"
        E[Express API]
        F[Auth / Groups]
        G[Job Queue · Pipeline Runner]
        H[File / Signed URL]
    end

    subgraph "MCP Server"
        I[stdio / Streamable HTTP]
    end

    subgraph "Data Store"
        J[(MongoDB)]
        K[(Redis)]
    end

    subgraph "External Services"
        L[ComfyUI Server]
        M[OpenAI 호환 API]
        N[Gemini API]
        O[Civitai API]
    end

    A --> E
    B --> E
    C --> E
    D --> E

    E --> J
    E --> L
    E --> M
    E --> N
    E --> O
    G --> K

    I -->|Backend API| E
```

## 사용자 역할

| 역할 | 권한 |
|------|------|
| **일반 사용자** | • 이미지/비디오/텍스트 생성 요청<br>• 갤러리 조회/다운로드<br>• 프로젝트·세계관 문서·파이프라인 관리<br>• 태그 기반 콘텐츠 분류, 즐겨찾기<br>• 프롬프트 데이터 저장/불러오기<br>• 권한 있는 작업판 컨텍스트에서 LoRA 조회<br>• 작업 히스토리 관리, 개인 설정 |
| **관리자** | • **모든 일반 사용자 기능**<br>• 작업판 생성/수정/삭제/비활성화/백업/복원<br>• 서버 관리 (ComfyUI · OpenAI 호환 · Gemini)<br>• 사용자 승인/관리, 그룹 관리<br>• LoRA 동기화 및 관리<br>• 시스템 백업/복원<br>• 시스템 통계 모니터링 |

## 최신 업데이트

- 현재 메이저 버전: **v3** — 변경 내역은 [업데이트 내역(v3)](./docs/updatelogs/v3.md) 참고
- 과거 내역: [v2](./docs/updatelogs/v2.md) · [v1](./docs/updatelogs/v1.md)
- 버전별 상세 개발 내역은 GitHub issues 의 `v{버전}` 라벨 검색으로 확인

## 문서

### 시작하기
- **[설치 가이드](./docs/INSTALLATION.md)** — 상세 설치 및 설정
- **[환경 설정](./docs/CONFIGURATION.md)** — 환경변수 및 옵션
- **[사용자 가이드](./docs/USER_GUIDE.md)** — 기능 사용법

### 개발
- **[개발 가이드](./docs/DEVELOPMENT.md)** — 개발 환경 및 기술 문서
- **[API 문서](./docs/API.md)** — REST API 엔드포인트 및 스키마
- **[ComfyUI 워크플로우](./docs/COMFYUI_WORKFLOW.md)** — 워크플로우 처리 로직
- **[LLM 추가 파라미터](./docs/LLM_EXTRA_PARAMS.md)** — 작업판별 LLM 옵션 전달
- **[MCP 서버 가이드](./docs/MCP_SERVER.md)** · **[MCP 도구 명세](./docs/MCP_SERVER_API.md)**

### 배포 & 운영
- **[배포 가이드](./docs/DEPLOYMENT.md)** — 환경별 배포 방법
- **[백업/복원](./docs/BACKUP_RESTORE.md)** — 백업·복원 절차
- **[보안 가이드](./docs/SECURITY.md)** — 보안 설정 및 모범사례
- **[유지보수 가이드](./docs/MAINTENANCE.md)** · **[문제 해결](./docs/TROUBLESHOOTING.md)**

## 주요 환경 변수

```bash
# 보안 (필수)
JWT_SECRET=your-super-secret-jwt-key-here

# 데이터베이스
MONGODB_URI=mongodb://admin:password@mongodb:27017/vcc-manager?authSource=admin
REDIS_URL=redis://:redispassword@redis:6379

# 파일 업로드
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760  # 10MB

# 백업 / 암호화
BACKUP_PATH=./backups
BACKUP_ENCRYPTION_KEY=        # openssl rand -hex 32 (백업 암호화)
CONFIG_ENCRYPTION_KEY=        # 선택 — provider 키 at-rest 암호화. 미설정 시 BACKUP_ENCRYPTION_KEY 재사용

# SMTP (비밀번호 재설정용, 선택)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# MCP 서버 (선택)
MCP_PORT=4136
```

> `.env` 가 최신 스키마와 맞는지 점검하려면 `npm run env:doctor` 를 사용하세요 (`--fix` 로 누락 키 추가, `--generate-secrets` 로 빈 시크릿 생성).

## 빠른 문제 해결

```bash
# 로그 확인
docker-compose logs -f

# 완전 재시작 (개발)
docker-compose down && docker-compose up --build -d

# ComfyUI 연결 확인
curl http://your-comfyui-server:8188/system_stats
```

자세한 내용은 [문제 해결 가이드](./docs/TROUBLESHOOTING.md) 참고.

## 라이선스

이 프로젝트는 [MIT 라이선스](./LICENSE)를 따릅니다.
