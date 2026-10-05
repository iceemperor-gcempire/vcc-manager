# AI 에이전트가 서버·작업판을 등록하는 절차

VCC Manager 는 **AI 에이전트가 이 저장소를 읽고 서버 등록부터 작업판 준비까지 스스로 하는 것**을 기본 사용 방식으로 둔다.
이 문서는 그 절차를 요청 단위로 적는다. 사람이 웹 화면(관리자 메뉴)에서 하는 일과 결과가 같다.

> 생성·실행(만들어 둔 작업판으로 이미지·영상·텍스트를 만드는 일)은 MCP 로 한다 — [MCP_SERVER.md](MCP_SERVER.md).
> 이 문서는 그 앞 단계, 작업판을 **준비하는** 일이다.

---

## 0. 준비 — 관리자 계정의 API 용 키

| | |
|---|---|
| 계정 | **관리자** 계정 (서버·작업판 관리는 관리자만) |
| 키 | 프로필 > 보안 설정 > API 키 발급에서 **용도: API 용 (범용)** 으로 발급 (`vcc_` 로 시작) |
| 보내는 법 | `X-API-Key: <키>` 헤더. `Authorization: Bearer` 는 받지 않는다 (401) |

- **MCP 용 키(`vccm_`)로는 안 된다** — MCP 도구가 쓰는 요청만 열려 있어 아래 요청은 전부 403 이다.
- 키는 환경변수로 두고 명령에 값을 직접 적지 않는다 (셸 기록·대화 기록에 남는다).

```bash
export VCC_BASE_URL="https://vcc.example.com"     # 웹 주소 (프런트와 같은 도메인이면 /api 가 백엔드로 간다)
export VCC_API_KEY="..."                          # 관리자 계정의 API 용 키 — 비밀 보관소에서 읽어 넣는다
vcc() { curl -sS -H "X-API-Key: $VCC_API_KEY" -H 'Content-Type: application/json' "$@"; }
```

**API 키로 할 수 없는 것** — 계정 삭제, 백업(생성·내려받기·복원·삭제), 사용자 삭제, 무결성 정리, 서버·작업판·그룹 등 **삭제**.
되돌릴 수 없는 일이라 웹에 로그인한 상태에서만 된다 (`403 이 작업은 API 키로 할 수 없습니다`). 지워야 하면 사람에게 넘긴다.

---

## 1. 이 저장소에서 읽을 곳

| 무엇 | 어디 |
|---|---|
| 서버 종류 이름·지원 출력 형식·연결 확인 경로 | `src/constants/serverTypes.js` (단일 출처) |
| 바로 가져다 쓰는 완성 작업판 (ComfyUI 워크플로 포함) | `workboards/` 와 그 `README.md` (필요한 모델·노드) |
| 새 작업판의 기본 입력 칸 (서버 종류 × 출력 형식) | `frontend/src/templates/<serverType>-<outputFormat>.json` |
| ComfyUI 워크플로를 작업판으로 만드는 법 | [COMFYUI_WORKFLOW_AUTHORING.md](COMFYUI_WORKFLOW_AUTHORING.md) |
| 요청 목록 전체 | [API.md](API.md) |

---

## 2. 서버 등록

```bash
vcc -X POST "$VCC_BASE_URL/api/servers" -d '{
  "name": "LocalLLM-EVOx2",
  "serverType": "OpenAI Compatible",
  "serverUrl": "http://192.168.0.10:8889",
  "configuration": { "apiKey": "<그 서버의 키, 없으면 빼기>" }
}'
```

- `serverType` 은 `serverTypes.js` 에 있는 이름 그대로 (`ComfyUI`, `OpenAI`, `OpenAI Compatible`, `Gemini` …).
- **주소에 경로를 붙이지 않는다.** OpenAI 호환 서버는 `/v1` 을 빼고 적는다 — VCC 가 `/v1/models`, `/v1/chat/completions` 를 붙인다.
  붙여 적으면 `/v1/v1/…` 로 요청이 가는데, 이를 너그럽게 받아 주는 서버도 있어 연결 확인만으로는 드러나지 않을 수 있다.
- 같은 이름이 이미 있으면 400 `같은 이름의 서버가 이미 존재합니다`. 먼저 `GET /api/servers` 로 확인한다.
- 서버의 키는 저장 시 암호화된다. 응답·목록에 키 값은 나오지 않는다.

**저장 후 연결 확인까지 끝나고 응답한다 (최대 10초).** 응답의 `data.healthCheck` 를 반드시 본다:

```json
{ "success": true, "data": { "server": { "_id": "6ac2…", … }, "healthCheck": { "status": "unhealthy", "errorMessage": "timeout of 10000ms exceeded" } } }
```

