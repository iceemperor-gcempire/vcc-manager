# VCC Manager MCP Server

VCC Manager의 이미지/비디오 생성 기능을 AI 에이전트(Claude Desktop, Claude Code 등)에서 사용할 수 있게 해주는 MCP 서버입니다.

> **상세 가이드**: [docs/MCP_SERVER.md](../docs/MCP_SERVER.md) — 설정, 클라이언트 연동, 등록 스코프, 문제 해결 등 전체 문서

## 실행 모드

- **HTTP 모드 (권장)**: Docker 컨테이너로 운영. `docker-compose up --build -d`
- **stdio 모드**: 로컬에서 프로세스 직접 실행. `cd mcp-server && npm install`

## 빠른 시작

### HTTP 모드

```bash
# .env에 MCP_EMAIL, MCP_PASSWORD 설정 후
docker-compose up --build -d
curl http://localhost:3100/health
```

### Claude Code 등록

```bash
# HTTP 모드
claude mcp add --transport http vcc-manager http://your-server:3100/mcp

# stdio 모드
claude mcp add --transport stdio vcc-manager -- node /absolute/path/to/mcp-server/index.js
```

## MCP Tools

| Tool | 설명 |
|---|---|
| `list_workboards` | 작업판 목록 조회 |
| `get_workboard` | 작업판 상세 조회 (모델, 크기, 필드 가이드) |
| `generate` | 이미지/비디오 생성 요청 |
| `continue_job` | 기존 작업을 같은/다른 작업판에서 이어가기 (스마트 필드 매칭) |
| `get_job_status` | 생성 작업 상태 확인 |
| `list_jobs` | 생성 작업 목록 조회 |
| `download_result` | 결과 다운로드 |
| `list_projects` | 프로젝트 목록 조회 |
| `list_pipelines` | 프로젝트의 파이프라인 목록 |
| `get_pipeline` | 파이프라인 단계 상세 |
| `run_pipeline` | 파이프라인 실행 시작 (runId 반환) |
| `get_pipeline_run` | 실행 상태 / 단계별 출력 |
| `list_pipeline_runs` | 최근 실행 목록 |

## 검증

```bash
# stdio 모드
npx @modelcontextprotocol/inspector node index.js

# HTTP 모드
npx @modelcontextprotocol/inspector --url http://localhost:3100/mcp
```

### 통합 테스트 (#448)

`test/integration.mjs` — 실제 MCP 서버에 접속해 프로젝트 / 파이프라인 도구 흐름을 검증.

```bash
# 로컬 (docker-compose 기동 + 컨테이너 안에서 실행, /app 기준)
MCP_TEST_API_KEY=<VCC API Key> npm run test:integration

# dev 환경
MCP_TEST_URL=https://alpha-vccm-mcp.gcempire.net/mcp \
MCP_TEST_API_KEY=<VCC API Key> npm run test:integration
```

| 환경변수 | 설명 |
|---|---|
| `MCP_TEST_API_KEY` | VCC API Key (필수, Bearer 전달) |
| `MCP_TEST_URL` | MCP endpoint (기본 `http://localhost:3100/mcp`) |
| `MCP_TEST_RUN_PIPELINE` | `1` 이면 `run_pipeline` 까지 실제 실행 (LLM/ComfyUI 호출 발생 — 기본 skip) |
| `MCP_TEST_INITIAL_PROMPT` | run 시 사용할 prompt |

프로젝트 / 파이프라인 데이터가 없으면 해당 단계는 skip (read-only 검증만). API Key 사용자 소유 자원만 보임.
