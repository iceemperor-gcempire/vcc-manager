# ComfyUI 워크플로 작성 가이드

VCC 작업판의 `workflowData` 에 넣을 워크플로 JSON 을 **작성하는 사람(또는 AI)** 을 위한 문서다.

> VCC 가 내부적으로 어떻게 치환·제출하는지는 [COMFYUI_WORKFLOW.md](COMFYUI_WORKFLOW.md) 를 본다.
> 이 문서는 "무엇을 만들어 넣어야 하는가" 만 다룬다.

---

## 0. 3분 요약

1. 공식 템플릿을 돌고 있는 ComfyUI 에서 받는다 (`/templates/index.json`)
2. `scripts/comfyui-template-to-api.js` 로 **API 포맷**으로 펼친다 — `--verify` 필수
3. 서브그래프 입력이던 자리에 `"{{##이름##}}"` 을 **따옴표로 감싸** 넣거나 고정값을 박는다
4. 작업판에 같은 이름의 필드를 정의한다
5. optional 입력을 요청마다 켜고 끄려면 `_vcc.omitInputsUnless`, 체인 중간 노드를 켜고 끄려면 `_vcc.bypassUnless` 를 쓴다
6. ComfyUI `/prompt` 에 직접 제출하고 **결과물을 ffprobe 로 확인**한다 (제출하면 실제로 생성된다)

> 처음이라면 **1.4절(위젯 매핑이 조용히 어긋나는 세 자리)** 을 먼저 읽을 것.
> 이 문서에서 가장 많은 시간을 아껴주는 부분이다.

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

수작업 변환은 연결을 놓치기 쉽다. **변환기를 쓴다.**

```bash
# 1. 대상 서버에서 스키마를 받는다 (위젯 이름·순서·타입의 유일한 근거)
curl -s http://<comfyui>/object_info > /tmp/object_info.json

# 2. 템플릿도 같은 서버에서 받을 수 있다 — 별도 다운로드 불필요
curl -s http://<comfyui>/templates/index.json            # 목록
curl -s http://<comfyui>/templates/video_ltx2_5_t2v.json > /tmp/tpl.json

# 3. 변환 (--verify 를 반드시 붙인다)
node scripts/comfyui-template-to-api.js /tmp/tpl.json /tmp/object_info.json out.json --verify
```

변환기는 서브그래프 전개 · 링크 해소 · 위젯 순서 · dynamic combo 점 표기 · `control_after_generate`
여분 값을 처리하고, 서브그래프 입력으로 주입되던 자리(`["-10", n]`)를 **치환 대상 목록으로 출력**한다.
그 자리에 플레이스홀더나 고정값을 채워 넣으면 작업판 워크플로가 된다.

ComfyUI UI 에서 열어 API 포맷으로 export 하는 방법도 있다. 결과가 의심스러우면 그쪽과 대조한다.

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

### 1.4 위젯 매핑이 조용히 어긋나는 세 자리

`widgets_values` 는 **이름 없는 값 배열**이다. `/object_info` 의 입력 순서대로 소비해야 하는데,
소비 규칙이 세 군데서 어긋난다. 셋 다 증상이 같다 — **값이 한 칸씩 밀리고, 구조 검증(끊긴 참조·
플레이스홀더 잔여)은 통과한 뒤, 실행에서 엉뚱한 오류로 터진다.**

전부 실제로 겪은 버그다. 변환기는 이미 셋 다 처리하지만, 직접 손볼 때는 알고 있어야 한다.

**① dynamic combo 의 하위 입력은 `부모.자식` 점 표기다**

`COMFY_DYNAMICCOMBO_V3` 는 고른 선택지에 따라 하위 입력이 딸려 나온다. 선택지가 바뀌면
필요한 키 집합 자체가 달라진다.

```json
"sampling_mode": "on",
"sampling_mode.temperature": 0.7,
"sampling_mode.top_k": 64
```

평탄한 형제 키(`"temperature": 0.7`)로 적으면 **`/prompt` 는 200 을 주지만** 검증에서
`required_input_missing / input_name: "sampling_mode.temperature"` 로 거부된다.
`ref_images.ref_image_0` (autogrow, 1.3절)과 같은 규약이다.

> ComfyUI 는 **선언되지 않은 키를 조용히 무시**한다. HTTP 200 만 보고 판단하지 말 것.
> `SaveVideo.codec` 에 잘못된 형태를 넣어도 접수는 되고 결과물만 달라진다.

**② 위젯 타입 판정은 허용목록이어야 한다**

