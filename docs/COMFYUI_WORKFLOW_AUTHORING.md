# ComfyUI 워크플로 작성 가이드

VCC 작업판의 `workflowData` 에 넣을 워크플로 JSON 을 **작성하는 사람(또는 AI)** 을 위한 문서다.

> VCC 가 내부적으로 어떻게 치환·제출하는지는 [COMFYUI_WORKFLOW.md](COMFYUI_WORKFLOW.md) 를 본다.
> 이 문서는 "무엇을 만들어 넣어야 하는가" 만 다룬다.

---

## 0. 3분 요약

1. ComfyUI **API 포맷** JSON 을 만든다 (UI 포맷 아님)
2. 사용자 입력이 들어갈 자리에 `"{{##이름##}}"` 을 **따옴표로 감싸** 넣는다
3. 작업판에 같은 이름의 필드를 정의한다
4. optional 입력을 요청마다 켜고 끄려면 `_vcc.omitInputsUnless`, 체인 중간 노드를 켜고 끄려면 `_vcc.bypassUnless` 를 쓴다
5. ComfyUI `/prompt` 에 직접 제출해 검증한다 (**제출하면 실제로 생성된다**)

---

## 1. 형식

### 1.1 API 포맷이어야 한다

```json
{
  "6": {
    "inputs": { "unet_name": "model.safetensors", "weight_dtype": "default" },
    "class_type": "UNETLoader",
    "_meta": { "title": "모델 로드" }
  },
  "9": {
    "inputs": { "samples": ["6", 0], "vae": ["11", 0] },
    "class_type": "VAEDecode"
  }
}
```

- 최상위는 **노드 ID → 노드** 맵. 배열이 아니다
- 연결은 `["출처노드ID", 출력슬롯번호]`
- `_meta.title` 은 선택. ComfyUI 는 무시하고 사람이 읽는 용도다

ComfyUI 웹 UI 에서 저장한 JSON(`nodes` / `links` / `groups` / `definitions` 키를 가진 것)은 **UI 포맷**이라 그대로 쓸 수 없다. UI 에서 *Export (API)* 로 받거나 아래 방법으로 변환한다.

### 1.2 서브그래프는 펼쳐야 한다

공식 템플릿은 서브그래프를 쓰는 경우가 많다. UI 포맷에서 `class_type` 자리에 UUID(`4c314f31-ecda-...`)가 보이면 서브그래프다.

- `definitions.subgraphs[].nodes` 에 내부 노드가, `.links` 에 내부 연결이 있다
- 서브그래프 입력은 내부에서 `#-10[슬롯번호]` 형태로 참조된다
- API 포맷으로 내보내면 `"267:242"` 같은 `부모:자식` ID 로 펼쳐진다

가장 확실한 방법은 **ComfyUI UI 에서 템플릿을 연 뒤 API 포맷으로 export** 하는 것이다. 수작업 변환은 연결을 놓치기 쉽다.

### 1.3 autogrow 입력은 점 표기 키

일부 노드는 슬롯이 동적으로 늘어난다 (`COMFY_AUTOGROW_V3`). API 포맷에서는 평범한 키다.

```json
"inputs": {
  "ref_images.ref_image_0": ["137", 0],
  "ref_images.ref_image_1": ["139", 0],
  "ref_videos.ref_video_0": ["161", 0]
}
```

**점은 경로 구분자가 아니라 키 이름의 일부다.** 중첩 객체로 만들면 안 된다.

---

## 2. 플레이스홀더

### 2.1 반드시 따옴표로 감싼다

```json
"width": "{{##width##}}"      ← 권장
"width": {{##width##}}        ← 비권장
```

따옴표가 있으면 JSON 으로 파싱된 뒤 값이 **타입까지 맞춰** 치환된다(숫자는 숫자로).
따옴표가 없으면 JSON 파싱이 실패해 문자열 치환 fallback 으로 빠지고, **`_vcc` 지시자가 동작하지 않는다.**

### 2.2 내장 플레이스홀더

작업판 필드를 만들지 않아도 항상 제공된다.

| 플레이스홀더 | 타입 | 출처 |
|---|---|---|
| `{{##prompt##}}` | string | 프롬프트 입력 |
| `{{##negative_prompt##}}` | string | 부정 프롬프트 입력 |
| `{{##base_model##}}` | string | 모델 필드 값 (파일명 / 모델 ID) |
| `{{##width##}}` `{{##height##}}` | number | `image_size` 의 `"WxH"` 에서 자동 분해 |
| `{{##seed##}}` | number | 시드 (무작위 또는 지정) |
| `{{##user_id##}}` | string | 사용자 ID 해시 8자리 |

