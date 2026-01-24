# VCC Manager

**Visual Content Creator Manager** - ComfyUI 워크플로우 관리 및 AI 이미지 생성 시스템

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎯 프로젝트 개요

VCC Manager는 ComfyUI 워크플로우를 효율적으로 관리하고 AI 이미지 생성 작업을 자동화하기 위한 종합 웹 애플리케이션입니다.

### ✨ 주요 기능

- 🔐 **사용자 관리** - JWT 기반 인증 및 역할별 권한 관리
- 📋 **작업판 관리** - ComfyUI 워크플로우 템플릿 관리 (관리자)
- 🎨 **AI 이미지 생성** - 비동기 작업 큐를 통한 안정적인 이미지 생성  
- 📁 **파일 관리** - 레퍼런스 이미지 업로드 및 생성 이미지 관리
- 📊 **실시간 모니터링** - 작업 상태 및 시스템 통계 대시보드
- 🎲 **고급 기능** - 시드 값 관리, 배치 처리, 진행률 추적

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

## 👥 사용자 역할

| 역할 | 권한 |
|------|------|
| **일반 사용자** | • 이미지 생성 요청<br>• 갤러리 조회/다운로드<br>• 작업 히스토리 관리<br>• 레퍼런스 이미지 업로드 |
| **관리자** | • **모든 일반 사용자 기능**<br>• 작업판 생성/수정/삭제<br>• 시스템 통계 모니터링<br>• 사용자 관리<br>• 전체 시스템 설정 |

## 📚 문서

### 🚀 시작하기
- **[설치 가이드](./docs/INSTALLATION.md)** - 상세한 설치 및 설정 방법
- **[환경 설정](./docs/CONFIGURATION.md)** - 환경변수 및 설정 옵션

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