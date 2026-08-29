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
| `comfyui/ltx-2.5-fl2v.json` | LTX-2.5 - FL2V | 영상 + 동기화 오디오 | LTX-2.5 모델 6종 · ComfyUI 0.32+ |
| `comfyui/minimax-music-3-t2m.json` | MiniMax Music 3 - T2M | **음악 (mp3)** | MiniMax Music 3 모델 3종 · ComfyUI 0.33+ |
| `comfyui/minimax-h3-fl2v-av1.json` | MiniMax H3 - FL2V (AV1) | 영상 + 오디오 · **코덱 선택** · 업스케일 옵션⁵ | H3 모델 4종 + VHS 노드팩 · ffmpeg¹ (+ 업스케일 모델²) |
| `comfyui/minimax-h3-r2v-av1.json` | MiniMax H3 - R2V (AV1) | 〃 | H3 모델 4종 + VHS 노드팩 · ffmpeg¹ (+ 업스케일 모델²) |
| `comfyui/ltx-2.5-fl2v-av1.json` | LTX-2.5 - FL2V (AV1) | 〃 | LTX-2.5 모델 6종 + VHS 노드팩 · ffmpeg¹ |

| `comfyui/sketch-to-image-sdxl.json` | Sketch to Image - SDXL | 이미지 ×2 (원본+업스케일) | SDXL 계열 ckpt + XL ControlNet + 업스케일 모델² |
| `comfyui/sketch-to-image-anima.json` | Sketch to Image - Anima | 〃 | Anima 모델 + **Comfy-Org/Anima-LLLite 패치**³ + 업스케일 모델² |
| `comfyui/sketch-to-image-krea2.json` | Sketch to Image - Krea2 | 〃 | Krea2 모델 + qwen3vl_4b TE + 업스케일 모델² |

| `comfyui/minimax-h3-fl2v-turbo.json` | MiniMax H3 - FL2V (Turbo) | 영상 + 오디오 · **4~8스텝 가속** · 코덱 선택 · 업스케일 옵션⁵ | H3 non-pruned 모델 + Turbo LoRA⁴ + VHS 노드팩 · ffmpeg¹ (+ 업스케일 모델²) |
| `comfyui/minimax-h3-r2v-turbo.json` | MiniMax H3 - R2V (Turbo) | 〃 | H3 non-pruned 모델 + Turbo LoRA⁴ + VHS 노드팩 · ffmpeg¹ (+ 업스케일 모델²) |

| `comfyui/video-upscale-pixel.json` | 영상 업스케일 (픽셀) | 영상 (원본 오디오 유지) · **2x/4x 픽셀 업스케일** | 업스케일 모델² + VHS 노드팩 · ffmpeg¹ |

