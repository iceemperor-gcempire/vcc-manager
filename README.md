# VCC Manager

**Visual Content Creator Manager** - ComfyUI 워크플로우 기반 AI 이미지/비디오/텍스트 생성 관리 시스템

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 프로젝트 개요

VCC Manager는 ComfyUI 워크플로우를 효율적으로 관리하고 AI 콘텐츠 생성 작업을 자동화하기 위한 종합 웹 애플리케이션입니다.

### 주요 기능

- **사용자 관리** - JWT 기반 인증, 관리자 승인 시스템 및 역할별 권한 관리
- **작업판 관리** - ComfyUI/OpenAI Compatible 워크플로우 템플릿 관리, 백업/복원 지원
- **AI 콘텐츠 생성** - 비동기 작업 큐를 통한 이미지/비디오/텍스트 생성
- **프로젝트 관리** - 프로젝트 단위 콘텐츠 분류, 전용 태그 및 즐겨찾기
- **태그 시스템** - 사용자별 개인 태그로 작업판, 이미지, 프롬프트 데이터 분류
- **LoRA 관리** - Civitai 연동 LoRA 메타데이터 조회 및 동기화
- **프롬프트 관리** - 프롬프트 저장/불러오기, AI 프롬프트 생성, 대표 이미지 자동 첨부
- **MCP 서버** - AI 에이전트 통합을 위한 MCP(Model Context Protocol) 서버 내장
- **서버 백업/복원** - AES-256 암호화 백업 및 시스템 잠금 기반 비동기 복원
- **파일 관리** - 레퍼런스 이미지 업로드, 생성 콘텐츠 관리, 다중 삭제
- **실시간 모니터링** - 간소화된 사용자 대시보드 및 관리자 통계
- **모바일 최적화** - 반응형 디자인 및 터치 친화적 인터페이스

## 빠른 시작

