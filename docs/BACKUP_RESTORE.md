# 백업 및 복구 가이드

VCC Manager 시스템의 전체 데이터를 백업하고 복구하는 방법을 설명합니다.

## 개요

백업 기능은 다음 데이터를 포함합니다:

### 데이터베이스 컬렉션 (10개)
| 컬렉션 | 설명 | 민감 데이터 처리 |
|--------|------|-----------------|
| User | 사용자 정보 | password 해시 포함, googleId 제외 |
| Server | ComfyUI 서버 정보 | apiKey AES-256-GCM 암호화 |
| Workboard | 작업판 설정 | 전체 백업 |
| ImageGenerationJob | 이미지 생성 작업 | 전체 백업 |
| GeneratedImage | 생성된 이미지 메타데이터 | 전체 백업 |
| GeneratedVideo | 생성된 비디오 메타데이터 | 전체 백업 |
| UploadedImage | 업로드된 이미지 메타데이터 | 전체 백업 |
| PromptData | 프롬프트 데이터 | 전체 백업 |
| Tag | 태그 정보 | 전체 백업 |
| LoraCache | LoRA 캐시 | 전체 백업 |

### 파일 저장소
- `/uploads/generated/` - 생성된 이미지
- `/uploads/reference/` - 업로드된 참조 이미지
- `/uploads/videos/` - 생성된 비디오

## 환경 설정

### 필수 환경 변수

```bash
# 백업 파일 저장 경로
BACKUP_PATH=/app/backups

# 암호화 키 (64자리 hex 문자열, 32바이트)
# 생성 방법: openssl rand -hex 32
BACKUP_ENCRYPTION_KEY=your_64_char_hex_key_here
```

### 암호화 키 생성

```bash
# Linux/macOS
openssl rand -hex 32

# 출력 예시: a1b2c3d4e5f6...(64자리)
```

> **중요**:
> - `BACKUP_ENCRYPTION_KEY`가 설정되지 않으면 **백업 생성이 불가능**합니다.
> - 암호화 키를 분실하면 백업에 포함된 암호화된 데이터(서버 API 키)를 복구할 수 없습니다.
> - 복구 시 키가 없으면 데이터베이스/파일은 복구되지만, 암호화된 API 키는 복구되지 않습니다.

### Docker Compose 설정

`docker-compose.yml`에서 백업 볼륨이 설정되어 있습니다:

```yaml
backend:
  environment:
    BACKUP_PATH: /app/backups
    BACKUP_ENCRYPTION_KEY: ${BACKUP_ENCRYPTION_KEY}
  volumes:
    - backups_data:/app/backups

volumes:
  backups_data:
    driver: local
```

## 백업 생성

### 백업 중 시스템 동작

백업이 진행되는 동안:
- **데이터 변경 API가 차단**됩니다 (POST, PUT, PATCH, DELETE)
- 읽기 전용 요청(GET)은 정상 처리됩니다
- 인증 및 백업 관련 API는 정상 작동합니다

이는 백업 데이터의 **일관성을 보장**하기 위한 조치입니다.

### 웹 UI 사용

1. 관리자 계정으로 로그인
2. 사이드바에서 **관리자 메뉴 > 백업 / 복구** 선택
3. **백업 생성** 버튼 클릭
4. 백업 진행 상태 확인 (실시간 폴링)
5. 완료 후 **다운로드** 버튼으로 백업 파일 다운로드

### API 사용

```bash
# 백업 생성 시작
curl -X POST http://localhost:3000/api/admin/backup \
  -H "Authorization: Bearer YOUR_TOKEN"

# 응답
{
  "success": true,
  "data": {
    "jobId": "backup_job_id",
    "status": "processing",
    "message": "백업이 시작되었습니다."
  }
}

# 백업 상태 확인
curl http://localhost:3000/api/admin/backup/status/backup_job_id \
  -H "Authorization: Bearer YOUR_TOKEN"

# 백업 파일 다운로드
curl -O http://localhost:3000/api/admin/backup/download/backup_job_id \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 백업 파일 구조

```
vcc-backup-2024-01-15T10-30-00-000Z.zip
├── metadata.json           # 백업 메타데이터
├── database/
│   ├── User.json
│   ├── Server.json
│   ├── Workboard.json
│   ├── ImageGenerationJob.json
│   ├── GeneratedImage.json
│   ├── GeneratedVideo.json
│   ├── UploadedImage.json
│   ├── PromptData.json
│   ├── Tag.json
│   └── LoraCache.json
└── files/
    ├── generated/          # 생성된 이미지 파일
    ├── reference/          # 참조 이미지 파일
    └── videos/             # 비디오 파일
