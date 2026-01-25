# VCC Manager 환경 설정 가이드

VCC Manager는 `.env` 파일을 통해 다양한 설정을 관리합니다.
이 문서는 각 환경 변수의 역할과 설정 방법을 상세히 설명합니다.

## 📁 파일 위치

프로젝트 루트 디렉토리의 `.env` 파일을 수정하여 설정합니다.
없는 경우 `.env.example` 파일을 복사하여 생성하세요.

```bash
cp .env.example .env
```

## ⚙️ 서버 설정 (Server)

| 변수명 | 설명 | 기본값 |
|---|---|---|
| `NODE_ENV` | 실행 환경 (`development`, `production`) | `development` |
| `PORT` | 백엔드 API 서버의 내부 포트 | `3000` |

## 🐳 Docker 포트 설정

호스트 머신에 노출되는 포트 설정입니다. `docker-compose.yml`에서 사용됩니다.

| 변수명 | 설명 | 기본값 |
|---|---|---|
| `FRONTEND_PORT` | 프론트엔드 웹 서버 접속 포트 | `80` |
| `BACKEND_PORT` | 백엔드 API 서버 접속 포트 | `3000` |
| `MONGODB_PORT` | (개발용) MongoDB 접속 포트 | `27017` |
| `REDIS_PORT` | (개발용) Redis 접속 포트 | `6379` |

## 🗄️ 데이터베이스 (Database)

| 변수명 | 설명 | 예시 |
|---|---|---|
| `MONGODB_URI` | MongoDB 연결 주소 | `mongodb://localhost:27017/vcc-manager` |

## 🔐 보안 설정 (Security)

| 변수명 | 설명 |
|---|---|
| `SESSION_SECRET` | 세션 암호화 키 (임의의 긴 문자열) |
| `JWT_SECRET` | JWT 토큰 서명 키 |
| `JWT_EXPIRES_IN` | JWT 토큰 만료 시간 |
| `ADMIN_EMAILS` | 관리자 권한을 부여할 이메일 목록 (쉼표 구분) |

## ☁️ 외부 서비스 (External Services)

### Google OAuth
| 변수명 | 설명 |
|---|---|
| `GOOGLE_CLIENT_ID` | GCP Client ID |
| `GOOGLE_CLIENT_SECRET` | GCP Client Secret |
| `GOOGLE_CALLBACK_URL` | 리다이렉트 URL |

### ComfyUI
| 변수명 | 설명 | 기본값 |
|---|---|---|
| `COMFY_UI_BASE_URL` | ComfyUI 서버 주소 | `http://localhost:8188` |

### Redis
| 변수명 | 설명 | 기본값 |
|---|---|---|
| `REDIS_URL` | Redis 연결 URL | `redis://localhost:6379` |

## 📂 파일 업로드

| 변수명 | 설명 | 기본값 |
|---|---|---|
| `UPLOAD_PATH` | 파일 저장 경로 | `./uploads` |
| `MAX_FILE_SIZE` | 최대 파일 크기 (Byte) | `10485760` (10MB) |

## 🌐 프론트엔드 설정

| 변수명 | 설명 | 용도 |
|---|---|---|
| `FRONTEND_URL` | 프론트엔드 URL | 백엔드 CORS 허용 설정 |
| `REACT_APP_API_URL` | API 서버 주소 | 프론트엔드 빌드 시 API 요청 주소 지정 |
