# VCC Manager MCP Server

VCC Manager의 이미지/비디오 생성 기능을 AI 에이전트(Claude Desktop, Claude Code 등)에서 사용할 수 있게 해주는 MCP 서버입니다.

**두 가지 실행 모드를 지원합니다:**

- **HTTP 모드 (권장)**: Docker 컨테이너로 운영. 클라이언트는 URL 하나로 연동.
- **stdio 모드**: 로컬에서 프로세스 직접 실행. 로컬 개발용.

> 상세 가이드: [docs/MCP_SERVER.md](../docs/MCP_SERVER.md)

## HTTP 모드 (Docker)

docker-compose에 `mcp-server` 서비스가 포함되어 있으므로 별도 설치 없이 사용 가능합니다.

### 환경 변수

`.env` 파일에 아래 항목을 설정하세요:

```env
MCP_PORT=3100
MCP_API_KEY=                          # 선택 (설정 시 Bearer 토큰 인증)
MCP_EMAIL=mcp-agent@your-domain.com
MCP_PASSWORD=your-mcp-password
```

### 실행

```bash
docker-compose up --build -d
curl http://localhost:3100/health
```

### 클라이언트 설정

**Claude Code** (`.mcp.json`):

```json
{
  "mcpServers": {
    "vcc-manager": {
      "type": "http",
      "url": "http://your-server:3100/mcp"
    }
  }
}
```

**Claude Desktop**: Connectors UI(**HTTPS 필수**)를 사용하거나, `mcp-remote` 브릿지(HTTP 시 `--allow-http` 필요)를 사용합니다. 상세: [docs/MCP_SERVER.md](../docs/MCP_SERVER.md#2-4-클라이언트-설정)

## stdio 모드 (로컬)

### 설치

```bash
cd mcp-server
npm install
```

### 클라이언트 설정

```json
{
  "mcpServers": {
    "vcc-manager": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/index.js"],
      "env": {
        "VCC_API_URL": "http://localhost:3000",
        "VCC_EMAIL": "mcp-agent@your-domain.com",
        "VCC_PASSWORD": "your-mcp-password",
        "VCC_DOWNLOAD_DIR": "~/Downloads/vcc"
      }
    }
  }
}
```

## 환경 변수

| 변수 | 필수 | 설명 | 기본값 |
|---|---|---|---|
| `VCC_API_URL` | No | VCC Manager API URL | `http://localhost:3000` |
| `VCC_EMAIL` | Yes | 로그인 이메일 | - |
| `VCC_PASSWORD` | Yes | 로그인 비밀번호 | - |
| `VCC_DOWNLOAD_DIR` | No | 다운로드 저장 경로 (stdio 전용) | `~/Downloads/vcc` |
| `MCP_TRANSPORT` | No | Transport 모드 (`stdio` / `http`) | `stdio` |
| `MCP_PORT` | No | HTTP 서버 포트 | `3100` |
| `MCP_API_KEY` | No | Bearer 토큰 인증 키 | - |

## MCP Tools

| Tool | 설명 |
|---|---|
| `list_workboards` | 작업판 목록 조회 |
| `get_workboard` | 작업판 상세 조회 (모델, 크기, 필드 가이드) |
| `generate` | 이미지/비디오 생성 요청 |
| `get_job_status` | 생성 작업 상태 확인 |
| `list_jobs` | 생성 작업 목록 조회 |
| `download_result` | 결과 다운로드 (stdio: 파일 저장, HTTP: 이미지 base64 반환 / 비디오 메타데이터) |

## 사용 예시

1. `list_workboards` — 사용 가능한 작업판 확인
2. `get_workboard` — 선택한 작업판의 옵션 확인
3. `generate` — 이미지/비디오 생성 요청
4. `get_job_status` — 완료될 때까지 상태 확인 (polling)
5. `download_result` — 결과 파일 다운로드 또는 URL 확인

## 검증

```bash
# stdio 모드
cd mcp-server
npx @modelcontextprotocol/inspector node index.js

# HTTP 모드
npx @modelcontextprotocol/inspector --url http://localhost:3100/mcp
```
