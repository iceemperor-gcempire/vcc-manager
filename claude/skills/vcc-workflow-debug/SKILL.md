---
name: vcc-workflow-debug
description: ComfyUI 작업판 작업이 실패했을 때 백엔드 로그 + ComfyUI 응답 본문을 분석해 root cause 진단
argument-hint: <jobId> 또는 최근 실패한 작업 (생략 시 last failed)
---

# vcc-workflow-debug 스킬

ComfyUI 작업 실패 (job status=failed) 의 원인을 단계별로 진단. v2.0.4 부터 \`comfyUIService\` 가 ComfyUI 응답 본문을 \`❌ ComfyUI 응답 본문\` 로그로 캡쳐 — 그 로그가 진단의 출발점.

---

## 진단 순서

### 1단계: 작업 ID 확인

\`\`\`
list_jobs(status='failed', limit=5)
\`\`\`

또는 사용자가 jobId 직접 제공 (\`6a04d4140bdcbdccbdd01580\` 같은 24자 ObjectId).

### 2단계: 백엔드 로그 추출

\`\`\`bash
docker compose logs backend 2>&1 | grep -A 80 "{jobId}"
\`\`\`

(production) — \`docker compose -f docker-compose.prod.yml --env-file .env.production logs backend\`

핵심 로그 라인 (시간순):
- \`🎯 Image generation request received\` — 요청 수신
- \`📋 Request body: { ... }\` — 페이로드
- \`🔍 Extracted fields: { ... }\` — workboardId / prompt / aiModel / imageSize 추출
- \`📦 Prepared inputData for job creation\` — queueService 진입 직전
- \`🔄 Injecting inputs into workflow\` — 워크플로우 치환 시작
- \`🔧 Built replacements object: { ... }\` — placeholder → value 매핑
- \`📝 Workflow JSON preview\` — ComfyUI 로 보낼 최종 워크플로우 (앞 200자)
- \`📤 Submitting workflow to ComfyUI\` — 제출
- \`✅ Workflow submitted successfully\` — ComfyUI 가 받음 (validation 실패는 그 후)
- \`❌ ComfyUI 응답 본문: { ... }\` — ComfyUI 의 validation / runtime 에러 본문

### 3단계: 에러 분류

ComfyUI 응답 본문의 \`error.type\` 또는 \`node_errors[].errors[].type\` 으로 분기:

| 에러 타입 | 원인 | 점검 항목 |
|---|---|---|
| \`prompt_outputs_failed_validation\` + \`value_not_in_list\` | 노드의 input value 가 ComfyUI 가 인식 못 함 | \`received_value\` 와 \`list of length N\` — workboard 의 customField options 가 ComfyUI 노드 valid list 와 일치하는지 |
| \`No such file or directory\` | ComfyUI 가 파일 (모델/이미지/LoRA) 못 찾음 | filename 정확한지, path separator (\`\\\` vs \`/\`), 빈 문자열 치환 여부 |
| \`prompt_outputs_failed_validation\` + \`Required input is missing\` | 노드 input 비어있음 | workflow placeholder 가 치환 안 됐는지 (customField formatString 누락 / 매핑 불일치) |
| \`Module 'X' not found\` | ComfyUI 측 노드 미설치 | ComfyUI 서버에 해당 custom node 추가 필요 |

### 4단계: placeholder 치환 추적

\`🔧 Built replacements object\` 에 모든 placeholder → value 가 보임.
빈 문자열 (\`\"value\": \"\"\`) 인 placeholder 는 source 누락:
- built-in placeholder (\`{{##base_model##}}\` 등) — \`Extracted fields\` 의 해당 값 검사
- customField placeholder (\`{{##<field_name>##}}\`) — workboard 의 customField 정의 + 사용자 입력값 검사

\`📝 Workflow JSON preview\` 에 미치환된 \`{{##...##}}\` 가 보이면 — workflow 에는 있는데 replacements 에 없는 placeholder. customField 정의 누락이거나 built-in 에 없는 placeholder 사용.

### 5단계: customField 정의 검사

\`\`\`
get_workboard({workboardId})
\`\`\`

응답의 \`additionalFields[]\` 확인:
- \`name\` — placeholder 이름 (\`{{##\${name}##}}\` 로 기본 변환)
- \`formatString\` — 커스텀 placeholder (정의되어 있으면 우선)
- \`type\` — string / number / select / image / baseModel / lora
- \`options\` (select 타입) — 사용자가 선택 가능한 값들. ComfyUI 노드의 valid list 와 일치해야 함
- \`defaultValue\` — 미선택 시 기본값

### 6단계: 사용자 페이로드 검사

\`📋 Request body\` 의 \`additionalParams\` 안에 사용자가 선택한 값들이 들어있는지 확인.

빈 string / undefined 면:
- 사용자가 미입력 → defaultValue 가 없거나 form initialization 실패
- 프론트 페이지 reload / 페이로드 직렬화 문제

### 7단계: 결론 및 fix 제안

원인에 따라:
- workboard 설정 문제 → admin 페이지에서 customField options / formatString 수정
- workflow JSON 문제 → admin 페이지의 workflow 탭에서 JSON 수정
- ComfyUI 서버 문제 (모델 파일 없음, custom node 미설치) → ComfyUI 측 처리

---

## 자주 발생하는 케이스 (이 프로젝트)

### A. 베이스 모델 백슬래시 경로
\`received_value\` 가 \`IXL\\nova.safetensors\` 같은 Windows-style 경로. ComfyUI 가 reject 하면 path normalization 필요. v2.0.3 에서 fix 된 double-escape 회귀와는 다른 이슈 — ComfyUI 자체의 path 인식.

### B. image_size 가 ComfyUI 노드 valid list 와 불일치
\`CM_SDXLExtendedResolution\` 같은 노드는 40개 specific 해상도만 허용. customField options 의 \`value\` 가 그 list 와 정확히 매칭돼야 함.

### C. customField name 이 비표준 (예: \`base_model\` vs \`aiModel\`)
v2.0.2 이전: hardcoded \`{{##model##}}\` placeholder 만 지원. v2.1.0+ 부터 \`{{##base_model##}}\` 단일화. 기존 workflowData 가 \`{{##model##}}\` 사용 중이면 admin 수정 필요.

### D. 이미지 customField 가 비어있음
"No uploaded image found for field 'X'" 로그 → \`uploadImageFieldsToComfyUI\` 가 그 필드의 이미지 못 찾음. 사용자가 이미지 첨부 안 했고 customField 가 type=image — v1.8.4 부터 빈 image 필드에 1024x1024 흰색 PNG 자동 주입 (sharp 동적 생성).

---

## 사용자 요청

$ARGUMENTS