| `healthCheck.status` | 뜻 | 할 일 |
|---|---|---|
| `healthy` | 연결됨 | 다음 단계로 |
| `unhealthy` | **저장은 됐지만** 연결 실패 | `errorMessage` 를 보고 주소·키를 고친다 (아래 수정). 다시 만들지 않는다 |

수정은 바꿀 칸만 보낸다. 주소나 설정을 바꾸면 연결을 다시 확인해 같은 형태로 돌려준다:

```bash
vcc -X PUT "$VCC_BASE_URL/api/servers/<serverId>" -d '{ "serverUrl": "http://192.168.0.10:8889" }'
```

`configuration.apiKey` 를 비워 보내면 저장돼 있던 키가 유지된다.

---

## 3. 모델 동기화 — 정확한 모델 ID 얻기

작업판의 기본 모델은 **서버가 알려 준 ID 그대로** 적어야 한다. 짐작하지 말고 동기화해서 읽는다.

```bash
vcc -X POST "$VCC_BASE_URL/api/servers/<serverId>/models/sync" -d '{}'      # 시작 (백그라운드)
vcc "$VCC_BASE_URL/api/servers/<serverId>/models/status"                   # data.status 가 running 이 아닐 때까지
vcc "$VCC_BASE_URL/api/servers/<serverId>/models?detailed=true&limit=200"  # data.models[].filename 이 모델 ID
```

- OpenAI 호환 서버는 `/v1/models`, ComfyUI 는 체크포인트 파일 목록, Gemini 는 모델 목록에서 온다.
- `models` 가 비어 있으면 `cacheInfo.status` 를 본다 — `fetching` 이면 잠시 뒤 다시, 동기화가 끝났는데 비면 서버 쪽 문제다.

---

## 4. 작업판 준비

셋 중 하나다. **이미 있는 판인지 먼저** `GET /api/workboards?outputFormat=<형식>&limit=50` 으로 본다.

### 4-1. 저장소의 완성 작업판 가져오기 (ComfyUI 판 대부분)

`workboards/**/*.json` 은 내보내기 형식이다. 파일 내용을 그대로 `data` 에 넣는다.

```bash
# 미리보기 — 같은 이름의 판이 있으면 무엇이 바뀌는지만 본다
jq -n --slurpfile d workboards/comfyui/minimax-h3-fl2v-turbo.json '{data: $d[0], mode: "update", dryRun: true}' \
  | vcc -X POST "$VCC_BASE_URL/api/workboards/import" -d @-
```

- `mode: "update"` — 같은 이름의 판이 있으면 **제자리 갱신**, 없으면 새로 만든다. `mode: "create"`(기본)는 항상 새로 만든다.
- 위험 변경(필드 삭제 등)이 있으면 409 와 경고 목록이 온다. 내용을 확인하고 `acknowledge: true` 를 붙여 다시 보낸다.
- 서버는 이름·종류가 같은 것으로 자동 매칭된다. 안 되면 응답에 서버 목록이 오니 `serverId` 를 지정해 다시 보낸다.
- 여러 파일을 한 번에: `node scripts/sync-workboards.js --apply workboards/comfyui/*.json` (환경변수 `VCC_BASE_URL`, `VCC_API_KEY`. 기본은 미리보기만).
- 판마다 필요한 모델·커스텀 노드는 `workboards/README.md` 에 있다. 가져오기는 그것을 설치해 주지 않는다.

### 4-2. 새로 만들기 (텍스트 판 등)

입력 칸은 서버가 채워 주지 않는다. **템플릿 파일의 `additionalInputFields` 를 그대로 쓰고 기본값만 채운다.**

```bash
T="frontend/src/templates/OpenAI Compatible-text.json"
jq --arg sid "<serverId>" --arg model "<3단계에서 얻은 모델 ID>" '{
  name: "Local Chat",
  serverId: $sid,
  outputFormat: "text",
  additionalInputFields: (.additionalInputFields | map(if .name == "base_model" then .defaultValue = $model else . end))
}' "$T" | vcc -X POST "$VCC_BASE_URL/api/workboards" -d @-
```

- 텍스트 템플릿(`OpenAI-text`, `OpenAI Compatible-text`, `Gemini-text`)에는 **이미지 칸(`input_images`, 최대 3장)이 들어 있다.** 모델이 이미지 입력(vision)을 지원하면 그대로 둔다.
- 접근 그룹을 안 적으면 기본 그룹이 붙는다.
- 대화형(채팅 화면)으로 쓰려면 `conversation_mode` 의 `defaultValue` 를 `true` 로.

### 4-3. 이미 있는 판 고치기 (서버·기본 모델 바꾸기, 이미지 칸 넣기)

