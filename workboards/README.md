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
| `comfyui/minimax-h3-t2v.json` | MiniMax H3 - T2V | 영상 + 스테레오 오디오 | H3 모델 4종 |
| `comfyui/minimax-h3-i2v.json` | MiniMax H3 - I2V | 〃 | H3 모델 4종 |
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

### 세 모드의 차이

| | 입력 | 용도 |
|---|---|---|
| **T2V** | 프롬프트만 | 빠른 컨셉 확인, 짧은 클립 |
| **I2V** | 시작 프레임 1장 | 정지 이미지에서 움직임 만들기 |
| **R2V** | 참조 이미지 최대 3장 + 참조 영상 최대 2개 | 인물·모션·스타일·목소리 이어받기 |

R2V 의 참조 영상은 **프레임과 사운드트랙이 함께** 참조된다 (`VHS_LoadVideo` 필요).

### R2V — 첨부한 것만 참조된다

참조 슬롯은 **첨부한 것만 모델에 전달**된다. 빈 칸은 그냥 없는 것으로 취급되므로,
참조 1장만 필요하면 1장만 넣으면 된다. 나머지를 억지로 채울 필요가 없다.

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

가이드를 작업판에 연결하는 기능이 있다 — 관리자 → 프롬프트 가이드에서 등록한 뒤 작업판에 연결하면
프롬프트 생성 시 자동으로 합성된다.

---

## 갱신 규칙

- 워크플로나 필드를 고쳤으면 **작업판을 다시 내보내 이 디렉토리의 파일을 교체**한다. 그러지 않으면
  배포본과 실제 동작이 어긋난다
- `appVersion` 은 내보낸 시점의 앱 버전이다. `package.json` 의 version 에서 파생된다
- 새 작업판을 추가할 때는 이 README 의 목록과 요구 사항도 함께 갱신한다

## 관련 문서

- [COMFYUI_WORKFLOW_AUTHORING.md](../docs/COMFYUI_WORKFLOW_AUTHORING.md) — 워크플로를 직접 만들 때
- [COMFYUI_WORKFLOW.md](../docs/COMFYUI_WORKFLOW.md) — VCC 내부 처리 로직
