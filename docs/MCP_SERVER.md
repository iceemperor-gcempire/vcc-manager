# VCC Manager MCP Server 세팅 가이드

VCC Manager MCP Server를 사용하면 AI 에이전트(Claude Desktop, Claude Code 등)에서 이미지/비디오 생성 기능을 직접 호출할 수 있습니다.

**두 가지 실행 모드를 지원합니다:**
- **HTTP 모드 (권장)**: Docker로 배포 후 URL 하나로 연동. 원격 서버 사용에 적합. **멀티유저 지원**.
- **stdio 모드**: 로컬에서 프로세스를 직접 실행. 로컬 개발에 적합.

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [인증 구조](#2-인증-구조)
3. [HTTP 모드 (Docker 배포)](#3-http-모드-docker-배포)
4. [stdio 모드 (로컬 실행)](#4-stdio-모드-로컬-실행)
5. [Claude Code 등록 가이드](#5-claude-code-등록-가이드)
6. [API Key 발급](#6-api-key-발급)
7. [환경 변수 참조](#7-환경-변수-참조)
8. [사용 가능한 Tools](#8-사용-가능한-tools)
9. [사용 예시 (워크플로우)](#9-사용-예시-워크플로우)
10. [동작 확인 (MCP Inspector)](#10-동작-확인-mcp-inspector)
11. [문제 해결](#11-문제-해결)

---

## 1. 사전 준비

- **VCC Manager 서버가 실행 중**이어야 합니다
- MCP Server에서 사용할 **VCC Manager API Key** (프로필 > 보안 설정에서 발급)
- HTTP 모드: **Docker** 환경 (docker-compose에 포함)
- stdio 모드: **Node.js 18 이상** (내장 `fetch` API 필요)

---

## 2. 인증 구조

MCP Server는 **VCC Manager API Key**를 사용하여 백엔드와 통신합니다. 모드에 따라 API Key 전달 방식이 다릅니다.

### HTTP 모드 (멀티유저)

```
┌──────────────┐   Bearer Token    ┌──────────────┐   X-API-Key    ┌──────────────┐
│  MCP Client  │ ─────────────────→│  MCP Server  │ ──────────────→│   Backend    │
│ (Claude 등)  │  (VCC API Key)    │  (Docker)    │  (forwarded)   │              │
└──────────────┘                   └──────────────┘                └──────────────┘
```

- 클라이언트가 자신의 VCC API Key를 **Bearer 토큰**으로 전송
- MCP Server는 세션 초기화 시 토큰을 추출하여 **세션별로 바인딩**
- 이후 모든 백엔드 요청에 **X-API-Key** 헤더로 전달
- **각 사용자가 자신의 API Key로 인증** → 멀티유저 환경 지원
- MCP Server에 별도의 API Key 설정 불필요 (서버는 패스스루 역할)

### stdio 모드 (단일 유저)

```
┌──────────────┐   stdio    ┌──────────────┐   X-API-Key    ┌──────────────┐
│  MCP Client  │ ──────────→│  MCP Server  │ ──────────────→│   Backend    │
│ (Claude 등)  │            │  (로컬 프로세스)│  (env var)    │              │
└──────────────┘            └──────────────┘                └──────────────┘
```

- 환경 변수 `VCC_API_KEY`에 설정된 키를 사용
- 단일 사용자 환경에 적합

---

## 3. HTTP 모드 (Docker 배포)

> 원격 서버에 배포된 VCC Manager를 사용하는 경우 권장하는 방식입니다.
> 클라이언트는 URL과 자신의 VCC API Key만으로 연동할 수 있습니다.

### 3-1. Docker Compose로 실행

MCP 서버는 `docker-compose.yml`에 포함되어 있으므로, 기존 서비스와 함께 시작됩니다:

```bash
docker-compose up --build -d
```

또는 MCP 서버만 재시작:

```bash
docker-compose up --build -d mcp-server
```

> **참고**: HTTP 모드에서는 서버 측 API Key 설정이 필요 없습니다. 각 클라이언트가 자신의 VCC API Key를 Bearer 토큰으로 전송합니다.

### 3-2. 헬스체크 확인

```bash
curl http://localhost:4136/health
# {"status":"ok","transport":"streamable-http","activeSessions":0}
```

### 3-3. 클라이언트 설정

#### Claude Code

CLI로 추가하거나 `.mcp.json` 파일을 직접 편집합니다:

```bash
# CLI로 추가 (VCC API Key를 Bearer 토큰으로 설정)
claude mcp add --transport http vcc-manager http://your-server:4136/mcp \
  --header "Authorization: Bearer vcc_xxxxxxxxxxxxxxxx"
```

또는 프로젝트 루트의 `.mcp.json` 파일에 직접 추가합니다:

```json
{
  "mcpServers": {
    "vcc-manager": {
      "type": "http",
      "url": "http://your-server:4136/mcp",
      "headers": {
        "Authorization": "Bearer vcc_xxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

> **참고**: HTTP 모드에서는 절대 경로나 로컬 Node.js가 필요 없습니다. URL과 API Key만 설정하면 됩니다.

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
        "mcp-remote", "http://your-server:4136/mcp",
        "--transport", "http-only",
        "--allow-http",
        "--header", "Authorization: Bearer vcc_xxxxxxxxxxxxxxxx"
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
        "--transport", "http-only",
        "--header", "Authorization: Bearer vcc_xxxxxxxxxxxxxxxx"
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

### 3-4. HTTP 모드에서의 `download_result` 동작

HTTP 모드에서 `download_result` 도구는 MCP 서버가 인증된 API를 통해 파일을 가져온 뒤, 미디어 타입에 따라 다르게 반환합니다:

- **이미지**: MCP `image` 콘텐츠 타입으로 base64 인코딩된 이미지 데이터를 직접 반환. 클라이언트에서 즉시 확인 가능.
- **비디오**: 파일 크기가 크므로 메타데이터(파일명, 크기)만 반환. VCC Manager 웹 UI에서 확인.

> **참고**: mcp-remote 브릿지 사용 시 응답 크기가 제한될 수 있습니다. Claude Code의 `"type": "http"` 직접 연결을 권장합니다.

---

## 4. stdio 모드 (로컬 실행)

> 로컬 개발 환경에서 MCP 서버를 직접 실행하는 방식입니다.

### 4-1. 설치

```bash
cd mcp-server
npm install
```

### 4-2. 클라이언트 설정

#### Claude Desktop

```json
{
  "mcpServers": {
    "vcc-manager": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/index.js"],
      "env": {
        "VCC_API_URL": "http://localhost:3000",
        "VCC_API_KEY": "vcc_xxxxxxxxxxxxxxxx",
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
        "VCC_API_KEY": "vcc_xxxxxxxxxxxxxxxx",
        "VCC_DOWNLOAD_DIR": "~/Downloads/vcc"
      }
    }
  }
}
```

> **참고**: `args`의 경로는 반드시 **절대 경로**를 사용하세요.

### 4-3. stdio 모드에서의 `download_result` 동작

stdio 모드에서는 결과 파일을 **로컬 디스크에 직접 다운로드**합니다. 저장 경로는 `VCC_DOWNLOAD_DIR` 환경변수 또는 `downloadDir` 파라미터로 지정합니다.

---

## 5. Claude Code 등록 가이드

Claude Code에서 MCP 서버를 등록하는 방법과 적용 범위(스코프)를 설명합니다.

> **참고**: Claude Code는 **HTTP를 직접 지원**합니다. Claude Desktop과 달리 `mcp-remote` 브릿지 없이 HTTP URL로 바로 연결할 수 있습니다.

### 5-1. 등록 방법

#### CLI 명령어

```bash
# HTTP 모드 (원격 서버) — VCC API Key를 Bearer 토큰으로 전달
claude mcp add --transport http vcc-manager http://your-server:4136/mcp \
  --header "Authorization: Bearer vcc_xxxxxxxxxxxxxxxx"

# stdio 모드 (로컬 실행)
claude mcp add --transport stdio vcc-manager -- node /absolute/path/to/mcp-server/index.js

# JSON으로 등록
claude mcp add-json vcc-manager '{"type":"http","url":"http://your-server:4136/mcp","headers":{"Authorization":"Bearer vcc_xxxxxxxxxxxxxxxx"}}'
```

#### 설정 파일 직접 편집

프로젝트 루트의 `.mcp.json` 파일을 생성/편집합니다:

```json
{
  "mcpServers": {
    "vcc-manager": {
      "type": "http",
      "url": "http://your-server:4136/mcp",
      "headers": {
        "Authorization": "Bearer vcc_xxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### 5-2. 등록 스코프

MCP 서버 등록 시 `--scope` 옵션으로 적용 범위를 지정할 수 있습니다.

| 스코프 | 저장 위치 | 적용 범위 | 팀 공유 | CLI 옵션 |
|--------|----------|----------|---------|----------|
| **Local** (기본) | `~/.claude.json` | 현재 프로젝트, 본인만 | X | `--scope local` |
| **Project** | `.mcp.json` (프로젝트 루트) | 현재 프로젝트, 팀 전체 | O (Git) | `--scope project` |
| **User** | `~/.claude.json` | 모든 프로젝트, 본인만 | X | `--scope user` |

```bash
# 이 프로젝트에서만, 나만 사용 (기본값)
claude mcp add --transport http vcc-manager http://server:4136/mcp \
  --header "Authorization: Bearer vcc_xxx"

# 이 프로젝트의 팀 전원이 사용 (.mcp.json에 저장, Git 커밋 대상)
claude mcp add --transport http vcc-manager --scope project http://server:4136/mcp \
  --header "Authorization: Bearer vcc_xxx"

# 내 모든 프로젝트에서 전역 사용
claude mcp add --transport http vcc-manager --scope user http://server:4136/mcp \
  --header "Authorization: Bearer vcc_xxx"
```

**우선순위**: 같은 이름의 서버가 여러 스코프에 존재하면 **Local > Project > User** 순으로 적용됩니다.

### 5-3. 관리 명령어

```bash
# 등록된 서버 목록 확인
claude mcp list

# 특정 서버 상세 정보
claude mcp get vcc-manager

# 서버 제거
claude mcp remove vcc-manager
```

Claude Code 대화 중 `/mcp` 입력으로 서버 상태를 확인하거나 인증을 처리할 수도 있습니다.

### 5-4. 클라이언트별 프로토콜 비교

| 클라이언트 | HTTP 직접 연결 | HTTPS | 비고 |
|---|---|---|---|
| **Claude Code** | O | O | HTTP/HTTPS 모두 직접 지원 |
| **Claude Desktop** (Connectors UI) | X | O (필수) | HTTPS만 허용 |
| **Claude Desktop** (mcp-remote 브릿지) | `--allow-http` 필요 | O | stdio 래핑으로 우회 |

---

## 6. API Key 발급

MCP Server는 VCC Manager API Key를 통해 백엔드와 통신합니다.

### 발급 절차

1. VCC Manager 웹에 로그인합니다
2. **프로필 페이지 > 보안 설정 > API Key 관리** 섹션으로 이동합니다
3. **생성** 버튼을 클릭하고 키 이름을 입력합니다 (예: `MCP Server`)
4. 생성된 API Key를 복사합니다 (**이 키는 다시 확인할 수 없으므로 반드시 저장**)
5. 복사한 키를 MCP 클라이언트 설정에 사용합니다:
   - **HTTP 모드**: `Authorization: Bearer vcc_xxx...` 헤더로 설정
   - **stdio 모드**: `VCC_API_KEY` 환경 변수에 설정

### API Key 사용의 장점

| 항목 | 설명 |
|---|---|
| **보안** | 이메일/비밀번호 대신 키 하나만 환경변수에 저장 |
| **만료 없음** | JWT와 달리 만료/갱신 로직 불필요 |
| **즉시 파기** | 웹 UI에서 키를 파기하면 MCP 접근 즉시 차단 |
| **사용 추적** | 마지막 사용 시각으로 MCP 활동 확인 가능 |
| **멀티유저** | HTTP 모드에서 각 사용자가 자신의 키로 독립 인증 |

### 주의사항

- API Key는 생성 시 1회만 표시됩니다. 분실 시 새 키를 발급해야 합니다.
- 사용자당 최대 10개의 활성 키를 발급할 수 있습니다.
- 키를 파기하면 해당 키를 사용하는 MCP 서버는 즉시 인증에 실패합니다.

---

## 7. 환경 변수 참조

### stdio 모드

| 변수 | 필수 | 설명 | 기본값 |
|---|---|---|---|
| `VCC_API_URL` | No | VCC Manager API 서버 URL | `http://localhost:3000` |
| `VCC_API_KEY` | **Yes** | VCC Manager API Key | - |
| `VCC_DOWNLOAD_DIR` | No | 결과 파일 다운로드 저장 경로 | `~/Downloads/vcc` |

### HTTP 모드 (Docker)

| 변수 | 필수 | 설명 | 기본값 |
|---|---|---|---|
| `MCP_TRANSPORT` | No | Transport 모드 (`stdio` / `http`) | `stdio` |
| `MCP_PORT` | No | HTTP 서버 포트 | `4136` |
| `VCC_API_URL` | No | VCC Manager API 서버 URL | `http://localhost:3000` |

> **참고**: HTTP 모드에서는 서버 측 API Key 설정이 필요 없습니다. 각 클라이언트가 자신의 VCC API Key를 Bearer 토큰으로 전송하며, MCP 서버는 이를 백엔드로 전달합니다.

### 인증 동작 방식

**HTTP 모드:**
1. 클라이언트가 `Authorization: Bearer vcc_xxx...` 헤더로 연결
2. MCP 서버가 세션 초기화(initialize) 시 토큰을 추출
3. 해당 세션의 모든 백엔드 요청에 `X-API-Key` 헤더로 전달
4. 각 세션은 독립된 사용자 컨텍스트를 가짐

**stdio 모드:**
1. `VCC_API_KEY` 환경 변수에서 키를 읽음
2. 모든 백엔드 요청에 `X-API-Key` 헤더로 전달

**공통:**
- API Key가 파기되거나 계정이 비활성화되면 즉시 인증에 실패합니다
- 별도의 로그인/토큰 갱신 과정이 없어 구성이 간단합니다

---

## 8. 사용 가능한 Tools

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

### `continue_job` — 작업 이어가기

완료 또는 실패한 기존 작업을 같은 작업판 또는 다른 작업판에서 이어갑니다. 원본 작업의 파라미터를 대상 작업판에 스마트 매칭하여 새 작업을 생성합니다. 개별 파라미터를 override할 수 있습니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `jobId` | string | **Yes** | 이어갈 원본 작업 ID |
| `targetWorkboardId` | string | No | 대상 작업판 ID (생략 시 원본 작업판 사용) |
| `prompt` | string | No | 프롬프트 override |
| `negativePrompt` | string | No | 네거티브 프롬프트 override |
| `aiModel` | string | No | AI 모델 override |
| `imageSize` | string | No | 이미지 크기 override |
| `seed` | number | No | 시드 값 override |
| `randomSeed` | boolean | No | 랜덤 시드 사용 (기본 true) |
| `additionalParams` | object | No | 추가 파라미터 override (지정한 키만 override, 나머지는 원본에서 매칭) |

**스마트 필드 매칭 동작:**
- select 필드(aiModel, imageSize 등): value로 먼저 매칭 → 실패 시 key로 매칭 → 실패 시 첫 번째 옵션 fallback
- additionalParams: 대상 작업판에 존재하는 필드만 매칭
- 응답에 매칭 리포트(`matching`) 포함: 소스/타겟 작업판, 매칭된 필드 목록

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

## 9. 사용 예시 (워크플로우)

AI 에이전트에서의 일반적인 사용 흐름입니다:

### 기본 생성 워크플로우

```
1. list_workboards          → 사용 가능한 작업판 목록 확인
2. get_workboard(id)        → 선택한 작업판의 모델, 크기 등 옵션 확인
3. generate(...)            → 프롬프트와 옵션으로 이미지/비디오 생성 요청
4. get_job_status(jobId)    → 완료될 때까지 상태 확인 (polling)
5. download_result(mediaId) → 결과 파일 다운로드 또는 URL 확인
```

### 작업 이어가기 워크플로우

```
1. list_jobs                → 기존 작업 목록에서 이어갈 작업 확인
2. list_workboards          → 대상 작업판 선택 (다른 작업판으로 이어가는 경우)
3. continue_job(jobId, ...) → 기존 작업의 파라미터를 자동 매칭하여 새 작업 생성
4. get_job_status(jobId)    → 완료될 때까지 상태 확인
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

### 예시: 다른 작업판으로 이어가기

```
사용자: "아까 생성한 이미지를 비디오 작업판에서 다시 만들어줘"

AI 에이전트 동작:
1. list_jobs(status="completed") → 최근 완료 작업 확인 (jobId 획득)
2. list_workboards(outputFormat="video") → 비디오 작업판 목록 확인
3. continue_job(jobId="...", targetWorkboardId="비디오작업판ID") → 파라미터 자동 매칭
4. get_job_status("새작업ID") → 완료 확인
```

---

## 10. 동작 확인 (MCP Inspector)

### stdio 모드

```bash
cd mcp-server
VCC_API_KEY=vcc_xxx npx @modelcontextprotocol/inspector node index.js
```

### HTTP 모드

```bash
# 서버 실행 (Docker 또는 직접)
docker-compose up -d mcp-server

# Inspector로 연결 (Bearer 토큰 포함)
npx @modelcontextprotocol/inspector --url http://localhost:4136/mcp \
  --header "Authorization: Bearer vcc_xxxxxxxxxxxxxxxx"
```

Inspector에서 확인할 항목:

1. **Tools 탭**: 7개 도구가 모두 표시되는지 확인
2. **list_workboards 실행**: 작업판 목록이 정상 반환되는지 확인
3. **get_workboard 실행**: 필드 가이드가 올바르게 표시되는지 확인
4. **generate 실행**: 작업 생성 후 jobId가 반환되는지 확인
5. **get_job_status 실행**: 완료 시 resultImages/resultVideos 포함 확인
6. **download_result 실행**: 파일 저장 (stdio) 또는 URL 반환 (HTTP) 확인

> **참고**: Inspector 실행 시에도 VCC API Key가 필요합니다. stdio 모드에서는 환경변수로, HTTP 모드에서는 Bearer 토큰으로 전달합니다.

---

## 11. 문제 해결

### "VCC_API_KEY environment variable is required" 오류 (stdio 모드)

- `VCC_API_KEY` 환경 변수가 설정되어 있는지 확인하세요
- 클라이언트 설정의 `env` 섹션에 `VCC_API_KEY`를 포함해야 합니다

### "Authorization header with Bearer token (VCC API Key) is required" (401) — HTTP 모드

- 클라이언트 설정에 `Authorization: Bearer vcc_xxx...` 헤더가 포함되어 있는지 확인하세요
- `.mcp.json`의 `headers` 필드 또는 CLI `--header` 옵션을 확인하세요

### "Invalid or revoked API key" (401) 오류

- API Key가 올바르게 입력되었는지 확인하세요 (`vcc_`로 시작하는 전체 키)
- 해당 키가 웹 UI에서 파기되지 않았는지 확인하세요
- 키를 발급한 계정이 활성화(active) 및 승인(approved) 상태인지 확인하세요

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

- 헬스체크 확인: `curl http://your-server:4136/health`
- 방화벽/보안그룹에서 MCP 포트(기본 4136)가 열려 있는지 확인하세요
- Docker 로그 확인: `docker-compose logs mcp-server`

### Claude Desktop에서 HTTP URL 연결 불가

- **Connectors UI**는 **HTTPS만 허용**합니다. HTTP URL을 입력하면 거부됩니다.
- HTTPS가 없는 환경에서는 `mcp-remote` 브릿지에 `--allow-http` 플래그를 사용하세요.
- 프로덕션 환경에서는 리버스 프록시(nginx, Caddy)로 TLS를 구성하거나 Cloudflare Tunnel 등을 사용하여 HTTPS를 제공하는 것을 권장합니다.

### mcp-remote 연결 시 "SSE error: Non-200 status code (400)"

- `mcp-remote`가 SSE 방식으로 연결을 시도하여 발생하는 에러입니다.
- VCC MCP 서버는 Streamable HTTP만 지원하므로, `--transport http-only` 플래그를 추가하세요:
  ```json
  "args": ["mcp-remote", "http://your-server:4136/mcp", "--transport", "http-only", "--allow-http"]
  ```
