# Visual Content Creator (VCC) Manager - 개발 문서

## 프로젝트 개요

VCC Manager는 ComfyUI 워크플로우를 관리하고 이미지 생성 작업을 효율적으로 처리하기 위한 웹 애플리케이션입니다.

### 주요 기능
- **사용자 관리**: JWT 기반 인증, 역할별 권한 관리 (admin/user)
- **작업판 관리**: ComfyUI 워크플로우 템플릿 관리 (관리자 전용)
- **이미지 생성**: 작업 큐를 통한 비동기 이미지 생성
- **파일 관리**: 레퍼런스 이미지 업로드 및 생성 이미지 관리
- **모니터링**: 실시간 작업 상태 및 시스템 통계

## 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   External      │
│   (React)       │    │  (Node.js)      │    │   Services      │
│                 │    │                 │    │                 │
│ - React 18      │◄──►│ - Express.js    │◄──►│ - ComfyUI       │
│ - Material-UI   │    │ - MongoDB       │    │ - Redis         │
│ - React Query   │    │ - Bull Queue    │    │                 │
│ - React Router  │    │ - Multer        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
        v                       v                       v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Nginx       │    │    Database     │    │   File System   │
│  (Reverse Proxy)│    │   (MongoDB)     │    │   (Uploads)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 프로젝트 구조

```
vcc-manager-claude/
├── frontend/                 # React 프론트엔드
│   ├── src/
│   │   ├── components/      # 공통 컴포넌트
│   │   │   └── admin/       # 관리자 전용 컴포넌트
│   │   ├── pages/           # 페이지 컴포넌트
│   │   ├── services/        # API 서비스
│   │   ├── contexts/        # React Context
│   │   └── config/          # 설정 파일
│   └── package.json
├── src/                     # Node.js 백엔드
│   ├── routes/              # API 라우트
│   ├── models/              # MongoDB 모델
│   ├── services/            # 비즈니스 로직
│   ├── middleware/          # Express 미들웨어
│   ├── config/              # 설정 파일
│   └── utils/               # 유틸리티 함수
├── docker-compose.yml       # Docker 구성
├── Dockerfile.frontend      # 프론트엔드 Docker 이미지
├── Dockerfile.backend       # 백엔드 Docker 이미지
├── nginx.conf               # Nginx 설정
└── uploads/                 # 업로드된 파일
```

## 환경 설정

### 필수 환경변수

#### 백엔드 (.env)
```bash
# 데이터베이스
MONGODB_URI=mongodb://admin:password@mongodb:27017/vcc-manager?authSource=admin

# Redis (작업 큐)
REDIS_URL=redis://:redispassword@redis:6379
REDIS_PASSWORD=redispassword

# JWT 인증
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# 파일 업로드
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# 기타
NODE_ENV=production
PORT=3000
FRONTEND_URL=http://localhost:3001
```

#### 프론트엔드 (frontend/.env)
```bash
# API 설정
REACT_APP_API_URL=/api

# 모니터링 업데이트 주기 (밀리초)
REACT_APP_QUEUE_STATUS_INTERVAL=5000    # 작업 큐 상태: 5초
REACT_APP_RECENT_JOBS_INTERVAL=15000    # 최근 작업: 15초
REACT_APP_USER_STATS_INTERVAL=30000     # 사용자 통계: 30초
```

## 개발 환경 시작

### 1. 의존성 설치
```bash
# 백엔드
npm install

# 프론트엔드
cd frontend && npm install
```

### 2. Docker Compose로 실행
```bash
# 전체 서비스 시작
docker-compose up -d

# 개발 환경으로 시작
docker-compose -f docker-compose.dev.yml up -d
```

### 3. 개별 서비스 실행
```bash
# 백엔드 (포트 3000)
npm start

# 프론트엔드 (포트 3001)
cd frontend && npm start
```

## 주요 컴포넌트 설명

### 백엔드 서비스

#### 1. 인증 시스템 (`src/routes/auth.js`)
- JWT 기반 토큰 인증
- 사용자 등록/로그인/로그아웃
- 역할별 접근 권한 관리

#### 2. 작업판 관리 (`src/routes/workboards.js`)
- ComfyUI 워크플로우 템플릿 CRUD
- 관리자 전용 편집 권한
- 동적 입력 필드 설정

#### 3. 이미지 생성 작업 (`src/services/queueService.js`)
- Bull Queue를 통한 비동기 작업 처리
- ComfyUI WebSocket 통신
- 진행률 추적 및 상태 관리

#### 4. 파일 관리 (`src/routes/images.js`)
- Multer를 통한 파일 업로드
- 이미지 메타데이터 관리
- 레퍼런스 이미지 연결

### 프론트엔드 컴포넌트

#### 1. 인증 컨텍스트 (`frontend/src/contexts/AuthContext.js`)
- 전역 사용자 상태 관리
- 토큰 자동 갱신
- 권한별 라우팅

#### 2. 관리자 대시보드 (`frontend/src/components/admin/AdminDashboard.js`)
- 시스템 통계 모니터링
- 실시간 작업 큐 상태
- 사용자 및 작업 관리

#### 3. 작업판 관리 (`frontend/src/components/admin/WorkboardManagement.js`)
- 워크플로우 템플릿 편집
- 동적 입력 필드 구성
- JSON 워크플로우 데이터 관리

