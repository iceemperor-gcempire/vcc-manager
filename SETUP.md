# Visual Content Creator 시스템 셋업 가이드

## 📋 사전 요구사항

- **Node.js**: v18.0.0 이상
- **MongoDB**: v4.4 이상
- **Redis**: v6.0 이상
- **ComfyUI**: 별도 설치 (AI 이미지 생성용)

## 🚀 빠른 시작 (Docker 사용)

### 1. 저장소 클론
```bash
git clone <repository-url>
cd vcc-manager-claude
```

### 2. 환경변수 설정
```bash
cp .env.example .env
```

### 3. 필수 환경변수 수정
`.env` 파일을 편집하여 다음 값들을 설정하세요:

```bash
# 보안 관련 (필수)
SESSION_SECRET=your_very_secure_session_secret_here
JWT_SECRET=your_very_secure_jwt_secret_here

# Google OAuth 설정 (필수)
GOOGLE_CLIENT_ID=your_google_client_id_from_console
GOOGLE_CLIENT_SECRET=your_google_client_secret_from_console

# 관리자 이메일 설정
ADMIN_EMAILS=admin@yourdomain.com,admin2@yourdomain.com

# 데이터베이스 비밀번호 (Docker용)
MONGO_ROOT_PASSWORD=your_secure_mongo_password
REDIS_PASSWORD=your_secure_redis_password
```

### 4. Docker 컨테이너 실행
```bash
docker-compose up -d
```

### 5. 브라우저에서 접속
- 프론트엔드: http://localhost
- 백엔드 API: http://localhost:3000
- Health Check: http://localhost:3000/health

---

## 🔧 개발 환경 수동 설치

### 1. MongoDB 설치 및 실행
```bash
# Ubuntu/Debian
sudo apt-get install mongodb

# macOS (Homebrew)
brew install mongodb-community
brew services start mongodb-community

# 또는 Docker 사용
docker run -d -p 27017:27017 --name mongodb mongo:7.0
```

### 2. Redis 설치 및 실행
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS (Homebrew)
brew install redis
brew services start redis

# 또는 Docker 사용
docker run -d -p 6379:6379 --name redis redis:7.2-alpine
```

### 3. 백엔드 설치 및 실행
```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일 편집 (아래 환경변수 섹션 참조)

# 개발 서버 실행
npm run dev

# 또는 프로덕션 실행
npm start
```

### 4. 프론트엔드 설치 및 실행
```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 실행 (localhost:3001)
npm start

# 또는 빌드 후 배포
npm run build
```

---

## ⚙️ 환경변수 상세 설정

### 필수 환경변수

| 변수명 | 설명 | 예시값 |
|--------|------|--------|
| `JWT_SECRET` | JWT 토큰 암호화 키 (32자 이상 권장) | `super_secure_jwt_secret_key_here` |
| `SESSION_SECRET` | 세션 암호화 키 (32자 이상 권장) | `super_secure_session_secret_key` |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID | `123456789.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 시크릿 | `GOCSPX-abcdef123456` |

### 기본 환경변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `PORT` | 백엔드 서버 포트 | `3000` |
| `NODE_ENV` | 실행 환경 | `development` |
| `MONGODB_URI` | MongoDB 연결 URI | `mongodb://localhost:27017/vcc-manager` |
| `REDIS_URL` | Redis 연결 URL | `redis://localhost:6379` |
| `FRONTEND_URL` | 프론트엔드 URL (CORS용) | `http://localhost:3001` |

### 선택사항 환경변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `ADMIN_EMAILS` | 관리자 이메일 목록 (콤마로 구분) | - |
| `UPLOAD_PATH` | 파일 업로드 경로 | `./uploads` |
| `MAX_FILE_SIZE` | 최대 파일 크기 (bytes) | `10485760` (10MB) |
| `COMFY_UI_BASE_URL` | ComfyUI 서버 URL | `http://localhost:8188` |
| `JWT_EXPIRES_IN` | JWT 토큰 만료 시간 | `7d` |

---

## 🔐 Google OAuth 설정

### 1. Google Cloud Console 설정
1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" > "사용자 인증 정보" 이동
4. "사용자 인증 정보 만들기" > "OAuth 2.0 클라이언트 ID" 선택

### 2. OAuth 설정
- **애플리케이션 유형**: 웹 애플리케이션
- **승인된 자바스크립트 원본**: 
  - `http://localhost:3000` (개발환경)
  - `https://yourdomain.com` (프로덕션)
- **승인된 리디렉션 URI**:
  - `http://localhost:3000/api/auth/google/callback` (개발환경)
  - `https://yourdomain.com/api/auth/google/callback` (프로덕션)

### 3. 환경변수 설정
생성된 클라이언트 ID와 클라이언트 시크릿을 `.env` 파일에 추가:
```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

---

## 🚀 프로덕션 배포

### Docker 배포
```bash
# 프로덕션 환경변수 설정
cp .env.example .env
# .env 파일에서 프로덕션 값으로 수정

# 이미지 빌드 및 실행
docker-compose -f docker-compose.yml up -d

# 로그 확인
docker-compose logs -f
```

### 수동 배포
```bash
# 백엔드 빌드는 필요없음 (Node.js)
# 프론트엔드 빌드
cd frontend
npm run build

# 빌드된 파일을 웹서버에 배포
# (Nginx, Apache 등)

# 백엔드 실행 (PM2 사용 권장)
npm install -g pm2
pm2 start src/server.js --name "vcc-backend"
```

---

## 🔍 문제해결

### 1. 백엔드 서버 시작 실패
```bash
# MongoDB 연결 확인
mongosh # 또는 mongo

# Redis 연결 확인
redis-cli ping

# 로그 확인
npm run dev
```

### 2. Google OAuth 오류
- Google Cloud Console에서 도메인 설정 확인
- 환경변수 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 확인
- 콜백 URL이 정확히 설정되었는지 확인

### 3. JWT 토큰 오류
- `JWT_SECRET` 환경변수가 설정되었는지 확인
- 토큰 만료 시간 확인 (`JWT_EXPIRES_IN`)

### 4. 파일 업로드 오류
- `UPLOAD_PATH` 디렉토리 권한 확인
- `MAX_FILE_SIZE` 설정 확인

### 5. 포트 충돌
```bash
# 포트 사용 중인 프로세스 확인
lsof -i :3000
lsof -i :3001

# 프로세스 종료
kill -9 <PID>
```

---

## 📱 기본 사용법

### 1. 회원가입/로그인
- Google OAuth 또는 이메일/비밀번호로 회원가입
- 비밀번호는 8자 이상, 대소문자/숫자/특수문자 포함 필요

### 2. 관리자 권한
- `.env`의 `ADMIN_EMAILS`에 등록된 이메일로 가입하면 자동으로 관리자 권한 부여
- 관리자는 사용자 관리, 시스템 통계 등 확인 가능

### 3. 이미지 생성
- 워크보드 생성 후 템플릿 설정
- ComfyUI 연동으로 AI 이미지 생성
- 생성된 이미지 다운로드 및 관리

---

## 🆘 지원

문제가 발생하거나 질문이 있으시면:
1. 이 가이드의 문제해결 섹션 확인
2. 로그 파일 확인 (`docker-compose logs` 또는 `npm run dev`)
3. GitHub Issues 등록

**Happy Creating! 🎨**