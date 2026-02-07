# VCC Manager MCP Server

VCC Manager의 이미지/비디오 생성 기능을 AI 에이전트(Claude Desktop, Claude Code 등)에서 사용할 수 있게 해주는 MCP 서버입니다.

## 설치

```bash
cd mcp-server
npm install
```

## 설정

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) 또는 `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "vcc-manager": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/index.js"],
      "env": {
        "VCC_API_URL": "http://localhost:3000",
        "VCC_EMAIL": "your-email@example.com",
        "VCC_PASSWORD": "your-password",
        "VCC_DOWNLOAD_DIR": "~/Downloads/vcc"
      }
    }
  }
}
```

### Claude Code

`.mcp.json` 파일에 추가:

```json
{
  "mcpServers": {
    "vcc-manager": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/index.js"],
      "env": {
        "VCC_API_URL": "http://localhost:3000",
        "VCC_EMAIL": "your-email@example.com",
        "VCC_PASSWORD": "your-password",
        "VCC_DOWNLOAD_DIR": "~/Downloads/vcc"
      }
    }
  }
}
```

### 환경 변수

| 변수 | 필수 | 설명 | 기본값 |
|---|---|---|---|
| `VCC_API_URL` | No | VCC Manager API URL | `http://localhost:3000` |
| `VCC_EMAIL` | Yes | 로그인 이메일 | - |
| `VCC_PASSWORD` | Yes | 로그인 비밀번호 | - |
| `VCC_DOWNLOAD_DIR` | No | 다운로드 저장 경로 | `~/Downloads/vcc` |

## MCP Tools

### `list_workboards`
사용 가능한 작업판(이미지/비디오 생성 템플릿) 목록을 조회합니다.

- **search**: 이름/설명 검색
- **apiFormat**: `ComfyUI` 또는 `OpenAI Compatible`
- **outputFormat**: `image`, `video`, `text`

### `get_workboard`
작업판의 상세 정보를 조회합니다. 사용 가능한 AI 모델, 이미지 크기, 추가 입력 필드 등의 가이드를 제공합니다.

### `generate`
이미지 또는 비디오 생성을 요청합니다. `get_workboard`에서 확인한 옵션 값을 사용하세요.

- **workboardId**, **prompt**, **aiModel**: 필수
- **imageSize**, **stylePreset**, **negativePrompt** 등: 선택

### `get_job_status`
생성 작업의 상태를 확인합니다. 완료 시 결과 이미지/비디오 ID가 포함됩니다.

### `list_jobs`
생성 작업 목록을 조회합니다.

### `download_result`
생성된 이미지/비디오를 로컬 디스크에 다운로드합니다.

## 사용 예시

AI 에이전트에서의 일반적인 워크플로우:

1. `list_workboards` — 사용 가능한 작업판 확인
2. `get_workboard` — 선택한 작업판의 옵션 확인
3. `generate` — 이미지/비디오 생성 요청
4. `get_job_status` — 완료될 때까지 상태 확인 (polling)
5. `download_result` — 결과 파일 다운로드

## 검증

MCP Inspector로 테스트:

```bash
cd mcp-server
npx @modelcontextprotocol/inspector node index.js
```
