# 백업 및 복구 가이드

VCC Manager의 전체 데이터를 백업·복구하고, 백업파일로 새 환경에 그대로 이전하는 방법을 설명합니다.

## 개요

백업은 시스템의 **모든 영구 데이터**를 포함합니다.

### 데이터베이스 컬렉션 (18개)
사용자/그룹/태그/서버 · 프로젝트/작업판/세계관 문서/업로드 이미지/프롬프트/파이프라인 · 생성 작업 및 결과(이미지/영상/텍스트/대화)/파이프라인 실행 · API 키 · 시스템 설정.

구체적으로: User, Group, Tag, Server, Project, Workboard, UploadedText, UploadedImage, PromptData, Pipeline, ImageGenerationJob, ConversationJob, GeneratedImage, GeneratedVideo, GeneratedText, PipelineRun, ApiKey, SystemSettings.

| 항목 | 처리 |
|------|------|
| `User.password` | bcrypt 해시 그대로 백업 (salt 내장 → 복원 후 그대로 로그인) |
| `User.googleId` | 백업 제외 (복원 후 Google 재연동 필요) |
| `ApiKey.keyHash` | SHA-256 해시 그대로 백업 (복원 후 기존 API 키 그대로 작동) |
| `Server.configuration.apiKey`, `SystemSettings.*.civitaiApiKey` | 평문 secret → 백업 시 AES-256-GCM 암호화 |

> 재생성 가능한 캐시(LoRA/모델 캐시)는 **백업하지 않습니다** — 복원 후 서버 동기화로 다시 채워집니다.

### 파일 저장소 (백업에 포함)
- `uploads/generated/` — 생성된 이미지
- `uploads/reference/` — 업로드/참조 이미지 (텍스트 첨부 이미지 포함)
- `uploads/videos/` — 생성된 비디오

> 모든 영구 파일은 이 세 디렉토리 중 하나에 저장됩니다. (`backup-temp`/`restore-temp`는 임시 작업 공간이라 백업 대상이 아닙니다.)

## 환경 설정

```bash
# 백업 파일 저장 경로
BACKUP_PATH=/app/backups

# 백업 암호화 키 (64자리 hex = 32바이트). 생성: openssl rand -hex 32
BACKUP_ENCRYPTION_KEY=your_64_char_hex_key_here

# (선택) provider API 키 at-rest 암호화 키. 미설정 시 BACKUP_ENCRYPTION_KEY 재사용.
CONFIG_ENCRYPTION_KEY=
```

> **암호화 키는 가장 중요한 값입니다.**
> - `BACKUP_ENCRYPTION_KEY`가 없으면 백업 생성이 불가능합니다.
> - 이 키(및 `CONFIG_ENCRYPTION_KEY`를 따로 쓴다면 그 키)를 분실하면 백업·DB의 암호화된 provider API 키를 복구할 수 없습니다.
> - **새 환경으로 이전할 때 이 키들을 동일하게 복사해야** API 키까지 완전히 복구됩니다. (아래 "새 환경 이전" 참고)

`.env`가 최신 스키마와 맞는지 점검: `npm run env:doctor` (`--fix`로 누락 키 추가).

### Docker Compose
백업은 named volume에 저장됩니다 (`docker-compose.yml` / `docker-compose.prod.yml`):

```yaml
backend:
  environment:
    BACKUP_PATH: /app/backups
    BACKUP_ENCRYPTION_KEY: ${BACKUP_ENCRYPTION_KEY}
    CONFIG_ENCRYPTION_KEY: ${CONFIG_ENCRYPTION_KEY:-}
  volumes:
    - backups_data:/app/backups
    - uploads_data:/app/uploads
```

> `backups_data`·`uploads_data`·`mongodb` 볼륨은 같은 디스크(Docker 데이터 루트)를 공유합니다. 백업이 디스크를 채우면 DB까지 위험하므로, 백업 시작 전 디스크 여유를 자동 점검합니다(아래).

## 백업 생성

