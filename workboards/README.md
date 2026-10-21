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

### 모델 폴더

베이스 모델은 **계열마다 폴더를 나눠 둔다** — `diffusion_models/qwen/`, `diffusion_models/Krea2/`,
`diffusion_models/openmoss/`, `diffusion_models/LTX-2/` 처럼. 작업판의 기본 모델이 이 폴더를 포함한 경로이고,
아래 판들은 **허용 모델 폴더**가 정해져 있어 그 폴더의 모델만 모델 선택 목록에 나오고 다른 모델로는 실행이
거절된다 (#1086 — 짝이 안 맞는 모델이 ComfyUI 까지 가서 원인 모를 오류로 실패하던 것을 막는다).

| 판 | 허용 모델 폴더 |
|---|---|
| Text to Image - Qwen-Image 2.1 · Sketch to Image - Qwen-Image 2.1 | `qwen/` |
| Text to Image - MOSS-Image · MOSS-Image (빠름) | `openmoss/` |
| Sketch to Image - Krea2 | `Krea2/` |
| LTX-2.5 - FL2V · FL2V (AV1) | `LTX-2/` |

폴더를 다르게 쓰고 있다면 가져온 뒤 작업판 편집기의 워크플로 설정에서 **허용 모델 폴더**와 기본 모델을 바꾼다.
허용 모델 타입(Civitai 분류)으로 거르는 판(Anima·SDXL·Z-Image)은 Civitai 정보가 없는 파일이 목록에 나오지 않는다.

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
| `comfyui/sketch-to-image-qwen-image-21.json` | Sketch to Image - Qwen-Image 2.1 | 이미지 ×1 · 스케치(스크리블) 또는 사진(Canny) 구도로 생성 · 한글 글씨 | Qwen-Image 2.1 판과 같은 모델 + 공식 컨트롤넷 `model_patches/qwen_image_2.1_fun_controlnet_union_int8_convrot` ([🤗 Comfy-Org/Qwen-Image-2.1](https://huggingface.co/Comfy-Org/Qwen-Image-2.1/tree/main/model_patches)) — ComfyUI 0.38 이상. 1024² 약 9초, Turbo 8스텝 약 4초. 제어 강도 0.8~1.0 |
| `comfyui/sketch-to-image-krea2.json` | Sketch to Image - Krea2 | 〃 | Krea2 Turbo 모델 + qwen3vl_4b TE + 업스케일 모델². 기본 모델 `Krea2\krea2TurboOfficialComfy_krea2TurboInt8` 은 Civitai 배포본으로, [🤗 Comfy-Org/Krea-2](https://huggingface.co/Comfy-Org/Krea-2/tree/main/diffusion_models) 의 `krea2_turbo_int8_convrot` 과 같은 파일이다(SHA256 일치). 공식 이름으로 받았다면 판의 베이스 모델 기본값을 그 이름으로 바꾼다 (허용 모델 폴더 `Krea2/` 안이면 모델 선택 목록에 나온다) |
| `comfyui/text-to-image-z-image.json` | Text to Image - Z-Image | 이미지 ×1 (업스케일본) · **프롬프트만** | Z-Image 터보 (`Z-Image/z_image_turbo_bf16`) + `qwen_3_4b` TE + `Z-Image/ae` VAE + 업스케일 모델² |
| `comfyui/text-to-image-z-image-aio.json` | Text to Image - Z-Image (AIO) | 이미지 ×1 (업스케일본) · **프롬프트만** | Z-Image **AIO 체크포인트** (TE·VAE 일체, `checkpoints/Z-Image/…aio…`) + 업스케일 모델² |
| `comfyui/text-to-image-qwen-image-21.json` | Text to Image - Qwen-Image 2.1 | 이미지 ×1 · 긍정·부정 프롬프트 · 한글 글씨 | Qwen-Image 2.1 (`qwen\qwen_image_2.1_int8_convrot` — 모델은 `diffusion_models/qwen/` 에 둔다) + `qwen3vl_8b_int8_convrot` TE + `qwen_image_2.1_vae_bf16` (+ 업스케일 모델²). 선택 모델(같은 `qwen/` 폴더): **Turbo** `qwen_image_2.1_turbo_int8_convrot` (스텝 8, 1024² 약 1.5초 — 기본 25스텝 4.3초와 같은 수준) · **Uncensored** `qwen-image-2.1-UC-int8_convrot` ([abenzerps](https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-GGUF), 공식 모델 + 검열 해제 LoRA 병합, 설정은 기본과 같음) |
| `comfyui/text-to-image-moss-image.json` | Text to Image - MOSS-Image | 이미지 ×1 · 긍정·부정 프롬프트 · 중국어·영어 글씨 · 긴 프롬프트(약 4천 토큰) | ComfyUI **0.42 이상** + Comfy-Org 모델 3개 `openmoss/…` (아래 「MOSS-Image」) (+ 업스케일 모델²). 1024² 50스텝 약 25초 (int8 모델 약 14초) |
| `comfyui/text-to-image-moss-image-fast.json` | Text to Image - MOSS-Image (빠름) | 이미지 ×1 · ComfyUI 공식 템플릿 설정 · **프롬프트 늘려 쓰기**(기본 켬) · 긍정·부정 프롬프트 | 위 판과 같은 폴더의 int8 모델 · w4a8 인코더 · VAE (아래 「MOSS-Image」) (+ 업스케일 모델²). 1024² 25스텝 약 9초 (늘려 쓰기를 끄면 약 7.5초) |

| `comfyui/minimax-h3-fl2v-turbo.json` | MiniMax H3 - FL2V (Turbo) | 영상 + 오디오 · **4~8스텝 가속** · 코덱 선택 · 업스케일 옵션⁵ | H3 non-pruned 모델 + Turbo LoRA⁴ + VHS 노드팩 · ffmpeg¹ (+ 업스케일 모델²) |
| `comfyui/minimax-h3-keyframe-turbo.json` | MiniMax H3 - 키프레임 앵커 (Turbo) | 영상+오디오 · 키 이미지 1~3장을 시간축에 앵커 | FL2V Turbo 와 동일 (H3 int8 + 터보 LoRA) |
| `comfyui/minimax-h3-t2v-fasth3-v2.json` | MiniMax H3 - T2V (FastH3 V2) | 영상+오디오 · 텍스트 전용, 8스텝 (FastVideo 공식 DMD) | `minimax/fastvideo_fasth3_8step_v2_pruned_int8_convrot` ([🤗 FastVideo/FastVideo-FastH3-Comfy](https://huggingface.co/FastVideo/FastVideo-FastH3-Comfy)) + H3 TE·VAE + VHS 노드팩 · ffmpeg¹. ComfyUI 0.36 이상(정식 VSA 노드). NVFP4 변환본도 선택 가능 (5% 빠름·메모리 6.8 GiB 적음) |
| `comfyui/minimax-h3-r2v-turbo.json` | MiniMax H3 - R2V (Turbo) | 〃 | H3 non-pruned 모델 + Turbo LoRA⁴ + VHS 노드팩 · ffmpeg¹ (+ 업스케일 모델²) |

| `comfyui/video-upscale-ltx-iclora.json` | 영상 업스케일 (LTX IC-LoRA x2) | 영상 (원본 오디오 유지) · **재작화 2x 업스케일** | LTX-2.5 distilled + IC-LoRA 업스케일러⁶ + VHS 노드팩 · ffmpeg¹ |
| `comfyui/video-upscale-h3-upsampler.json` | 영상 업스케일 (H3 업샘플러 x2) | 영상 (원본 오디오 유지) · **정확히 2배, 원본 가이드로 디테일 복원** · 프롬프트 없음 | H3 ref2va int8 + H3 Video Upsampler 노드 + h3upscale LoRA + latent 업스케일러 (아래 「H3 업샘플러」) + VHS 노드팩 · ffmpeg¹ |

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
`anima-lllite-any-test-like-v2.safetensors`(혼합 — 선화·스크리블·그레이스케일)를 쓴다. 공식 템플릿과 같은 파일이다.
같은 저장소의 lineart/scribble/depth/pose 프리뷰판은 판 선택지에서 뺐다 — 공식 템플릿에 없고, 설치하지 않은 서버에서 고르면 실패했다.

⁴ **(Turbo) 판**은 lightx2v 증류 LoRA 로 20스텝을 4~8스텝으로 줄인다 (실측 3~5배).
LoRA 파일을 https://huggingface.co/lightx2v/Minimax-h3-Turbo 에서 받아 `models/loras/` 에 두고,
작업판의 터보 LoRA 경로가 실제 하위 경로와 일치하는지 확인할 것 (export 기본값은
`optimizer/minimax/` 하위). LoRA 의 base 가 full 모델이라 **베이스 기본값은 non-pruned int8**
(`minimax_h3_*_int8_convrot.safetensors`). pruned·NVFP4 베이스와의 조합도 동작한다 — 아래 ⁸ 참고. FL2V 판은 **768p 학습 LoRA 2종**만 노출한다 (기본 1344x768 · 시프트 6/3):
8step v1.0 768p(기본)=스텝 8, 4step v1.1 768p=스텝 4. 예전 8step v1.0(544p mixed) 은 같은 시드
A/B 에서 화질·구도 준수가 밀려 뺐다 — 저해상도 출력 자체가 디테일이 떨어져 쓰지 않는다.
R2V 판은 4step v0.1 고정이며
참조 이미지 해상도 기본값이 base 판과 달리 **match** (터보 증류 학습 조건).

⁵ **인코딩 전 업스케일** — H3 4종은 "업스케일 (인코딩 전)" 선택으로 생성 직후·인코딩 **전**에
AnimeSharp 2x 를 걸 수 있다 (기본 "없음" — 끄면 노드가 우회되어 이전과 동일 경로). 별도 판으로
업스케일하면 480p 손실 인코딩을 한 번 더 통과해 압축 노이즈까지 키우게 되는데, 워크플로 안에서
처리하면 프레임이 디스크를 거치지 않아 그 손실이 없다 (동일 시드 실측: 하늘 평탄부 노이즈 −27%,
디테일 유지). 시간 +약 40초 / 파일 약 3배 (5초 기준). 업스케일 모델은 `models/upscale_models/` 에
있어야 한다. H.264 기본 CRF 는 14 (준무손실). 이 옵션도 **프레임을 한 장씩** 키우고, 키운 프레임 전체를
시스템 램에 한꺼번에 올린다 (램 ≈ 프레임 수 × 가로 × 세로 × 배율² × 12바이트). 이미 만들어진 영상을
같은 방식으로 키우던 `영상 업스케일 (픽셀)` 판은 영상 처리 과정 없이 프레임만 보고 키우는 한계가 분명해
제거했다 (#964) — 이미 만든 영상은 IC-LoRA 판⁶으로 키운다.

⁶ **LTX IC-LoRA 업스케일 판**은 Lightricks 공식 `ltx-2.5-22b-ic-lora-pixel-spatial-upscaler-x2-1.0.safetensors`
(`models/loras/optimizer/LTX-2/`) 로 영상을 2배 해상도로 **다시 그린다** — 프레임 단위 픽셀 업스케일과 달리 영상 모델이 선을 정리하고 디테일을 재생성한다.
동일성은 참조 고정 설계로 유지 (실측 #908). LTX-2.5 모델 4종(README 의 LTX 절 참고)이 함께 필요하다.
5초 480p→960p 약 66초, 10초 이상 대형 입력은 ~10분·램 소모 큼. 코어 노드만 사용.

⁸ **NVFP4 베이스 (선택)** — 커뮤니티 변환본 `minimax/minimax_h3_fl2va_pruned_nvfp4_all.safetensors`
(11.67GiB, `MATLOWAI/minimax-h3-nvfp4`, Comfy-Org pruned bf16 에서 변환). 파일에 `comfy_quant`
메타데이터가 있어 **스톡 ComfyUI 에서 커스텀 노드 없이** 로드되고, 작업판의 베이스 모델 목록에
그대로 뜬다 (모델 노출 정책이 `full`). **기본값은 바꾸지 않았다** — 고르는 사람이 판단한다.

실측 (RTX Pro 6000 1장, 웜, 같은 시드, 반복 측정 · 2026-09-29):

| 경로 | int8 (non-pruned, 31.7GiB) | NVFP4 (pruned, 11.67GiB) |
|---|---|---|
| 1344x768 · 5초 · 20스텝 | 203.3초 | **180.4초 (−11%)** |
| 1344x768 · 5초 · 터보 8step | 100.6초 | **90.2초 (−10%)** |
| 832x448 · 3초 · 20스텝 | 25.2초 | 25.1초 (차이 없음) |

작은 크기에서는 이득이 없다 — 토큰이 많아 행렬 연산이 지배할 때만 FP4 이득이 나온다.
**터보 LoRA 와 함께 써도 동작한다** (5회 전부 성공, 격자·깨짐 없음). 다만 같은 시드 두 개에서
NVFP4 쪽이 피사체를 더 멀리 잡는 경향이 보였다 (n=2 — 단정할 수 없다). 그리고 이 비교에는
**가지치기와 FP4 두 변수가 섞여 있다**; 가르려면 `minimax_h3_fl2va_pruned_int8_convrot`(19.53GiB)
대조군이 필요하다.

**전 규격이 아니다** — 이 변환본은 fl2va 헤드뿐이라 R2V 판 2개(`ref2va`)는 쓸 수 없다. 저작자의
30초 빌더로 자체 변환하면 전 규격·non-pruned 계보가 가능하고, peak VRAM 도 82.5 → 59.3GiB(−28%)로
줄어든다. 절차·미검증 항목·재개 조건은 **이슈 #988 (보류 — 프로덕션 서비스 중)**.

---

## MiniMax H3

텍스트·이미지·영상·오디오를 함께 이해하고, **영상과 스테레오 오디오를 한 번의 패스로** 생성한다.
음성·효과음·음악이 따로 붙는 게 아니라 함께 모델링된다. 최대 2K · 24fps · 약 15초.

### 필요한 모델

ComfyUI 서버에 아래가 설치돼 있어야 한다.

```
models/
├── diffusion_models/minimax/
│   ├── minimax_h3_fl2va_int8_convrot.safetensors    ← FL2V · 키프레임 판 기본 (31.7 GiB)
│   └── minimax_h3_ref2va_int8_convrot.safetensors   ← R2V 판 기본 (31.7 GiB)
├── text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors
└── vae/minimax/
    ├── minimax_h3_video_vae_fp16.safetensors
    └── minimax_h3_audio_vae_fp32.safetensors
```

받는 곳: [🤗 Comfy-Org/MiniMax-H3](https://huggingface.co/Comfy-Org/MiniMax-H3)

텍스트 인코더와 VAE 는 H3 에 고정이라 워크플로에 하드코딩돼 있다. 사용자에게 노출되는 모델 선택은
diffusion 모델 하나뿐이다 — 서버에 있는 모델이 모두 선택 목록에 뜬다.

**GPU 메모리가 작다면 — w6a8.** 같은 저장소의 `minimax_h3_fl2va_pruned_w6a8` / `minimax_h3_ref2va_pruned_w6a8` (`diffusion_models/minimax/` 에 둔다)
(각 14.9 GiB, ComfyUI 0.38 · comfy-kitchen 0.2.36 이상)을 받아 모델 선택에서 고르면 된다. 실측(1344×768, sol-attn 켬):

| 모델 | GPU 메모리 최고점 5초 / 10초 | 생성 시간 5초 |
|---|---|---|
| int8_convrot (기본) | 50.8 / 54.3 GiB | 136.0초 |
| pruned w6a8 | 34.3 / 39.8 GiB | 135.6초 |

속도는 같고 메모리가 약 16.5 GiB 준다(텍스트 인코더 포함 최고점). 가지치기·양자화 방식이 달라 같은 시드라도 결과가 기본 모델과 다르게 나온다.
96 GiB GPU 에서는 메모리가 영상 길이를 막지 않으므로(5→10초에 4~5 GiB 증가) 기본 모델을 그대로 쓴다.

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

### 가속 — Sol-Attn (기본 켜짐)

FL2V · R2V · 키프레임 작업판에는 **가속 — Sol-Attn** 체크박스가 있고 **기본으로 켜져 있다**.
H3 전용 희소 어텐션으로 확산 단계의 어텐션 계산을 줄인다. ComfyUI **정식 노드**
(`BlockSparseAttention`, 화면 이름 *Model Sparse Attention*, method `sol-attn`)라 커스텀 노드 설치가 필요 없다
— ComfyUI 0.36 이상. 그보다 낮으면 업데이트하거나 체크를 끄면 된다(끄면 노드가 워크플로에서 빠진다, `_vcc.bypassUnless`).

실측 (RTX PRO 6000 Blackwell · `--use-sage-attention` · ComfyUI 0.38.0 · 20스텝 · 3회 중앙값 · ComfyUI 실행 시간 기준):

| 설정 | 864×480 · 73프레임 | 1344×768 · 124프레임 |
|---|---|---|
| 끔 | 26.7초 | 177.5초 |
| **켬** | 25.3초 | **136.0초 (1.31×)** |

터보(8스텝) 판도 같은 설정으로 켠다 — 알파 VCC 경로 실측 1344×768·124프레임 (2회 평균, 작업 시간):
FL2V Turbo 80초 → 65초 (1.23×), R2V Turbo 91초 → 70초 (1.31×). 프레임 비교로 화질 차이 없음.

토큰 수가 클수록 이득이 커진다. 설정값은 tau 1.3, 전체 스텝의 20~90% 구간, 4096 토큰 미만은 그대로.
근사 연산이라 같은 시드라도 결과가 **미세하게 달라진다** — 같은 시점 프레임 비교로 화질 차이는 보이지 않았다.
이전 결과를 시드로 그대로 재현하려면 체크를 끈다. 첫 실행은 커널 컴파일 때문에 느리다.

**SageAttention 이 없는 서버라면** ComfyUI 기동 인자 `--use-sage-attention` 없이도 같은 속도를 낼 수 있다 —
ComfyUI 0.38 의 *Model Attention Backend* 노드에서 `comfy kitchen attention`(INT8, Nvidia·AMD)을 고르면 된다.
실측(sol-attn 켬, 1344×768·5초): PyTorch 기본 157.3초 / SageAttention 136.1초 / INT8 135.9초.
작업판에는 넣지 않았다 — Sage 로 기동한 서버에서는 이득이 없고 결과만 미세하게 바뀌기 때문이다. 필요하면 워크플로의
UNETLoader 바로 뒤에 이 노드를 끼우면 된다.

> 예전에는 커스텀 노드 `ComfyUI-sol-attn`(`SolAttnPatch`)을 썼다 (끔/켬 1344×768 기준 1.13~1.21×).
> 정식 노드가 더 빠르고 결과도 가속 끈 쪽에 더 가까워 바꿨다. 상세 실측은 union-wiki `wiki/comfyui/h3-comfyui-038-attention-w6a8-bench`.

### H3 업샘플러 — 영상 업스케일 판과 R2V 판 선택지

**영상 업스케일 (H3 업샘플러 x2)** 판은 이미 만든 영상을 받아 **정확히 2배**로 키운다 (832×448 → 1664×896, 1344×768 → 2688×1536).
R2V 판(기본·터보)에는 같은 처리를 생성 직후에 붙이는 **업스케일 — H3 업샘플러** 선택지(없음 / 2배, 기본 없음)가 있다.

처리: 완성된 영상을 VAE 로 다시 latent 로 바꾸고 → H3 latent 업스케일러로 2배 → H3 ref2va 모델이 `h3upscale_v2_x2` LoRA 로
원본을 가이드 삼아 한 번(denoise 0.1) 다시 그린다 → 디코드. 가이드는 원본을 출력 절반 크기(= 원본 크기)로 출력 격자 2칸마다 겹쳐
넣는 깨끗한 조건이라, 질감을 지어내지 않고 원본 디테일을 되살린다. 구도·움직임·소리는 원본 그대로.

- **2배인 이유** — LoRA 가 출력 절반 크기 원본을 가이드로 학습됐다(`reference_downscale_factor: 2`). 노드는 면적(메가픽셀)만 받으므로
  정식 노드 `GetImageSize` + `ComfyMathExpression` 으로 원본 크기 × 4 를 계산해 넣는다
- **FL2V · 키프레임 판에는 없다** — 다시 그리기용 ref2va 를 생성용 fl2va 와 함께 올려야 해 업샘플 구간 GPU 메모리를 96 GiB 중 약 90 GiB 까지
  썼다. 그 판의 결과는 영상 업스케일 판으로 따로 키운다. R2V 판은 같은 모델로 다시 그려 여유가 34 GiB 이상 남는다
- **프롬프트 없음** — 업스케일 판은 LoRA 학습 문구를 고정으로 쓴다 (생성 화면에 프롬프트 칸이 나오지 않는다)

필요한 것 (영상 ComfyUI, 0.38 이상):
- 커스텀 노드 [`ComfyUI-H3-Video-Upsampler`](https://github.com/dntpi/ComfyUI-H3-Video-Upsampler) (검증 커밋 `36cb612`, pip 의존성 없음)
- LoRA `loras/optimizer/minimax/h3upscale_v2_x2.safetensors` — [🤗 sandpies/ComfyUI-H3-Video-Upsampler](https://huggingface.co/sandpies/ComfyUI-H3-Video-Upsampler/tree/main/lora)
- latent 업스케일러 `latent_upscale_models/minimax_h3_latent_upscaler_3d_bf16.safetensors` — [🤗 LBH-123-AI](https://huggingface.co/LBH-123-AI/Minimax_h3_latent_Upscaler)
- `diffusion_models/minimax/minimax_h3_ref2va_int8_convrot.safetensors` (R2V 판과 같은 것)

실측 (RTX PRO 6000, VCC 작업 시간):

| 경우 | 시간 |
|---|---|
| 업스케일 판 · 832×448·5초 → 1664×896 (모델 로드 포함) | 111초 |
| R2V Turbo 1344×768·5초 · 끔 / 2배 (→ 2688×1536) | 약 70초 / 237초 |

같은 영상을 2MP(1.4~1.7배)로 키운 것보다 2배가 털 결이 더 살아났다. 어두운 역광 장면은 효과가 작다.
R2V 판에서 아래 **업스케일 (인코딩 전)** 픽셀 업스케일과 함께 켜면 두 번 커지니 하나만 쓴다.

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

---

## MOSS-Image

OpenMOSS 의 5B 텍스트→이미지 모델 ([GitHub](https://github.com/OpenMOSS/MOSS-Image) ·
[🤗 OpenMOSS-Team/MOSS-Image-SFT](https://huggingface.co/OpenMOSS-Team/MOSS-Image-SFT)). 중국어·영어 글씨를 잘 쓰고
긴 프롬프트를 받는다. 가중치는 Apache-2.0, 동봉 VAE(FLUX.2 small decoder)도 Apache-2.0 이다.
**ComfyUI 0.42.0 부터 본체가 지원하므로 커스텀 노드는 필요 없다.** 확인한 ComfyUI 는 0.42.1 이다.

### 필요한 모델

ComfyUI 용으로 한 파일씩 묶어 둔 [🤗 Comfy-Org/MOSS-Image](https://huggingface.co/Comfy-Org/MOSS-Image) 에서 받아
각 폴더의 `openmoss/` 아래에 **파일 이름 그대로** 둔다. 폴더 이름은 판의 기본값과 맞춘 것이다.

```
models/
├── diffusion_models/openmoss/moss_image_sft_bf16.safetensors          (9.5 GiB, 기본 판)
├── diffusion_models/openmoss/moss_image_sft_int8_convrot.safetensors  (5.0 GiB, 빠른 판 — 기본 판에서도 고를 수 있음)
├── text_encoders/openmoss/qwen3.5_9b_bf16.safetensors                 (18.0 GiB, 기본 판)
├── text_encoders/openmoss/qwen3.5_9b_w4a8_gptq.safetensors            (6.8 GiB, 빠른 판 — 기본 판에서도 고를 수 있음)
└── vae/openmoss/flux2-vae_small.safetensors                           (238 MiB, 두 판 모두)
```

- 한 판만 쓴다면 그 판의 파일만 받으면 된다. 빠른 판만 쓰면 int8 모델 · w4a8 인코더 · VAE 세 개다
- `moss_image_base_*` 는 파인튜닝용 Base 체크포인트라 두 판 모두 쓰지 않는다

### 커스텀 노드 판(v4.11.0)에서 옮길 때

v4.11.0 의 판은 커스텀 노드 `moss-image` 와 HF 조각을 직접 합친 파일 3개를 썼다.

- ComfyUI 를 0.42.0 이상으로 올린다
- **텍스트 인코더는 새로 받아야 한다.** 합쳐 만든 `moss_image_qwen35_9b_bf16` 은 키 이름이(`language_model.…`) 본체 로더가 찾는
  형식(`model.language_model.…`)과 달라 인식되지 않는다
- 합쳐 만든 모델 파일(`diffusion_models/openmoss/moss_image_sft_bf16.safetensors`)은 본체 로더로 그대로 읽힌다. 새로 설치한다면
  Comfy-Org 파일을 받는다
- 판을 다시 가져온 뒤에는 커스텀 노드와 합쳐 만든 텍스트 인코더·VAE(`moss_image_flux2_small_decoder`)를 지워도 된다
- 같은 시드로 커스텀 노드 판과 비교하면 구도·내용은 같고 세부만 조금 다르다. 텍스트 인코더는 픽셀까지 같았고, 차이는 모델
  계산(본체 구현과 커스텀 노드 구현)에서 난다

### 두 판

| | `Text to Image - MOSS-Image` | `Text to Image - MOSS-Image (빠름)` |
|---|---|---|
| 기준 | OpenMOSS 공식 권장값 | ComfyUI 공식 템플릿(`image_moss_image_t2i`) |
| 모델 · 인코더 | bf16 · bf16 (둘 다 고를 수 있음) | int8 · w4a8 (모델은 고를 수 있음) |
| 스텝 · CFG | 50 · 3 | 25 · 2.5 |
| 샘플러 | Euler + `sgm_uniform`, 시프트 5 | `er_sde` + `simple`, 시프트는 모델 기본값 5 |
| SLG (layer 22) | 켬, 전 구간 | 끔 (켜면 앞쪽 절반) |
| 부정 프롬프트 | 입력한 것만 | 템플릿 권장 문구 + 입력한 것 |
| 프롬프트 늘려 쓰기 | 없음 | 켬 (끌 수 있음) |
| 1024² 한 장 | 약 25초 | 약 9초 (늘려 쓰기를 끄면 약 7.5초) |

같은 시드라도 샘플러가 달라서 두 판의 구도는 다르다. 크기 목록과 업스케일 선택은 두 판이 같다.

### 기본 판의 기본값과 입력

- 기본값은 공식 권장값이다: 50스텝 · CFG 3 · 시프트 5 · SLG(layer 22, 전 구간) · Euler + `sgm_uniform`. 크기는 전부 16 의 배수
- 실측(RTX PRO 6000, 1024x1024, 3회 중앙값, 프롬프트 읽기 포함):

  | 베이스 모델 | 텍스트 인코더 | 스텝 | 시간 |
  |---|---|---|---|
  | bf16 | bf16 | 50 | **약 25초** |
  | int8 | bf16 | 50 | 약 14초 |
  | bf16 | w4a8 | 50 | 약 25초 |
  | bf16 | bf16 | 25 | 약 12초 |

- 25스텝은 같은 시드에서 구도가 거의 그대로이고 디테일만 줄었다. int8 모델과 w4a8 인코더는 그림이 조금 달라진다
- w4a8 텍스트 인코더는 ComfyUI 공식 템플릿의 기본값이다. 파일이 약 12GB 작아 메모리가 적은 GPU 에 맞는다. 이 서버(VRAM 96GB)에서는 속도 차이가 없었다
- CFG 를 쓰는 모델이라 **부정 프롬프트가 적용된다** (CFG 1 인 Qwen-Image 2.1 판과 다르다)
- 프롬프트는 약 4천 토큰까지 받는다. 약 3,700토큰 프롬프트의 마지막 문장에 적은 글씨까지 그려지는 것을 확인했다

### 빠른 판 (ComfyUI 공식 템플릿 설정)

- 템플릿의 샘플링 설정 · 권장 부정 프롬프트 · 프롬프트 늘려 쓰기를 그대로 옮겼다. 같은 시드에서, 템플릿 설정을 API 그래프로
  옮겨 ComfyUI 에서 직접 돌린 결과와 이 판의 결과가 픽셀까지 같았다 (늘려 쓰기 켬·끔 모두)
- **프롬프트 늘려 쓰기**: 프롬프트를 읽는 Qwen 이 먼저 프롬프트를 자세한 영어 장면 묘사로 늘려 쓰고, 그 글로 그린다. 시스템 프롬프트와
  설정은 템플릿 것이다 (템플릿은 OpenMOSS 의 프롬프트 개선 스킬을 바탕으로 썼다고 밝힌다). 인코더 파일을 같이 쓰므로 모델을 더 받지 않는다
  - 따옴표 안의 글씨는 원문 그대로 둔다. 한글 간판 문구 네 줄이 늘려 쓴 글에 그대로 남는 것을 확인했다
  - 늘려 쓰기의 시드는 템플릿처럼 0 으로 고정이다. 같은 프롬프트로 다시 돌리면 늘려 쓴 글과 그림이 픽셀까지 같았다. 다만
    ComfyUI 나 인코더 파일이 바뀌면 같은 프롬프트에서도 다른 글이 나올 수 있다
  - 늘려 쓴 글은 vcc 작업 기록에도, 이미지 파일의 PNG 정보에도 남지 않는다 (PNG 에는 원래 프롬프트와 늘려 쓰기 설정만 들어간다).
    ComfyUI 실행 기록의 "실제로 쓴 프롬프트" 노드 출력에서는 볼 수 있다 — ComfyUI 를 재시작하기 전까지
- 부정 프롬프트 칸을 비우면 템플릿 권장 문구(`nsfw, worst quality, bad anatomy, watermark, jpeg artifact`)만 들어가고,
  쓰면 그 뒤에 `, ` 로 이어 붙는다
- 실측(RTX PRO 6000, 1024x1024, 25스텝, 3회 중앙값, 프롬프트 읽기 포함): 늘려 쓰기를 끄면 약 7.5초, 켜면 약 9초.
  늘려 쓰기는 한 장에 약 2초다

## 갱신 규칙

- 워크플로나 필드를 고쳤으면 **작업판을 다시 내보내 이 디렉토리의 파일을 교체**한다. 그러지 않으면
  배포본과 실제 동작이 어긋난다
- `appVersion` 은 내보낸 시점의 앱 버전이다. `package.json` 의 version 에서 파생된다
- 새 작업판을 추가할 때는 이 README 의 목록과 요구 사항도 함께 갱신한다

## 관련 문서

- [COMFYUI_WORKFLOW_AUTHORING.md](../docs/COMFYUI_WORKFLOW_AUTHORING.md) — 워크플로를 직접 만들 때
- [AGENT_SKILL_INTEGRATION.md](../docs/AGENT_SKILL_INTEGRATION.md) — 모델 제작사 프롬프트 스킬을 어떻게 붙일지
- [COMFYUI_WORKFLOW.md](../docs/COMFYUI_WORKFLOW.md) — VCC 내부 처리 로직

## SaaS 작업판 (`openai/`)

ComfyUI 워크플로가 없는 provider 직결 작업판. `workflowData` 가 비어 있고 모델·크기·품질은 필드로만 정해진다.

| 파일 | 작업판 | 출력 | 필요한 것 |
|---|---|---|---|
| `openai/gpt-image.json` | GPT Image | 이미지 | OpenAI 서버(`serverType: OpenAI`) + API 키 |

**GPT-Image-2.5 (2026-09-08)** 대응 — 모델 노출은 `full`(작업판 화이트리스트 없음, 서버 모델 목록이 그대로 보인다).
크기는 권장 3종 + 2K/4K, 품질은 `low~max`. 커스텀 크기 규칙은 각 변 16의 배수 · 비율 1:3~3:1 · 한 변 ≤3840 ·
총 픽셀 655,360~8,294,400 이며 **2560x1440 초과는 OpenAI 문서상 experimental** 이다.
4K PNG 는 파일이 8MB 를 넘으므로 `output_format` 을 webp/jpeg 로 두는 편이 낫다 (실측 4K PNG 8.61MB vs 2K webp 2.58MB).
