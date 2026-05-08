# Visual Content Creator (VCC) Manager — 개발 문서

VCC Manager 의 백엔드 / 프론트엔드 / MCP 서버 구조와 핵심 모듈을 설명한다. Claude Code 작업 지침은 root [CLAUDE.md](../../CLAUDE.md), 환경변수는 [CONFIGURATION.md](./CONFIGURATION.md), API 명세는 [API.md](./API.md), MCP 도구 명세는 [MCP_SERVER_API.md](./MCP_SERVER_API.md) 를 참고.

## 프로젝트 개요

여러 AI 이미지/비디오/텍스트 생성 provider 를 단일 작업판(Workboard) 모델로 추상화하여 관리하는 웹 애플리케이션.

- **지원 provider** (`serverType`): `OpenAI`, `OpenAI Compatible` (Ollama / LiteLLM 등), `Gemini`, `ComfyUI`
- **출력 형식** (`outputFormat`): `image`, `video`, `text` — provider 별 capability matrix 에서 결정
- **인증**: JWT (웹) + API Key (MCP / 외부) — 세부 정책은 root `CLAUDE.md` "알려진 패턴 및 주의사항" 참고

## 아키텍처

```
┌──────────────┐    ┌─────────────────┐    ┌──────────────────────┐
│  Frontend    │    │    Backend      │    │  External Providers  │
│  (React 18)  │◄──►│  (Express)      │◄──►│  ComfyUI / OpenAI /  │
│  CRA + MUI   │    │  Bull Queue     │    │  Gemini / Compatible │
│  React Query │    │  Mongoose       │    └──────────────────────┘
└──────────────┘    └─────────────────┘             ▲
       ▲                    │                       │
       │                    ▼                       │
┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   Nginx      │    │  MongoDB +      │    │  MCP Server      │
│ (reverse     │    │  Redis (Bull)   │    │  (stdio + HTTP)  │
│  proxy)      │    └─────────────────┘    └──────────────────┘
└──────────────┘
```

## 디렉토리 구조

전체 구조는 root [CLAUDE.md](../../CLAUDE.md#주요-디렉토리-구조) 참고. 본 문서는 모듈별 진입점만 다룬다.

## 백엔드 핵심 모듈

| 모듈 | 위치 | 역할 |
| --- | --- | --- |
| 인증 | `src/routes/auth.js` | 이메일/비밀번호 + Google OAuth, 비밀번호 재설정 (v1.2.4) |
| API Key | `src/routes/apikeys.js` | 사용자별 API Key 발급/관리 (v1.3.6) |
| 작업판 | `src/routes/workboards.js` | Server·outputFormat 기반 작업판 CRUD |
| 작업 큐 | `src/services/queueService.js` | `SERVICE_MAP[(serverType, outputFormat)]` dispatcher (v1.8.0) |
| ComfyUI | `src/services/comfyUIService.js` | 워크플로우 실행 / WebSocket 모니터링 / 이미지 업로드 |
| OpenAI Chat | `src/services/openAIChatService.js` | OpenAI 공식 + Local LLM (Ollama / LiteLLM) 공통 (v1.8.0) |
| Gemini | `src/services/geminiService.js` | 이미지 + 텍스트 생성 (v1.7.0 / v1.8.2) |
| GPT Image | `src/services/gptImageService.js` | OpenAI 이미지 생성 (`gpt-image-2` 포함, v1.7.3) |
| Signed URL | `src/utils/signedUrl.js` + `src/routes/files.js` | HMAC 기반 미디어 접근 제어 (v1.4.0) |
| 백업/복원 | `src/services/backupService.js` / `src/services/restoreService.js` | 시스템 백업 (v1.2.4) |
| 마이그레이션 | `src/migrations/` | Mongoose 일회성 스크립트 |
| 단위 테스트 | `src/tests/` | Jest (signedUrl, escapeRegex, queueService 등) |

## 프론트엔드 핵심 모듈

| 모듈 | 위치 | 역할 |
| --- | --- | --- |
| 인증 컨텍스트 | `frontend/src/contexts/AuthContext.js` | 전역 사용자 상태, 토큰 관리 |
| 작업판 템플릿 | `frontend/src/templates/` | `<serverType>-<outputFormat>.json` + `index.js` 로더 + `capabilities.js` (capability matrix) (v1.8.0) |
| 관리자 작업판 편집 | `frontend/src/components/admin/WorkboardManagement.js` | 작업판 생성·편집, 템플릿 기반 폼 |
| 공통 컴포넌트 | `frontend/src/components/common/` | 13개 공통 다이얼로그/패널 (root `CLAUDE.md` "공통 컴포넌트 활용" 참고) |

## MCP 서버

`mcp-server/src/server.js` 가 McpServer 인스턴스를 생성하고, `tools/{workboards,jobs,media}.js` 에서 도구를 등록한다. stdio + Streamable HTTP 양 모드 지원. 멀티유저 인증 / `VCC_BASE_URL_FOR_MCP` 등 운영 정책은 root `CLAUDE.md` 와 [MCP_SERVER.md](./MCP_SERVER.md) 참고.

## 데이터베이스 스키마

핵심 모델 (`src/models/`):

- **User** — 이메일 / 비밀번호 / 닉네임 / `isAdmin` / `apiKeys[]` (최대 10개) / `passwordResetToken` / 사용자 설정 (`preferences.deleteContentWithHistory` 등)
- **Server** — `serverType` (`OpenAI` / `OpenAI Compatible` / `Gemini` / `ComfyUI`), `baseUrl`, `apiKey`, healthcheck 결과
- **Workboard** — `serverId`, `outputFormat` (`image` / `video` / `text`), `baseInputFields`, `additionalInputFields`, `workflowData` (ComfyUI 만 사용, `default: ''`)
- **ImageGenerationJob** — `userId`, `workboardId`, `serverId`, `inputData` (prompt / aiModel / additionalParams), `resultImages[]` / `resultVideos[]`, `progress`, `error`, `resolvedWorkflow` (ComfyUI 디버깅용)
- **GeneratedImage** / **GeneratedVideo** — `jobId` (선택), `userId`, `path`, `metadata`, `tags[]`
- **ApiKey** — 해시된 키 + 라벨 + `lastUsedAt`
- **BackupJob** / **RestoreJob** — 백업·복원 잡 (v1.8.1 에서 TTL 자동 삭제 제거)
- **Project** — 프로젝트 분류 + 커버 이미지 (v1.3.0)
- **PromptData** — 프롬프트 라이브러리 (v1.2.4)
- **Tag** — 사용자 기반 태그 (v1.2.4)
- **LoraCache** / **ServerLoraCache** / **ServerModelCache** — 외부 모델 카탈로그 캐시 (ServerModelCache 는 v2.0 신규: ComfyUI checkpoint + SaaS provider 모델 통합 관리)

## 트러블슈팅 / 운영

운영 트러블슈팅은 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md), 백업/복원은 [BACKUP_RESTORE.md](./BACKUP_RESTORE.md), 보안은 [SECURITY.md](./SECURITY.md) 참고.

## 라이선스

MIT — [LICENSE](../LICENSE) 참고.

---
**마지막 업데이트**: 2026-05-02
