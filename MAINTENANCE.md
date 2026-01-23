# VCC Manager - 유지보수 가이드

## 일상적인 유지보수 작업

### 시스템 모니터링

#### 1. 서비스 상태 확인
```bash
# 모든 서비스 상태 확인
docker-compose ps

# 서비스별 리소스 사용량
docker stats

# 디스크 사용량 확인
df -h
du -sh uploads/
```

#### 2. 로그 모니터링
```bash
# 실시간 로그 확인
docker-compose logs -f

# 에러 로그만 확인
docker-compose logs | grep -i error

# 특정 시간대 로그
docker-compose logs --since="2026-01-22T10:00:00" --until="2026-01-22T12:00:00"
```

#### 3. 데이터베이스 상태
```bash
# MongoDB 연결 확인
docker-compose exec mongodb mongosh "mongodb://admin:password@localhost:27017/vcc-manager?authSource=admin" --eval "db.runCommand('ping')"

# 컬렉션 상태 확인
docker-compose exec mongodb mongosh "mongodb://admin:password@localhost:27017/vcc-manager?authSource=admin" --eval "
  db.users.countDocuments();
  db.workboards.countDocuments();
  db.imagegenerationjobs.countDocuments();
"
```

#### 4. Redis 큐 상태
```bash
# Redis 연결 확인
docker-compose exec redis redis-cli -a redispassword ping

# 큐 상태 확인
docker-compose exec redis redis-cli -a redispassword info memory
docker-compose exec redis redis-cli -a redispassword keys "*"
```

### 정기 정리 작업

#### 1. 로그 로테이션
```bash
# Docker 로그 정리 (30일 이상 된 로그)
docker system prune -f
docker-compose logs --since 720h > /dev/null

# 시스템 로그 확인
sudo journalctl --disk-usage
sudo journalctl --vacuum-time=30d
```

#### 2. 파일 정리
```bash
# 30일 이상 된 생성 이미지 정리 (주의: 데이터베이스와 동기화 필요)
find uploads/generated -name "*.png" -mtime +30 -type f

# 임시 파일 정리
find /tmp -name "upload_*" -mtime +1 -delete
```

#### 3. 데이터베이스 최적화
```javascript
// MongoDB에서 실행
db.imagegenerationjobs.deleteMany({
  status: "failed",
  createdAt: { $lt: new Date(Date.now() - 30*24*60*60*1000) }
});

// 인덱스 재구축
db.imagegenerationjobs.reIndex();
db.generatedimages.reIndex();
```

### 백업 절차

#### 1. 데이터베이스 백업
```bash
# MongoDB 전체 백업
docker-compose exec mongodb mongodump --uri="mongodb://admin:password@localhost:27017/vcc-manager?authSource=admin" --out="/backup/$(date +%Y%m%d)"

# 백업 파일 압축
tar -czf "backup_$(date +%Y%m%d_%H%M%S).tar.gz" /backup/$(date +%Y%m%d)

# 원격 저장소로 백업 (예: AWS S3)
# aws s3 cp backup_$(date +%Y%m%d_%H%M%S).tar.gz s3://your-backup-bucket/
```

#### 2. 파일 시스템 백업
```bash
# 업로드된 파일 백업
rsync -av uploads/ /backup/uploads_$(date +%Y%m%d)/

# 설정 파일 백업
cp docker-compose.yml /backup/config/
cp nginx.conf /backup/config/
cp .env /backup/config/
```

#### 3. 백업 복원
```bash
# 데이터베이스 복원
docker-compose exec mongodb mongorestore --uri="mongodb://admin:password@localhost:27017/vcc-manager?authSource=admin" /backup/20260122/vcc-manager/

# 파일 복원
rsync -av /backup/uploads_20260122/ uploads/
```

### 성능 최적화

#### 1. 데이터베이스 최적화
```javascript
// 느린 쿼리 분석
db.setProfilingLevel(2, { slowms: 100 });
db.system.profile.find().limit(5).sort({ ts: -1 }).pretty();

// 인덱스 사용률 확인
db.imagegenerationjobs.explain("executionStats").find({ userId: ObjectId("...") });

// 필요시 새 인덱스 생성
db.imagegenerationjobs.createIndex({ "createdAt": -1, "status": 1 });
```

#### 2. Redis 최적화
```bash
# 메모리 사용량 확인
docker-compose exec redis redis-cli -a redispassword info memory

# 만료된 키 정리
docker-compose exec redis redis-cli -a redispassword eval "return redis.call('del', unpack(redis.call('keys', ARGV[1])))" 0 "bull:*:completed*"

# Redis 설정 최적화 (필요시 redis.conf 수정)
# maxmemory 2gb
# maxmemory-policy allkeys-lru
```

#### 3. 이미지 파일 최적화
```bash
# 이미지 압축 (PNG → WebP 변환)
find uploads/generated -name "*.png" -exec sh -c 'cwebp -q 80 "$1" -o "${1%.png}.webp"' _ {} \;

# 원본 파일 확인 후 정리
# (주의: 데이터베이스 URL 업데이트 필요)
```

