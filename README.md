# VCC Manager

**Visual Content Creator Manager** - ComfyUI 워크플로우 관리 및 AI 이미지 생성 시스템

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎯 프로젝트 개요

VCC Manager는 ComfyUI 워크플로우를 효율적으로 관리하고 AI 이미지 생성 작업을 자동화하기 위한 종합 웹 애플리케이션입니다.

### ✨ 주요 기능

- 🔐 **사용자 관리** - JWT 기반 인증, 관리자 승인 시스템 및 역할별 권한 관리
- 📋 **작업판 관리** - ComfyUI 워크플로우 템플릿 관리 (관리자)
- 🎨 **AI 이미지 생성** - 비동기 작업 큐를 통한 안정적인 이미지 생성  
- 📁 **파일 관리** - 레퍼런스 이미지 업로드 및 생성 이미지 관리
- 📊 **실시간 모니터링** - 간소화된 사용자 대시보드 및 관리자 통계
- 📱 **모바일 최적화** - 반응형 디자인 및 터치 친화적 인터페이스
- 🔄 **데이터 무결성** - 작업 삭제 시 연관 이미지 자동 정리
- 💾 **크로스 브라우저** - iPhone Safari 포함 모든 주요 브라우저 지원

## 🚀 빠른 시작

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
- **관리자**: 첫 번째 가입 사용자가 자동으로 관리자 권한 획득

## 🛠️ 기술 스택

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
• React Router
</td>
<td>
• Node.js + Express<br>
• MongoDB + Mongoose<br>
• Redis + Bull Queue<br>
• JWT Authentication
</td>
<td>
• Docker + Compose<br>
• Nginx<br>
• ComfyUI Integration
</td>
</tr>
</table>

## 🏗️ 시스템 아키텍처

```mermaid
graph TB
    subgraph "Frontend (React)"
        A[Dashboard]
        B[Admin Panel]
        C[Gallery]
        D[Workboards]
    end
    
    subgraph "Backend (Node.js)"
        E[Express API]
        F[Auth System]
        G[Job Queue]
        H[File Management]
    end
    
    subgraph "External Services"
        I[ComfyUI Server]
        J[MongoDB]
        K[Redis]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
    
    E --> I
    F --> J
    G --> K
    H --> J
```

## 👥 사용자 역할 (v1.1.0 업데이트)

| 역할 | 권한 | 새로운 기능 |
|------|------|-------------|
| **일반 사용자** | • 이미지 생성 요청<br>• 갤러리 조회/다운로드<br>• 작업 히스토리 관리<br>• 레퍼런스 이미지 업로드 | • **승인 시스템**: 가입 후 관리자 승인 필요<br>• **간소화 대시보드**: 핵심 정보만 표시<br>• **모바일 최적화**: 햄버거 메뉴 및 반응형 디자인<br>• **향상된 다운로드**: iPhone Safari 지원 |
| **관리자** | • **모든 일반 사용자 기능**<br>• 작업판 생성/수정/삭제<br>• 시스템 통계 모니터링<br>• 사용자 관리<br>• 전체 시스템 설정 | • **사용자 승인 관리**: 가입 승인/거절<br>• **확장된 사용자 관리**: 검색, 필터링, 삭제<br>• **향상된 통계**: 상세 시스템 모니터링 |

## 🆕 최신 업데이트 (v1.1.0 - 2026-01-27)

### ✨ 주요 개선사항
- **📱 모바일 최적화**: 햄버거 메뉴, 반응형 디자인, 터치 친화적 UI
- **👥 사용자 승인 시스템**: 신규 가입자 관리자 승인 워크플로우
- **📊 간소화된 대시보드**: 일반 사용자를 위한 핵심 정보 중심 구성
- **🔧 bug fixes**: iPhone Safari 다운로드, 페이지네이션 오버플로우 등 해결

### 🛠️ 수정된 이슈들
- **#1**: iPhone Safari 이미지 다운로드 오류 → blob 기반 다운로드로 해결
- **#3**: 작업 삭제 시 연관 이미지 정리 → cascade 삭제 구현  
- **#4**: 프로덕션 종료 스크립트 오류 → Docker Compose 방식으로 수정
- **#6**: 모바일 메뉴 접근성 → 햄버거 메뉴 및 대시보드 개선

## 📚 문서

### 🚀 시작하기
- **[설치 가이드](./docs/INSTALLATION.md)** - 상세한 설치 및 설정 방법
- **[환경 설정](./docs/CONFIGURATION.md)** - 환경변수 및 설정 옵션
- **[사용자 가이드](./docs/USER_GUIDE.md)** - 신규/업데이트된 기능 사용법

### 🛠️ 개발 
- **[개발 가이드](./docs/DEVELOPMENT.md)** - 개발 환경 설정 및 기술 문서
- **[API 문서](./docs/API.md)** - REST API 엔드포인트 및 스키마  
- **[ComfyUI 워크플로우](./docs/COMFYUI_WORKFLOW.md)** - 워크플로우 처리 로직
- **[Claude Code 가이드](./docs/CLAUDE_CODE.md)** - Claude Code 전용 개발 지침

### 🚀 배포 & 운영
- **[배포 가이드](./docs/DEPLOYMENT.md)** - 환경별 배포 방법
- **[보안 가이드](./docs/SECURITY.md)** - 보안 설정 및 모범사례
- **[유지보수 가이드](./docs/MAINTENANCE.md)** - 시스템 운영 및 관리

### 📋 참고자료
- **[변경 로그](./CHANGELOG.md)** - 버전별 변경사항
- **[문제 해결](./docs/TROUBLESHOOTING.md)** - 일반적인 문제 해결방법

## 🔧 주요 환경 변수

```bash
# 보안 (필수)
JWT_SECRET=your-super-secret-jwt-key-here
SESSION_SECRET=your-session-secret-here

# 데이터베이스
MONGODB_URI=mongodb://admin:password@mongodb:27017/vcc-manager?authSource=admin
REDIS_URL=redis://:redispassword@redis:6379

# ComfyUI 연동 (선택사항)  
COMFY_UI_BASE_URL=http://your-comfyui-server:8188

# 파일 업로드
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760  # 10MB
```

## 🚨 빠른 문제 해결

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

## 🤝 기여하기

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
- **test**: 테스트 추가

## 📊 시스템 통계

- **지원 이미지 형식**: PNG, JPEG, WebP
- **최대 파일 크기**: 10MB (설정 가능)
- **동시 작업 처리**: 5개 (설정 가능)
- **Seed 범위**: 64비트 부호있는 정수

## 📄 라이선스

이 프로젝트는 [MIT 라이선스](./LICENSE)를 따릅니다.

## 📞 지원 및 문의

- **버그 리포트**: [GitHub Issues](../../issues)
- **기능 요청**: [GitHub Discussions](../../discussions)  
- **보안 문제**: SECURITY.md 참조

---

<p align="center">
  <strong>VCC Manager</strong>로 AI 이미지 생성을 더욱 효율적으로 관리하세요! 🎨✨
</p>

<p align="center">
  <sub>개발: Claude Code Assistant | 마지막 업데이트: 2026년 1월 24일</sub>
</p>