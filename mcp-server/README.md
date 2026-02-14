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

## 검증

```bash
# stdio 모드
npx @modelcontextprotocol/inspector node index.js

# HTTP 모드
npx @modelcontextprotocol/inspector --url http://localhost:3100/mcp
```