### 보안 관리

#### 1. 정기 보안 점검
```bash
# 컨테이너 보안 스캔
docker scan vcc-manager-claude-backend
docker scan vcc-manager-claude-frontend

# 취약점 업데이트 확인
docker-compose pull
npm audit --audit-level high
```

#### 2. 인증서 관리 (HTTPS 사용시)
```bash
# Let's Encrypt 인증서 갱신
certbot renew --dry-run

# 인증서 상태 확인
openssl x509 -in /etc/letsencrypt/live/domain.com/cert.pem -text -noout
```

#### 3. 접근 로그 분석
```bash
# 의심스러운 접근 패턴 확인
docker-compose logs nginx | grep -E "(404|403|500)" | tail -100

# IP별 요청 빈도 확인
docker-compose logs nginx | awk '{print $1}' | sort | uniq -c | sort -nr | head -20
```

### 문제 해결 절차

#### 1. 서비스 재시작
```bash
# 개별 서비스 재시작
docker-compose restart backend
docker-compose restart frontend
docker-compose restart redis
docker-compose restart mongodb

# 전체 서비스 재시작
docker-compose restart
```

#### 2. 설정 변경 반영
```bash
# 환경변수 변경 후
docker-compose down
docker-compose up -d

# nginx 설정 변경 후
docker-compose build frontend
docker-compose up -d frontend
```

#### 3. 데이터베이스 연결 문제
```bash
# MongoDB 연결 확인
docker-compose exec backend node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected'))
  .catch(err => console.error('Error:', err));
"

# Redis 연결 확인
docker-compose exec backend node -e "
const Redis = require('redis');
const client = Redis.createClient({ url: process.env.REDIS_URL });
client.connect().then(() => console.log('Connected')).catch(console.error);
"
```

#### 4. 큐 작업 문제
```bash
# 대기 중인 작업 확인
docker-compose exec redis redis-cli -a redispassword keys "*waiting*"

# 실패한 작업 정리
docker-compose exec redis redis-cli -a redispassword keys "*failed*" | xargs docker-compose exec redis redis-cli -a redispassword del

# 큐 재시작
docker-compose restart backend
```

### 업데이트 절차

#### 1. 의존성 업데이트
```bash
# 백엔드 패키지 업데이트
npm update
npm audit fix

# 프론트엔드 패키지 업데이트
cd frontend
npm update
npm audit fix
```

#### 2. Docker 이미지 업데이트
```bash
# 베이스 이미지 업데이트
docker-compose build --pull

# 새 이미지로 재배포
docker-compose down
docker-compose up -d
```

#### 3. 배포 전 체크리스트
- [ ] 백업 완료 확인
- [ ] 테스트 환경에서 검증
- [ ] 의존성 충돌 확인
- [ ] 환경변수 업데이트
- [ ] 데이터베이스 마이그레이션 (필요시)
- [ ] 로드밸런서 설정 (필요시)

### 모니터링 알림 설정

#### 1. 시스템 리소스 알림
```bash
# 디스크 사용률 90% 이상시 알림
df -h | awk '$5 >= 90 {print $0}' | mail -s "Disk Usage Alert" admin@domain.com

# 메모리 사용률 확인
free -m | awk 'NR==2{printf "Memory Usage: %.2f%%\n", $3*100/$2}'
```

#### 2. 애플리케이션 상태 모니터링
```javascript
// 헬스체크 엔드포인트 활용
fetch('/api/health')
  .then(response => {
    if (!response.ok) {
      // 알림 발송
      console.error('Health check failed');
    }
  })
  .catch(error => {
    // 서비스 다운 알림
    console.error('Service unavailable');
  });
```

### 비상 연락처 및 절차

#### 1. 서비스 장애 시
1. 즉시 서비스 상태 확인
2. 로그 수집 및 분석
3. 필요시 서비스 재시작
4. 사용자 공지 (필요시)
5. 근본 원인 분석 및 대응

#### 2. 보안 사고 시
1. 즉시 영향받은 서비스 격리
2. 로그 보존 및 분석
3. 패스워드 및 토큰 무효화
4. 보안 패치 적용
5. 사후 분석 및 개선방안 수립

### 정기 점검 체크리스트

#### 매일
- [ ] 서비스 상태 확인
- [ ] 에러 로그 점검
- [ ] 디스크 사용량 확인
- [ ] 큐 작업 상태 확인

#### 매주
- [ ] 백업 상태 확인
- [ ] 성능 지표 분석
- [ ] 보안 로그 검토
- [ ] 의존성 업데이트 확인

#### 매월
- [ ] 전체 시스템 백업
- [ ] 성능 최적화 검토
- [ ] 보안 취약점 스캔
- [ ] 용량 계획 검토

---
**마지막 업데이트**: 2026-01-22  
**담당자**: 시스템 관리자  
**비상 연락처**: [연락처 정보 추가 필요]