## API 엔드포인트

### 인증 관련
```
POST /api/auth/signin          # 로그인
POST /api/auth/signup          # 회원가입
POST /api/auth/logout          # 로그아웃
GET  /api/auth/me              # 현재 사용자 정보
```

### 작업판 관리
```
GET    /api/workboards         # 작업판 목록 (일반 사용자)
GET    /api/workboards/:id     # 작업판 상세 (일반 사용자)
GET    /api/workboards/admin/:id # 작업판 상세 (관리자, workflowData 포함)
POST   /api/workboards         # 작업판 생성 (관리자)
PUT    /api/workboards/:id     # 작업판 수정 (관리자)
DELETE /api/workboards/:id     # 작업판 삭제 (관리자)
```

### 이미지 생성
```
POST /api/jobs/generate        # 이미지 생성 작업 요청
GET  /api/jobs/my             # 내 작업 목록
GET  /api/jobs/:id            # 작업 상세 정보
POST /api/jobs/:id/retry      # 작업 재시도
POST /api/jobs/:id/cancel     # 작업 취소
```

### 파일 관리
```
GET  /api/images/uploaded     # 업로드된 이미지 목록
GET  /api/images/generated    # 생성된 이미지 목록
POST /api/images/upload       # 이미지 업로드
GET  /uploads/generated/:filename # 생성된 이미지 다운로드
```

## 데이터베이스 스키마

### User 모델
```javascript
{
  email: String,
  password: String (hashed),
  nickname: String,
  isAdmin: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Workboard 모델
```javascript
{
  name: String,
  description: String,
  serverUrl: String,
  isActive: Boolean,
  baseInputFields: {
    aiModel: [SelectOption],
    imageSizes: [SelectOption],
    // ...
  },
  additionalInputFields: [InputField],
  workflowData: String, // JSON
  createdBy: ObjectId,
  version: Number,
  usageCount: Number
}
```

### ImageGenerationJob 모델
```javascript
{
  userId: ObjectId,
  workboardId: ObjectId,
  status: String, // 'pending'|'processing'|'completed'|'failed'
  inputData: {
    prompt: String,
    negativePrompt: String,
    aiModel: String,
    // ...
  },
  resultImages: [ObjectId],
  progress: Number,
  error: Object,
  createdAt: Date,
  completedAt: Date
}
```

## 트러블슈팅

### 일반적인 문제들

#### 1. 이미지가 표시되지 않는 경우
**원인**: nginx 정적 파일 라우팅 설정 문제
**해결**: `nginx.conf`에서 `/uploads` 경로가 백엔드로 프록시되도록 설정 확인

```nginx
location /uploads {
    proxy_pass http://backend:3000;
    # ... proxy headers
}
```

#### 2. 작업이 즉시 완료되는 경우
**원인**: ComfyUI가 동일한 시드/파라미터에 대해 이전 결과 재사용
**해결**: 시드값 변경 또는 워크플로우 파라미터 수정

#### 3. 작업 큐가 작동하지 않는 경우
**원인**: Redis 연결 문제 또는 Bull Queue 초기화 실패
**해결**: Redis 연결 확인 및 환경변수 검증

```bash
# Redis 연결 확인
docker-compose logs redis

# 백엔드 로그 확인
docker-compose logs backend
```

#### 4. 워크플로우 JSON이 저장되지 않는 경우
**원인**: `ImageGenerationJob.updateStatus()` 메서드에서 resultImages 처리 누락
**해결**: updateStatus 메서드에 resultImages 필드 처리 추가

### 개발 도구

#### 로그 확인
```bash
# 전체 서비스 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f backend
docker-compose logs -f frontend
```

#### 데이터베이스 접근
```bash
# MongoDB 접속
docker-compose exec mongodb mongosh "mongodb://admin:password@localhost:27017/vcc-manager?authSource=admin"
```

#### Redis 상태 확인
```bash
# Redis CLI 접속
docker-compose exec redis redis-cli -a redispassword
```

## 배포

### 프로덕션 배포
```bash
# 프로덕션 이미지 빌드
docker-compose build

# 프로덕션 환경 시작
docker-compose up -d
```

### 환경별 설정
- **개발**: `docker-compose.dev.yml` 사용
- **프로덕션**: `docker-compose.yml` 사용

## 향후 개발 계획

### 단기 목표
1. 작업 우선순위 설정 기능
2. 이미지 메타데이터 편집 기능
3. 배치 작업 처리 기능

### 중기 목표
1. 사용자별 할당량 관리
2. 워크플로우 버전 관리
3. API 율한계 설정

### 장기 목표
1. 다중 ComfyUI 서버 지원
2. 플러그인 시스템
3. 고급 모니터링 및 알림

## 기여 가이드라인

1. **코드 스타일**: ESLint 및 Prettier 설정 준수
2. **커밋 메시지**: Conventional Commits 형식 사용
3. **테스트**: 새로운 기능에 대한 테스트 코드 작성
4. **문서**: 변경사항에 대한 문서 업데이트

## 라이선스

[라이선스 정보 추가 필요]

---
**마지막 업데이트**: 2026-01-22
**작성자**: Claude Code Assistant