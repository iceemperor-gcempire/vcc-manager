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

### 통합 테스트 (#448, #1178)

`test/integration.mjs` — 실제 MCP 서버에 접속해 도구를 부른다. 도구 15개 노출, 작업판 목록·상세(`baseModel`), `generate` 가 기본 모델 없는 판에서 작업을 만들기 전에 막히는지, 그리고 프로젝트·파이프라인 흐름을 본다. 저장소에서 실행한다 (컨테이너 이미지에는 `test/` 가 없다).

```bash
# 알파 — MCP 용 키(vccm_)로
MCP_TEST_URL=https://alpha-vccm-mcp.gcempire.net/mcp \
MCP_TEST_API_KEY=<vccm_ 키> pnpm --dir mcp-server test:integration

# 실제 생성 1건까지 (릴리스 때)
MCP_TEST_URL=... MCP_TEST_API_KEY=<vccm_ 키> \
MCP_TEST_RUN_GENERATE=1 MCP_TEST_WORKBOARD='<빠른 이미지 판 이름>' \
pnpm --dir mcp-server test:integration
```

| 환경변수 | 설명 |
|---|---|
| `MCP_TEST_API_KEY` | VCC API Key (필수, Bearer 전달). **MCP 용 키(`vccm_`)로 돌린다** — 범용 키(`vcc_`)는 MCP 키 허용 목록을 거치지 않는다 (경고만 낸다) |
| `MCP_TEST_URL` | MCP endpoint (기본 `http://localhost:3100/mcp`) |
| `MCP_TEST_RUN_GENERATE` | `1` 이면 프롬프트만으로 생성 1건 → 완료 대기 → `download_result`. **프로덕션에는 켜지 않는다** (시험 작업이 남는다) |
| `MCP_TEST_WORKBOARD` | 생성에 쓸 판 ID 또는 이름. 없으면 기본 모델이 있고 필수 첨부 칸이 없는 첫 이미지 판 |
| `MCP_TEST_PROMPT` | 생성 프롬프트 |
| `MCP_TEST_GENERATE_TIMEOUT_SEC` | 생성 완료 대기 상한 (기본 600) |
| `MCP_TEST_RUN_PIPELINE` | `1` 이면 `run_pipeline` 까지 실제 실행 (LLM/ComfyUI 호출 발생 — 기본 skip) |
| `MCP_TEST_INITIAL_PROMPT` | run 시 사용할 prompt |

작업판·프로젝트·파이프라인 데이터가 없으면 해당 단계는 skip 하고 그렇다고 한 줄 남긴다. API Key 사용자가 볼 수 있는 자원만 보인다. 생성으로 만든 작업의 ID 를 출력하니 시험 데이터 정리에 쓴다.
