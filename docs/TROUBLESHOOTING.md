# 문제 해결 가이드 (Troubleshooting Guide)

이 문서는 VCC Manager 운영 중 발생할 수 있는 주요 문제들과 해결 방법을 정리한 것입니다.

## 목차
- [502 Bad Gateway 오류](#502-bad-gateway-오류)
- [MongoDB 연결 오류](#mongodb-연결-오류)
- [Workflow JSON 파싱 오류](#workflow-json-파싱-오류)
- [Docker 컨테이너 이슈](#docker-컨테이너-이슈)
- [프로덕션 배포 이슈](#프로덕션-배포-이슈)

## 502 Bad Gateway 오류

### 증상
```
2026/01/25 11:10:30 [error] 33#33: *8 connect() failed (111: Connection refused) while connecting to upstream
```

### 원인 분석
1. **백엔드 컨테이너 미실행**: MongoDB 연결 실패로 인한 백엔드 서비스 다운
2. **포트 설정 불일치**: 프론트엔드-백엔드 간 포트 매핑 문제
3. **네트워크 연결 문제**: Docker 네트워크 내 컨테이너 간 통신 실패

### 해결 과정

#### 1단계: 컨테이너 상태 확인
```bash
docker ps | grep vcc
docker logs vcc-backend
docker logs vcc-frontend
```

#### 2단계: 네트워크 연결 테스트
```bash
# 프론트엔드에서 백엔드로 연결 테스트
docker exec vcc-frontend curl -f http://backend:3000/health
docker exec vcc-frontend nslookup backend
```

#### 3단계: 포트 매핑 확인
```bash
docker inspect vcc-backend | grep '"IPAddress"'
docker port vcc-backend
```

#### 4단계: 백엔드 서비스 상태 확인
```bash
docker exec vcc-backend netstat -tlnp | grep 3000
docker exec vcc-backend curl -f http://localhost:3000/health
```

### 해결 방법
- MongoDB 연결 문제 해결 (아래 섹션 참조)
- 컨테이너 재시작: `docker-compose -f docker-compose.prod.yml restart`
- 완전 재빌드: `docker-compose -f docker-compose.prod.yml down && docker-compose -f docker-compose.prod.yml up -d`

---

## MongoDB 연결 오류

### 증상
```
Error connecting to MongoDB (attempt 1/5): option buffermaxentries is not supported
Failed to connect to MongoDB after 5 attempts. Exiting...
```

### 원인
- `bufferMaxEntries` 옵션이 최신 MongoDB 드라이버에서 deprecated됨
- MongoDB 7.0과 Mongoose 8.x 버전 호환성 문제

### 해결 방법

#### 1단계: 연결 옵션 수정
`src/config/database.js` 파일에서 deprecated 옵션 제거:

```javascript
// ❌ 이전 (문제 있는 코드)
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferMaxEntries: 0,  // ← 이 옵션 제거 필요
  bufferCommands: false,
};

// ✅ 수정된 코드
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false, // bufferMaxEntries 옵션 제거
};
```

#### 2단계: 컨테이너 재빌드
```bash
docker-compose -f docker-compose.prod.yml stop backend
docker-compose -f docker-compose.prod.yml build --no-cache backend
docker-compose -f docker-compose.prod.yml start backend
```

#### 3단계: 연결 확인
```bash
docker logs vcc-backend | grep "MongoDB Connected"
```

### 예방 방법
- MongoDB 드라이버 업데이트 시 deprecated 옵션 확인
- 연결 옵션에 대한 테스트 케이스 작성 (`src/tests/database.test.js`)

---

## Workflow JSON 파싱 오류

### 증상
```
SyntaxError: Unexpected token in JSON at position X
```
- Prompt나 negative prompt에 줄바꿈, 따옴표 등 특수문자 포함 시 발생

### 원인
1. **특수문자 미이스케이핑**: JSON 문자열에 안전하지 않은 문자 포함
2. **이중 이스케이핑**: 이스케이핑이 중복 적용되어 백슬래시가 2배로 나타남

### 해결 과정

#### 1단계: 특수문자 이스케이핑 함수 개선
```javascript
const escapeForJsonString = (value) => {
  if (typeof value === 'string') {
    return value
      .replace(/\\/g, '\\\\')  // 역슬래시
      .replace(/"/g, '\\"')    // 큰따옴표  
      .replace(/\n/g, '\\n')   // 줄바꿈
      .replace(/\r/g, '\\r')   // 캐리지 리턴
      .replace(/\t/g, '\\t');  // 탭
  }
  return value;
};
```

#### 2단계: 이중 이스케이핑 방지
```javascript
// ❌ 이전 (이중 이스케이핑 발생)
const replacements = {
  '{{##prompt##}}': { value: escapeForJsonString(inputData.prompt), type: 'string' }
};
// replaceInObject에서 다시 한 번 escapeForJsonString 적용

// ✅ 수정된 코드
const replacements = {
  '{{##prompt##}}': { value: inputData.prompt, type: 'string' } // 미리 이스케이핑 안함
};
// replaceInObject에서 필요시에만 적용
```

#### 3단계: 선택적 이스케이핑 적용
- **직접 플레이스홀더 치환**: 원본 값 그대로 사용 (이스케이핑 없음)
- **부분 문자열 치환**: 이스케이핑 적용

### 테스트 케이스
`src/tests/queueService.test.js`에서 다음 시나리오들을 검증:
- 줄바꿈이 포함된 prompt 처리
- 따옴표, 탭, 캐리지 리턴 등 특수문자 처리
- 이중 이스케이핑 방지
- 직접 치환 vs 부분 치환 구분

---

## Docker 컨테이너 이슈

### 포트 설정 문제

#### 증상
- 외부에서 서비스 접근 불가
- 컨테이너 간 통신 실패

#### 해결 방법
1. `.env` 파일에서 포트 설정 확인:
   ```bash
   BACKEND_PORT=3131
   FRONTEND_PORT=80
   ```

2. docker-compose.prod.yml에서 포트 매핑 확인:
   ```yaml
   services:
     backend:
       ports:
         - "${BACKEND_PORT:-3000}:3000"
   ```

### 컨테이너 재시작 루프

#### 증상
```bash
docker ps
# STATUS에 "Restarting" 상태가 계속 나타남
```

#### 해결 방법
1. 로그 확인: `docker logs [container_name]`
2. 헬스체크 실패 확인
3. 의존성 서비스(MongoDB, Redis) 상태 확인

---

## 프로덕션 배포 이슈

### .env 파일 관리

#### 보안 문제 방지
```bash
# .env 파일이 git에 추가되지 않도록 확인
git status
# 만약 .env가 추적되고 있다면:
echo ".env" >> .gitignore
git rm --cached .env
git commit -m "Remove .env from tracking"
```

#### 환경 설정 확인
1. `.env.example`에서 `.env` 생성
2. 프로덕션 값으로 설정:
   ```bash
   MONGO_ROOT_PASSWORD=secure_password_here
   REDIS_PASSWORD=secure_redis_password
   ```

### 네트워크 보안

#### MongoDB/Redis 외부 포트 노출 방지
```yaml
# ✅ 프로덕션 설정 (내부 네트워크만)
services:
  mongodb:
    # ports 섹션 주석 처리 또는 제거
    # ports:
    #   - "27017:27017"
    networks:
      - vcc-network

  redis:
    # ports 섹션 주석 처리 또는 제거  
    # ports:
    #   - "6379:6379"
    networks:
      - vcc-network
```

### 배포 스크립트 활용

#### 안전한 배포
```bash
# deploy-prod.sh 사용
chmod +x scripts/deploy-prod.sh
./scripts/deploy-prod.sh

# 수동 배포 시
docker-compose -f docker-compose.prod.yml down frontend backend
docker-compose -f docker-compose.prod.yml build --no-cache frontend backend
docker-compose -f docker-compose.prod.yml up -d
```

#### 헬스체크 확인
```bash
# 백엔드 헬스체크
curl -f http://localhost:3131/health

# 프론트엔드 접근 테스트
curl -f http://localhost/
```

---

## 일반적인 문제 해결 도구

### 로그 모니터링
```bash
# 모든 컨테이너 로그
docker-compose -f docker-compose.prod.yml logs

# 특정 서비스 로그 (실시간)
docker-compose -f docker-compose.prod.yml logs -f backend

# 최근 N개 라인만
docker logs vcc-backend --tail 20
```

### 컨테이너 내부 접근
```bash
# 백엔드 컨테이너 쉘 접근
docker exec -it vcc-backend sh

# 프론트엔드 컨테이너 접근
docker exec -it vcc-frontend sh
```

### 네트워크 디버깅
```bash
# Docker 네트워크 정보
docker network ls
docker network inspect vcc-manager_vcc-network

# 컨테이너 IP 확인
docker inspect vcc-backend | grep '"IPAddress"'
```

### 리소스 사용량 확인
```bash
# 컨테이너 리소스 사용량
docker stats

# 디스크 사용량 확인
docker system df
```

---

## 문제 예방을 위한 베스트 프랙티스

1. **정기적인 헬스체크**: 모니터링 시스템 구축
2. **로그 로테이션**: 디스크 공간 관리
3. **백업 전략**: 데이터베이스 정기 백업
4. **테스트 케이스**: 주요 기능에 대한 자동화된 테스트
5. **문서화**: 변경사항과 해결 과정 기록

## 추가 도움말

문제가 지속되거나 이 가이드에서 다루지 않은 문제가 발생하면:
1. GitHub Issues에 문제 상황 상세히 기록
2. 관련 로그와 환경 정보 함께 제공
3. 재현 가능한 최소 예제 작성

---

*이 문서는 실제 문제 해결 경험을 바탕으로 작성되었으며, 새로운 이슈 발견 시 지속적으로 업데이트됩니다.*