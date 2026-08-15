# 에이전트 스킬 연동 — 프롬프트 가이드 vs MCP

모델마다 "좋은 프롬프트를 쓰는 법" 이 따로 있고, 제작사가 그것을 **스킬**로 배포하는 경우가 늘고 있다.
그 지식을 VCC 에 들이는 길은 두 가지이며, **스킬의 구조에 따라 답이 갈린다.**

---

## 0. 3분 요약

| 스킬 형태 | 방법 | 근거 |
|---|---|---|
| 문서 몇 개 (수십 KB) | **프롬프트 가이드**(#766)에 본문을 넣고 작업판에 연결 | 통째로 읽혀도 컨텍스트에 들어간다 |
| 방법론 + 대형 참조 코퍼스 (수 MB) | **MCP 로 외부 에이전트가 처리** | 스킬의 점진적 탐색을 VCC 안에 재현할 수 없다 |
| 워크플로에 전용 LLM 이 내장됨 | **아무것도 안 한다** | 모델이 이미 그 문법을 안다 |

판단 기준은 크기가 아니라 **"스킬이 파일을 찾아 읽는 구조인가"** 다. 찾아 읽는 스킬은
파일시스템이 있는 에이전트 쪽에 두는 편이 자연스럽다.

---

## 1. 프롬프트 가이드로 넣는 경우

스킬이 **읽히기만 하면 되는 문서**일 때.

```
관리자 → 프롬프트 가이드 → 등록 → 작업판 편집기에서 연결
```

연결된 작업판에서 프롬프트를 생성하면 시스템 프롬프트로 자동 합성된다 (`utils/promptComposition`).
가이드는 계정이 아니라 **작업판 단위**라, 그 작업판이 보이는 모든 사용자에게 동일하게 적용된다.

**유의**

- 등록 시 출처 저장소와 commit 을 함께 적어둔다 (`sourceRef` 필드) — 갱신 여부 판단에 필요하다
- 요청마다 시스템 프롬프트로 실려 응답이 느려지고 비용이 든다. 그래서 생성 화면에 적용 표시가 뜬다
- **작업판 내보내기에는 실리지 않는다** (#782) — 다른 인스턴스로 옮기면 가이드는 따라가지 않는다

---

## 2. MCP 로 외부 에이전트가 처리하는 경우

스킬이 **참조 자료를 찾아 읽는 구조**일 때. 예: MiniMax Music 3 의 `music-caption-rewriter` 는
SKILL.md 9KB 에 인덱스 19개와 완성 캡션 템플릿 1000개(5.5MB)가 딸려 있고, 스킬 자체가
*"1000개를 다 훑지 말고 장르로 좁혀 필요한 것만 열어라"* 로 설계돼 있다.

이런 코퍼스는 프롬프트 가이드에 넣을 수 없다. 넣을 필요도 없다 — **스킬이 설치된 에이전트가
캡션을 완성해 MCP 로 넘기면 된다.**

```
외부 에이전트 (스킬 설치됨)
  └ 장르 라우팅 → 인덱스 → 템플릿 선택 → 캡션 완성      ← 파일시스템에서 자연스럽게 동작
      └ MCP generate(prompt=캡션, additionalParams={...})
          └ VCC → ComfyUI → 모델
              └ get_job_status → download_result
```

VCC 는 코퍼스를 가질 필요가 없다. 인스턴스가 가벼워지고, 서드파티 자산의 재배포 문제(#782)도
비켜간다 — 스킬은 에이전트 쪽에 설치된 채로 남는다.

### 실제 호출

```jsonc
// tools/call — generate
{
  "workboardId": "...",              // list_workboards 로 확인
  "prompt": "Global Metadata\n...",  // 스킬이 만든 구조화 캡션
  "aiModel": "minimax\\minimax_music3_dit_fp16.safetensors",
  "randomSeed": true,
  "additionalParams": {              // 작업판의 커스텀 필드
    "base_model": "minimax\\minimax_music3_dit_fp16.safetensors",
    "lyrics": "",                    // 비우면 연주곡
    "max_duration": 60,
    "tiled_decode": false
  }
}
```

`base_model` 처럼 **required 인 커스텀 필드는 `additionalParams` 로 반드시 넘겨야 한다.**
빠뜨리면 어떤 필드가 없는지 알려주는 오류가 돌아온다. `get_workboard` 로 필드 목록을 먼저 확인하면 된다.

결과는 `get_job_status` 의 `resultAudios` / `resultVideos` / `resultImages` 에서 id 를 얻어
`download_result` 로 가져온다. HTTP 모드에서 `VCC_BASE_URL_FOR_MCP` 가 설정돼 있으면 signed URL 이,
아니면 메타데이터가 돌아온다 (오디오·비디오는 인라인으로 싣기엔 크다).

### 같은 방식이 적용되는 사례

| 모델 | 스킬 | 현재 상태 |
|---|---|---|
| MiniMax Music 3 | `music-caption-rewriter` (1000 템플릿) | MCP 경유 — 가이드 미등록 |
| MiniMax H3 | `h3-prompt-writing` (문서 3개) | 가이드 등록됨. **MCP 경유도 가능** |

H3 는 문서가 작아 가이드로도 되지만, 스킬을 이미 갖춘 에이전트라면 MCP 쪽이 더 낫다 —
가이드를 매 요청 시스템 프롬프트로 실어보내는 비용이 사라진다.

---

## 3. 아무것도 안 해도 되는 경우

워크플로 안에 **그 모델 전용으로 조율된 LLM** 이 들어 있는 경우. LTX-2.5 의
`TextGenerateLTX2Prompt` 가 그렇다 — 노드 내부 기본 템플릿(`use_default_template`)이
LTX 문법을 이미 담고 있어, 밖에서 가이드를 밀어넣을 자리가 없고 넣으면 오히려 출력을 흐린다.

판별법: 워크플로에 텍스트 인코더 외에 **LLM 노드가 따로 있는지** 본다.

---

## 4. 앞으로

스킬 설계가 점진적 탐색 전제로 가고 있어, 2번 형태가 늘어날 것으로 본다.
VCC 가 코퍼스를 직접 다루려면 **LLM 툴 콜**(#769)이 전제다 — 그때는 "VCC 가 참조 자료를
검색해 필요한 조각만 LLM 에 건네는" 구조가 가능해진다. 그전까지는 MCP 경유가 답이다.

## 참고

- [MCP_SERVER.md](MCP_SERVER.md) — 세팅
- [MCP_SERVER_API.md](MCP_SERVER_API.md) — 도구 명세
- [COMFYUI_WORKFLOW_AUTHORING.md](COMFYUI_WORKFLOW_AUTHORING.md) — 워크플로를 직접 만들 때
