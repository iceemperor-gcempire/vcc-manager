# VCC Manager MCP Server 세팅 가이드

VCC Manager MCP Server를 사용하면 AI 에이전트(Claude Desktop, Claude Code 등)에서 이미지/비디오 생성 기능을 직접 호출할 수 있습니다.

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [MCP Server 설치](#2-mcp-server-설치)
3. [MCP 전용 계정 생성 (권장)](#3-mcp-전용-계정-생성-권장)
4. [클라이언트별 설정](#4-클라이언트별-설정)
5. [환경 변수 참조](#5-환경-변수-참조)
6. [사용 가능한 Tools](#6-사용-가능한-tools)
7. [사용 예시 (워크플로우)](#7-사용-예시-워크플로우)
8. [동작 확인 (MCP Inspector)](#8-동작-확인-mcp-inspector)
9. [문제 해결](#9-문제-해결)

---

## 1. 사전 준비

- **Node.js 18 이상** (내장 `fetch` API 필요)
- **VCC Manager 서버가 실행 중**이어야 합니다
- MCP Server에서 사용할 **VCC Manager 계정** (이메일/비밀번호)

---

## 2. MCP Server 설치

```bash
cd mcp-server
npm install
```

설치가 완료되면 `mcp-server/` 디렉토리에 `node_modules`가 생성됩니다.

---

## 3. MCP 전용 계정 생성 (권장)

> **보안 권장사항**: MCP Server용 계정은 개인 계정과 별도로 생성하는 것을 강력히 권장합니다.

MCP Server는 환경 변수에 이메일과 비밀번호를 평문으로 저장합니다. 개인 계정을 사용할 경우 자격 증명이 설정 파일에 노출될 위험이 있으며, AI 에이전트가 해당 계정으로 작업을 수행하므로 생성 이력 관리에도 혼동이 생길 수 있습니다.

### 전용 계정 생성 절차

1. VCC Manager 웹에서 새 계정을 등록합니다
   - 이메일 예시: `mcp-agent@your-domain.com`
   - 닉네임 예시: `MCP Agent`
2. **관리자가 해당 계정을 승인**합니다 (관리자 페이지 → 사용자 관리)
3. 승인된 계정의 이메일/비밀번호를 MCP Server 환경 변수에 설정합니다

### 전용 계정 사용의 장점

| 항목 | 설명 |
|---|---|
| **보안 격리** | 개인 계정 자격 증명이 설정 파일에 노출되지 않음 |
| **이력 추적** | AI 에이전트가 생성한 작업을 별도 계정으로 구분하여 추적 가능 |
| **권한 관리** | 필요시 MCP 전용 계정만 비활성화하여 에이전트 접근을 차단 가능 |
| **비밀번호 관리** | 개인 비밀번호 변경 시 MCP 설정에 영향 없음 |

---

## 4. 클라이언트별 설정

### 4-1. Claude Desktop

설정 파일 경로:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

설정 후 **Claude Desktop을 재시작**하면 MCP 도구가 활성화됩니다.

### 4-2. Claude Code

프로젝트 루트의 `.mcp.json` 파일에 추가합니다:

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

> **참고**: `args`의 경로는 반드시 **절대 경로**를 사용하세요.

---

## 5. 환경 변수 참조

| 변수 | 필수 | 설명 | 기본값 |
|---|---|---|---|
| `VCC_API_URL` | No | VCC Manager API 서버 URL | `http://localhost:3000` |
| `VCC_EMAIL` | **Yes** | 로그인 이메일 | - |
| `VCC_PASSWORD` | **Yes** | 로그인 비밀번호 | - |
| `VCC_DOWNLOAD_DIR` | No | 결과 파일 다운로드 저장 경로 | `~/Downloads/vcc` |

### 인증 동작 방식

- 첫 API 호출 시 이메일/비밀번호로 자동 로그인하여 JWT 토큰을 발급받습니다
- 발급받은 토큰은 메모리에 캐싱되어 이후 요청에 재사용됩니다
- 토큰 만료(401 응답) 시 자동으로 1회 재로그인을 시도합니다
- 로그인 rate limit은 15분당 5회이므로, 토큰 캐싱으로 충분히 회피됩니다

---

## 6. 사용 가능한 Tools

### `list_workboards` — 작업판 목록 조회

사용 가능한 작업판(이미지/비디오 생성 템플릿) 목록을 조회합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `search` | string | No | 이름/설명 검색 |
| `apiFormat` | string | No | `ComfyUI` 또는 `OpenAI Compatible` |
| `outputFormat` | string | No | `image`, `video`, `text` |
| `page` | number | No | 페이지 번호 (기본 1) |
| `limit` | number | No | 페이지당 항목 수 (기본 10, 최대 50) |

### `get_workboard` — 작업판 상세 조회

작업판의 상세 정보와 입력 필드 가이드를 조회합니다. `generate` 호출 전에 반드시 확인하세요.

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `workboardId` | string | **Yes** | 작업판 ID |

### `generate` — 이미지/비디오 생성

이미지 또는 비디오 생성을 요청합니다. select 필드(aiModel, imageSize 등)는 `value` 문자열만 전달하면 key-value 매핑이 자동 처리됩니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `workboardId` | string | **Yes** | 작업판 ID |
| `prompt` | string | **Yes** | 생성 프롬프트 |
| `aiModel` | string | **Yes** | AI 모델 value |
| `negativePrompt` | string | No | 네거티브 프롬프트 |
| `imageSize` | string | No | 이미지 크기 value |
| `stylePreset` | string | No | 스타일 프리셋 value |
| `upscaleMethod` | string | No | 업스케일 방법 value |
| `seed` | number | No | 시드 값 |
| `randomSeed` | boolean | No | 랜덤 시드 사용 (기본 true) |
| `additionalParams` | object | No | 추가 파라미터 (필드명 → 값) |

### `get_job_status` — 작업 상태 확인

생성 작업의 진행 상태를 확인합니다. 완료 시 결과 이미지/비디오 ID 목록이 포함됩니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `jobId` | string | **Yes** | 작업 ID |

### `list_jobs` — 작업 목록 조회

내 생성 작업 목록을 조회합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `status` | string | No | `pending`, `processing`, `completed`, `failed`, `cancelled` |
| `search` | string | No | 프롬프트 검색 |
| `page` | number | No | 페이지 번호 (기본 1) |
| `limit` | number | No | 페이지당 항목 수 (기본 10, 최대 50) |

### `download_result` — 결과 다운로드

생성된 이미지/비디오를 로컬 디스크에 다운로드합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `mediaId` | string | **Yes** | 미디어 ID (get_job_status 결과에서 확인) |
| `mediaType` | string | **Yes** | `image` 또는 `video` |
| `downloadDir` | string | No | 저장 디렉토리 (기본: VCC_DOWNLOAD_DIR) |

---

## 7. 사용 예시 (워크플로우)

AI 에이전트에서의 일반적인 사용 흐름입니다:

```
1. list_workboards          → 사용 가능한 작업판 목록 확인
2. get_workboard(id)        → 선택한 작업판의 모델, 크기 등 옵션 확인
3. generate(...)            → 프롬프트와 옵션으로 이미지/비디오 생성 요청
4. get_job_status(jobId)    → 완료될 때까지 상태 확인 (polling)
5. download_result(mediaId) → 결과 파일을 로컬에 다운로드
```

### 예시: 이미지 생성

```
사용자: "고양이 일러스트를 생성해줘"

AI 에이전트 동작:
1. list_workboards(outputFormat="image") → 이미지 작업판 목록 확인
2. get_workboard("작업판ID") → 사용 가능한 모델/크기 확인
3. generate(workboardId="...", prompt="cute cat illustration", aiModel="model-v1") → 작업 생성
4. get_job_status("작업ID") → status: "completed", resultImages: [{id: "..."}]
5. download_result(mediaId="...", mediaType="image") → ~/Downloads/vcc/result.png 저장
```

---

## 8. 동작 확인 (MCP Inspector)

MCP Inspector를 사용하여 서버가 정상 동작하는지 확인할 수 있습니다:

```bash
cd mcp-server
npx @modelcontextprotocol/inspector node index.js
```

Inspector에서 확인할 항목:

1. **Tools 탭**: 6개 도구가 모두 표시되는지 확인
2. **list_workboards 실행**: 작업판 목록이 정상 반환되는지 확인
3. **get_workboard 실행**: 필드 가이드가 올바르게 표시되는지 확인
4. **generate 실행**: 작업 생성 후 jobId가 반환되는지 확인
5. **get_job_status 실행**: 완료 시 resultImages/resultVideos 포함 확인
6. **download_result 실행**: 파일이 정상 저장되는지 확인

> **참고**: Inspector 실행 시에도 환경 변수(`VCC_EMAIL`, `VCC_PASSWORD` 등)가 필요합니다. 터미널에서 `export`로 설정하거나 `.env` 파일을 활용하세요.

---

## 9. 문제 해결

### "Sign-in failed (401)" 오류

- `VCC_EMAIL`, `VCC_PASSWORD` 환경 변수가 올바르게 설정되어 있는지 확인하세요
- 해당 계정이 관리자에 의해 **승인(approved)** 상태인지 확인하세요
- 비밀번호에 특수문자가 포함된 경우 JSON 설정 파일에서 이스케이프가 필요할 수 있습니다

### "Sign-in failed (429)" 오류

- 로그인 rate limit(15분당 5회)에 도달한 경우입니다
- 15분 후 자동으로 해제됩니다
- 정상 동작 시에는 토큰 캐싱으로 인해 발생하지 않습니다

### 연결 실패 (ECONNREFUSED)

- `VCC_API_URL`이 올바른지 확인하세요 (기본: `http://localhost:3000`)
- VCC Manager 서버가 실행 중인지 확인하세요: `docker-compose ps`

### MCP 도구가 표시되지 않음

- 설정 파일의 `args` 경로가 **절대 경로**인지 확인하세요
- Claude Desktop의 경우 앱을 **완전히 재시작**해야 합니다
- `node --version`으로 Node.js 18 이상인지 확인하세요
- `cd mcp-server && npm install`로 의존성이 설치되어 있는지 확인하세요
