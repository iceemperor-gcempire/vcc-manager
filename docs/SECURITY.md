# VCC Manager 보안 가이드

## 개요

VCC Manager의 보안 설정 및 모범 사례에 대한 가이드입니다. 개발환경과 프로덕션 환경의 보안 차이점과 권장 설정을 다룹니다.

## 보안 아키텍처

### 개발환경 vs 프로덕션 환경

| 구분 | 개발환경 | 프로덕션 |
|------|----------|----------|
| 데이터베이스 포트 | 외부 노출 (27017) | 내부 네트워크만 |
| Redis 포트 | 외부 노출 (6379) | 내부 네트워크만 |
| 인증 | 기본 설정 | 강력한 패스워드 |
| SSL/TLS | 선택사항 | 필수 |
| 방화벽 | 선택사항 | 필수 |

## 1. 네트워크 보안

### Docker 네트워크 분리

```yaml
# docker-compose.prod.yml
networks:
  vcc-network:
    driver: bridge
    internal: false  # 외부 통신 허용
```

### 포트 접근 제어

```yaml
# 프로덕션: 데이터베이스 포트 비노출
mongodb:
  # ports 섹션 제거 또는 주석처리
  # - "27017:27017"  # 외부 접근 차단
  networks:
    - vcc-network

redis:
  # ports 섹션 제거 또는 주석처리  
  # - "6379:6379"   # 외부 접근 차단
  networks:
    - vcc-network
```

### 방화벽 설정

```bash
# UFW 방화벽 설정
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 필수 포트만 허용
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS

# 데이터베이스 포트 명시적 차단
sudo ufw deny 27017/tcp   # MongoDB
sudo ufw deny 6379/tcp    # Redis

sudo ufw enable
sudo ufw status verbose
```

## 2. 인증 및 권한 관리

### MongoDB 보안

```bash
# 강력한 루트 패스워드 설정
MONGO_ROOT_PASSWORD=$(openssl rand -base64 32)
echo "MONGO_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}" >> .env.prod

# 별도 애플리케이션 사용자 생성 (권장)
docker exec -it vcc-mongodb mongosh --authenticationDatabase admin -u admin -p

use vcc-manager
db.createUser({
  user: "vcc-app",
  pwd: "strong_app_password",
  roles: [
    { role: "readWrite", db: "vcc-manager" }
  ]
})
```

### Redis 보안

```bash
# 강력한 Redis 패스워드 설정
REDIS_PASSWORD=$(openssl rand -base64 32)
echo "REDIS_PASSWORD=${REDIS_PASSWORD}" >> .env.prod

# Redis 보안 설정
command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD} --protected-mode yes
```

### Google OAuth 보안

```bash
# 프로덕션용 Google OAuth 앱 생성
# - Google Cloud Console에서 별도 프로젝트 생성
# - 승인된 리디렉션 URI만 등록
# - 클라이언트 ID/시크릿 분리 관리

GOOGLE_CLIENT_ID=production_only_client_id
GOOGLE_CLIENT_SECRET=production_only_client_secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback
```

## 3. 데이터 보안

### JWT 토큰 보안

```bash
# 강력한 JWT 시크릿 생성 (256비트 이상)
JWT_SECRET=$(openssl rand -base64 64)

# JWT 설정
JWT_EXPIRES_IN=7d        # 적절한 만료 시간
JWT_ALGORITHM=HS256      # 안전한 알고리즘
```

### 파일 업로드 보안

```javascript
// 파일 타입 제한
const allowedTypes = [
  'image/jpeg',
  'image/png', 
  'image/webp',
  'application/json'
];

// 파일 크기 제한
MAX_FILE_SIZE=10485760  // 10MB

// 업로드 경로 보안
UPLOAD_PATH=/app/uploads  // 컨테이너 내부 경로
```

### 데이터베이스 백업 암호화