`PUT` 의 `additionalInputFields` 는 **통째로 바뀐다.** 반드시 현재 값을 읽어 고친 뒤 전부 보낸다.

```bash
vcc "$VCC_BASE_URL/api/workboards/<workboardId>" > wb.json        # .workboard 에 현재 값

jq --arg sid "<새 serverId>" --arg model "<새 모델 ID>" '.workboard | {
  serverId: $sid,
  additionalInputFields: (.additionalInputFields | map(if .name == "base_model" then .defaultValue = $model else . end))
}' wb.json | vcc -X PUT "$VCC_BASE_URL/api/workboards/<workboardId>" -d @-
```

- 서버를 바꾸면 그 서버 주소로 따라 바뀐다. 이름도 모델을 담고 있으면 `name` 을 함께 고친다.
- 허용 모델을 제한한 판(`modelExposurePolicy: "whitelist"`)은 `modelWhitelist` 도 새 모델 ID 로 바꾼다. 안 바꾸면 새 모델이 목록에 안 보인다.
- **이미지 칸이 없는 옛 텍스트 판**은 템플릿의 `input_images` 칸을 `additionalInputFields` 끝에 붙여 보낸다.
- 확인: 다시 `GET` 해서 `serverId.name`, `base_model` 의 `defaultValue`, 이미지 칸을 본다.

---

## 5. 동작 확인

준비한 판을 실제로 한 번 돌려 본다. 응답이 성공이어도 서버·모델이 맞는지는 실행해 봐야 안다.

| 판 | 확인 방법 |
|---|---|
| 텍스트 | MCP `generate_text` (이미지 칸이 있으면 `upload_image` 로 올린 그림을 붙여 그림 내용을 묻는다) |
| 이미지·영상·오디오 | MCP `generate` → `get_job_status` → `download_result` |

MCP 없이 REST 로 볼 때 텍스트 판은 `POST /api/jobs/generate-prompt` (응답이 SSE 스트림), 나머지는 `POST /api/jobs/generate`.
**REST 는 작업판 기본값을 채워 주지 않는다** (웹 화면과 MCP `generate_text` 는 채운다). 모델 같은 칸을 직접 넣는다:

```bash
IMG=$(curl -sS -H "X-API-Key: $VCC_API_KEY" -F "image=@check.png" "$VCC_BASE_URL/api/images/upload" | jq -r .image._id)
jq -n --arg w "<workboardId>" --arg i "$IMG" '{workboardId: $w, inputData: {
  userPrompt: "이미지의 도형 색과 숫자를 짧게 답해.", base_model: "<모델 ID>", input_images: [$i] }}' \
  | curl -sSN -H "X-API-Key: $VCC_API_KEY" -H 'Content-Type: application/json' \
      -X POST "$VCC_BASE_URL/api/jobs/generate-prompt" -d @-      # 마지막 event: done 의 result 가 답
```

**확인용으로 만든 대화·작업·업로드는 끝나면 지운다.** (대화·업로드 삭제는 키로 된다. 서버·작업판 삭제는 키로 안 되니 사람에게.)

---

## 6. 막혔을 때

| 증상 | 원인 |
|---|---|
| 401 | 키가 틀렸거나 폐기됨, 또는 `Authorization: Bearer` 로 보냄 (`X-API-Key` 로) |
| 403 `이 키는 MCP 용이라…` | MCP 용 키를 씀 — API 용 키로 |
| 403 `관리자 권한이 필요합니다` | 관리자 계정의 키가 아님 |
| 403 `이 작업은 API 키로 할 수 없습니다` | 삭제·백업 같은 되돌릴 수 없는 작업 — 웹 로그인 상태에서 사람이 |
| 서버 저장 후 `healthCheck.status: unhealthy` | 저장은 됐다. 주소(경로 붙였나)·키·방화벽 확인 후 `PUT` |
| 모델 목록이 빔 | 동기화가 안 끝났거나(`fetching`) 서버가 모델을 안 알려 줌 |
| 텍스트 판 실행이 `작업판에 모델이 선택되지 않았습니다` | REST 로 불렀으면 `inputData.base_model` 을 넣는다 (기본값을 안 채운다). 웹·MCP 에서 났으면 `base_model` 기본값이 비었음 — 4-3 으로 채운다 |
| 이미지를 붙였더니 `…이미지 입력(vision)을 지원하지 않을 수 있습니다` | 모델이 이미지를 받지 않음 — 같은 모델이라도 서버·양자화본에 따라 다르다. 이미지를 받는 모델로 바꾸거나 이미지를 뺀다 |
| 키로 서버 목록·모델 조회가 `401 No token provided` | 이 문서가 생기기 전 버전의 결함 — 최신으로 업데이트한다 |
