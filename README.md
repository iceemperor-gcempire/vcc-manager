# VCC Manager

Visual Content Creator Manager - ComfyUI 워크플로우 관리 및 이미지 생성 시스템

## 🚀 프로젝트 개요

VCC Manager는 ComfyUI 워크플로우를 효율적으로 관리하고 이미지 생성 작업을 자동화하기 위한 종합 관리 시스템입니다.

### ✨ 주요 기능

- **🔐 사용자 관리**: JWT 기반 인증 및 역할별 권한 관리
- **📋 작업판 관리**: ComfyUI 워크플로우 템플릿 관리 (관리자 전용)
- **🎨 이미지 생성**: 비동기 작업 큐를 통한 안정적인 이미지 생성
- **📁 파일 관리**: 레퍼런스 이미지 업로드 및 생성 이미지 관리
- **📊 실시간 모니터링**: 작업 상태 및 시스템 통계 대시보드

## 🛠️ 기술 스택

### Frontend
- **React 18** - 모던 React 훅 기반 개발
- **Material-UI** - 일관된 디자인 시스템
- **React Query** - 효율적인 데이터 페칭 및 캐싱
- **React Router** - 클라이언트 사이드 라우팅

### Backend  
- **Node.js** + **Express.js** - RESTful API 서버
- **MongoDB** + **Mongoose** - 문서형 데이터베이스
- **Redis** + **Bull Queue** - 작업 큐 및 세션 관리
- **JWT** - 인증 토큰 관리

### Infrastructure
- **Docker** + **Docker Compose** - 컨테이너 기반 배포
- **Nginx** - 리버스 프록시 및 정적 파일 서빙

## 🚀 빠른 시작

### 사전 요구사항
- Docker & Docker Compose
- Node.js 18+ (로컬 개발용)
- ComfyUI 서버 (외부 서비스)

### 1. 프로젝트 클론 및 설정

```bash
git clone <repository-url>
cd vcc-manager-claude

# 환경 변수 설정
cp .env.example .env
cp frontend/.env.example frontend/.env

# 환경 변수 편집 (MongoDB, Redis, JWT 시크릿 등)
nano .env
```

### 2. Docker Compose로 실행

```bash
# 전체 서비스 시작
docker-compose up -d

# 서비스 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f
```

### 3. 접속 확인
- **프론트엔드**: http://localhost
- **백엔드 API**: http://localhost/api
- **관리자 계정**: 첫 번째 가입 사용자가 자동으로 관리자로 설정됩니다.

## 📚 문서

- **[개발 가이드](DEVELOPMENT.md)** - 상세한 개발 및 기술 문서
- **[유지보수 가이드](MAINTENANCE.md)** - 시스템 운영 및 관리 절차
- **[변경 로그](CHANGELOG.md)** - 버전별 변경사항
- **[설치 가이드](SETUP.md)** - 세부 설치 및 설정 방법

## 🏗️ 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   External      │
│   (React)       │    │  (Node.js)      │    │   Services      │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │◄──►│ ┌─────────────┐ │◄──►│ ┌─────────────┐ │
│ │ Dashboard   │ │    │ │ Express API │ │    │ │ ComfyUI     │ │
│ │ Admin Panel │ │    │ │ Auth System │ │    │ │ Server      │ │
│ │ Gallery     │ │    │ │ Job Queue   │ │    │ └─────────────┘ │
│ │ Workboards  │ │    │ │ File Mgmt   │ │    │ ┌─────────────┐ │
│ └─────────────┘ │    │ └─────────────┘ │    │ │ Redis       │ │
└─────────────────┘    └─────────────────┘    │ │ MongoDB     │ │
        │                       │              │ └─────────────┘ │
        v                       v              └─────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                        Nginx (Port 80)                         │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐│