### 사전 요구사항
- [Docker](https://www.docker.com/) & Docker Compose
- [Git](https://git-scm.com/)

### 1분 설치
```bash
# 1. 프로젝트 복제
git clone <repository-url>
cd vcc-manager

# 2. 환경 설정
cp .env.example .env
# .env 파일에서 JWT_SECRET, MONGODB_URI 등 설정

# 3. 서비스 실행
docker-compose up -d

# 4. 접속 확인
curl http://localhost/api/auth/status
```

### 접속 URL
- **프론트엔드**: http://localhost
- **백엔드 API**: http://localhost/api
- **MCP 서버**: http://localhost:3100 (설정 시)
- **관리자**: 첫 번째 가입 사용자가 자동으로 관리자 권한 획득

## 기술 스택

<table>
<tr>
<td><strong>Frontend</strong></td>
<td><strong>Backend</strong></td>
<td><strong>Infrastructure</strong></td>
</tr>
<tr>
<td>
• React 18<br>
• Material-UI<br>
• React Query<br>
• React Router<br>
• React Hook Form
</td>
<td>
• Node.js + Express<br>
• MongoDB + Mongoose<br>
• Redis + Bull Queue<br>
• JWT Authentication<br>
• MCP Server (Streamable HTTP)
</td>
<td>
• Docker + Compose<br>
• Nginx<br>
• ComfyUI Integration<br>
• OpenAI Compatible API
</td>
</tr>
</table>

## 시스템 아키텍처

```mermaid
graph TB
    subgraph "Frontend (React)"
        A[Dashboard]
        B[Admin Panel]
        C[Gallery / Projects]
        D[Workboards]
    end

    subgraph "Backend (Node.js)"
        E[Express API]
        F[Auth System]
        G[Job Queue]
        H[File Management]
    end

    subgraph "MCP Server"
        I[Streamable HTTP]
    end

    subgraph "Data Store"
        J[(MongoDB)]
        K[(Redis)]
    end

    subgraph "External Services"
        L[ComfyUI Server]
        M[OpenAI Compatible API]
        N[Civitai API]
    end

    A --> E
    B --> E
    C --> E
    D --> E

    E --> J
    E --> L
    E --> M
    E --> N
    G --> K

    I -->|Backend API| E
```

## 사용자 역할

| 역할 | 권한 |
|------|------|
| **일반 사용자** | • 이미지/비디오/텍스트 생성 요청<br>• 갤러리 조회/다운로드<br>• 프로젝트 관리 및 즐겨찾기<br>• 태그 기반 콘텐츠 분류<br>• 프롬프트 데이터 저장/불러오기<br>• LoRA 목록 조회<br>• 작업 히스토리 관리<br>• 개인 설정 (삭제/계속 동작 옵션) |
| **관리자** | • **모든 일반 사용자 기능**<br>• 작업판 생성/수정/삭제/비활성화/백업/복원<br>• 서버 관리 (ComfyUI, OpenAI Compatible)<br>• 사용자 승인/관리<br>• LoRA 동기화 및 관리<br>• 시스템 백업/복원<br>• 시스템 통계 모니터링 |

## 최신 업데이트

최신 변경사항은 [업데이트 내역](./docs/updatelogs/v1.md)을 참조하세요.

### v1.3 주요 변경사항
- **작업판 백업/복원** - 내보내기/가져오기 기능으로 작업판 설정 이동 (#52)
- **MCP Server HTTP 전환** - stdio에서 Streamable HTTP로 전환 및 Docker 분리
- **다중 삭제** - 이미지 목록에서 선택 항목 일괄 삭제 및 검색 결과 전체 삭제 (#17)
- **프로젝트 기능** - 프로젝트 단위 콘텐츠 관리, 커버 이미지, 즐겨찾기 (#51, #63)
- **태그 통합** - 태그 검색과 관리 메뉴 통합, 드래그앤드롭 순서 변경 (#61, #62)
- **iOS 다운로드 개선** - 표준 다운로드 방식으로 통일, iOS 워크어라운드 제거 (#69)

### v1.2 주요 변경사항
- **작업판 타입 개편** - apiFormat (ComfyUI/OpenAI Compatible) + outputFormat (image/video/text) (#48)
- **프롬프트 관리** - 저장/불러오기, AI 생성, 대표 이미지 자동 첨부 (#11, #49)
- **LoRA 관리** - Civitai 연동, 메타데이터 조회, NSFW 필터 (#45)
- **서버 백업/복원** - AES-256 암호화, 비동기 실행, 시스템 잠금 (#44)
- **비밀번호 재설정** - SMTP 기반 이메일 인증 (#47)
- **비디오 생성** - 비디오 출력 지원 및 VideoViewerDialog 컴포넌트
- **태그 시스템** - 사용자별 개인 태그, 작업판/이미지/프롬프트 데이터 분류 (#18)
- **MCP 서버** - AI 에이전트 연동을 위한 MCP 서버 추가

## 문서

### 시작하기
- **[설치 가이드](./docs/INSTALLATION.md)** - 상세한 설치 및 설정 방법
- **[환경 설정](./docs/CONFIGURATION.md)** - 환경변수 및 설정 옵션
- **[사용자 가이드](./docs/USER_GUIDE.md)** - 기능 사용법

### 개발
- **[개발 가이드](./docs/DEVELOPMENT.md)** - 개발 환경 설정 및 기술 문서
- **[API 문서](./docs/API.md)** - REST API 엔드포인트 및 스키마
- **[ComfyUI 워크플로우](./docs/COMFYUI_WORKFLOW.md)** - 워크플로우 처리 로직
- **[MCP 서버 가이드](./docs/MCP_SERVER.md)** - MCP 서버 설정 및 사용법

### 배포 & 운영
- **[배포 가이드](./docs/DEPLOYMENT.md)** - 환경별 배포 방법
- **[보안 가이드](./docs/SECURITY.md)** - 보안 설정 및 모범사례
- **[유지보수 가이드](./docs/MAINTENANCE.md)** - 시스템 운영 및 관리

### 참고자료
- **[업데이트 내역](./docs/updatelogs/v1.md)** - 버전별 변경사항
- **[문제 해결](./docs/TROUBLESHOOTING.md)** - 일반적인 문제 해결방법

## 주요 환경 변수

```bash
# 보안 (필수)
JWT_SECRET=your-super-secret-jwt-key-here
SESSION_SECRET=your-session-secret-here

# 데이터베이스
MONGODB_URI=mongodb://admin:password@mongodb:27017/vcc-manager?authSource=admin
REDIS_URL=redis://:redispassword@redis:6379

# 파일 업로드
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760  # 10MB

# 백업 (선택사항)
BACKUP_PATH=./backups
BACKUP_ENCRYPTION_KEY=  # openssl rand -hex 32

# SMTP (비밀번호 재설정용, 선택사항)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# MCP 서버 (선택사항)
MCP_PORT=3100
MCP_EMAIL=mcp-agent@your-domain.com
MCP_PASSWORD=your-mcp-password
```

## 빠른 문제 해결

### 컨테이너가 시작되지 않는 경우
```bash
# 로그 확인
docker-compose logs -f

# 완전 재시작
docker-compose down -v
docker-compose up --build -d
```

### 이미지 생성이 작동하지 않는 경우
```bash
# ComfyUI 연결 확인
curl http://your-comfyui-server:8188/system_stats

# Redis 큐 상태 확인
curl http://localhost/api/jobs/queue/stats
```

## 기여하기

1. **Fork** 및 **Clone**
2. **기능 브랜치** 생성 (`git checkout -b feature/amazing-feature`)
3. **커밋** (`git commit -m 'feat: add amazing feature'`)
4. **Push** (`git push origin feature/amazing-feature`)
5. **Pull Request** 생성

### 커밋 규칙
- **feat**: 새로운 기능
- **fix**: 버그 수정
- **docs**: 문서 변경
- **refactor**: 리팩토링
- **chore**: 빌드, 설정 변경

## 시스템 통계

- **지원 미디어 형식**: PNG, JPEG, WebP (이미지) / MP4 (비디오)
- **최대 파일 크기**: 10MB (설정 가능)
- **동시 작업 처리**: 5개 (설정 가능)
- **Seed 범위**: 64비트 부호있는 정수

## 라이선스

이 프로젝트는 [MIT 라이선스](./LICENSE)를 따릅니다.

## 지원 및 문의

- **버그 리포트**: [GitHub Issues](../../issues)
- **기능 요청**: [GitHub Discussions](../../discussions)
- **보안 문제**: SECURITY.md 참조

---

<p align="center">
  <sub>마지막 업데이트: 2026년 2월 12일</sub>
</p>
