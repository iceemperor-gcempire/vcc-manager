# VCC Manager 설치 가이드

## 🚀 빠른 시작 (Docker - 권장)

### 사전 요구사항
- **Docker** & **Docker Compose**
- **Git**

### 1단계: 프로젝트 복제
```bash
git clone <repository-url>
cd vcc-manager
```

### 2단계: 환경 설정
```bash
# 환경 변수 파일 복사
cp .env.example .env
cp frontend/.env.example frontend/.env

# 필수 환경 변수 설정 (.env 파일 편집)
nano .env
```

### 3단계: 서비스 실행
```bash
# 모든 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

### 4단계: 접속 확인
- **프론트엔드**: http://localhost
- **백엔드 API**: http://localhost/api
- **상태 확인**: `curl http://localhost/api/auth/status`

---

## 🔧 수동 설치 (개발 환경)

### 사전 요구사항
- **Node.js** 18+
- **MongoDB** 7.0+
- **Redis** 7.0+
- **ComfyUI** (선택사항)

### 1. MongoDB 설치
```bash
# Ubuntu/Debian
sudo apt install mongodb-org

# macOS (Homebrew)
brew install mongodb-community

# Docker
docker run -d -p 27017:27017 --name mongodb mongo:7.0
```

### 2. Redis 설치
```bash
# Ubuntu/Debian
sudo apt install redis-server

# macOS (Homebrew)
brew install redis

# Docker
docker run -d -p 6379:6379 --name redis redis:7.2-alpine
```

### 3. 백엔드 설정
```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집 필요

# 개발 서버 실행
npm run dev
```

### 4. 프론트엔드 설정
```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 실행 (포트 3001)
npm start
```

---

## ⚙️ 환경 변수 설정

### 필수 환경변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `JWT_SECRET` | JWT 암호화 키 (32자 이상) | `your-super-secret-jwt-key-here` |
| `MONGODB_URI` | MongoDB 연결 URI | `mongodb://localhost:27017/vcc-manager` |
| `REDIS_URL` | Redis 연결 URL | `redis://localhost:6379` |

### 포트 환경변수 (선택사항)

Docker Compose에서 모든 서비스의 포트를 환경변수로 제어할 수 있습니다:

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `FRONTEND_PORT` | 80 | 프론트엔드 웹서버 포트 |
| `BACKEND_PORT` | 3136 | 백엔드 API 서버 포트 |
| `MONGODB_PORT` | 27017 | MongoDB 데이터베이스 포트 |
| `REDIS_PORT` | 6379 | Redis 캐시 서버 포트 |
| `HTTP_PORT` | 80 | Nginx HTTP 포트 (프로덕션 전용) |
| `HTTPS_PORT` | 443 | Nginx HTTPS 포트 (프로덕션 전용) |

```bash
# 포트 설정 예시
echo "FRONTEND_PORT=8080" >> .env
echo "BACKEND_PORT=3001" >> .env
docker-compose up -d
```

### Google OAuth 설정 (선택사항)

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. OAuth 2.0 클라이언트 ID 생성
4. 환경변수 설정:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3136/api/auth/google/callback
```

### 파일 업로드 설정

```bash
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760  # 10MB
```

### ComfyUI 연동 (선택사항)

```bash
COMFY_UI_BASE_URL=http://your-comfyui-server:8188
```

---

## 🔍 설치 확인

### 1. 서비스 상태 확인
```bash
# Docker 환경
docker-compose ps
docker-compose logs backend

# 수동 설치
curl http://localhost:3136/health
```

### 2. 데이터베이스 연결 확인
```bash
# MongoDB
mongosh "mongodb://localhost:27017/vcc-manager"

# Redis
redis-cli ping
```

### 3. 기본 기능 테스트
```bash
# API 상태 확인
curl http://localhost:3136/api/auth/status

# 프론트엔드 접속
# 브라우저에서 http://localhost 방문
```

---

## 🚨 문제 해결

### 포트 충돌
```bash
# 포트 사용 중인 프로세스 확인
lsof -i :3136
lsof -i :3001
lsof -i :27017
lsof -i :6379

# 프로세스 종료
kill -9 <PID>
```

### MongoDB 연결 오류
- MongoDB 서비스 실행 상태 확인
- `MONGODB_URI` 환경변수 확인
- 방화벽 설정 확인

### Redis 연결 오류
- Redis 서비스 실행 상태 확인
- `REDIS_URL` 환경변수 확인
- 비밀번호 설정 확인

### Docker 관련 문제
```bash
# 이미지 재빌드
docker-compose build --no-cache

# 볼륨 정리
docker-compose down -v
docker-compose up -d
```

---

## 🔐 초기 관리자 설정

1. **자동 관리자**: `.env`의 `ADMIN_EMAILS`에 이메일 등록
2. **수동 관리자**: 첫 번째 가입 사용자가 자동으로 관리자 권한 획득
3. **관리자 기능**: 작업판 관리, 시스템 모니터링, 사용자 관리

---

## 📚 다음 단계

설치 완료 후 다음 문서들을 참조하세요:

- **[환경 설정](./CONFIGURATION.md)** - 상세한 설정 옵션
- **[개발 가이드](./DEVELOPMENT.md)** - 개발 환경 구성
- **[사용법](./USER_GUIDE.md)** - 기본 사용법
- **[문제 해결](./TROUBLESHOOTING.md)** - 일반적인 문제 해결

---

**도움이 필요하시면 GitHub Issues에 문의해 주세요.**