```bash
# 암호화된 MongoDB 백업
docker exec vcc-mongodb mongodump \
  --uri="mongodb://admin:${MONGO_ROOT_PASSWORD}@localhost:27017/vcc-manager?authSource=admin" \
  --gzip --archive | gpg --cipher-algo AES256 --compress-algo 1 \
  --symmetric --output backup-$(date +%Y%m%d).gpg
```

## 4. SSL/TLS 설정

### Nginx SSL 설정

```bash
# SSL 인증서 디렉토리 생성
mkdir -p ./ssl
chmod 700 ./ssl

# Let's Encrypt 인증서 생성 (권장)
sudo apt-get install certbot
sudo certbot certonly --standalone -d yourdomain.com

# 인증서 복사
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/key.pem
sudo chown $(whoami):$(whoami) ./ssl/*.pem
```

### Nginx 보안 설정

```nginx
# ./nginx/prod.conf
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL 설정
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # 보안 헤더
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # SSL 보안 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
}

# HTTP to HTTPS 리디렉션
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## 5. 로깅 및 모니터링

### 보안 로깅

```bash
# Docker 로그 설정
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"

# 보안 이벤트 로그 모니터링
docker-compose logs backend | grep -E "(login|auth|error|fail)"
```

### 침입 탐지

```bash
# Fail2ban 설정 (접근 시도 차단)
sudo apt-get install fail2ban

# /etc/fail2ban/jail.local
[nginx-auth]
enabled = true
filter = nginx-auth
logpath = /var/log/nginx/access.log
maxretry = 3
bantime = 3600
```

## 6. 환경별 보안 체크리스트

### 개발환경

- [ ] `.env` 파일을 Git에 커밋하지 않음
- [ ] 기본 패스워드 사용 (개발용만)
- [ ] HTTP 접속 허용
- [ ] 데이터베이스 포트 외부 노출 (디버깅용)

### 프로덕션 환경

- [ ] 강력한 패스워드 사용 (32자 이상)
- [ ] 데이터베이스 포트 외부 차단
- [ ] SSL/TLS 인증서 적용
- [ ] 방화벽 설정 완료
- [ ] 보안 헤더 적용
- [ ] 정기 백업 설정
- [ ] 로그 모니터링 설정
- [ ] 취약점 스캔 실행

## 7. 보안 사고 대응

### 사고 발생 시 즉시 조치

```bash
# 1. 컨테이너 즉시 중단
docker-compose down

# 2. 로그 백업
docker-compose logs > security_incident_$(date +%Y%m%d_%H%M%S).log

# 3. 패스워드 변경
# MongoDB, Redis, JWT 시크릿 모두 재생성

# 4. 방화벽 강화
sudo ufw deny from [suspicious_ip]

# 5. 백업에서 복구 (필요시)
```

### 정기 보안 점검

```bash
# 매주 실행
#!/bin/bash
# security_check.sh

# 1. 컨테이너 취약점 스캔
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image vcc-manager_backend:latest

# 2. 포트 스캔
nmap -sS localhost

# 3. 로그 분석
grep -E "(fail|error|attack)" /var/log/nginx/access.log

# 4. 패스워드 강도 확인
echo "Check password strength manually"
```

## 8. 규정 준수

### 개인정보보호

- 사용자 데이터 암호화 저장
- 접근 로그 기록 및 보관
- 데이터 삭제 정책 수립
- GDPR/개인정보보호법 준수

### 백업 및 복구

```bash
# 자동 백업 스크립트 (crontab)
0 2 * * * /path/to/backup_script.sh

# backup_script.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
docker exec vcc-mongodb mongodump --uri="..." --gzip --archive > backup_${DATE}.gz
gpg --cipher-algo AES256 --symmetric --output backup_${DATE}.gpg backup_${DATE}.gz
rm backup_${DATE}.gz
```

이 보안 가이드를 따라 구현하면 VCC Manager를 안전하게 운영할 수 있습니다.