# 텍스트 작업판 — 싱글턴 / 멀티턴 UI 디자인 핸드오프

> 대상: 텍스트(LLM) 작업판의 **실행(실 사용) 화면** 재디자인.
> 목적: 디자이너가 현재 구조·상태·동작을 정확히 이해하고 새 디자인을 만들 수 있게 함.
> 이 문서는 **현재(as-is) 사양 + 반드시 보존할 동작 + 자유롭게 바꿔도 되는 영역**을 구분해 기술한다.

---

## 0. 한눈에 보기

텍스트 작업판을 "실행"하면 한 화면(`/prompt-generate/:workboardId`)에서 **3가지 모드** 중 하나가 렌더된다. 모드는 작업판 설정과 진입 경로로 자동 결정되며, 사용자가 토글하지 않는다.

| 모드 | 컴포넌트 | 언제 | 성격 |
| --- | --- | --- | --- |
| **A. 싱글턴 (프롬프트 생성)** | `PromptGeneratorPanel` | 작업판의 `conversation_mode`=false (기본) | 입력 1회 → 결과 1개. 좌(입력)/우(결과) 2단 |
| **B. 멀티턴 (대화 모드)** | `WorkboardChatPanel` | 작업판의 `conversation_mode`=true | 채팅. 매번 새 대화로 시작 |
| **C. 대화 이어가기** | `ConversationChatPanel` | URL 에 `?conversationId=...` (히스토리/다른작업 진입) | 기존 대화를 불러와 이어서 대화 |

- `conversation_mode` 는 **관리자 전용 설정**으로, 사용자 입력 폼에는 노출되지 않는다.
- 세 모드 모두 **응답 스트리밍**(토큰 단위 실시간 출력)을 사용한다. → §6 필수 동작 참고.

---

## 1. 공통 페이지 골격 (3모드 공유)

`PromptGeneration` 페이지 상단 공통 영역(컨테이너 `maxWidth=lg`):

1. **뒤로가기 버튼** — 텍스트는 진입 경로에 따라 "작업판 선택"(목록) 또는 "히스토리로"(이어가기 진입 시).
2. **타이틀 행** — 채팅 아이콘 + 작업판 이름(h5) + 상태 칩("프롬프트 생성" / "대화 이어가기").
3. **작업판 ID** — monospace caption + 복사 아이콘(작은 버튼).
4. **설명 Alert**(info) — 작업판 description 이 있고 이어가기가 아닐 때만.
5. **프로젝트 컨텍스트 / 세계관 토글**(`ProjectContextSelector`) — 이어가기(conversationId)일 땐 숨김(이미 첫 턴에 주입됨).
6. 그 아래 모드별 패널(A/B/C).

> 디자인 자유도: 이 상단 메타 영역(ID 표기·설명·뒤로가기 배치)은 정리 대상이 될 수 있음. 단 "작업판 이름 + 모드 표시"는 유지 권장.

---

## 2. 모드 A — 싱글턴 (PromptGeneratorPanel)

### 레이아웃
데스크탑에서 **2단 그리드** (md: 좌 6 / 우 6, 모바일은 1단 세로).

**좌측 — 입력 폼 (Paper)**
- 작업판의 customField 들을 순서대로 렌더(단, `conversation_mode` 는 숨김):
  - `baseModel` 타입 → **베이스 모델 선택기**(`MetadataFieldInput`): 읽기전용 TextField + "선택" 버튼 → 모달에서 모델 고름. 표시는 모델명(없으면 파일명), 전체 경로는 tooltip.
  - `string` → TextField(이름에 'prompt' 포함 시 multiline).
  - `select` → 드롭다운.
  - `lora` → LoRA 선택기(베이스 모델과 동일 UX).
  - `number`/`boolean` → 해당 입력.
- 맨 아래 **사용자 프롬프트** TextField(multiline, rows 5, 필수).
- **생성 버튼**(전체폭, secondary). 생성 중엔 라벨 "생성 중..." + 스피너 + 비활성.

