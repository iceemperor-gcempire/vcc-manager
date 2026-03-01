# VCC Manager 배포 가이드

## 개요

VCC Manager는 ComfyUI와 연동된 비주얼 콘텐츠 생성 관리 시스템입니다. Docker Compose를 사용하여 개발환경과 프로덕션 환경을 모두 지원합니다.

## 아키텍처

- **Frontend**: React 기반 웹 인터페이스 (개발: 포트 3001, 프로덕션: 포트 80)
- **Backend**: Node.js API 서버 (개발: 포트 3136, 프로덕션: 사용자 정의 포트)
- **MongoDB**: 데이터베이스 (내부 포트 27017, 프로덕션에서는 외부 노출 안함)
- **Redis**: 작업 큐 및 세션 저장소 (내부 포트 6379, 프로덕션에서는 외부 노출 안함)
- **Nginx**: Frontend 컨테이너 내장 (프록시 처리)

## 환경별 배포

### 1. 개발환경 배포

```bash
# 1. 환경 변수 설정
cp .env.example .env
# .env 파일을 수정하여 개발환경에 맞는 값 입력

# 2. 컨테이너 실행
docker-compose up -d

# 3. 접속
# Frontend: http://localhost
# Backend API: http://localhost:3136
# MongoDB: localhost:27017 (외부 접속 가능)
# Redis: localhost:6379 (외부 접속 가능)
```

### 2. 프로덕션 환경 배포

#### 2-1. 환경 변수 설정
```bash
# .env.example에서 .env 생성
cp .env.example .env

# .env 파일 편집하여 프로덕션 값 설정
# 주요 설정 항목:
# - BACKEND_PORT: 백엔드 외부 포트 (예: 3131)
# - FRONTEND_PORT: 프론트엔드 외부 포트 (예: 80)
# - MongoDB/Redis 비밀번호 변경
# - Google OAuth 설정
# - 도메인 설정
```

#### 2-2. 배포 스크립트 사용 (권장)
```bash
# 배포 스크립트 실행 권한 부여
chmod +x scripts/deploy-prod.sh

# 안전한 배포 실행 (데이터베이스 보호)
./scripts/deploy-prod.sh
```

#### 2-3. 수동 배포
```bash
# 1. 프로덕션 컨테이너 중지 (데이터베이스 제외)
docker-compose -f docker-compose.prod.yml stop frontend backend

# 2. 무캐시 빌드 (최신 변경사항 반영)
docker-compose -f docker-compose.prod.yml build --no-cache frontend backend

# 3. 모든 서비스 시작
docker-compose -f docker-compose.prod.yml up -d

# 4. 상태 확인
docker-compose -f docker-compose.prod.yml ps
docker logs vcc-backend
docker logs vcc-frontend
```

#### 2-4. 접속 및 확인
```bash
# Frontend 접속 테스트
curl -f http://localhost:${FRONTEND_PORT}/

# Backend API 접속 테스트  
curl -f http://localhost:${BACKEND_PORT}/health

# 프로덕션 접속:
# Frontend: http://your-server:80
# Backend API: http://your-server:3131/api
# MongoDB/Redis: 내부 네트워크만 접근 가능
# 
# 참고: SSL은 별도 외부 서버에서 처리 (Cloudflare Tunnel 등)
```

## 환경 변수 설정

### 개발환경 (.env)

```bash
# 서버 설정
PORT=3000
NODE_ENV=development

# 데이터베이스
MONGODB_URI=mongodb://localhost:27017/vcc-manager

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3136/auth/google/callback

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# 관리자 설정
ADMIN_EMAILS=admin@example.com

# Redis
REDIS_URL=redis://localhost:6379

# 파일 업로드
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# ComfyUI
COMFY_UI_BASE_URL=http://localhost:8188

# CORS
FRONTEND_URL=http://localhost:3001
```

### 프로덕션 환경 (.env.prod)

```bash
# Docker 포트 설정
FRONTEND_PORT=80
BACKEND_PORT=3136
HTTP_PORT=80
HTTPS_PORT=443

# 데이터베이스 보안 설정
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=secure_mongo_password_here
MONGO_DB=vcc-manager
REDIS_PASSWORD=secure_redis_password_here

# Google OAuth (프로덕션)
GOOGLE_CLIENT_ID=production_google_client_id
GOOGLE_CLIENT_SECRET=production_google_client_secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback

# 보안 키 (32자 이상)
JWT_SECRET=production_jwt_secret_min_32_chars
JWT_EXPIRES_IN=7d

# 관리자 설정
ADMIN_EMAILS=admin@yourdomain.com,admin2@yourdomain.com

# 파일 업로드
MAX_FILE_SIZE=10485760

# ComfyUI
COMFY_UI_BASE_URL=http://comfyui-server:8188

# CORS
FRONTEND_URL=https://yourdomain.com
```

