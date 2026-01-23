# Claude Code 개발 지침

## 🐳 Docker 기반 테스트 환경

### 필수 테스트 방식
이 프로젝트는 **반드시 Docker Compose를 통해서만** 테스트해야 합니다.

```bash
# 🚫 금지: 로컬 node 실행
npm run dev  # 사용하지 말 것

# ✅ 권장: Docker Compose 사용
docker-compose down
docker-compose up --build -d
```

### 테스트 워크플로우

#### 1. 서비스 중지 및 재시작
```bash
# 기존 서비스 중지
docker-compose down

# 컨테이너 충돌 시 강제 제거
docker rm -f vcc-mongodb vcc-redis vcc-backend vcc-frontend

# 빌드 및 시작
docker-compose up --build -d
```

#### 2. 서비스 상태 확인
```bash
# 컨테이너 상태 확인
docker-compose ps

# 백엔드 로그 확인
docker-compose logs backend

# API 접근 테스트
curl -X GET "http://localhost/api/auth/status"
```

#### 3. 실시간 로그 모니터링
```bash
# 모든 서비스 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f backend
```

## 🔧 개발 환경 설정

### 환경 변수 파일
- `.env` - 로컬 개발용
- `.env.production` - 프로덕션용
- `frontend/.env` - 프론트엔드용

### 필수 확인 사항
1. MongoDB 연결 상태
2. Redis 연결 상태  
3. API 엔드포인트 접근성
4. Frontend 빌드 성공

## 🚨 주의사항

### ❌ 하지 말아야 할 것
- 로컬 Node.js로 직접 실행 (`npm run dev`)
- 포트 충돌 무시
- 컨테이너 로그 확인 생략

### ✅ 반드시 해야 할 것
- 모든 변경사항은 Docker 재빌드 후 테스트
- 컨테이너 로그로 에러 상황 확인
- API 엔드포인트 동작 검증

## 🔄 개발 프로세스

### 코드 변경 후 테스트 절차
1. **코드 수정 완료**
2. **Docker 컨테이너 재시작**:
   ```bash
   docker-compose down
   docker-compose up --build -d
   ```
3. **서비스 상태 확인**:
   ```bash
   docker-compose logs backend | tail -20
   curl -X GET "http://localhost/api/auth/status"
   ```
4. **기능 테스트 실행**
5. **로그 분석 및 디버깅**

### 문제 해결 단계
1. **컨테이너 상태 확인**: `docker-compose ps`
2. **로그 분석**: `docker-compose logs [service-name]`
3. **포트 충돌 해결**: 기존 프로세스 종료
4. **볼륨/네트워크 정리**: `docker-compose down -v`

## 📝 로그 분석 가이드

### 중요한 로그 패턴
```bash
# MongoDB 연결 확인
docker-compose logs backend | grep "MongoDB Connected"

# Redis 연결 확인  
docker-compose logs backend | grep "Redis connected"

# Queue 초기화 확인
docker-compose logs backend | grep "Job queue initialized"

# Seed 값 처리 로그
docker-compose logs backend | grep -E "(Processed seed|Invalid seed)"
```

### 에러 상황별 대응
- **포트 충돌**: 기존 컨테이너 제거 후 재시작
- **빌드 실패**: `--no-cache` 옵션으로 재빌드
- **의존성 문제**: `package.json` 변경 시 반드시 재빌드

## 🎯 테스트 체크리스트

### 기본 동작 확인
- [ ] 모든 컨테이너가 `Up` 상태
- [ ] MongoDB 연결 성공
- [ ] Redis 연결 성공
- [ ] API 엔드포인트 응답
- [ ] Frontend 접근 가능 (`http://localhost`)

### 기능별 테스트
- [ ] 사용자 인증 동작
- [ ] 작업판 목록 조회
- [ ] 이미지 생성 요청 
- [ ] Queue 시스템 동작
- [ ] 파일 업로드/다운로드

## 💡 개발 팁

### 빠른 재시작
```bash
# 백엔드만 재시작
docker-compose restart backend

# 특정 서비스만 재빌드
docker-compose up --build -d backend
```

### 데이터 초기화
```bash
# 볼륨 포함 완전 정리
docker-compose down -v

# 새로운 환경으로 시작
docker-compose up --build -d
```

### 성능 최적화
```bash
# 빌드 캐시 무시 (의존성 변경 시)
docker-compose build --no-cache

# 병렬 빌드
docker-compose up --build -d --parallel
```

---

**중요**: 이 가이드라인을 따라야만 일관된 개발 환경에서 안정적인 테스트가 가능합니다.