**우측 — 결과 (Paper, minHeight 400)**
- 헤더 "생성된 프롬프트" + (결과 있을 때) 복사 아이콘.
- 상태별 표시:
  - **대기**: 중앙 placeholder(채팅 아이콘 + "프롬프트를 입력하고 생성 버튼을 눌러주세요").
  - **생성 시작~첫 토큰 전**: LinearProgress + "AI가 프롬프트를 생성하고 있습니다...".
  - **스트리밍 중**: 결과 박스에 토큰이 실시간으로 쌓임(monospace, grey.50 배경) + 끝에 깜빡이는 커서(▍).
  - **완료**: 결과 텍스트 + 하단에 토큰 사용량 caption("토큰: 입력 N / 출력 M").
  - **에러**: toast 로 알림(인라인 영역은 placeholder 로 복귀).

### 인터랙션
- 베이스 모델 등 customField 의 **기본값(defaultValue)이 자동으로 채워진다**(작업판 로드 시).
- 복사 버튼 → 결과를 클립보드로(`copyToClipboard` 유틸, HTTP 환경 fallback 포함).

---

## 3. 모드 B — 멀티턴 (WorkboardChatPanel)

채팅 UI. 매 진입 시 새 대화로 시작하고, 첫 메시지를 보내면 대화가 생성된다.

### 구성 (위→아래, 단일 Paper)
1. **헤더 칩 행**: "대화 모드" 칩 + (대화 시작 후) 모델 칩 · 서버타입 칩 · "누적 $0.00xxxx" 비용 칩 + 우측에 "시작: 날짜시간".
2. **설정 패널**(collapsible Paper) — 작업판 customField(베이스 모델/시스템 프롬프트 등)를 편집. 
   - **첫 메시지 전송 전까지만 편집 가능**. 전송 후 **잠금**(자물쇠 아이콘 + "대화가 시작되어 설정은 더 이상 변경할 수 없습니다" 안내) 및 접힘.
   - 헤더 클릭으로 펼침/접힘.
3. **대화 transcript**(스크롤 영역, 현재 grey.50 배경, min 200 / max 500 높이):
   - 메시지 없을 때: "아래 입력창에 메시지를 입력해 대화를 시작하세요" placeholder.
   - 메시지 행: **역할 아이콘**(user=사람/assistant=로봇/system=설정 아이콘) + 역할 라벨(대문자 caption) + 본문(pre-wrap). 구분선으로 행 분리.
   - **assistant 메시지에는 "북마크" 액션** → 그 응답을 "생성된 텍스트 컨텐츠"로 저장.
   - 전송 직후: **낙관적 사용자 말풍선** + **실시간 어시스턴트 말풍선**(토큰 스트리밍 + 커서, 토큰 오기 전엔 작은 스피너).
   - 대화 status=failed 시 하단 에러 Alert.
4. **입력 폼**: 
   - 메시지 TextField(multiline rows 2) + **전송 버튼**(우측, 입력창 높이에 맞춤, secondary).
   - 폼 아래 "⌘/Ctrl + Enter 로 전송" caption.
   - 생성 중엔 입력/전송 비활성 + 전송 버튼 스피너.

> 참고: 현재 전송 버튼은 입력창과 상단 정렬 + 높이 맞춤 + 간격 10px 로 최근 조정됨. 새 디자인에서 입력바를 다시 설계할 수 있음.

---

## 4. 모드 C — 대화 이어가기 (ConversationChatPanel)

모드 B와 거의 동일한 채팅 UI지만:
- **기존 대화를 불러와** 과거 메시지를 모두 상단에 표시(정적), 하단 입력창으로 다음 턴을 이어감.
- **설정 패널 없음**(설정은 첫 턴에 고정됨).
- 헤더 칩: "대화 이어가기" + 모델 · 서버타입 · 누적 비용 + 시작 시각.
- 같은 입력 폼 / 스트리밍 / 북마크 저장 동작.
- 대화가 다른 곳에서 status=processing 인 채면 "생성 중" 안내 Alert.

---

## 5. 데이터 / 표시 요소 정리 (모드 공통)

- **메시지**: role(user/assistant/system) + content(텍스트, 멀티라인). system 메시지는 작업판 시스템 프롬프트/세계관에서 유래(사용자가 직접 작성하지 않음).
- **모델 / 서버타입**: 대화에 고정 저장(작업판 변경과 무관하게 일관).
- **토큰 사용량**: 입력/출력/합계. 멀티턴은 누적.
- **비용 추정**: 통화 + 금액(소수 6자리). 로컬 모델 등은 비용 정보가 없을 수 있음(빈 값) → "표시 안 함"으로 graceful.
- **타임스탬프**: 대화 시작 시각.
- **상태**: processing / completed / failed.