## 포트 설정

모든 서비스의 포트는 환경변수를 통해 동적으로 설정할 수 있습니다.

### 사용 가능한 포트 환경변수

| 환경변수 | 기본값 | 설명 | 보안 권장사항 |
|---------|--------|------|-------------|
| `FRONTEND_PORT` | 80 | 프론트엔드 웹서버 포트 | ✅ 외부 노출 안전 |
| `BACKEND_PORT` | 3136 | 백엔드 API 서버 포트 | ⚠️ 필요시에만 노출 |
| `MONGODB_PORT` | 27017 | MongoDB 데이터베이스 포트 | ❌ 프로덕션에서 노출 금지 |
| `REDIS_PORT` | 6379 | Redis 캐시 서버 포트 | ❌ 프로덕션에서 노출 금지 |

> **🔒 보안 주의사항**: 
> - 프로덕션 환경에서는 `MONGODB_PORT`와 `REDIS_PORT`를 설정하지 마세요. 
> - `docker-compose.prod.yml`에서 이 포트들은 의도적으로 주석 처리되어 있습니다.
> - 데이터베이스는 내부 네트워크에서만 접근 가능해야 합니다.

### 포트 변경 방법

#### 1. 환경변수 파일을 통한 변경

**개발환경용 (.env)**:
```bash
# 개발환경에서는 모든 포트 변경 가능
cat >> .env << EOF
FRONTEND_PORT=8080
BACKEND_PORT=3001
MONGODB_PORT=27018  # 개발환경에서만 사용
REDIS_PORT=6380     # 개발환경에서만 사용
EOF

docker-compose up -d
```

**프로덕션환경용 (.env.production)**:
```bash
# 프로덕션에서는 데이터베이스 포트 설정 금지
cat >> .env.production << EOF
FRONTEND_PORT=80
BACKEND_PORT=3136
HTTP_PORT=80
HTTPS_PORT=443
# MONGODB_PORT=27017  # 보안상 설정하지 않음
# REDIS_PORT=6379     # 보안상 설정하지 않음
EOF

docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

#### 2. 일회성 포트 변경
```bash
# 개발환경
FRONTEND_PORT=8080 BACKEND_PORT=3001 docker-compose up -d

# 프로덕션 환경
FRONTEND_PORT=8080 HTTP_PORT=80 docker-compose -f docker-compose.prod.yml up -d
```

#### 3. 특정 서비스만 포트 변경 후 재시작
```bash
# Frontend 포트만 변경
echo "FRONTEND_PORT=8080" >> .env
docker-compose up -d frontend

# Backend 포트만 변경
echo "BACKEND_PORT=3001" >> .env
docker-compose up -d backend
```

### 포트 매핑 테이블

| 서비스 | 개발환경 기본 | 프로덕션 기본 | 환경변수 제어 | 접근성 |
|--------|---------------|---------------|---------------|---------|
| Frontend | 80 | 80 | `FRONTEND_PORT` | 외부 접근 |
| Backend | 3136 | 3136 | `BACKEND_PORT` | 외부 접근 |
| MongoDB | 27017 | 없음* | `MONGODB_PORT` | 개발: 외부, 프로덕션: 내부만 |
| Redis | 6379 | 없음* | `REDIS_PORT` | 개발: 외부, 프로덕션: 내부만 |
| Nginx | 없음 | 80, 443 | `HTTP_PORT`, `HTTPS_PORT` | 프로덕션 전용 |

*프로덕션에서는 보안상 데이터베이스 포트가 외부에 노출되지 않음

### 포트 충돌 해결

```bash
# 포트 사용 중인 프로세스 확인
lsof -i :80
lsof -i :3136

# 사용 중인 포트 변경
FRONTEND_PORT=8080 BACKEND_PORT=3001 docker-compose up -d
```

## 자동 배포 스크립트

프로덕션 배포를 위한 안전한 스크립트를 제공합니다:

### 🚀 자동 배포 스크립트 실행
```bash
# 스크립트 실행 (데이터베이스 볼륨 안전 보장)
./scripts/deploy-prod.sh
```

### 📋 스크립트 주요 기능
- ✅ **데이터베이스 볼륨 보호**: MongoDB/Redis 데이터 손실 방지
- 🔄 **노 캐시 빌드**: 최신 코드 반영 보장
- 🏥 **헬스 체크**: 배포 후 서비스 상태 자동 확인
- 💾 **백업 안내**: 배포 전 데이터 백업 권장
- 🎨 **컬러 출력**: 진행 상황을 명확하게 표시

### ⚠️ 안전 배포 원칙
```bash
# ❌ 위험한 명령어 (데이터 손실 가능)
docker-compose down --volumes  # 절대 사용 금지!

