# 배포용 작업판

바로 가져다 쓸 수 있는 작업판 모음. 각 파일은 VCC Manager 의 **작업판 내보내기 형식**이라
관리자 화면에서 가져오기만 하면 등록된다.

앱 버전과 함께 관리된다 — 이 디렉토리의 작업판은 같은 커밋의 VCC Manager 에서 동작이 확인된 것이다.

---

## 설치

1. **관리자 → 작업판 관리 → 가져오기**
2. 아래 JSON 파일 선택
3. 서버 선택 — 이름·타입이 같은 서버가 있으면 자동 매칭된다. 없으면 직접 고른다
4. 저장

가져오기 시 접근 그룹은 **기본 그룹**이 자동 할당된다. 다른 그룹에도 열려면 등록 후 작업판 편집기에서 조정한다.
(내보내기 형식에 그룹이 포함되지 않는 이유는 인스턴스마다 그룹 ID 가 달라 매칭이 불가능하기 때문이다.)

---

## 목록

### ComfyUI

| 파일 | 작업판 | 출력 | 요구 사항 |
|---|---|---|---|
| `comfyui/minimax-h3-fl2v.json` | MiniMax H3 - FL2V | 영상 + 스테레오 오디오 | H3 모델 4종 |
| `comfyui/minimax-h3-r2v.json` | MiniMax H3 - R2V | 〃 | H3 모델 4종 + VHS_LoadVideo |

---

## MiniMax H3

텍스트·이미지·영상·오디오를 함께 이해하고, **영상과 스테레오 오디오를 한 번의 패스로** 생성한다.
음성·효과음·음악이 따로 붙는 게 아니라 함께 모델링된다. 최대 2K · 24fps · 약 15초.

### 필요한 모델

ComfyUI 서버에 아래가 설치돼 있어야 한다.

```
models/
├── diffusion_models/minimax/minimax_h3_fl2va_pruned_int8_convrot.safetensors
├── text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors
└── vae/minimax/
    ├── minimax_h3_video_vae_fp16.safetensors
    └── minimax_h3_audio_vae_fp32.safetensors
```

받는 곳: [🤗 Comfy-Org/MiniMax-H3](https://huggingface.co/Comfy-Org/MiniMax-H3)

텍스트 인코더와 VAE 는 H3 에 고정이라 워크플로에 하드코딩돼 있다. 사용자에게 노출되는 모델 선택은
diffusion 모델 하나뿐이다.

### 두 작업판의 차이

| | 입력 | 용도 |
|---|---|---|
| **FL2V** | 첫 프레임 · 끝 프레임 (둘 다 선택) | 일반적인 영상 생성 |
| **R2V** | 참조 이미지 최대 3장 + 참조 영상 최대 2개 | 인물·모션·스타일·목소리 이어받기 |

R2V 의 참조 영상은 **프레임과 사운드트랙이 함께** 참조된다 (`VHS_LoadVideo` 필요).

### FL2V — 넣은 조합이 곧 모드다

첫/끝 프레임이 **둘 다 선택**이라, 가진 소재를 넣기만 하면 모드가 알아서 정해진다. 모드를 고르는 UI 는 없다.

| 첫 프레임 | 끝 프레임 | 동작 |
|---|---|---|
| ✗ | ✗ | 텍스트만으로 생성 (T2VA) |
| ✓ | ✗ | 그 이미지에서 시작해 전개 (I2VA) |
| ✗ | ✓ | 그 이미지로 끝나도록 수렴 (L2VA) |
| ✓ | ✓ | 두 이미지 사이를 잇는다 (FL2VA) |

### 첨부한 것만 전달된다

FL2V 의 첫/끝 프레임도, R2V 의 참조 슬롯도 **첨부한 것만 모델에 전달**된다. 빈 칸은 그냥 없는 것으로
취급되므로, 참조 1장만 필요하면 1장만 넣으면 된다. 나머지를 억지로 채울 필요가 없다.

이는 워크플로의 `_vcc.omitInputsUnless` 로 구현돼 있다. 자세한 내용은
[COMFYUI_WORKFLOW_AUTHORING.md](../docs/COMFYUI_WORKFLOW_AUTHORING.md) §3 참고.

### 길이 · 해상도 제약

H3 는 프레임 수가 **17k+5 격자**만 유효하다. 작업판에서 select 로 고정해 뒀다.

| 길이 | 프레임 |
|---|---|
| 3초 | 73 |
| 5초 | 124 |
| 10초 | 243 |
| 15초 | 362 |

해상도는 짧은 변 768px 기준, 32의 배수.

| 프리셋 | 크기 |
|---|---|
| 0.4MP | 864 × 480 |
| 0.8MP | 1216 × 672 |
| 네이티브 | 1344 × 768 |

### 프롬프트 작성

H3 는 프롬프트에 **샷 구성·카메라·오디오를 함께** 적는 형식을 쓴다. 공식 가이드 구조
(`integrated_multimodal_description` / `overall_soundscape` / `non_diegetic_music`)를 따르면 결과가 크게 달라진다.
생성 모드도 다섯 가지(T2VA / I2VA / FL2VA / L2VA / Ref2VA)로 나뉘고 각각 프롬프트 구조가 다르다.

VCC 에는 이 작성법을 작업판에 붙여두는 기능이 있다 — 관리자 → **프롬프트 가이드**에 등록하고 작업판 편집기에서
연결하면, 그 작업판에서 프롬프트를 생성할 때 자동으로 함께 전달된다. 사용자가 문법을 외울 필요가 없어진다.

**가이드 본문은 이 저장소에 동봉하지 않는다.** MiniMax 공식 스킬을 받아 등록한다:

1. [MiniMax-AI/MiniMax-H3 · `skills/h3-prompt-writing`](https://github.com/MiniMax-AI/MiniMax-H3/tree/main/skills/h3-prompt-writing) 에서
   `SKILL.md` 와 `references/base-en.txt` · `references/ref-en.txt` 내용을 받는다
2. 관리자 → 프롬프트 가이드 → 등록. 출처 저장소와 commit 을 함께 적어두면 나중에 갱신 여부를 판단하기 쉽다
3. 작업판 편집기에서 H3 작업판에 연결

동봉하지 않는 이유는 해당 문서가 MiniMax H3 Community License Agreement 아래 배포되고, 그 재배포 조항의
적용 지역에서 한국이 제외돼 있기 때문이다 (모델 사용과는 무관하며, 재배포에만 걸린다).

---

## 갱신 규칙

- 워크플로나 필드를 고쳤으면 **작업판을 다시 내보내 이 디렉토리의 파일을 교체**한다. 그러지 않으면
  배포본과 실제 동작이 어긋난다
- `appVersion` 은 내보낸 시점의 앱 버전이다. `package.json` 의 version 에서 파생된다
- 새 작업판을 추가할 때는 이 README 의 목록과 요구 사항도 함께 갱신한다

## 관련 문서

- [COMFYUI_WORKFLOW_AUTHORING.md](../docs/COMFYUI_WORKFLOW_AUTHORING.md) — 워크플로를 직접 만들 때
- [COMFYUI_WORKFLOW.md](../docs/COMFYUI_WORKFLOW.md) — VCC 내부 처리 로직