```

### Rate Limiting

백업 생성은 **시간당 1회**로 제한됩니다.

### 백업 보관 기간

백업 파일은 생성 후 **7일** 후 자동 삭제됩니다.

## 복구

### 웹 UI 사용

1. 관리자 계정으로 로그인
2. 사이드바에서 **관리자 메뉴 > 백업 / 복구** 선택
3. **복구하기** 버튼 클릭
4. 백업 파일(.zip) 선택 및 업로드
5. 검증 결과 확인
6. 복구 옵션 선택:
   - **기존 데이터 덮어쓰기**: 같은 ID의 데이터가 있으면 덮어씀
   - **데이터베이스 복구 건너뛰기**: 파일만 복구
   - **파일 복구 건너뛰기**: 데이터베이스만 복구
7. **복구 실행** 버튼 클릭

### API 사용

```bash
# 1. 백업 파일 검증
curl -X POST http://localhost:3000/api/admin/backup/restore/validate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "backup=@vcc-backup-2024-01-15.zip"

# 응답
{
  "success": true,
  "data": {
    "jobId": "restore_job_id",
    "validationResult": {
      "isValid": true,
      "errors": [],
      "warnings": []
    },
    "backupMetadata": {
      "version": "1.0",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "collections": { "User": 5, "Server": 2, ... }
    },
    "filePath": "/tmp/restore-xxx.zip"
  }
}

# 2. 복구 실행
curl -X POST http://localhost:3000/api/admin/backup/restore \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "restore_job_id",
    "filePath": "/tmp/restore-xxx.zip",
    "options": {
      "overwriteExisting": false,
      "skipFiles": false,
      "skipDatabase": false
    }
  }'

# 3. 복구 상태 확인
curl http://localhost:3000/api/admin/backup/restore/status/restore_job_id \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 복구 후 동작

### 사용자 계정
- 로컬 계정: 기존 비밀번호로 즉시 로그인 가능 (bcrypt 해시에 salt 내장)
- Google OAuth 계정: googleId가 백업에서 제외되므로 다시 연동 필요

### 서버 API 키
- 동일한 `BACKUP_ENCRYPTION_KEY`를 사용하면 자동 복호화
- 키가 다르면 경고 메시지 표시, API 키는 복구되지 않음

### 파일
- 경로 매핑 유지
- 기존 URL로 정상 접근 가능

## 보안 고려사항

1. **접근 제한**: 모든 백업/복구 API는 관리자 권한 필요
2. **API 키 암호화**: Server 컬렉션의 apiKey는 AES-256-GCM으로 암호화
3. **민감 정보 제외**: Google OAuth ID는 백업에서 제외
4. **암호화 키 관리**: `BACKUP_ENCRYPTION_KEY`는 안전하게 보관

## 문제 해결

### 백업 생성 실패

```
Error: EACCES: permission denied, mkdir './backups'
```
→ 백업 디렉토리 권한 확인. Docker 환경에서는 볼륨 마운트 확인.

### 복구 시 암호화 키 경고

```
백업 암호화 키가 현재 시스템과 다릅니다.
```
→ 백업 생성 시 사용한 `BACKUP_ENCRYPTION_KEY`와 동일한 키 설정 필요.

### 대용량 백업 시 타임아웃

대용량 파일이 많은 경우 백업 시간이 길어질 수 있습니다.
백업은 비동기로 실행되므로 상태 API로 진행 상황을 확인하세요.

## API 엔드포인트 요약

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/admin/backup` | 백업 생성 시작 |
| GET | `/api/admin/backup/status/:id` | 백업 상태 조회 |
| GET | `/api/admin/backup/download/:id` | 백업 파일 다운로드 |
| GET | `/api/admin/backup/list` | 백업 목록 조회 |
| DELETE | `/api/admin/backup/:id` | 백업 삭제 |
| POST | `/api/admin/backup/restore/validate` | 복구 파일 검증 |
| POST | `/api/admin/backup/restore` | 복구 실행 |
| GET | `/api/admin/backup/restore/status/:id` | 복구 상태 조회 |
| GET | `/api/admin/backup/restore/list` | 복구 히스토리 조회 |