### 백업 중 시스템 동작
- 데이터 변경 API(POST/PUT/PATCH/DELETE) **차단**, 읽기(GET)·인증·백업 제어 API는 정상 — 백업 일관성 보장.
- **디스크 여유 사전 점검**: 추정 필요 공간(데이터+파일 × 안전배수)보다 가용 공간이 적으면 백업을 시작하지 않고 안내합니다(디스크를 채워 시스템이 불안정해지는 사고 방지).

### 웹 UI
관리자 > **백업 / 복구** > **백업 생성** → 진행 상태 확인 → 완료 후 다운로드.

### 백업 파일 구조
```
vcc-backup-2026-06-20T10-30-00-000Z.zip
├── metadata.json            # 버전 · 컬렉션별 문서 수 · 암호화 키 해시
├── database/
│   ├── User.ndjson          # 한 줄에 문서 1개(NDJSON) — 대용량 스트리밍
│   ├── Server.ndjson
│   ├── ... (18개 컬렉션)
│   └── SystemSettings.ndjson
└── files/
    ├── generated/
    ├── reference/
    └── videos/
```

> 구버전 백업은 `database/*.json`(배열) 형식일 수 있으며, 복원이 두 형식 모두 인식합니다.

### 보관
백업 파일은 **자동 삭제되지 않습니다** (생성물은 사용자 소유 데이터 — 의도적). 불필요한 백업은 UI에서 직접 삭제하세요. 단, 디스크 부족 등으로 중단된 백업이 남긴 임시/미완성 파일은 **서버 재시작 시 자동 정리**됩니다.

## 복구

### 웹 UI — 두 가지 방식
복구하기 다이얼로그에서 방식을 고릅니다:

- **서버 백업 (권장, 대용량 안전)**: 서버 `/app/backups`에 있는 백업 파일을 목록에서 골라 복원. 업로드가 없어 크기 제한이 없습니다. 백업 파일을 서버에 올릴 때:
  ```bash
  ./scripts/upload-backup-file.sh <백업파일.zip>        # 프로덕션
  ./scripts/upload-backup-file.sh --dev <백업파일.zip>  # 개발
  ```
  (한 줄로 backend 컨테이너의 `/app/backups`에 복사 → UI "서버 백업" 탭에 표시)
- **파일 업로드**: 2GB 이하 백업을 브라우저로 업로드. 그보다 크면 위 "서버 백업" 방식을 쓰세요(대용량 HTTP 업로드는 느리고 실패하기 쉬움).

검증 결과 확인 → 옵션 선택 → 복구 실행.

옵션: 기존 데이터 덮어쓰기 / 데이터베이스 건너뛰기 / 파일 건너뛰기.

### 복원 중 안전장치
- **복원 중 쓰기 차단**: 복원이 진행되는 동안 데이터 변경이 차단되어 동시 쓰기로 인한 정합성 손상을 막습니다.
- **복원 전 자동 스냅샷**: 복원을 시작하기 전 현재 상태를 자동으로 백업(`vcc-presnapshot-*`)합니다. 잘못된 복원도 이 스냅샷으로 되돌릴 수 있습니다.
- 백업↔복원은 동시에 실행되지 않습니다.

## 복구 후 동작
- **로컬 계정**: 기존 비밀번호로 즉시 로그인.
- **Google 계정**: googleId 제외되므로 재연동 필요.
- **API 키(사용자 발급)**: 그대로 작동(해시 보존).
- **provider API 키(서버/Civitai)**: 동일 암호화 키면 자동 복호화. 키가 다르면 경고 + 해당 키만 미복구(나머지는 정상).
- **파일**: 경로 매핑 유지 → 기존 URL 그대로 접근.

## 백업으로 새 환경 이전 (마이그레이션 / OrbStack 전환 등)

**원칙: 백업파일 + 동일 암호화 키만 있으면 새로 설치한 환경에 전체 복원이 됩니다.** (빈 DB에 복원 시 18개 컬렉션이 원본과 동일하게 복원됨을 검증했습니다.) 그래서 호스트/런타임을 바꿀 때(예: Docker → OrbStack) **위험한 볼륨 직접 복사 대신, 새로 띄우고 백업을 복원**하는 것이 안전한 정공법입니다.

