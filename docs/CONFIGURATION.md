# VCC Manager 환경 설정 가이드

VCC Manager 는 `.env` (개발) / `.env.production` (프로덕션) 파일로 환경 변수를 관리한다. ComfyUI / Civitai API Key 등은 더 이상 환경변수가 아니라 **관리자 화면의 서버 모델로 관리** (v1.2.5 이후, 서버별 다중 등록 지원).

## 파일 위치

```bash
# 개발용
cp .env.example .env

# 프로덕션
cp .env.production.example .env.production
```

> 환경변수가 추가/변경/삭제되면 `docker-compose.yml`, `docker-compose.prod.yml`, `scripts/deploy-prod.sh`, `scripts/stop-prod.sh` 도 함께 점검할 것 (root [CLAUDE.md](../CLAUDE.md) "작업 시 유의사항" 참고).

## 서버

| 변수 | 설명 | 기본값 |
|---|---|---|
| `NODE_ENV` | `development` / `production` | `development` |
| `PORT` | 백엔드 컨테이너 내부 포트 (Dockerfile 변경 시에만 수정) | `3000` |

## Docker 호스트 포트

`docker-compose.yml` 가 호스트로 노출하는 포트.

| 변수 | 설명 | 기본값 |
|---|---|---|
| `FRONTEND_PORT` | 프론트엔드 (nginx) | `8136` |
| `BACKEND_PORT` | 백엔드 API | `3136` |
| `MCP_PORT` | MCP HTTP 서버 (v1.3.3+) | `4136` |
| `MONGODB_PORT` | (개발용) MongoDB. 프로덕션은 미노출 | `27017` |
| `REDIS_PORT` | (개발용) Redis. 프로덕션은 미노출 | `6379` |

## 데이터베이스 / Redis

| 변수 | 설명 |
|---|---|
| `MONGO_ROOT_USER` | MongoDB 루트 계정 |
| `MONGO_ROOT_PASSWORD` | MongoDB 루트 비밀번호 (프로덕션 필수 변경) |
| `MONGO_DB` | 기본 DB 명 (`vcc-manager`) |
| `MONGODB_URI` | 연결 문자열 |
| `REDIS_PASSWORD` | Redis 비밀번호 (프로덕션 필수 변경) |
| `REDIS_URL` | Redis 연결 URL (`redis://:<pw>@<host>:<port>`) |

## 인증 / 보안

| 변수 | 설명 |
|---|---|
| `JWT_SECRET` | JWT 서명 키 (프로덕션은 32자 이상). 미설정 시 부팅 실패 (v1.4.10 fail-fast) |
| `JWT_EXPIRES_IN` | 토큰 만료 (예: `7d`) |
| `ADMIN_EMAILS` | 관리자 자동 승격 이메일 (쉼표 구분) |
| `BACKUP_ENCRYPTION_KEY` | 백업 ZIP 의 API 키 등 민감정보 암호화 키. **64자리 hex** (`openssl rand -hex 32`). 분실 시 백업의 암호화 항목 복구 불가 |

> Signed URL HMAC 키는 `JWT_SECRET` 을 재사용하므로 별도 설정 불필요.

## Google OAuth

| 변수 | 설명 |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | GCP OAuth Credentials |
| `GOOGLE_CALLBACK_URL` | 콜백 URL (개발: `http://localhost:3136/auth/google/callback`, 프로덕션: `https://<domain>/auth/google/callback`) |

## 파일 / 백업

| 변수 | 설명 | 기본값 |
|---|---|---|
| `UPLOAD_PATH` | 미디어 저장 경로 | `./uploads` (개발) / `/app/uploads` (프로덕션) |
| `MAX_FILE_SIZE` | 업로드 최대 byte | `10485760` (10MB) |
| `BACKUP_PATH` | 백업 ZIP 저장 경로 | `./backups` (개발) / `/app/backups` (프로덕션) |

## CORS / 프론트엔드

| 변수 | 설명 |
|---|---|
| `FRONTEND_URL` | CORS 허용 origin (예: `http://localhost:8136`, `https://<domain>`) |
| `REACT_APP_API_URL` | 프론트엔드 빌드 시 API 경로. 컨테이너 배포에서는 `/api` (nginx 프록시) |

## SMTP (비밀번호 재설정 이메일, v1.2.4+)

| 변수 | 설명 |
|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | SMTP 서버 |
| `SMTP_USER` / `SMTP_PASSWORD` | 인증 계정 (Gmail 의 경우 앱 비밀번호) |
| `SMTP_FROM_EMAIL` / `SMTP_FROM_NAME` | 발신자 표기 |

## Signed URL (v1.4.0+)

| 변수 | 설명 | 기본값 |
|---|---|---|
| `SIGNED_URL_EXPIRY` | 만료 시간 (초) | `3600` (1시간) |
| `SIGNED_URL_ROUND_SECONDS` | 만료 라운딩 간격 (초). 동일 구간 내 동일 URL 보장 → 비디오 깜박임 방지 (v1.4.3) | `1440` (24분) |

## MCP Server (v1.3.3+)

| 변수 | 설명 |
|---|---|
| `MCP_PORT` | HTTP 모드 포트 (`4136` 기본) |
| `VCC_API_KEY` | **stdio 모드 전용** 로컬 MCP 서버용. HTTP 모드는 클라이언트 Bearer 토큰 사용 |
| `VCC_BASE_URL_FOR_MCP` | MCP 의 `download_result` 가 signed URL 을 반환할 때 사용할 VCC 서버 기본 URL. 미설정 시 base64 fallback (`mcp-remote` 1MB 응답 제한 회피용) |

상세 운영 정책은 [MCP_SERVER.md](./MCP_SERVER.md) 참고.

## 더 이상 환경변수가 아닌 항목

다음은 v1.2.5 이후 **관리자 화면 > 서버 관리** 에서 설정한다 (서버별 등록):

- ComfyUI 서버 URL (이전 `COMFY_UI_BASE_URL`)
- OpenAI / Gemini / OpenAI Compatible API Key 및 base URL
- Civitai API Key (전역 설정 → 관리자 > LoRA 설정)

```
docs/updatelogs/v1.md (v1.2.5):
  chore: 서버별 관리로 전환된 환경변수
  (COMFY_UI_BASE_URL, CIVITAI_API_KEY) 예시 파일에서 제거 (#53)
```

---
**마지막 업데이트**: 2026-05-02
