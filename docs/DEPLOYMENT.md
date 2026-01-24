# VCC Manager 배포 가이드

## 개요

VCC Manager는 ComfyUI와 연동된 비주얼 콘텐츠 생성 관리 시스템입니다. Docker Compose를 사용하여 개발환경과 프로덕션 환경을 모두 지원합니다.

## 아키텍처

- **Frontend**: React 기반 웹 인터페이스 (포트 80/3001)
- **Backend**: Node.js API 서버 (포트 3000)
- **MongoDB**: 데이터베이스 (포트 27017, 프로덕션에서는 내부망만)
- **Redis**: 작업 큐 및 세션 저장소 (포트 6379, 프로덕션에서는 내부망만)
- **Nginx**: 리버스 프록시 (프로덕션 전용, 포트 80/443)

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
# Backend API: http://localhost:3000
# MongoDB: localhost:27017 (외부 접속 가능)
# Redis: localhost:6379 (외부 접속 가능)
```

### 2. 프로덕션 환경 배포

```bash
# 1. 프로덕션 환경 변수 설정
cp .env.production .env.prod
# .env.prod 파일을 수정하여 프로덕션 값 입력

# 2. 보안 설정으로 컨테이너 실행
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 3. 접속
# Frontend: http://your-domain (Nginx를 통해)
# Backend API: http://your-domain/api (Nginx를 통해)
# MongoDB/Redis: 내부 네트워크만 접근 가능
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
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# 세션 및 JWT
SESSION_SECRET=your_session_secret_key
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
BACKEND_PORT=3000
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
SESSION_SECRET=production_session_secret_min_32_chars
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

### 포트 변경 방법

```bash
# Frontend 포트를 3001로 변경 (개발환경)
echo "FRONTEND_PORT=3001" >> .env
docker-compose restart frontend

# Frontend 포트를 8080으로 변경 (프로덕션)
FRONTEND_PORT=8080 docker-compose -f docker-compose.prod.yml up -d
```

### 포트 매핑

| 서비스 | 개발환경 | 프로덕션 | 접근성 |
|--------|----------|----------|---------|
| Frontend | 80 | 80 (환경변수로 변경 가능) | 외부 접근 |
| Backend | 3000 | 3000 | 외부 접근 |
| MongoDB | 27017 | 없음 | 개발: 외부, 프로덕션: 내부만 |
| Redis | 6379 | 없음 | 개발: 외부, 프로덕션: 내부만 |
| Nginx | 없음 | 80, 443 | 프로덕션 전용 |

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
docker-compose restart [service_name]
```

## 문제 해결

### 1. 일반적인 오류

```bash
# 포트 충돌 오류
netstat -tulpn | grep :80
sudo lsof -i :80

# 권한 오류
sudo chown -R $(whoami):$(whoami) ./uploads
sudo chmod -R 755 ./uploads

# 메모리 부족
docker system prune -a
docker volume prune
```

### 2. 로그 분석

```bash
# 상세 로그 확인
docker-compose logs -f --tail=100 backend

# 에러만 필터링
docker-compose logs backend 2>&1 | grep -i error

# 특정 시간대 로그
docker-compose logs --since="2024-01-01T00:00:00" --until="2024-01-01T23:59:59"
```

### 3. 성능 최적화

```bash
# Docker 메모리 제한 설정
# docker-compose.yml에서 deploy.resources.limits 사용

# Redis 메모리 최적화
redis-cli config set maxmemory 256mb
redis-cli config set maxmemory-policy allkeys-lru
```

## 추가 참고사항

- **개발환경**: 빠른 개발을 위해 모든 포트가 외부에 노출됨
- **프로덕션**: 보안을 위해 데이터베이스 포트는 내부 네트워크만 접근 가능
- **Nginx**: 프로덕션에서 리버스 프록시 및 SSL 종료점 역할
- **환경 분리**: `.env` (개발), `.env.prod` (프로덕션)으로 환경별 설정 관리
- **보안 권장사항**: 강력한 패스워드, 정기적인 업데이트, 모니터링 시스템 구축