¹ **(AV1) 판**은 출력 코덱을 생성 시점에 고른다 (H.264 mp4 / VP9 webm / AV1 webm). 저장을
core `SaveVideo` 대신 `VHS_VideoCombine`(VideoHelperSuite) 이 담당하므로 ComfyUI 머신에
**외부 ffmpeg** 이 필요하다 — H.264·VP9 는 아무 빌드나 되지만(VHS 의 pip 의존성이 최소
바이너리를 깔아줌), **AV1 은 `libsvtav1` 포함 full 빌드**가 필요하다. Windows 는
`VHS_FORCE_FFMPEG_PATH` 환경변수로 경로를 못박는 것을 권장. 코덱 없는 ffmpeg 을 만나면
저장 단계에서 `[Errno 22]` 로 실패한다. **H3 는 코덱 선택 판으로 일원화됐다** (#866) —
H.264 만 쓰면 VHS 동봉 바이너리로 충분해 별도 ffmpeg 설치가 필요 없다. 무코덱-스위치
판은 LTX-2.5 기본판만 남아 있다.

² **Sketch to Image 3종**은 업로드한 스케치의 비율로 **1M 픽셀·32px 버킷** 크기를 자동 계산하고,
원본 크기와 업스케일본(선택한 모델: AnimeSharp 2x / Remacri 4x / RealESRGAN 4x 등)을 함께 저장한다.
업스케일 모델은 `models/upscale_models/` 에 있어야 한다.

³ Anima 판은 `AnimaLLLiteApply`(core) 를 쓰며 **가중치 별도 설치 필요**:
https://huggingface.co/Comfy-Org/Anima-LLLite → `models/model_patches/`.
`anima-lllite-any-test-like-v2.safetensors`(혼합, 권장) 외 lineart/scribble/depth/pose 프리뷰판 선택 가능.

⁴ **(Turbo) 판**은 lightx2v 증류 LoRA 로 20스텝을 4~8스텝으로 줄인다 (실측 3~5배).
LoRA 파일을 https://huggingface.co/lightx2v/Minimax-h3-Turbo 에서 받아 `models/loras/` 에 두고,
작업판의 터보 LoRA 경로가 실제 하위 경로와 일치하는지 확인할 것 (export 기본값은
`optimizer/minimax/` 하위). LoRA 의 base 가 full 모델이라 **베이스는 non-pruned int8 권장**
(`minimax_h3_*_int8_convrot.safetensors` — pruned 조합은 미검증). FL2V 판은 터보 LoRA·스텝·
시프트를 짝으로 노출한다: 8step v1.0(544p mixed, 세로비 포함 전 해상도)=스텝 8·시프트 12,
4step v1.1 768p(가로 1344x768 전용)=스텝 4·시프트 6. R2V 판은 4step v0.1 고정이며
참조 이미지 해상도 기본값이 base 판과 달리 **match** (터보 증류 학습 조건).

⁵ **인코딩 전 업스케일** — H3 4종은 "업스케일 (인코딩 전)" 선택으로 생성 직후·인코딩 **전**에
AnimeSharp 2x 를 걸 수 있다 (기본 "없음" — 끄면 노드가 우회되어 이전과 동일 경로). 별도 판으로
업스케일하면 480p 손실 인코딩을 한 번 더 통과해 압축 노이즈까지 키우게 되는데, 워크플로 안에서
처리하면 프레임이 디스크를 거치지 않아 그 손실이 없다 (동일 시드 실측: 하늘 평탄부 노이즈 −27%,
디테일 유지). 시간 +약 40초 / 파일 약 3배 (5초 기준). `영상 업스케일 (픽셀)` 판은 **이미 만들어진
영상**을 나중에 키울 때 쓴다 (AnimeSharp 2x · RealESRGAN 4x · Remacri 4x). 두 경우 모두
업스케일 모델은 `models/upscale_models/` 에 있어야 한다. H.264 기본 CRF 는 14 (준무손실).

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

### 가속 옵션 — Sol-Attn

FL2V 작업판에는 **가속 — Sol-Attn** 체크박스가 있다. 어텐션 커널을 교체해 생성을 빠르게 한다.
기본은 꺼짐이라, 모르고 지나가도 지금까지와 똑같이 동작한다.

`ComfyUI-sol-attn` 커스텀 노드(`SolAttnPatch`)가 설치된 서버에서만 켤 수 있다. 없으면 체크하지 않으면 된다 —
꺼두면 그 노드는 워크플로에서 아예 빠지므로(`_vcc.bypassUnless`) 순정 ComfyUI 에서도 정상 동작한다.

실측 (RTX PRO 6000 Blackwell · SageAttention 기동 · 20스텝 · 웜 상태 · VCC 왕복 시간 기준):

| 설정 | 끔 | 켬 | |
|---|---|---|---|
| 864×480 · 73프레임 | 44.6초 | 42.6초 | 1.05× |
| 1344×768 · 124프레임 | 292.7초 | 259.3초 | **1.13×** (33초 단축) |

토큰 수가 클수록 이득이 커진다. 커널 자체 벤치마크(SageAttention 대비 1.38~1.65×)보다 낮은 이유는
전체 시간에 MLP·VAE·텍스트 인코딩이 함께 들어가기 때문이다.

근사 연산이라 결과가 **미세하게 달라진다**. 같은 시드라도 픽셀 단위로 동일하지는 않다.
첫 실행은 Triton 커널 컴파일 때문에 느리다 — 속도 비교는 두 번째 실행부터 봐야 한다.

Ref2V 에도 쓸 수 있다 (모드와 무관한 모델 패치). R2V 작업판에는 아직 넣지 않았다.

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

## LTX-2.5

**영상과 동기화된 오디오를 한 번에** 만든다. 2단계 샘플링(저해상도 생성 → 잠재 업스케일 →
재샘플링)으로 디테일을 올린다. ComfyUI 0.32 이상이 필요하다 (공식 템플릿이 그때 들어왔다).

### 필요한 모델

```
models/
├── diffusion_models/LTX-2/ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors
├── text_encoders/gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors
├── text_encoders/gemma4_e2b_it_bf16.safetensors
├── vae/LTX-2/ltx-2.5-video-vae-bf16.safetensors
├── vae/LTX-2/ltx-2.5-audio-vae-bf16.safetensors
└── latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors
```

받는 곳: [🤗 Lightricks/LTX-2.5](https://huggingface.co/Lightricks) — **접근 권한 승인이 선행**되어야 한다.
텍스트 인코더와 업스케일러는 루트에, 나머지는 `LTX-2/` 아래에 둔 기준이다. 다른 위치에 뒀다면
작업판의 워크플로에서 해당 경로 문자열을 고쳐야 한다.

### FL2V — 넣은 조합이 곧 모드다

H3 FL2V 와 같다. 첫/끝 프레임이 **둘 다 선택**이라 가진 소재를 넣기만 하면 모드가 정해진다.

| 첫 프레임 | 끝 프레임 | 동작 |
|---|---|---|
| ✗ | ✗ | 텍스트만으로 생성 |
| ✓ | ✗ | 그 이미지에서 시작해 전개 |
| ✗ | ✓ | 그 이미지로 끝나도록 수렴 |
| ✓ | ✓ | 두 이미지 사이를 잇는다 |

미첨부 프레임은 해당 `LTXVAddGuide` 노드가 워크플로에서 빠진다 (`_vcc.bypassUnless`).

### 길이는 초 × 24 + 1 프레임

3초 = 73프레임, 5초 = 121프레임, 10초 = 241프레임. 작업판에서 select 로 고정해 뒀다.

### 해상도는 64의 배수

2단계 구조상 해상도를 반으로 줄여 1단계를 돌리므로, **절반이 32의 배수** 여야 한다. 즉 원본은 64의 배수다.
64의 배수가 아니면 조용히 깎여서 나온다 (832×480 을 넣으면 832×448 이 나온다).

| 프리셋 | 실제 출력 |
|---|---|
| 832×448 | 그대로 |
| 1024×576 | 그대로 (정확한 16:9) |
| 1280×704 | 그대로 |
| 1920×1088 | 그대로 |

### 프롬프트 자동 확장

워크플로 안에 프롬프트 전용 언어모델(`gemma4_e2b_it`)이 들어 있다. **기본으로 켜져 있다.**
"a lighthouse at dusk" 처럼 짧게 적어도 샷 구성·카메라 무빙·조명·질감·사운드스케이프를 갖춘
LTX 형식 프롬프트로 늘려준다.

비용은 **처음 쓰는 프롬프트당 10초 남짓**이고, 같은 프롬프트를 다시 쓰면 결과가 캐시되어 추가 시간이 없다.
시드만 바꿔 여러 장 뽑는 경우 첫 장에만 붙는다.

이 작업판에는 프롬프트 가이드(관리자 → 프롬프트 가이드)를 연결할 필요가 없다 — LTX 문법 지식이
이미 워크플로 안에 있다.

---

## MiniMax Music 3

설명과 가사로 **완성곡**을 만든다. VCC 의 오디오 출력 작업판이며 결과는 mp3 로 저장된다.
ComfyUI 0.33 이상이 필요하다 (공식 템플릿이 그때 들어왔다).

### 필요한 모델

```
models/
├── diffusion_models/minimax/minimax_music3_dit_fp16.safetensors
│   (저VRAM 이면 minimax_music3_dit_int8_convrot.safetensors)
├── text_encoders/minimax_music3_text_encoder_pruned_int8_convrot.safetensors
└── vae/minimax/minimax_music3_dav.safetensors
```

받는 곳: [🤗 Comfy-Org/MiniMax-Music-3](https://huggingface.co/Comfy-Org/MiniMax-Music-3)
텍스트 인코더는 루트에, 나머지는 `minimax/` 아래에 둔 기준이다.

### 입력

| 필드 | 설명 |
|---|---|
| 프롬프트 | 장르·BPM·조성·악기·분위기. `Global Metadata: ...` 형식이 잘 먹는다 |
| 가사 (선택) | **비우면 연주곡**이 된다. `[verse]` `[chorus]` 구조 표기 사용 가능 |
| 최대 길이 (초) | **상한값**이다. 실제 길이는 모델이 곡에 맞춰 정하며 더 짧게 나온다 |
| 타일 디코드 | 메모리가 부족할 때 켠다. 조금 느려진다 |

실측: 최대 120초 설정 · RTX PRO 6000 기준 **72초 소요 → 21초 곡** (mp3 44.1kHz 스테레오).

## 갱신 규칙

- 워크플로나 필드를 고쳤으면 **작업판을 다시 내보내 이 디렉토리의 파일을 교체**한다. 그러지 않으면
  배포본과 실제 동작이 어긋난다
- `appVersion` 은 내보낸 시점의 앱 버전이다. `package.json` 의 version 에서 파생된다
- 새 작업판을 추가할 때는 이 README 의 목록과 요구 사항도 함께 갱신한다

## 관련 문서

- [COMFYUI_WORKFLOW_AUTHORING.md](../docs/COMFYUI_WORKFLOW_AUTHORING.md) — 워크플로를 직접 만들 때
- [AGENT_SKILL_INTEGRATION.md](../docs/AGENT_SKILL_INTEGRATION.md) — 모델 제작사 프롬프트 스킬을 어떻게 붙일지
- [COMFYUI_WORKFLOW.md](../docs/COMFYUI_WORKFLOW.md) — VCC 내부 처리 로직
