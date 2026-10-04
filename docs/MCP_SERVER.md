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
- MCP 에 쓸 **VCC Manager API Key — 용도는 "MCP 용"** (프로필 > 보안 설정에서 발급, [6장](#6-api-key-발급))
- HTTP 모드에서 이미지·영상을 받으려면 **`VCC_BASE_URL_FOR_MCP`** 설정 ([3-1](#3-1-docker-compose로-실행))
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

### 키 용도 — MCP 에는 MCP 키

API 키는 발급할 때 용도를 고른다.

| | MCP 용 (`vccm_…`) | API 용 · 범용 (`vcc_…`) |
|---|---|---|
| 할 수 있는 것 | MCP 도구가 쓰는 요청만 — 작업판 조회, 생성(텍스트 작업판 포함), 작업 조회, 결과 받기, 이미지 업로드, 프로젝트·파이프라인 조회와 실행 | 계정의 API 전반 (스크립트·자동화용) |
| 키가 새면 | MCP 로 할 수 있는 만큼만 열린다 | 그 계정의 API 가 열린다 |

**MCP 클라이언트에는 MCP 키를 쓴다.** MCP 키로 그 밖의 요청을 하면 `403 이 키는 MCP 용이라 이 작업에 쓸 수 없습니다` 가 난다.
어느 용도든 계정 삭제·백업 복원처럼 되돌릴 수 없는 작업은 API 키로 할 수 없다 (로그인한 웹 화면에서만).

키 용도는 **할 수 있는 작업**을 막고, **볼 수 있는 데이터**는 막지 않는다 — 관리자 계정의 MCP 키는 관리자가 보는 콘텐츠를 그대로 본다.
데이터까지 나누고 싶으면 **MCP 전용 계정**을 따로 만들어 그 계정에서 키를 발급한다. 이때 작업판에 그룹 제한이 걸려 있으면
그 계정을 해당 그룹에 넣어야 MCP 에서 작업판이 보인다.

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

#### 이미지·영상을 받으려면 `VCC_BASE_URL_FOR_MCP` 를 설정한다

MCP 는 도구 결과로 파일을 직접 실어 보낼 길이 없어서, 결과물은 **서명된 링크**로 돌려준다. 그 링크의 앞부분이 `VCC_BASE_URL_FOR_MCP` 다.
**MCP 클라이언트가 실제로 열 수 있는 VCC 주소**로 `.env` 에 적는다.

```bash
# .env
VCC_BASE_URL_FOR_MCP=https://vcc.example.com     # 원격에서 붙는 클라이언트가 있으면 그쪽에서 닿는 주소
# VCC_BASE_URL_FOR_MCP=http://localhost:3136     # 클라이언트가 같은 머신에만 있으면
```

설정하지 않으면 `download_result` 가 **영상·오디오는 메타데이터만(파일 없음)**, 이미지는 base64 로 돌려준다 —
이미지는 대화에 그대로 실려 커지고, 영상은 받을 방법이 없다. 이 경우 MCP 서버가 기동할 때 로그에 경고를 남긴다.

### 3-2. 헬스체크 확인

```bash
curl http://localhost:4136/health
# {"status":"ok","transport":"streamable-http","activeSessions":0}
```

### 3-3. 연결 주소 — http 로 충분한 경우와 https 가 필요한 경우

API 키는 `Authorization: Bearer …` **헤더**로 간다. 평문 http 면 오가는 길목에서 읽힐 수 있다 (헤더를 어떻게 만들든 같다).
서명된 결과 링크도 만료 전까지는 그 파일의 열쇠라 같은 성질이다. 다만 개인이 집 안에서 쓰는데 인증서까지 세울 필요는 없다:

| 구성 | http | 권장 |
|---|---|---|
| **같은 머신** (클라이언트와 서버가 한 대) | 문제없음 — 트래픽이 머신 밖으로 안 나간다 | `http://localhost:4136/mcp` |
| **집·사내 LAN, 신뢰하는 기기만** | 써도 된다. 위험은 같은 네트워크의 다른 기기·공유기 | http 로 쓰되 **MCP 키**로 피해 범위를 줄이고, 의심되면 키를 교체 |
| **LAN 밖** (인터넷 노출, 포트포워딩, 공용 Wi-Fi, 다른 곳에서 접속) | **안 된다** | https |

LAN 밖에서 쓸 때 고를 수 있는 길 (부담이 적은 순):

- **Tailscale 같은 메시 VPN** — 인증서 없이 기기 사이 트래픽이 암호화된다. 주소가 `http://` 여도 네트워크 층에서 암호화된다
- **Cloudflare Tunnel 등 터널** — 도메인이 있으면 TLS 를 대신 처리해 준다
- **리버스 프록시 + 인증서** (Caddy, nginx) — 공개 도메인이 있어야 자동 발급이 편하다. LAN 전용 자체 서명 인증서는 클라이언트가 거부하는 경우가 많다

> 아래 예시의 `http://your-server:4136/mcp` 는 **같은 머신·신뢰된 LAN 용**이다. LAN 밖이면 `https://` 주소로 바꾼다.

### 3-4. 클라이언트 설정

#### Claude Code

**기본 — MCP 용 키를 헤더로** (한 줄)

```bash
claude mcp add --transport http vcc-manager http://your-server:4136/mcp \
  --header "Authorization: Bearer vccm_xxxxxxxxxxxxxxxx"
```

지킬 것은 셋이다.

1. **반드시 MCP 용 키(`vccm_…`)를 쓴다.** 이 방식은 키가 Claude Code 설정 파일에 그대로 남는다. 그래도 괜찮은 이유는 MCP 키가
   새도 작업판 조회·생성·결과 받기 정도만 열리기 때문이다 — 되돌릴 수 없는 작업은 어떤 키로도 안 되고, 관리 기능은 MCP 키로 못 쓴다.
   범용 키(`vcc_…`)를 여기에 넣지 않는다
2. **`.mcp.json` 에 넣지 않는다.** 프로젝트 루트의 `.mcp.json`(project 스코프)은 보통 Git 에 커밋된다. 기본값인 local 스코프나 user 스코프로 등록한다 ([5-2](#5-2-등록-스코프))
3. **키를 바꾸면 다시 연결한다** — 설정을 고친 뒤 `/mcp` 에서 Reconnect ([5-3](#5-3-관리-명령어))

등록한 뒤에는 `/mcp` 에서 연결 상태를 보고 `list_workboards` 를 한 번 불러 실제로 되는지 확인한다.

**고급 — 키를 설정 파일에서도 빼고 싶다면 (headersHelper)**

키를 설정 파일에 두는 것 자체를 피하고 싶을 때만 쓴다. Claude Code 가 연결할 때 지정한 스크립트를 실행해 그 출력을 헤더로 쓰므로,
키는 스크립트가 읽는 곳(예: 권한 600 파일)에만 있다. 준비할 것이 많고 아래 조건이 붙는다.

1. 헬퍼 스크립트를 둔다 — 저장소의 [`scripts/mcp-headers.sh.example`](../scripts/mcp-headers.sh.example) 을 복사해 쓴다

   ```sh
   #!/bin/sh
   # stdout 으로 헤더 JSON 하나만 낸다. 실패하면 0 이 아닌 코드로 끝낸다.
   . "$HOME/.config/vcc-mcp.env"          # 여기에 VCC_MCP_KEY="vccm_..." (chmod 600)
   [ -n "$VCC_MCP_KEY" ] || { echo "VCC_MCP_KEY 없음" >&2; exit 1; }
   printf '{"Authorization": "Bearer %s"}\n' "$VCC_MCP_KEY"
   ```

2. `claude mcp add-json` 으로 등록한다 (`claude mcp add` 에는 헬퍼 옵션이 없고, `add-json` 은 JSON 을 그대로 받는다)

   ```bash
   claude mcp add-json vcc-manager '{"type":"http","url":"http://your-server:4136/mcp","headersHelper":"/절대경로/mcp-headers.sh"}'
   ```

3. 조건과 함정
   - **헬퍼는 신뢰한 폴더에서만 실행된다.** 신뢰 확인을 수락하지 않은 폴더에서는 헬퍼가 돌지 않아 인증 헤더 없이 접속하고,
     `Dynamic Client Registration rejected (HTTP 404)` 라는 엉뚱한 오류로 실패한다 ([문제 해결](#11-문제-해결))
   - 헬퍼가 실행되지 않는 클라이언트 버그 보고가 있다 (anthropics/claude-code #41690, #48514 — 특히 플러그인으로 설치한 경우). "연결됨" 표시만 믿지 말고 실제 호출로 확인한다
   - `.mcp.json` 에 쓸 거라면 이 방식만 — 키가 저장소에 올라가지 않는다

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

> **참고**: `--allow-http`는 트래픽이 암호화되지 않으므로, 신뢰할 수 있는 내부 네트워크에서만 사용하세요 ([3-3](#3-3-연결-주소--http-로-충분한-경우와-https-가-필요한-경우)).
> mcp-remote 방식도 키가 설정 파일에 남는다 — 3-4 의 기본 경로와 같이 **MCP 용 키**를 쓴다.
> `--transport http-only`는 SSE 대신 Streamable HTTP로 연결합니다. 생략 시 SSE 폴백을 시도하여 400 에러가 발생할 수 있습니다.

**클라이언트별 프로토콜 요구사항:**

| 클라이언트 | HTTP | HTTPS |
|---|---|---|
| Claude Code (`.mcp.json`) | O (직접 지원) | O |
| Claude Desktop Connectors UI | X | O (필수) |
| mcp-remote 브릿지 | `--allow-http` 필요 | O (기본) |

### 3-5. HTTP 모드에서의 `download_result` 동작

`VCC_BASE_URL_FOR_MCP` 설정 여부로 갈린다 ([3-1](#3-1-docker-compose로-실행)):

| | 이미지 | 영상·오디오 |
|---|---|---|
| **설정함 (정상)** | 서명된 링크 (`responseType: signedUrl`) | 서명된 링크 |
| 설정 안 함 (저하) | base64 를 대화에 그대로 실음 (`base64`) | **메타데이터만 — 파일 없음** (`metadata`) |

설정하지 않은 상태는 정상 동작이 아니라 **저하**다. 서명된 링크는 만료 시각이 있고, 받는 쪽이 그 주소에 닿아야 한다.

> 받은 링크를 스크립트로 내려받을 때 403 이 나면, 앞단 프록시·CDN 이 특정 User-Agent(예: Python 기본값)를 막는지 먼저 본다 — 같은 주소를 curl 이나 브라우저로 열어 비교한다.

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
# HTTP 모드 — 기본: MCP 용 키를 헤더로 (3-4)
claude mcp add --transport http vcc-manager http://your-server:4136/mcp \
  --header "Authorization: Bearer vccm_xxxxxxxxxxxxxxxx"

# HTTP 모드 — 고급: 키를 설정 파일 밖에 두는 헬퍼 (3-4 의 조건 참고)
claude mcp add-json vcc-manager '{"type":"http","url":"http://your-server:4136/mcp","headersHelper":"/절대경로/mcp-headers.sh"}'

# stdio 모드 (로컬 실행)
claude mcp add --transport stdio vcc-manager -- node /absolute/path/to/mcp-server/index.js
```

#### 설정 파일 직접 편집

프로젝트 루트의 `.mcp.json` 파일을 생성/편집합니다. **이 파일은 Git 에 커밋되므로 키를 적지 말고 헬퍼만 지정한다** (팀이 같이 쓰는 경우):

```json
{
  "mcpServers": {
    "vcc-manager": {
      "type": "http",
      "url": "http://your-server:4136/mcp",
      "headersHelper": "/절대경로/mcp-headers.sh"
    }
  }
}
```

> `.mcp.json` 은 Git 에 커밋되는 파일이다 — 키를 `headers` 로 적지 않는다.

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

#### 키를 교체·폐기했을 때

MCP 서버는 세션을 열 때 받은 키를 그 세션 동안 쓴다. 키가 폐기되면 **다음 요청에서 세션을 닫고 401 을 돌려준다** — 옛 키로 조용히 계속 실패하지 않는다.

1. 새 키를 헬퍼가 읽는 곳에 넣는다 (헤더를 직접 적었다면 설정을 고친다)
2. `/mcp` 에서 vcc-manager 를 **Reconnect** 한다
3. `list_workboards` 로 실제 호출을 확인한다

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
3. **생성** 버튼을 클릭하고 키 이름을 입력한 뒤, **"어디에 쓸 키인가요?" 에서 `MCP 용`** 을 고릅니다 (예: 이름 `Claude Code`)
4. 생성된 API Key를 복사합니다 (**이 키는 다시 확인할 수 없으므로 반드시 저장**)
5. 복사한 키를 MCP 클라이언트 설정에 사용합니다:
   - **HTTP 모드**: `Authorization: Bearer vccm_xxx...` 헤더로 등록 ([3-4](#3-4-클라이언트-설정))
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
- 키를 파기하면 해당 키를 사용하는 MCP 세션은 다음 요청에서 401 로 닫힙니다. 새 키로 Reconnect 합니다 ([5-3](#5-3-관리-명령어)).
- **관리자 계정의 범용 키를 MCP 에 쓰지 않는다.** MCP 에는 MCP 키, 데이터까지 나누려면 MCP 전용 계정 ([2장](#키-용도--mcp-에는-mcp-키)).

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
| `VCC_BASE_URL_FOR_MCP` | **미디어 사용 시 사실상 필수** | 결과물 서명 링크의 기준 주소 — MCP 클라이언트가 닿는 VCC 주소. 없으면 영상·오디오는 메타데이터만 ([3-1](#3-1-docker-compose로-실행)) | - |

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
- API Key가 파기되거나 계정이 비활성화되면 인증에 실패합니다. HTTP 모드에서는 세션을 열 때 키를 확인하고(거부되면 401), 세션 도중 폐기되면 다음 요청에서 세션을 닫고 401 을 돌려줍니다
- 별도의 로그인/토큰 갱신 과정이 없어 구성이 간단합니다

---

## 8. 사용 가능한 Tools

### `list_workboards` — 작업판 목록 조회

사용 가능한 작업판(이미지/비디오 생성 템플릿) 목록을 조회합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `search` | string | No | 이름/설명 검색 |
| `serverType` | string | No | `ComfyUI`, `OpenAI`, `OpenAI Compatible`, `Gemini` |
| `outputFormat` | string | No | `image`, `video`, `text` |
| `page` | number | No | 페이지 번호 (기본 1) |
| `limit` | number | No | 페이지당 항목 수 (기본 10, 최대 50) |

### `get_workboard` — 작업판 상세 조회

작업판의 상세 정보와 입력 필드 가이드를 조회합니다. `generate` 호출 전에 반드시 확인하세요.

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `workboardId` | string | **Yes** | 작업판 ID |

### `generate` — 이미지/비디오/오디오 생성

이미지·비디오·오디오 생성을 요청합니다. **텍스트 작업판은 `generate_text`** 를 씁니다. select 필드(aiModel, imageSize 등)는 `get_workboard`의 옵션 배열에서 문자열을 그대로 전달하면 key-value 매핑이 자동 처리됩니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `workboardId` | string | **Yes** | 작업판 ID |
| `prompt` | string | **Yes** | 생성 프롬프트 |
| `aiModel` | string | **Yes** | AI 모델 이름 (`get_workboard` options에서 확인) |
| `negativePrompt` | string | No | 네거티브 프롬프트 |
| `imageSize` | string | No | 이미지 크기 이름 |
| `stylePreset` | string | No | 스타일 프리셋 이름 |
| `upscaleMethod` | string | No | 업스케일 방법 이름 |
| `seed` | number | No | 시드 값 |
| `randomSeed` | boolean | No | 랜덤 시드 사용 (기본 true) |
| `additionalParams` | object | No | 추가 파라미터 (필드명 → 값) |

### `generate_text` — 텍스트 작업판 실행

채팅·프롬프트 작성기 같은 텍스트 작업판(`outputFormat: text`)을 실행하고 결과 텍스트를 **바로** 돌려줍니다 (`get_job_status` 폴링 없음). OpenAI / OpenAI Compatible / Gemini 서버 모두 됩니다. 작업판 필드의 기본값(모델 등)은 자동으로 채워집니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `workboardId` | string | **Yes** | 텍스트 작업판 ID |
| `prompt` | string | **Yes** | 사용자 메시지 |
| `imageIds` | string[] | No | `upload_image` 결과 imageId — 이미지 칸이 있는 작업판, 이미지 입력(vision) 지원 모델 |
| `model` | string | No | 작업판 기본 모델 대신 쓸 모델 ID |
| `conversationId` | string | No | 이전 결과의 대화 ID — 같은 대화로 이어감 |
| `additionalParams` | object | No | 그 밖의 필드 (예: `system_prompt`, `temperature`) |

응답: `result`(텍스트), `conversationId`, `model`, `usage`. 로컬 LLM 은 몇 분 걸릴 수 있으니, 끊기면 MCP 클라이언트의 도구 호출 시간 제한을 확인하세요.

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
- select 필드(aiModel, imageSize 등): 이름(key)으로 먼저 매칭 → 실패 시 내부값(value)으로 매칭 → 실패 시 첫 번째 옵션 fallback
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
- **HTTP 모드**: 서명된 링크를 반환 — `VCC_BASE_URL_FOR_MCP` 가 설정돼 있을 때. 없으면 이미지는 base64, 영상·오디오는 메타데이터만 ([3-5](#3-5-http-모드에서의-download_result-동작))

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `mediaId` | string | **Yes** | 미디어 ID (get_job_status 결과에서 확인) |
| `mediaType` | string | **Yes** | `image`, `video`, `audio` |
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

### 텍스트 작업판 워크플로우 (이미지 첨부)

```
1. list_workboards(outputFormat="text") → 텍스트 작업판 확인 (runWith: "generate_text")
2. upload_image(data)                   → imageId (이미지를 보여 줄 때만)
3. generate_text(workboardId, prompt, imageIds=[imageId]) → result, conversationId
4. generate_text(workboardId, "이어서 질문", conversationId) → 같은 대화로 이어감
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

1. **Tools 탭**: `generate`·`generate_text` 를 포함한 도구들이 표시되는지 확인
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

- API Key가 올바르게 입력되었는지 확인하세요 (`vccm_` 또는 `vcc_` 로 시작하는 전체 키)
- 해당 키가 웹 UI에서 파기되지 않았는지 확인하세요
- 키를 발급한 계정이 활성화(active) 및 승인(approved) 상태인지 확인하세요

### "Dynamic Client Registration rejected (HTTP 404)" / "Cannot POST /register"

헬퍼(headersHelper)를 쓰는데 이 오류가 나면, **인증 헤더 없이 접속한 것**이다 — 서버가 401 을 주자 클라이언트가 OAuth 로 보고 등록을 시도했다. VCC MCP 는 OAuth 를 쓰지 않는다.

- **그 폴더를 신뢰하지 않았다** — Claude Code 는 신뢰하지 않은 폴더에서 헬퍼를 실행하지 않는다. 그 폴더에서 Claude Code 를 열어 신뢰 확인을 수락한다
- **헬퍼 경로·실행 권한** — `headersHelper` 는 절대 경로, `chmod +x`
- **헬퍼 출력** — 직접 실행해 `{"Authorization": "Bearer vccm_…"}` 한 줄만 나오는지 본다. 다른 출력이 섞이면 실패한다

### "VCC API Key 가 거부됐습니다" (401) — HTTP 모드

- 키가 폐기·교체됐거나 잘못된 키다. 세션을 열 때, 또는 세션 도중 키가 폐기된 뒤 다음 요청에서 난다
- 새 키를 넣고 `/mcp` 에서 **Reconnect** ([5-3](#5-3-관리-명령어))

### "이 키는 MCP 용이라 이 작업에 쓸 수 없습니다" (403)

- MCP 키로 MCP 도구가 쓰지 않는 요청을 한 경우다. MCP 클라이언트에서 났다면 버그이니 알려 달라
- 스크립트에서 그 작업이 필요하면 **API 용 키**를 따로 발급한다

### 영상·오디오가 메타데이터만 오고 파일을 받을 수 없음

- `VCC_BASE_URL_FOR_MCP` 가 설정되지 않은 상태다 — MCP 서버 기동 로그에 경고가 있다 ([3-1](#3-1-docker-compose로-실행))
- 설정한 뒤 `docker-compose up -d mcp-server` 로 다시 띄운다

### MCP 를 붙였는데 작업판이 안 보이거나 일부만 보임

- 키를 발급한 계정이 그 작업판의 접근 그룹에 들어 있는지 확인한다 (MCP 전용 계정을 따로 만들었다면 특히)

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