│  │ Static Files        │    │ API Proxy                       ││
│  │ (React Build)       │    │ (/api/* → backend:3000)        ││
│  │                     │    │ (/uploads/* → backend:3000)    ││
│  └─────────────────────┘    └─────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 👥 사용자 역할

### 일반 사용자 (User)
- 작업판을 선택하여 이미지 생성 요청
- 생성된 이미지 갤러리 조회 및 다운로드
- 작업 히스토리 확인 및 관리
- 레퍼런스 이미지 업로드 및 사용

### 관리자 (Admin)
- **모든 일반 사용자 기능** + 추가 관리 기능
- 작업판 생성, 수정, 삭제
- 시스템 전체 통계 및 모니터링
- 사용자 관리 및 시스템 설정
- 전체 이미지 및 작업 관리

## 🔧 주요 설정

### 환경 변수

#### 백엔드 (.env)
```bash
# 데이터베이스
MONGODB_URI=mongodb://admin:password@mongodb:27017/vcc-manager?authSource=admin

# 인증
JWT_SECRET=your-secure-jwt-secret-key
JWT_EXPIRES_IN=7d

# Redis (작업 큐)
REDIS_URL=redis://:redispassword@redis:6379
REDIS_PASSWORD=redispassword

# 파일 업로드
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760  # 10MB

# 서버 설정
PORT=3000
NODE_ENV=production
FRONTEND_URL=http://localhost
```

#### 프론트엔드 (frontend/.env)
```bash
# API 설정
REACT_APP_API_URL=/api

# 모니터링 업데이트 주기 (밀리초)
REACT_APP_QUEUE_STATUS_INTERVAL=5000    # 작업 큐: 5초
REACT_APP_RECENT_JOBS_INTERVAL=15000    # 최근 작업: 15초
REACT_APP_USER_STATS_INTERVAL=30000     # 통계: 30초
```

## 🛡️ 보안 기능

- **JWT 토큰 기반 인증** - 안전한 세션 관리
- **역할 기반 접근 제어** - 관리자/사용자 권한 분리
- **파일 업로드 검증** - 타입 및 크기 제한
- **CORS 정책** - 크로스 오리진 요청 제한
- **Helmet.js** - 보안 헤더 설정
- **Rate Limiting** - API 요청 제한

## 🔄 개발 워크플로우

### 로컬 개발 환경
```bash
# 백엔드 개발
npm run dev

# 프론트엔드 개발
cd frontend && npm start

# 데이터베이스 초기화
npm run db:seed
```

### 프로덕션 빌드
```bash
# 전체 빌드
docker-compose build

# 프로덕션 배포
docker-compose up -d
```

## 📊 모니터링 대시보드

### 시스템 통계
- 전체 사용자 수 및 활성 사용자
- 작업판 개수 및 사용률
- 이미지 생성 통계 및 용량
- 작업 큐 상태 (대기/처리/완료/실패)

### 실시간 모니터링
- 현재 처리 중인 작업
- 최근 완료된 작업
- 시스템 리소스 사용량
- 에러 및 알림 상태

## 🚨 문제 해결

### 일반적인 문제들

#### 이미지가 표시되지 않는 경우
```bash
# nginx 설정 확인
docker-compose logs frontend

# 파일 존재 확인
docker-compose exec backend ls -la uploads/generated/

# 권한 확인
docker-compose exec backend chmod 755 uploads/
```

#### 작업이 처리되지 않는 경우
```bash
# Redis 연결 확인
docker-compose exec redis redis-cli -a redispassword ping

# 큐 상태 확인
curl http://localhost/api/jobs/queue/stats

# 백엔드 재시작
docker-compose restart backend
```

#### ComfyUI 연결 문제
```bash
# ComfyUI 서버 상태 확인
curl http://your-comfyui-server:8188/system_stats

# 워크플로우 유효성 검증
# 관리자 패널에서 작업판 테스트 기능 사용
```

## 🤝 기여하기

1. Fork 및 Clone
2. 기능 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경사항 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 Push (`git push origin feature/AmazingFeature`)
5. Pull Request 생성

### 커밋 메시지 규칙
- **feat**: 새로운 기능 추가
- **fix**: 버그 수정
- **docs**: 문서 변경
- **style**: 코드 스타일 변경
- **refactor**: 리팩토링
- **test**: 테스트 코드 추가

## 📄 라이선스

이 프로젝트는 [MIT 라이선스](LICENSE)를 따릅니다.

## 📞 지원 및 문의

- **이슈 리포트**: [GitHub Issues](../../issues)
- **기능 요청**: [GitHub Discussions](../../discussions)
- **문서**: [Wiki](../../wiki)

---

**개발**: Claude Code Assistant  
**마지막 업데이트**: 2026년 1월 22일