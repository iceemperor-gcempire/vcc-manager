# VCC Manager MCP Server 세팅 가이드

VCC Manager MCP Server를 사용하면 AI 에이전트(Claude Desktop, Claude Code 등)에서 이미지/비디오 생성 기능을 직접 호출할 수 있습니다.

**두 가지 실행 모드를 지원합니다:**
- **HTTP 모드 (권장)**: Docker로 배포 후 URL 하나로 연동. 원격 서버 사용에 적합.
- **stdio 모드**: 로컬에서 프로세스를 직접 실행. 로컬 개발에 적합.

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [HTTP 모드 (Docker 배포)](#2-http-모드-docker-배포)
3. [stdio 모드 (로컬 실행)](#3-stdio-모드-로컬-실행)
4. [MCP 전용 계정 생성 (권장)](#4-mcp-전용-계정-생성-권장)
5. [환경 변수 참조](#5-환경-변수-참조)
6. [사용 가능한 Tools](#6-사용-가능한-tools)
7. [사용 예시 (워크플로우)](#7-사용-예시-워크플로우)
8. [동작 확인 (MCP Inspector)](#8-동작-확인-mcp-inspector)
9. [문제 해결](#9-문제-해결)

---

## 1. 사전 준비

- **VCC Manager 서버가 실행 중**이어야 합니다
- MCP Server에서 사용할 **VCC Manager 계정** (이메일/비밀번호)
- HTTP 모드: **Docker** 환경 (docker-compose에 포함)
- stdio 모드: **Node.js 18 이상** (내장 `fetch` API 필요)

---

## 2. HTTP 모드 (Docker 배포)

> 원격 서버에 배포된 VCC Manager를 사용하는 경우 권장하는 방식입니다.
> 클라이언트는 URL 하나만으로 연동할 수 있습니다.

### 2-1. 환경 변수 설정

`.env` (개발) 또는 `.env.production` (프로덕션) 파일에 MCP 관련 설정을 추가합니다:

```env
# MCP Server Configuration
MCP_PORT=3100
MCP_API_KEY=your-secret-api-key    # 선택사항 (설정 시 Bearer 토큰 인증 활성화)
MCP_EMAIL=mcp-agent@your-domain.com
MCP_PASSWORD=your-mcp-password
```

### 2-2. Docker Compose로 실행

MCP 서버는 `docker-compose.yml`에 포함되어 있으므로, 기존 서비스와 함께 시작됩니다:

```bash
docker-compose up --build -d
```

또는 MCP 서버만 재시작:

```bash
docker-compose up --build -d mcp-server
```

### 2-3. 헬스체크 확인

```bash
curl http://localhost:3100/health
# {"status":"ok","transport":"streamable-http","activeSessions":0}
```

### 2-4. 클라이언트 설정

#### Claude Code

CLI로 추가하거나 `.mcp.json` 파일을 직접 편집합니다:

```bash
# CLI로 추가
claude mcp add --transport http vcc-manager http://your-server:3100/mcp

# MCP_API_KEY를 설정한 경우
claude mcp add --transport http vcc-manager http://your-server:3100/mcp \
  --header "Authorization: Bearer your-secret-api-key"
```

또는 프로젝트 루트의 `.mcp.json` 파일에 직접 추가합니다:

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

`MCP_API_KEY`를 설정한 경우:

```json
{
  "mcpServers": {
    "vcc-manager": {
      "type": "http",
      "url": "http://your-server:3100/mcp",
      "headers": {
        "Authorization": "Bearer your-secret-api-key"
      }
    }
  }
}
```

> **참고**: HTTP 모드에서는 절대 경로나 로컬 Node.js가 필요 없습니다. URL만 설정하면 됩니다.

#### Claude Desktop

Claude Desktop은 `claude_desktop_config.json`에서 원격 HTTP 서버를 직접 지원하지 않습니다.
아래 방법 중 하나를 사용하세요:

**방법 1: Connectors UI + HTTPS (권장)**

Claude Desktop 앱 → **Settings → Connectors → Add custom connector** 에서 URL을 입력합니다.

> **주의**: Connectors UI는 **HTTPS URL만 허용**합니다. 리버스 프록시(nginx, Caddy 등)나 터널(Cloudflare Tunnel, ngrok 등)을 통해 HTTPS를 제공해야 합니다.

- URL: `https://your-server/mcp`

**방법 2: mcp-remote 브릿지 (HTTP 가능)**

`claude_desktop_config.json`에서 `mcp-remote`를 stdio 브릿지로 사용합니다.
HTTP URL을 사용하려면 `--allow-http` 플래그가 필요합니다.
또한 VCC MCP 서버는 Streamable HTTP 전용이므로 `--transport http-only`를 지정해야 합니다:

```json
{
  "mcpServers": {
    "vcc-manager": {
      "command": "npx",
      "args": [
        "mcp-remote", "http://your-server:3100/mcp",
        "--transport", "http-only",
        "--allow-http"
      ]
    }
  }
}
```

`MCP_API_KEY`를 설정한 경우:

```json
{
  "mcpServers": {
    "vcc-manager": {
      "command": "npx",
      "args": [
        "mcp-remote", "http://your-server:3100/mcp",
        "--transport", "http-only",
        "--allow-http",
        "--header", "Authorization: Bearer your-secret-api-key"
      ]
    }
  }
}
```

HTTPS URL이라면 `--allow-http` 생략 가능:

```json
{
  "mcpServers": {
    "vcc-manager": {
      "command": "npx",
      "args": [
        "mcp-remote", "https://your-server/mcp",
        "--transport", "http-only"
      ]
    }
  }
}
```

> **참고**: `--allow-http`는 트래픽이 암호화되지 않으므로, 신뢰할 수 있는 내부 네트워크에서만 사용하세요.
> `--transport http-only`는 SSE 대신 Streamable HTTP로 연결합니다. 생략 시 SSE 폴백을 시도하여 400 에러가 발생할 수 있습니다.

**클라이언트별 프로토콜 요구사항:**

| 클라이언트 | HTTP | HTTPS |
|---|---|---|
| Claude Code (`.mcp.json`) | O (직접 지원) | O |
| Claude Desktop Connectors UI | X | O (필수) |
| mcp-remote 브릿지 | `--allow-http` 필요 | O (기본) |

### 2-5. HTTP 모드에서의 `download_result` 동작

HTTP 모드에서 `download_result` 도구는 MCP 서버가 인증된 API를 통해 파일을 가져온 뒤, 미디어 타입에 따라 다르게 반환합니다:

- **이미지**: MCP `image` 콘텐츠 타입으로 base64 인코딩된 이미지 데이터를 직접 반환. 클라이언트에서 즉시 확인 가능.
- **비디오**: 파일 크기가 크므로 메타데이터(파일명, 크기)만 반환. VCC Manager 웹 UI에서 확인.
```

---

## 3. stdio 모드 (로컬 실행)

> 로컬 개발 환경에서 MCP 서버를 직접 실행하는 방식입니다.

### 3-1. 설치

```bash
cd mcp-server
npm install
```

### 3-2. 클라이언트 설정

#### Claude Desktop

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

#### Claude Code

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

### 3-3. stdio 모드에서의 `download_result` 동작

stdio 모드에서는 결과 파일을 **로컬 디스크에 직접 다운로드**합니다. 저장 경로는 `VCC_DOWNLOAD_DIR` 환경변수 또는 `downloadDir` 파라미터로 지정합니다.

---

## 4. MCP 전용 계정 생성 (권장)

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

## 5. 환경 변수 참조

### 공통 (stdio / HTTP)

| 변수 | 필수 | 설명 | 기본값 |
|---|---|---|---|
| `VCC_API_URL` | No | VCC Manager API 서버 URL | `http://localhost:3000` |
| `VCC_EMAIL` | **Yes** | 로그인 이메일 | - |
| `VCC_PASSWORD` | **Yes** | 로그인 비밀번호 | - |

### stdio 모드 전용

| 변수 | 필수 | 설명 | 기본값 |
|---|---|---|---|
| `VCC_DOWNLOAD_DIR` | No | 결과 파일 다운로드 저장 경로 | `~/Downloads/vcc` |

### HTTP 모드 전용

| 변수 | 필수 | 설명 | 기본값 |
|---|---|---|---|
| `MCP_TRANSPORT` | No | Transport 모드 (`stdio` / `http`) | `stdio` |
| `MCP_PORT` | No | HTTP 서버 포트 | `3100` |
| `MCP_API_KEY` | No | Bearer 토큰 인증 키 (미설정 시 인증 비활성화) | - |

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

생성된 이미지/비디오를 다운로드합니다. 동작은 transport 모드에 따라 다릅니다:

- **stdio 모드**: 로컬 디스크에 파일을 직접 다운로드
- **HTTP 모드**: 다운로드 URL을 반환 (브라우저에서 열기)

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `mediaId` | string | **Yes** | 미디어 ID (get_job_status 결과에서 확인) |
| `mediaType` | string | **Yes** | `image` 또는 `video` |
| `downloadDir` | string | No | 저장 디렉토리 — stdio 모드 전용 (기본: VCC_DOWNLOAD_DIR) |

---

## 7. 사용 예시 (워크플로우)

AI 에이전트에서의 일반적인 사용 흐름입니다:

```
1. list_workboards          → 사용 가능한 작업판 목록 확인
2. get_workboard(id)        → 선택한 작업판의 모델, 크기 등 옵션 확인
3. generate(...)            → 프롬프트와 옵션으로 이미지/비디오 생성 요청
4. get_job_status(jobId)    → 완료될 때까지 상태 확인 (polling)
5. download_result(mediaId) → 결과 파일 다운로드 또는 URL 확인
```

### 예시: 이미지 생성

```
사용자: "고양이 일러스트를 생성해줘"

AI 에이전트 동작:
1. list_workboards(outputFormat="image") → 이미지 작업판 목록 확인
2. get_workboard("작업판ID") → 사용 가능한 모델/크기 확인
3. generate(workboardId="...", prompt="cute cat illustration", aiModel="model-v1") → 작업 생성
4. get_job_status("작업ID") → status: "completed", resultImages: [{id: "..."}]
5. download_result(mediaId="...", mediaType="image") → 파일 다운로드 또는 URL 반환
```

---

## 8. 동작 확인 (MCP Inspector)

### stdio 모드

```bash
cd mcp-server
npx @modelcontextprotocol/inspector node index.js
```

### HTTP 모드

```bash
# 서버 실행 (Docker 또는 직접)
docker-compose up -d mcp-server

# Inspector로 연결
npx @modelcontextprotocol/inspector --url http://localhost:3100/mcp
```

Inspector에서 확인할 항목:

1. **Tools 탭**: 6개 도구가 모두 표시되는지 확인
2. **list_workboards 실행**: 작업판 목록이 정상 반환되는지 확인
3. **get_workboard 실행**: 필드 가이드가 올바르게 표시되는지 확인
4. **generate 실행**: 작업 생성 후 jobId가 반환되는지 확인
5. **get_job_status 실행**: 완료 시 resultImages/resultVideos 포함 확인
6. **download_result 실행**: 파일 저장 (stdio) 또는 URL 반환 (HTTP) 확인

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

- **stdio 모드**: `VCC_API_URL`이 올바른지 확인하세요 (기본: `http://localhost:3000`)
- **HTTP 모드**: Docker 네트워크 내에서 backend 컨테이너가 실행 중인지 확인하세요
  ```bash
  docker-compose logs mcp-server
  docker-compose logs backend
  ```
- VCC Manager 서버가 실행 중인지 확인: `docker-compose ps`

### MCP 도구가 표시되지 않음 (stdio 모드)

- 설정 파일의 `args` 경로가 **절대 경로**인지 확인하세요
- Claude Desktop의 경우 앱을 **완전히 재시작**해야 합니다
- `node --version`으로 Node.js 18 이상인지 확인하세요
- `cd mcp-server && npm install`로 의존성이 설치되어 있는지 확인하세요

### MCP 서버 연결 불가 (HTTP 모드)

- 헬스체크 확인: `curl http://your-server:3100/health`
- `MCP_API_KEY`를 설정한 경우, 클라이언트에도 동일한 키로 Authorization 헤더를 설정했는지 확인하세요
- 방화벽/보안그룹에서 MCP 포트(기본 3100)가 열려 있는지 확인하세요
- Docker 로그 확인: `docker-compose logs mcp-server`

### "Unauthorized" (401) — MCP 엔드포인트

- `MCP_API_KEY`가 서버와 클라이언트 양쪽에서 일치하는지 확인하세요
- Authorization 헤더 형식이 `Bearer <key>`인지 확인하세요

### Claude Desktop에서 HTTP URL 연결 불가

- **Connectors UI**는 **HTTPS만 허용**합니다. HTTP URL을 입력하면 거부됩니다.
- HTTPS가 없는 환경에서는 `mcp-remote` 브릿지에 `--allow-http` 플래그를 사용하세요.
- 프로덕션 환경에서는 리버스 프록시(nginx, Caddy)로 TLS를 구성하거나 Cloudflare Tunnel 등을 사용하여 HTTPS를 제공하는 것을 권장합니다.

### mcp-remote 연결 시 "SSE error: Non-200 status code (400)"

- `mcp-remote`가 SSE 방식으로 연결을 시도하여 발생하는 에러입니다.
- VCC MCP 서버는 Streamable HTTP만 지원하므로, `--transport http-only` 플래그를 추가하세요:
  ```json
  "args": ["mcp-remote", "http://your-server:3100/mcp", "--transport", "http-only", "--allow-http"]
  ```