`{{##user_id##}}` 는 저장 경로에 넣어 사용자별로 분리한다.

```json
"filename_prefix": "{{##user_id##}}/video/MyWorkboard"
```

### 2.3 커스텀 필드 플레이스홀더

작업판에 정의한 필드는 **이름이 곧 플레이스홀더**다. `steps` 필드 → `{{##steps##}}`.

image / video / audio 타입은 하나가 더 붙는다.

| | 값 |
|---|---|
| `{{##필드명##}}` | ComfyUI 에 업로드된 파일명 |
| `{{##필드명_attached##}}` | `1` / `0` — 사용자가 **실제로** 첨부했는지 |

image 필드는 미첨부여도 흰 PNG 가 자동 주입되어 `{{##필드명##}}` 이 비지 않는다.
video / audio 는 대체 주입이 없어 미첨부 시 빈 문자열이 된다 — `_vcc.omitInputsUnless` 로 입력을 걷어내야 한다.
"진짜 첨부했는지" 는 `_attached` 로만 알 수 있다.

---

## 3. 조건부 입력 생략 — `_vcc.omitInputsUnless`

### 3.1 언제 필요한가

ComfyUI 의 optional 입력은 **키가 없는 것**이 곧 미사용이다. 그런데 워크플로 JSON 은 고정이라 요청마다 키를 빼고 넣을 수 없다.

이게 문제가 되는 전형적인 경우:

- 참조 이미지를 **1장만 넣을 때도, 3장 넣을 때도** 있다
- 시작 프레임을 넣으면 I2V, 안 넣으면 T2V 로 동작해야 한다

흰 PNG 자동 주입은 대안이 못 된다. 모델이 **흰 이미지를 실제 입력으로 인식**하기 때문이다. 투명 PNG 도 알파 처리가 모델마다 달라 위험하다. 전 슬롯 필수화는 "1장만 필요한 요청" 을 막는다.

### 3.2 사용법

```json
"136": {
  "class_type": "MiniMaxH3ReferenceToVideo",
  "inputs": {
    "ref_images.ref_image_0": ["151", 0],
    "ref_images.ref_image_1": ["152", 0]
  },
  "_vcc": {
    "omitInputsUnless": {
      "ref_images.ref_image_0": "{{##ref_image_1_attached##}}",
      "ref_images.ref_image_1": "{{##ref_image_2_attached##}}"
    }
  }
}
```

- 치환 결과가 falsy 면 그 **입력 키를 제거**한다
- falsy: `0` `"0"` `""` `false` `null` `"false"` `NaN`
- `_vcc` 는 조건 유무와 무관하게 **항상 제거**되어 ComfyUI 로 가지 않는다
- 조건은 아무 플레이스홀더나 쓸 수 있다. `_attached` 전용이 아니다

### 3.3 노드는 지우지 않아도 된다

입력 키가 사라지면 상류 `LoadImage` 는 고아가 된다. **ComfyUI 는 출력 노드에서 도달할 수 없는 노드를 검증도 실행도 하지 않는다.** 존재하지 않는 파일을 가리켜도 무해하다.

즉 노드를 지우는 로직이 필요 없고, 미첨부 슬롯의 업로드 비용도 발생하지 않는다.

### 3.4 주의

**필수(required) 입력에는 쓰지 말 것.** 지우면 ComfyUI 가 제출을 거부한다.
노드의 required / optional 은 `/object_info` 로 확인한다.

**체인 중간 노드를 끄는 용도로도 쓰지 말 것.** 그건 생략이 아니라 우회다 → 3.5 참고.

### 3.5 조건부 노드 우회 — `_vcc.bypassUnless`

가속 패치처럼 **모델 체인 중간에 끼는 노드**는 생략으로 끌 수 없다. 소비자의 필수 입력이
사라져 오류가 난다. 이럴 때는 노드를 빼고 상류로 재연결한다 — ComfyUI 에디터의 ctrl+B 와 같다.

```json
"200": {
  "class_type": "SolAttnPatch",
  "inputs": { "model": ["6", 0], "tau": 1.3, "int8_qk": true },
  "_vcc": {
    "bypassUnless": {
      "condition": "{{##use_sol_attn##}}",
      "passthrough": { "0": "model" }
    }
  }
}
```

