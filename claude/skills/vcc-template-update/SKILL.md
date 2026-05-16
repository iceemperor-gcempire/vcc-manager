---
name: vcc-template-update
description: vcc-manager 의 작업판 템플릿 (serverType-outputFormat JSON 5종) 을 일괄 갱신할 때의 점검 / 작성 절차
argument-hint: <변경 사항 요약>
---

# vcc-template-update 스킬

\`frontend/src/templates/*.json\` 5종 (ComfyUI-image, ComfyUI-video, Gemini-image, Gemini-text, OpenAI-image, OpenAI-text, OpenAI Compatible-text) 를 갱신할 때 일관성 / placeholder / customField 컨벤션 점검.

신규 작업판 admin 이 \"새 작업판\" 생성 시 \`getWorkboardTemplate(serverType, outputFormat)\` 으로 채워지는 기본값.

---

## 템플릿 구조

각 JSON 파일:

\`\`\`json
{
  \"baseInputFields\": {},
  \"additionalInputFields\": [
    {
      \"name\": \"base_model\",
      \"label\": \"베이스 모델\",
      \"type\": \"baseModel\",
      \"required\": true,
      \"formatString\": \"{{##base_model##}}\",
      \"description\": \"...\"
    },
    { \"name\": \"image_size\", \"label\": \"이미지 크기\", \"type\": \"select\", \"options\": [...] },
    ...
  ],
  \"workflowData\": \"...JSON 문자열 또는 빈 string\"
}
\`\`\`

---

## 컨벤션 (v2.1+)

1. **\`baseInputFields\` 는 항상 빈 객체** — v2.0 F4 에서 schema drop 됨. customField 단일 경로
2. **customField name 은 snake_case** — \`base_model\` / \`image_size\` / \`reference_image_method\` / \`system_prompt\` / \`max_tokens\` 등
3. **type=baseModel** 은 베이스 모델 select. options 정의 안 함 — 서버의 모델 목록 + 작업판 노출 정책 활용
4. **type=lora** 도 동일 — 서버의 LoRA 목록
5. **type=select** options 의 value 는 ComfyUI 노드 또는 provider API 의 valid value 와 정확히 매칭
6. **formatString 명시** — workflow placeholder 와 1:1 일치. 생략 시 \`{{##\${name}##}}\` 자동 사용
7. **ComfyUI 템플릿의 workflowData** — placeholder 는 snake_case (\`{{##prompt##}}\` / \`{{##base_model##}}\` 등)
8. **Gemini/OpenAI 텍스트 / 이미지 템플릿의 workflowData** — 빈 string. ComfyUI 만 workflow JSON 사용
9. **defaultValue** — 사용자가 미선택 시 사용. select 의 경우 options[0].value 자동 fallback. number 는 명시 권장

---

## 갱신 절차

### 1단계: 영향 분석

변경의 종류 식별:
- A. **placeholder 이름 변경** (예: \`{{##model##}}\` → \`{{##base_model##}}\`)
  - 5개 템플릿의 \`workflowData\` + \`formatString\` 양쪽 갱신
  - backend \`src/constants/workflowVariables.js\` + \`src/services/queueService.js\` 의 replacements 갱신
  - frontend \`frontend/src/constants/workflowVariables.js\` mirror 갱신
  - legacy alias 유지 여부 결정 (#310 같은 점진적 제거)
- B. **customField name 변경** (예: \`aiModel\` → \`base_model\`)
  - 신규 템플릿만 영향. 기존 작업판은 admin 이 별도 수정 필요
- C. **options 추가/제거**
  - 신규 작업판만 영향. ComfyUI 노드의 valid list 와 매칭 점검
- D. **새 type 추가** (예: \`baseModel\` / \`lora\` 같은 v2.0 D 의 type 추가)
  - schema enum (\`src/models/Workboard.js\`) 갱신
  - frontend WorkboardManagement.js 의 type dropdown 갱신
  - 사용자 페이지 렌더링 분기 (MetadataFieldInput 등) 갱신

### 2단계: 5개 템플릿 일괄 점검

체크리스트 — 각 파일에 대해:

| 항목 | 확인 |
|---|---|
| \`baseInputFields\` | \`{}\` 빈 객체 |
| \`additionalInputFields[].name\` | snake_case |
| \`additionalInputFields[].formatString\` | workflow placeholder 와 매칭 |
| \`baseModel\` 필드 1개 | type=baseModel (ComfyUI / Gemini / OpenAI 모두) |
| \`image_size\` (이미지 type) / \`temperature\` 등 (텍스트 type) | 적절히 정의 |
| ComfyUI 템플릿: \`workflowData\` | placeholder 가 위 \`formatString\` 들과 매칭 |
| Gemini / OpenAI 템플릿: \`workflowData\` | 빈 string \`\"\"\` |

### 3단계: 빌드 + 동작 확인

\`\`\`bash
DOCKER_BUILDKIT=1 docker compose build --no-cache frontend
\`\`\`

CRA build 가 JSON parse 실패하면 (잘못된 JSON) 에러로 끊음. 통과 확인.

신규 작업판 생성 테스트:
1. admin → 작업판 관리 → 새 작업판 (해당 serverType-outputFormat 조합)
2. \"입력 양식\" 탭에 정의한 customField 들 표시 확인
3. 사용자 페이지 → 작업 실행 → 정상 동작 확인

### 4단계: 기존 작업판 영향 안내

기존 작업판은 자동 갱신되지 않음. updatelog 에 admin 이 수동으로 해야 하는 작업 명시:
- 어떤 placeholder 가 deprecated 되었는지
- 어떤 customField 이름을 바꿔야 하는지
- formatString 변경 권장 사항

---

## 자주 발생하는 회귀

1. **JSON syntax 오류** — JSON.parse 실패 → fallback path 사용 → 의도와 다른 string 치환 가능
2. **placeholder 와 formatString 불일치** — workflow 에 \`{{##model##}}\` 인데 customField formatString 은 \`{{##base_model##}}\` → 치환 안 됨 → 빈 값으로 ComfyUI 가 reject
3. **camelCase / snake_case 혼재** — v2.1+ 에서 snake_case 단일화 결정. 신규 추가 시 snake_case 만
4. **type=baseModel / lora 에 options 정의** — 불필요. 서버 목록을 자동으로 사용. options 추가하면 무시되지만 혼동 유발

---

## 사용자 요청

$ARGUMENTS