### 절차
1. **(기존 환경) 백업 생성 + 다운로드** — 관리자 > 백업/복구에서 백업하고 .zip을 안전한 곳에 보관.
2. **(기존 환경) `.env` 확보** — 특히 `BACKUP_ENCRYPTION_KEY`(및 쓴다면 `CONFIG_ENCRYPTION_KEY`). 이 키가 새 환경과 같아야 provider 키까지 복원됩니다.
3. **(새 환경) 새로 기동** — 새 호스트/런타임에서 코드 체크아웃 → `.env` 복사(**암호화 키 동일**) → `docker compose up -d`(또는 OrbStack). 빈 DB로 시작.
4. **(새 환경) 복원** — 관리자 > 백업/복구 > 복구하기로 .zip 업로드 → 검증 → 복구 실행. (빈 DB이므로 "덮어쓰기"는 불필요.)
5. **검증** — ① 로그인 ② 작업판/프로젝트/생성물(이미지·영상) 표시 ③ 서버 관리에서 provider 연결 정상(키 복호화 확인) ④ 새 생성 1회 동작.
6. **마무리** — 검증 완료 후 기존 환경 정리. (불안하면 기존 환경을 잠시 보존)

### 주의
- 암호화 키가 다르면: 데이터·파일은 복원되지만 **provider API 키만 복호화 실패** → 서버 관리에서 키를 다시 입력하면 됩니다.
- 같은 호스트에서 런타임만 바꾸는 경우(Docker→OrbStack) 포트 충돌 방지를 위해 기존 스택을 먼저 내린 뒤 새로 띄우세요.

## 보안 고려사항
1. 모든 백업/복구 API는 **관리자 권한** 필요.
2. provider API 키는 백업·DB 양쪽에서 암호화(AES-256-GCM).
3. Google OAuth ID는 백업 제외.
4. 암호화 키(`BACKUP_ENCRYPTION_KEY`/`CONFIG_ENCRYPTION_KEY`)는 안전하게 보관하고 새 환경 이전 시 동일하게 복사.

## 문제 해결
- **백업이 "진행중"에서 멈춰 보임**: 디스크 부족 등으로 중단된 경우입니다. 서버를 재시작하면 멈춘 작업과 잔재 파일이 자동 정리됩니다.
- **백업을 지웠는데 디스크가 안 줄어듦**: 중단된 백업의 잔재(임시 디렉토리/미완성 파일)입니다. 서버 재시작 시 자동 회수됩니다.
- **복구 시 암호화 키 경고**: 백업 생성에 쓴 키와 현재 키가 다릅니다. 동일 키를 설정하세요.
- **디스크 부족으로 백업 시작 거부**: 안내된 필요 공간만큼 확보 후 재시도하세요.

## API 엔드포인트 요약
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/admin/backup` | 백업 생성 시작 (디스크 점검 포함) |
| GET | `/api/admin/backup/status/:id` | 백업 상태 조회 |
| POST | `/api/admin/backup/:id/signed-url` | 백업 다운로드 URL 발급 (권장) |
| GET | `/api/admin/backup/download/:id` | 백업 다운로드 (deprecated — signed-url 권장) |
| GET | `/api/admin/backup/list` | 백업 목록 |
| DELETE | `/api/admin/backup/:id` | 백업 삭제 |
| GET | `/api/admin/backup/lock-status` | 백업/복원 진행 상태 |
| GET | `/api/admin/backup/restore/server-files` | 서버 백업 파일 목록 (서버사이드 복원) |
| POST | `/api/admin/backup/restore/server-validate` | 서버 백업 파일 검증 (업로드 우회) |
| POST | `/api/admin/backup/restore/validate` | 복구 파일 검증 (업로드) |
| POST | `/api/admin/backup/restore` | 복구 실행 |
| GET | `/api/admin/backup/restore/status/:id` | 복구 상태 조회 |
| GET | `/api/admin/backup/restore/list` | 복구 히스토리 |