"링크 타입이 아니면 위젯" 으로 판정하면 `COMFY_MATCHTYPE_V3` 같은 신규 링크 타입을
위젯으로 오인한다. `INT` `FLOAT` `STRING` `BOOLEAN` `COMBO` `COMFY_DYNAMICCOMBO_V3` 만
위젯으로 본다.

**③ 다중 타입 위젯이 있다**

`LTXVEmptyLatentAudio.frame_rate` 의 타입은 **`"FLOAT,INT"`** 다. 허용목록과 통째로 비교하면
위젯이 아니라고 판정되어 그 칸을 건너뛴다. 쉼표로 분리해 하나라도 위젯 타입이면 위젯이다.

이 버그로 `batch_size` 가 `frame_rate` 값 25 를 삼켰고, 실행 시
`Sizes of tensors must match... Expected size 1 but got size 25` 로 터졌다. **오류 메시지만
보면 해상도나 프레임 수 문제로 보인다** — 원인과 증상이 전혀 닮지 않았다.

**검사 방법**

`--verify` 는 노드별로 **소비한 개수 == 원본 배열 길이** 를 본다. 규칙이 하나라도 어긋나면
개수가 안 맞고 그 시점부터 값이 밀린다.

```
=== 위젯 소비 정합성 ===
불일치 1건 — 값이 밀렸을 가능성이 높다:
  #197 LTXVEmptyLatentAudio
     원본 3개 중 2개만 소비  [97,25,1]
     매핑: {"frames_number":97,"batch_size":25}
```

링크로 대체된 위젯의 값이 결과에 안 보이는 것은 정상이므로 신호로 쓰지 않는다.

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

이런 제약은 숫자 입력으로 열지 말고 **select 로 고정**하는 편이 안전하다. 사용자가 어긋난 값을 넣을 방법이 없어진다.

| 모델 | 제약 | 왜 |
|---|---|---|
| MiniMax H3 | 프레임 **17k+5** (73 / 124 / 243 / 362 …) | 모델 구조 |
| LTX-2.5 | 해상도 **64의 배수** | 2단계 구조가 해상도를 절반으로 줄여 1단계를 돌린다. 그 절반이 32배수여야 하므로 원본은 64배수 |
| LTX-2.5 | 프레임 **초 × 24 + 1** | 워크플로의 `ComfyMathExpression("a * b + 1")` 이 계산 |

**어긋나면 오류가 나는 게 아니라 조용히 깎인다.** LTX-2.5 에 832×480 을 넣으면 832×448 이 나온다.
select 라벨과 실제 출력이 어긋나지 않도록, 프리셋을 정한 뒤 **한 번은 실제로 생성해 ffprobe 로 확인**할 것.

### 7.5 LTX-2.5 — 프롬프트 확장기가 내장돼 있다

LTX-2.5 템플릿에는 `TextGenerateLTX2Prompt` 노드가 있다. 짧은 프롬프트를 샷 구성·카메라·조명·
사운드스케이프를 갖춘 LTX 형식으로 늘려준다. `ComfySwitchNode` 로 on/off 된다.

- 확장기가 쓰는 모델은 **`gemma4_e2b_it`** 다. `gemma4-12b-with-proj` 는 LTX 본 텍스트 인코더로
  확장 여부와 무관하게 항상 로딩된다 — 헷갈리기 쉽다
- 비용은 **새 프롬프트당 12~14초**, 같은 프롬프트 재사용 시 0초 (ComfyUI 가 노드 출력을 캐시)
- **이 작업판에는 프롬프트 가이드(#766)를 연결할 필요가 없다.** LTX 문법 지식이 노드 내부
  기본 템플릿(`use_default_template`)에 이미 있다. 가이드는 워크플로에 LLM 이 없어서
  **VCC 밖 범용 LLM 을 써야 하는 모델**을 위한 장치다

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
- [ ] 변환기를 `--verify` 로 돌려 **위젯 소비 정합성**이 통과했는가
- [ ] `/prompt` 로 실제 제출해 성공을 확인했는가
- [ ] **결과물을 ffprobe 로 확인**했는가 (해상도·길이·오디오 트랙이 의도대로인가)

---

## 참고

- [`scripts/comfyui-template-to-api.js`](../scripts/comfyui-template-to-api.js) — 공식 템플릿 → API 포맷 변환기
- [COMFYUI_WORKFLOW.md](COMFYUI_WORKFLOW.md) — VCC 내부 처리 로직, 플레이스홀더 치환 구현, D-1/D-2 계약
- [`workboards/README.md`](../workboards/README.md) — 완성된 배포용 작업판 (모델 준비물 · 모델별 제약)
- [DEVELOPMENT.md](DEVELOPMENT.md) — 신규 serverType 추가 절차