# ✅ 안전한 배포
./scripts/deploy-prod.sh  # 데이터베이스 볼륨 보호됨
```

### 🛠️ 수동 배포 (고급 사용자)
```bash
# 1. 애플리케이션만 중지 (DB는 유지)
docker-compose -f docker-compose.prod.yml --env-file .env.production stop frontend backend

# 2. 캐시 없이 빌드
docker-compose -f docker-compose.prod.yml build --no-cache

# 3. 애플리케이션 컨테이너만 재생성
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## 보안 설정

### 1. 데이터베이스 보안

```bash
# MongoDB 접근 제한 (프로덕션)
# docker-compose.prod.yml에서 포트 노출 제거됨
# ports 섹션이 주석처리되어 내부 네트워크만 접근 가능

# Redis 접근 제한 (프로덕션)
# 비밀번호 인증 + 포트 노출 제거
command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
```

### 2. SSL/TLS 설정

```bash
# SSL 인증서 폴더 생성
mkdir -p ./ssl

# 인증서 파일 배치
# ./ssl/cert.pem (공개키)
# ./ssl/key.pem (개인키)

# Nginx SSL 설정은 ./nginx/prod.conf에 정의됨
```

### 3. 방화벽 설정

```bash
# UFW를 사용한 방화벽 설정 예제
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 22/tcp    # SSH
sudo ufw deny 27017/tcp  # MongoDB (외부 차단)
sudo ufw deny 6379/tcp   # Redis (외부 차단)
sudo ufw enable
```

## 모니터링 및 관리

### 1. 컨테이너 상태 확인

```bash
# 컨테이너 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f [service_name]

# 리소스 사용량 확인
docker stats
```

### 2. 백업 및 복구

```bash
# MongoDB 백업
docker exec vcc-mongodb mongodump --uri="mongodb://admin:password@localhost:27017/vcc-manager?authSource=admin" --out=/backup

# Redis 백업
docker exec vcc-redis redis-cli --rdb /data/backup.rdb

# 볼륨 백업
docker run --rm -v vcc-manager_mongodb_data:/data -v $(pwd):/backup alpine tar czf /backup/mongodb_backup.tar.gz -C /data .
```

### 3. 업데이트

```bash
# 이미지 업데이트
docker-compose pull
docker-compose up -d --build

# 특정 서비스만 재시작
docker-compose restart

## 문제 해결

### 일반적인 문제들

#### 1. 502 Bad Gateway 오류
**증상**: 프론트엔드에서 백엔드 API 호출 시 502 오류 발생

**해결 방법**:
```bash
# 1. 백엔드 로그 확인
docker logs vcc-backend

# 2. MongoDB 연결 확인
# "MongoDB Connected" 메시지가 있는지 확인

# 3. 컨테이너 재시작
docker-compose -f docker-compose.prod.yml restart backend
```

#### 2. MongoDB 연결 실패
**증상**: `option buffermaxentries is not supported` 오류

**원인**: 최신 MongoDB 드라이버와 deprecated 옵션 충돌

**해결**: 이미 수정됨 (src/config/database.js에서 bufferMaxEntries 옵션 제거)

#### 3. Workflow JSON 파싱 오류
**증상**: 프롬프트에 줄바꿈 포함 시 JSON 파싱 에러

**해결**: 이미 수정됨 (특수문자 자동 이스케이핑 적용)

### 로그 확인 방법
```bash
# 모든 서비스 로그 실시간 모니터링
docker-compose -f docker-compose.prod.yml logs -f

# 특정 서비스 로그만 확인
docker logs vcc-backend --tail 50
docker logs vcc-frontend --tail 50

# 에러가 포함된 로그만 필터링
docker logs vcc-backend 2>&1 | grep -i error
```

### 헬스체크
```bash
# 백엔드 상태 확인
curl -f http://localhost:${BACKEND_PORT}/health

# 프론트엔드 접근 확인
curl -f http://localhost:${FRONTEND_PORT}/

# 컨테이너 상태 확인
docker-compose -f docker-compose.prod.yml ps
```

### 상세한 문제 해결 가이드
더 자세한 문제 해결 방법은 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)를 참조하세요.

---

## 참고 자료

### 관련 문서
- [개발 환경 설정](./DEVELOPMENT.md)
- [설치 가이드](./INSTALLATION.md)  
- [문제 해결 가이드](./TROUBLESHOOTING.md)

### 외부 의존성
- [Docker](https://docs.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [MongoDB](https://docs.mongodb.com/)
- [Redis](https://redis.io/documentation)
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI)

---

*이 문서는 실제 배포 경험을 바탕으로 작성되었으며, 지속적으로 업데이트됩니다.*