---

## 6. 반드시 보존해야 할 동작 (디자인이 바뀌어도 유지)

1. **응답 스트리밍**: 첫 토큰을 즉시 받아 글자 단위로 출력. (느린 로컬 LLM + 앞단 프록시 타임아웃 회피의 핵심 — 빈 화면으로 오래 두면 안 됨. "생성 중" 또는 토큰 출력이 계속 보여야 함.)
2. **생성 도중 이탈해도 결과 저장**: 사용자가 화면을 떠나도 백엔드가 끝까지 받아 대화에 저장. → 다시 보기/이어가기로 결과 확인 가능. (UI는 이를 방해하지 않아야 함.)
3. **⌘/Ctrl + Enter 전송**(키보드 단축키) 유지.
4. **생성 중 입력 잠금**(중복 전송 방지).
5. **멀티턴 설정 잠금**: 첫 메시지 후 모델/시스템 프롬프트 등 설정 변경 불가(대화 일관성).
6. **assistant 응답 저장**: 응답을 "생성된 텍스트 컨텐츠"로 저장하는 액션 유지.
7. **베이스 모델 등 customField 기본값 자동 적용**.
8. **프로젝트 컨텍스트/세계관 토글**(싱글턴·멀티턴 신규 진입 시) 유지.
9. **싱글턴/멀티턴/이어가기 3모드 모두 동작**(모드 전환은 자동 — 디자인이 모드를 강제로 합치거나 토글로 바꾸려면 별도 합의 필요).

---

## 7. 자유롭게 바꿔도 되는 영역 (디자인 재량)

- 전체 레이아웃·여백·타이포·색·말풍선 스타일(현재는 역할 아이콘 + 대문자 라벨 + 구분선의 기본형).
- 싱글턴의 2단 구성(입력/결과)을 다른 형태로.
- 헤더 메타(작업판 ID/설명/칩) 정리·재배치.
- 설정 패널 형태(collapsible Paper → 다른 패턴).
- 입력바·전송 버튼·스트리밍 표시(커서/스피너) 비주얼.
- 빈 상태 placeholder, 로딩 표현.

---

## 8. 디자인 토큰 / 현재 스타일 참고

- **spacing 단위 = 4px** (theme.spacing: 4). 즉 spacing 1 = 4px. (mockup px 값을 sx 로 옮길 때 px/4.)
- **기본 borderRadius = 6** (Button/Input 공통), **Chip = pill(999)**.
- 입력 필드 기본 **size=small**, 입력 fontSize 13.
- 채팅/텍스트 액션 강조색 = **secondary**.
- transcript 배경 현재 = grey.50.
- 전체 디자인 토큰은 같은 폴더의 `TOKENS.md` / 기존 핸드오프(`design_handoff_vcc_manager`, `vcc-manager-6.zip`) 참고.

---

## 9. 현재 거슬리는 점(개선 힌트, 강제 아님)

- 말풍선이 좌측 아이콘 + 대문자 role 라벨 + 구분선의 다소 투박한 형태 → 일반 채팅앱 같은 말풍선(좌/우 정렬, 발화자 구분) 검토 여지.
- 싱글턴의 좌/우 2단이 좁은 화면에서 결과가 아래로 길게 밀림.
- 설정 패널(멀티턴)과 헤더 칩이 정보 과밀하게 보일 수 있음.
- 스트리밍 중 커서(▍)/스피너 표현이 임시적.

---

## 10. 참고 파일 (구현 위치)

- 라우팅/모드 선택: `frontend/src/pages/PromptGeneration.js`
- 싱글턴: `frontend/src/components/PromptGeneratorPanel.js`
- 멀티턴: `frontend/src/components/common/WorkboardChatPanel.js`
- 이어가기: `frontend/src/components/common/ConversationChatPanel.js`
- 모델/LoRA 선택기: `frontend/src/components/common/MetadataFieldInput.js`, `MetadataPickerModal.js`
- 스트리밍: `frontend/src/services/streamChat.js`, `frontend/src/hooks/useStreamingPrompt.js`
- 프로젝트 컨텍스트 토글: `frontend/src/components/common/ProjectContextSelector.js`