- `condition` falsy → 노드를 제거하고, `["200",0]` 을 보던 참조를 전부 `["6",0]` 으로 바꾼다
- `passthrough` 는 **출력 인덱스 → 통과시킬 입력 이름**. 다중 출력 노드는 인덱스별로 적는다
- 여러 노드를 동시에 우회하면 최상류까지 연쇄적으로 직결된다 (A → B → C 에서 B·C 를 끄면 A 직결)
- `passthrough` 가 가리키는 입력이 링크가 아니면(리터럴이면) **우회하지 않고 노드를 남긴다** —
  일부만 재연결하면 워크플로가 깨지므로, 안전한 실패는 "가속을 못 끔" 쪽이다

조건은 `boolean` 타입 필드를 쓰면 자연스럽다. 기본값을 꺼짐으로 두면 옵션을 모르는 사용자는
지금까지와 똑같이 동작한다.

---

## 4. 작업판 필드 정의

### 4.1 타입

| type | 치환 결과 | 비고 |
|---|---|---|
| `string` | 문자열 | |
| `number` | 숫자 | |
| `boolean` | 불리언 | |
| `file` | 업로드된 파일명 | 범용 파일 |
| `select` | 선택한 `value` | 아래 4.2 주의 |
| `image` | 업로드된 파일명 | `_attached` 자동 제공 |
| `video` | 업로드된 파일명 | `_attached` 자동 제공. `VHS_LoadVideo` 등에서 소비 |
| `audio` | 업로드된 파일명 | `_attached` 자동 제공. `LoadAudio` 등에서 소비 (#772) |
| `baseModel` | 모델 파일명 / ID | 서버 모델 목록에서 선택 |
| `lora` | LoRA 파일명 | |

### 4.2 select 옵션 키는 `options` 다

```json
{
  "name": "length",
  "label": "길이",
  "type": "select",
  "required": true,
  "defaultValue": "124",
  "options": [
    { "key": "3초 (73프레임)", "value": "73" },
    { "key": "5초 (124프레임)", "value": "124" }
  ]
}
```

- `key` = 사용자에게 보이는 라벨, `value` = 워크플로에 들어갈 값
- **`selectOptions` 로 쓰면 스키마가 조용히 버린다.** 옵션이 빈 셀렉트가 되고 원인을 찾기 어렵다
- `defaultValue` 는 옵션의 **`value`** 와 문자열로 일치해야 한다

### 4.3 모델처럼 고정된 값은 필드로 만들지 않는다

텍스트 인코더나 VAE 처럼 그 모델에 종속돼 바뀔 일이 없는 값은 워크플로에 하드코딩한다. 필드로 노출하면 사용자가 잘못 고를 여지만 생긴다.

---

## 5. 검증

### 5.1 노드 시그니처와 모델 목록

```bash
# 노드 전체
curl -s http://<comfyui>/object_info | jq 'keys | length'

# 특정 노드의 입력/출력
curl -s http://<comfyui>/object_info/LoadImage | jq

# 특정 입력의 선택지 (모델 파일 목록 등)
curl -s http://<comfyui>/object_info/VAELoader | jq '.VAELoader.input.required.vae_name[0]'
```

입력 정의에서 `shape: 7` 은 optional 이라는 뜻이다.

### 5.2 제출

```bash
curl -X POST http://<comfyui>/prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": <워크플로 JSON>, "client_id": "test"}'
```

- 성공하면 `{"prompt_id": "..."}`
- 실패하면 `node_errors` 에 노드별 사유가 담긴다

> **`/prompt` 는 검증 전용 모드가 없다.** 제출하면 검증과 동시에 큐에 들어가 실제로 생성이 시작된다. GPU 를 쓰는 무거운 워크플로라면 감안할 것.

### 5.3 결과 확인

```bash
curl -s http://<comfyui>/history/<prompt_id> | jq
```

`status.status_str`, `status.messages` 의 `execution_error`, `outputs` 를 본다.

---

## 6. 자주 겪는 실패

| 증상 | 원인 |
|---|---|
| `value_not_in_list` | 미치환 플레이스홀더가 남았거나, 모델 파일명이 서버 목록과 다름 |
| 모델명 불일치 | Windows 경로 백슬래시. JSON 에서 `"minimax\\model.safetensors"` (파싱 후 `\` 1개) |
| `Server URL: undefined` | 작업판을 API 가 아닌 DB 로 직접 만들어 `serverUrl` 이 빠짐. 생성 라우트는 `server.serverUrl` 을 채워준다 |
| 셀렉트가 비어 보임 | 옵션을 `selectOptions` 로 넣음 → `options` 로 |
| `_vcc` 가 무시됨 | 플레이스홀더를 따옴표 없이 써서 문자열 치환 fallback 을 탐 |
| 필수 입력 누락 | `_vcc` 로 required 입력을 지움 |
| 입력이 반영 안 됨 | 워크플로에 해당 플레이스홀더가 없음 (필드만 만들면 아무 일도 안 일어난다) |

---

## 7. 예제 — MiniMax H3

세 모드가 **같은 뼈대**에서 갈라진다. 새 모델을 붙일 때도 이 패턴이 대체로 통한다.

### 7.1 공통 뼈대 (T2V)

```
UNETLoader ─┬→ BasicScheduler ──────→ sigmas ┐
            └→ BasicGuider ← conditioning     │
CLIPLoader ──→ MiniMaxH3ImageToVideo ─────────┤
VAELoader(video) ┘        └→ LATENT ──────────┤
RandomNoise ──────────────────────────────────┤
KSamplerSelect ───────────────────────────────┴→ SamplerCustomAdvanced
                                                     ├→ VAEDecode(video VAE) → images ┐
                                                     └→ VAEDecodeAudio(audio VAE) → audio ┤
                                                                       CreateVideo(24fps) ←┘
                                                                            └→ SaveVideo
```

T2V 는 조건화 노드의 `first_frame` / `last_frame` 을 **연결하지 않는다**. optional 이므로 키가 없으면 그만이다.

### 7.2 I2V — 한 줄 추가

```json
"114": { "inputs": { "image": "{{##first_frame##}}" }, "class_type": "LoadImage" }
```

그리고 조건화 노드에 `"first_frame": ["114", 0]` 을 더한다. 그 외에는 T2V 와 완전히 같다.

### 7.3 R2V — 가변 슬롯

참조 이미지 3개 + 참조 영상 2개를 조건부로 연결한다.

```json
"151": { "inputs": { "image": "{{##ref_image_1##}}" }, "class_type": "LoadImage" },
"161": {
  "inputs": { "video": "{{##ref_video_1##}}", "force_rate": 0, "custom_width": 0,
              "custom_height": 0, "frame_load_cap": 0, "skip_first_frames": 0,
              "select_every_nth": 1 },
  "class_type": "VHS_LoadVideo"
},
"136": {
  "class_type": "MiniMaxH3ReferenceToVideo",
  "inputs": {
    "ref_images.ref_image_0": ["151", 0],
    "ref_videos.ref_video_0": ["161", 0],
    "ref_video_audios.ref_video_audio_0": ["161", 2]
  },
  "_vcc": {
    "omitInputsUnless": {
      "ref_images.ref_image_0": "{{##ref_image_1_attached##}}",
      "ref_videos.ref_video_0": "{{##ref_video_1_attached##}}",
      "ref_video_audios.ref_video_audio_0": "{{##ref_video_1_attached##}}"
    }
  }
}
```

`VHS_LoadVideo` 는 `IMAGE`(슬롯 0)와 `AUDIO`(슬롯 2)를 함께 내보내므로, 영상 1개 첨부로 두 슬롯이 같이 채워진다. 조건도 같은 `_attached` 를 공유한다.

### 7.4 모델별 제약은 문서화해 둔다

H3 는 프레임 수가 **17k+5 격자**만 유효하다 (73 / 124 / 243 / 362 …). 이런 제약은 숫자 입력으로 열지 말고 **select 로 고정**하는 편이 안전하다. 사용자가 어긋난 값을 넣을 방법이 없어진다.

---

## 8. 체크리스트

작업판을 만들기 전에 확인한다.

- [ ] API 포맷인가 (`노드ID → {inputs, class_type}`)
- [ ] 서브그래프가 펼쳐졌는가
- [ ] 모든 플레이스홀더가 **따옴표 안**에 있는가
- [ ] 워크플로의 플레이스홀더와 작업판 필드 이름이 **정확히** 일치하는가
- [ ] select 옵션을 `options` 로 넣었는가
- [ ] `defaultValue` 가 옵션의 `value` 와 일치하는가
- [ ] 모델 파일명이 `/object_info` 목록과 일치하는가
- [ ] `_vcc` 를 required 입력에 쓰지 않았는가
- [ ] `SaveImage` / `SaveVideo` 의 `filename_prefix` 에 `{{##user_id##}}` 가 있는가
- [ ] `/prompt` 로 실제 제출해 성공을 확인했는가

---

## 참고

- [COMFYUI_WORKFLOW.md](COMFYUI_WORKFLOW.md) — VCC 내부 처리 로직, 플레이스홀더 치환 구현, D-1/D-2 계약
- [DEVELOPMENT.md](DEVELOPMENT.md) — 신규 serverType 추가 절차
