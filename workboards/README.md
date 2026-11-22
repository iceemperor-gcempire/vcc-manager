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
| Sketch to Image - Krea2 · Krea 2 - T2I | `Krea2/` |
| LTX-2.5 - FL2V · FL2V (AV1) | `LTX-2/` |
| MiniMax H3 판 13개(FL2V·R2V·키프레임·긴 영상) · MiniMax-H3-Image 판 2개 · MiniMax Music 3 - T2M | `minimax/` |

H3 영상 판 13개는 모두 모델 선택 목록을 허용 목록으로 좁혀 두었다 (바로 아래 「H3 영상 판의 모델 허용 목록」).
MiniMax-H3-Image 판은 모델 선택 목록을 H3-Image 본체 하나로 좁혀 두었다 (허용 목록 — 아래 「MiniMax-H3-Image」).
Music 3 판은 폴더 제한만 있어 같은 `minimax/` 폴더의 H3 모델도 목록에 보인다. 다른 계열 모델은 나오지 않는다.

**H3 영상 판의 모델 허용 목록** (#1245) — 폴더 전체를 열면 다른 계열·병합본·이미지·음악 모델까지 선택지에 뜬다.
병합본을 터보·Pika LoRA 를 거는 판에서 고르면 가속이 두 번 걸려 화면에 줄무늬가 생기거나 소리가 망가진다.
그래서 판마다 그 판에서 맞게 도는 모델만 둔다. 규칙은 둘이다.

1. 가속 LoRA(터보·Pika)를 거는 판에는 가속이 들어 있지 않은 모델만 둔다. 가속이 든 모델(병합본·증류본)은 아무것도 더하지 않는 판에만 둔다
2. FL2V 계열 판에는 fl2va, R2V 계열 판에는 ref2va 를 둔다. 섞인 모델은 시험한 뒤에만 넣는다

| 판 | 허용 모델 (`diffusion_models/minimax/`) |
|---|---|
| FL2V (AV1)·(Pika Flex)·(Turbo), 키프레임 앵커 (Turbo), I2V 긴 영상·(Turbo) | `minimax_h3_fl2va_int8_convrot`·`_bf16`·`_pruned_w6a8` (Comfy-Org), `_pruned_nvfp4_all` (커뮤니티, ⁸) |
| R2V (AV1)·(Pika Flex)·(Turbo), R2V 긴 영상 (Turbo) | `minimax_h3_ref2va_int8_convrot`·`_pruned_w6a8` (Comfy-Org) |
| R2V (FastH3 Omni) | `fasth3_omniref_8step_pruned_int8_convrot` |
| R2V (PRISM), FL2V (PRISM) | 고정하지 않는다 — `minimax/` 폴더의 모델에서 직접 고른다 (아래 「8스텝 병합 모델용 판」) |

- 허용 목록은 **선택 목록**을 거른다. 실행할 때 막는 것은 폴더 제한뿐이라, API·MCP 로 목록 밖 모델 이름을 넘기면 지나간다
- 새 모델을 쓰려면 위 규칙에 맞는 판의 허용 목록에 넣는다 (작업판 편집기의 워크플로 설정 → 모델 노출 정책). 서버 파일 이름이 다르면 목록도 그 이름으로 바꾼다
- 이 저장소의 파일 이름은 영상 서버 기준이다. 목록에 있는 파일이 서버에 없으면 그 항목은 선택지에 나오지 않을 뿐이다

폴더를 다르게 쓰고 있다면 가져온 뒤 작업판 편집기의 워크플로 설정에서 **허용 모델 폴더**와 기본 모델을 바꾼다.
허용 모델 타입(Civitai 분류)으로 거르는 판(Anima·SDXL·Z-Image)은 Civitai 정보가 없는 파일이 목록에 나오지 않는다.

LoRA 도 같은 방식으로 **허용 LoRA 폴더**를 정할 수 있다 (#1099). 그 폴더의 LoRA 만 선택 목록에 나오고, 프롬프트 태그나
LoRA 선택 칸에 다른 폴더의 LoRA 를 넣으면 실행이 거절된다 (#1157). 다른 계열 LoRA 는 ComfyUI 가 오류 없이 무시해,
고른 LoRA 가 안 걸린 줄 모르고 지나가기 쉬워서다.

| 판 | 허용 LoRA 폴더 |
|---|---|
| Text to Image - MOSS-Image · MOSS-Image (빠름) | `style/openmoss/` |
| MiniMax H3 FL2V (Turbo) · FL2V (Pika Flex) · FL2V (PRISM) · FL2V (pi-H3) · 키프레임 앵커 (Turbo) | `style/Minimax/fl2va/` (아래 「스타일 LoRA」) |
| MiniMax H3 R2V (Turbo) · R2V (Pika Flex) · R2V (FastH3 Omni) · R2V (PRISM) · R2V (pi-H3) | `style/Minimax/ref2va/` |

LoRA 를 다른 폴더에 두었다면 작업판 편집기의 권한 / 노출에서 **허용 LoRA 폴더**를 바꾼다.

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
| `comfyui/minimax-h3-i2v-long-context.json` | MiniMax H3 - I2V 긴 영상 (Context Windows) | 영상 + 오디오 · **20~60초** (5초 창 이어 붙이기) · 첫 프레임 필수 · 구간 프롬프트 최대 4개 · 실험 판 | FL2V (AV1) 판과 같다 + ComfyUI **0.44 이상** (아래 「긴 영상 — I2V Context Windows 판」) |
| `comfyui/minimax-h3-i2v-long-context-turbo.json` | MiniMax H3 - I2V 긴 영상 (Context Windows · Turbo) | 〃 · **터보 LoRA 8스텝 가속** (1344x768 · 20초 약 6분) | 위 판 + Turbo LoRA⁴ (아래 「Turbo 판」) |
| `comfyui/minimax-h3-r2v-long-context-turbo.json` | MiniMax H3 - R2V 긴 영상 (Context Windows · Turbo) | 영상 + 오디오 · **20~60초** · 참조 이미지·영상·소리 (모든 창에 들어감) · 구간 프롬프트 최대 4개 · 터보 LoRA 8스텝 · 실험 판 | R2V (Turbo) 판과 같다 + ComfyUI **0.44 이상** (아래 「R2V 긴 영상 Turbo 판」) |

| `comfyui/sketch-to-image-sdxl.json` | Sketch to Image - SDXL | 이미지 ×2 (원본+업스케일) | SDXL 계열 ckpt + XL ControlNet + 업스케일 모델² |
| `comfyui/sketch-to-image-anima.json` | Sketch to Image - Anima | 〃 | Anima 모델 + **Comfy-Org/Anima-LLLite 패치**³ + 업스케일 모델² |
| `comfyui/sketch-to-image-qwen-image-21.json` | Sketch to Image - Qwen-Image 2.1 | 이미지 ×1 · 스케치(스크리블) 또는 사진(Canny) 구도로 생성 · 한글 글씨 | Qwen-Image 2.1 판과 같은 모델 + 공식 컨트롤넷 `model_patches/qwen_image_2.1_fun_controlnet_union_int8_convrot` ([🤗 Comfy-Org/Qwen-Image-2.1](https://huggingface.co/Comfy-Org/Qwen-Image-2.1/tree/main/model_patches)) — ComfyUI 0.38 이상. 1024² 약 9초, Turbo 8스텝 약 4초. 제어 강도 0.8~1.0 |
| `comfyui/sketch-to-image-krea2.json` | Sketch to Image - Krea2 | 〃 | Krea2 Turbo 모델 + qwen3vl_4b TE + 업스케일 모델². 기본 모델 `Krea2\krea2TurboOfficialComfy_krea2TurboInt8` 은 Civitai 배포본으로, [🤗 Comfy-Org/Krea-2](https://huggingface.co/Comfy-Org/Krea-2/tree/main/diffusion_models) 의 `krea2_turbo_int8_convrot` 과 같은 파일이다(SHA256 일치). 공식 이름으로 받았다면 판의 베이스 모델 기본값을 그 이름으로 바꾼다 (허용 모델 폴더 `Krea2/` 안이면 모델 선택 목록에 나온다) |
| `comfyui/text-to-image-krea2.json` | Krea 2 - T2I | 이미지 ×1 · **프롬프트만** | Krea 2 터보 int8 convrot (`Krea2/krea2TurboOfficialComfy_krea2TurboInt8` — 위 Sketch 판과 같은 파일) + `qwen3vl_4b_fp8_scaled` TE + `qwen/qwen_image_vae` VAE. ComfyUI 공식 템플릿 `image_krea2_turbo_t2i_int8` 을 옮겼다. 판 안의 프롬프트 보강(Qwen3-VL 4B 가 영어로 늘려 씀)은 「프롬프트 보강」 칸으로 켜고 끈다. 공식 템플릿은 기본 켬이지만 이 판은 **기본 꺼짐**이다 — 모델이 작아 요청과 다르게 늘려 쓰는 일이 잦았다. 늘려 쓰기는 실행 화면의 AI 프롬프트 생성을 권한다 (판의 작성 지침이 형식을 정한다). 템플릿의 LoRA 분기는 넣지 않았다 |
| `comfyui/text-to-image-anima.json` | Text to Image - Anima | 이미지 ×1 (업스케일본, 기본 AnimeSharp 2x) · **프롬프트만** · 애니메이션·일러스트 전용 · 긍정·부정 프롬프트 · 스텝·CFG·샘플러 선택 (기본 30 · 4 · er_sde, Turbo 모델은 8~12 · 1) | Anima 모델 (`Anima/anima_baseV10`) + `qwen_3_06b_base` TE + `qwen/qwen_image_vae` VAE (+ 업스케일 모델²) |
| `comfyui/text-to-image-z-image.json` | Text to Image - Z-Image | 이미지 ×1 (업스케일본) · **프롬프트만** | Z-Image 터보 (`Z-Image/z_image_turbo_bf16`) + `qwen_3_4b` TE + `Z-Image/ae` VAE + 업스케일 모델² |
| `comfyui/text-to-image-z-image-aio.json` | Text to Image - Z-Image (AIO) | 이미지 ×1 (업스케일본) · **프롬프트만** | Z-Image **AIO 체크포인트** (TE·VAE 일체, `checkpoints/Z-Image/…aio…`) + 업스케일 모델² |
| `comfyui/text-to-image-qwen-image-21.json` | Text to Image - Qwen-Image 2.1 | 이미지 ×1 · 긍정·부정 프롬프트 · 한글 글씨 | Qwen-Image 2.1 (`qwen\qwen_image_2.1_int8_convrot` — 모델은 `diffusion_models/qwen/` 에 둔다) + `qwen3vl_8b_int8_convrot` TE + `qwen_image_2.1_vae_bf16` (+ 업스케일 모델²). 선택 모델(같은 `qwen/` 폴더): **Turbo** `qwen_image_2.1_turbo_int8_convrot` (고르면 스텝 칸과 상관없이 공식 Turbo 템플릿의 8스텝 시그마로 돈다, 1024² 약 2초 — #1278. 공식 Turbo 파일 이름일 때만 자동으로 바뀌고, 이름이 다른 Turbo 병합본은 스텝을 8 로 직접 고른다) · **Uncensored** `qwen-image-2.1-UC-int8_convrot` ([abenzerps](https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-GGUF), 공식 모델 + 검열 해제 LoRA 병합, 설정은 기본과 같음) |
| `comfyui/text-to-image-moss-image.json` | Text to Image - MOSS-Image | 이미지 ×1 · 긍정·부정 프롬프트 · 중국어·영어 글씨 · 긴 프롬프트(약 4천 토큰) | ComfyUI **0.42 이상** + Comfy-Org 모델 3개 `openmoss/…` (아래 「MOSS-Image」) (+ 업스케일 모델²). 1024² 50스텝 약 25초 (int8 모델 약 14초). LoRA 는 LoRA 태그 로더 노드 + `loras/style/openmoss/` (아래 「MOSS-Image」 LoRA) |
| `comfyui/text-to-image-moss-image-fast.json` | Text to Image - MOSS-Image (빠름) | 이미지 ×1 · ComfyUI 공식 템플릿 설정 · **프롬프트 늘려 쓰기**(기본 켬) · 긍정·부정 프롬프트 | 위 판과 같은 폴더의 int8 모델 · w4a8 인코더 · VAE (아래 「MOSS-Image」) (+ 업스케일 모델²). 1024² 25스텝 약 9초 (늘려 쓰기를 끄면 약 7.5초). LoRA 는 위 판과 같다 |

| `comfyui/minimax-h3-fl2v-turbo.json` | MiniMax H3 - FL2V (Turbo) | 영상 + 오디오 · **4~8스텝 가속** · 코덱 선택 · 업스케일 옵션⁵ | H3 non-pruned 모델 + Turbo LoRA⁴ + VHS 노드팩 · ffmpeg¹ (+ 업스케일 모델²) |
| `comfyui/minimax-h3-keyframe-turbo.json` | MiniMax H3 - 키프레임 앵커 (Turbo) | 영상+오디오 · 키 이미지 1~3장을 시간축에 앵커 | FL2V Turbo 와 동일 (H3 int8 + 터보 LoRA) |
| `comfyui/minimax-h3-r2v-turbo.json` | MiniMax H3 - R2V (Turbo) | 〃 | H3 non-pruned 모델 + Turbo LoRA⁴ + VHS 노드팩 · ffmpeg¹ (+ 업스케일 모델²) |
| `comfyui/minimax-h3-fl2v-pika-flex.json` | MiniMax H3 - FL2V (Pika Flex) | 영상 + 오디오 · **6스텝** (Pika H3 Flex 공식 어댑터) · 코덱 선택 · 업스케일 옵션⁵ | H3 non-pruned 모델 + Pika Flex LoRA (아래 「Pika H3 Flex」) + VHS 노드팩 · ffmpeg¹ (+ 업스케일 모델²) |
| `comfyui/minimax-h3-fl2v-pi-h3.json` | MiniMax H3 - FL2V (pi-H3) | 영상 + 오디오 · 첫·끝 프레임 · **2~4스텝** (pi-H3 어댑터, 영상 VAE 디코드 없음) · 코덱 선택 · 업스케일 옵션⁵ | H3 **pruned** fl2va 모델 + `ComfyUI-piFlow` 노드 + pi-H3 DWD 어댑터 (+ Spark-H3 노드, 아래 「pi-H3」) + VHS 노드팩 · ffmpeg¹ (+ 업스케일 모델²) |
| `comfyui/minimax-h3-fl2v-prism.json` | MiniMax H3 - FL2V (PRISM) | 영상 + 오디오 · 첫·끝 프레임 · 8스텝 가속이 병합된 커뮤니티 모델용, **8스텝 · 시프트 12/3** (가속 LoRA 없음) · 샘플링 선택 (기본 lcm · simple) | 8스텝 가속이 병합된 H3 모델 (직접 준비, 아래 「8스텝 병합 모델용 판」) + H3 TE·VAE + VHS 노드팩 · ffmpeg¹ (+ 업스케일 모델²) |
| `comfyui/minimax-h3-r2v-pika-flex.json` | MiniMax H3 - R2V (Pika Flex) | 〃 | 〃 (ref2va 용 Pika Flex LoRA) |
| `comfyui/minimax-h3-r2v-pi-h3.json` | MiniMax H3 - R2V (pi-H3) | 영상+오디오 · 참조 이미지·영상·소리 · **2~4스텝** (pi-H3 어댑터, 영상 VAE 디코드 없음) · **프롬프트에 참조 태그 필요** | H3 **pruned** ref2va 모델 + `ComfyUI-piFlow` 노드 + pi-H3 DWD 어댑터 (+ Spark-H3 노드, 아래 「pi-H3」) + VHS 노드팩 · ffmpeg¹ (+ 업스케일 모델²) |
| `comfyui/minimax-h3-r2v-fasth3-omni.json` | MiniMax H3 - R2V (FastH3 Omni) | 영상+오디오 · 참조 이미지·영상·소리, 8스텝 (FastVideo 증류) · 5·10·15초 | `minimax/fasth3_omniref_8step_pruned_int8_convrot` ([🤗 FastVideo/FastH3-Omni-Comfy](https://huggingface.co/FastVideo/FastH3-Omni-Comfy), 22.2 GB) + H3 TE·VAE + VHS 노드팩 · ffmpeg¹ (+ 업스케일 모델²). ComfyUI **0.42 이상**. 1344x768 5초 약 68초 (참조 영상을 넣으면 크게 늘어난다) |
| `comfyui/minimax-h3-r2v-prism.json` | MiniMax H3 - R2V (PRISM) | 영상+오디오 · 참조 이미지·영상·소리 · 8스텝 가속이 병합된 커뮤니티 모델용, 가속 LoRA 없이 8스텝 · 샘플링 선택 (기본 euler · beta57) · **프롬프트에 참조 태그 필요** | 8스텝 가속이 병합된 H3 모델 (직접 준비, 아래 「8스텝 병합 모델용 판」) + H3 TE·VAE + VHS 노드팩 · ffmpeg¹ (+ 업스케일 모델²) |
| `comfyui/text-to-image-minimax-h3-image.json` | Text to Image - MiniMax-H3-Image | 이미지 ×1 · **MiniMax 공식 이미지 모델** · 4/8/16MP · 비율 8가지 · **AI 프롬프트 생성 권장** (판 안 늘려 쓰기는 기본 끔) | H3-Image 본체·VAE + H3 텍스트 인코더 + Qwen3.5 9B 보강 모델 (아래 「MiniMax-H3-Image」). **H3 영상 판과 같은 서버에 연결한다.** ComfyUI 0.45.0 이상. 4MP 약 7초 |
| `comfyui/image-edit-minimax-h3-image.json` | Image Edit - MiniMax-H3-Image | 이미지 ×1 · 고칠 이미지 + 참조 이미지 최대 3장(`<Picture 1>`~`<Picture 4>`) · 4/8/16MP · 프롬프트 늘려 쓰기(기본 켬) | 위 판과 같다. 4MP 약 21초 |

| `comfyui/video-upscale-ltx-iclora.json` | 영상 업스케일 (LTX IC-LoRA x2) | 영상 (원본 오디오 유지) · **재작화 2x 업스케일** | LTX-2.5 distilled + IC-LoRA 업스케일러⁶ + VHS 노드팩 · ffmpeg¹ |
| `comfyui/video-upscale-h3-upsampler.json` | 영상 업스케일 (H3 업샘플러 x2) | 영상 (원본 오디오 유지) · **정확히 2배, 세부를 다시 그려 선명하게** · 프롬프트 없음 | H3 fl2va int8 + H3 Video Upsampler 노드(0.7 이상) + Regen2K LoRA + latent 업스케일러 (아래 「H3 업샘플러」) + VHS 노드팩 · ffmpeg¹ |

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
Anima 판은 업스케일본 한 장만 저장한다 (#1253).

**기본 프롬프트 · 기본 부정 프롬프트** (#1262) — 아래 판은 새 작업을 열면 프롬프트·부정 프롬프트 칸에 값이 채워져 나온다.
워크플로가 몰래 붙이지 않으므로 보고 고치거나 지울 수 있다. API·MCP 는 프롬프트를 보낸 그대로 쓰고, 부정 프롬프트를 생략했을 때만 기본값을 쓴다.

| 판 | 기본 프롬프트 | 기본 부정 프롬프트 | 출처 |
|---|---|---|---|
| Text to Image - Anima · Sketch to Image - Anima | `masterpiece, best quality, score_7, safe,` | `worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration` | Anima 모델 카드 「Prompting」 절의 권장값 (Aesthetic 모델은 score 태그를 빼라고 권한다 — 칸에서 지우면 된다) |
| Sketch to Image - SDXL | `masterpiece, best quality,` | `worst quality, low quality, watermark` | 이 판이 워크플로에 넣어 두던 값 그대로 (SDXL 은 파인튜닝마다 권장값이 달라 고쳐 쓴다) |

Qwen-Image 2.1 · Krea 2 판은 비워 둔다 — CFG 1 로 돌아 부정 프롬프트가 계산에 들어가지 않는다 (ComfyUI 는 CFG 가 1 이면 부정 조건을 건너뛴다).
업스케일 모델은 `models/upscale_models/` 에 있어야 한다.

³ Anima 판은 `AnimaLLLiteApply`(core) 를 쓰며 **가중치 별도 설치 필요**:
https://huggingface.co/Comfy-Org/Anima-LLLite → `models/model_patches/`.
`anima-lllite-any-test-like-v2.safetensors`(혼합 — 선화·스크리블·그레이스케일)를 쓴다. 공식 템플릿과 같은 파일이다.
같은 저장소의 lineart/scribble/depth/pose 프리뷰판은 판 선택지에서 뺐다 — 공식 템플릿에 없고, 설치하지 않은 서버에서 고르면 실패했다.

⁴ **(Turbo) 판**은 lightx2v 증류 LoRA 로 20스텝을 4~8스텝으로 줄인다 (실측 3~5배).
LoRA 파일을 https://huggingface.co/lightx2v/Minimax-h3-Turbo 에서 받아 `models/loras/` 에 두고,
작업판의 터보 LoRA 경로가 실제 하위 경로와 일치하는지 확인할 것 (export 기본값은
`optimizer/minimax/` 하위). LoRA 의 base 가 full 모델이라 **베이스 기본값은 non-pruned int8**
(`minimax_h3_*_int8_convrot.safetensors`). pruned·NVFP4 베이스와의 조합도 동작한다 — 아래 ⁸ 참고. FL2V 판의 lightx2v 선택지는 **768p 학습 LoRA** 만 노출한다 (기본 1344x768 · 오디오 시프트 3, 비디오 시프트는 아래 「시프트 자동」):
FL2V (Turbo)·키프레임 앵커 (Turbo) 판: **8step v1.2 768p(기본)**=스텝 8, 8step v1.0 768p=스텝 8, 4step v1.1 768p=스텝 4.
긴 영상 (Turbo) 판은 8step v1.0(기본) · 4step v1.1 둘이다. 예전 8step v1.0(544p mixed) 은 같은 시드
A/B 에서 화질·구도 준수가 밀려 뺐다 — 저해상도 출력 자체가 디테일이 떨어져 쓰지 않는다.
FL2V·키프레임 판에는 커뮤니티 합본 **Pika Flex 합본 4step**(스텝 4)도 있다 (아래 「Pika H3 Flex」).
**8step v1.2 768p** 는 2026-11 공개본이다. 파일은 `minimax_h3_fl2v_turbo_8step_v1.2_768p_comfyui_bf16.safetensors` 다.
LightX2V 공식 8스텝 설정이 v1.2 로 바뀌면서 비디오 시프트도 6 → **12** 로 바뀌었다 (ModelTC/LightX2V#1706). 시프트 6 으로 돌리면
단색 배경의 색이 영상 중간에 바뀌고, 12 로 돌리면 사라진다. 빠른 동작 장면을 시드 3개로 v1.0·시프트 6 과 비교하면 v1.2·시프트 12 가
나은 것 2, 비슷한 것 1, 나쁜 것 0 이었고 배경색 안정성은 같았다 — 그래서 2026-11-20 부터 두 판의 기본값이다 (#1236).

**시프트 자동** (#1245) — FL2V (Turbo)·키프레임 앵커 (Turbo) 판의 비디오 시프트 칸 기본값은 「자동」이다. 고른 터보 LoRA 가
시프트 12 목록에 있으면 12, 아니면 6 을 쓴다. 목록은 지금 8step v1.2 하나다 (8step v1.0·4step v1.1·Pika 합본 4step 은 6).
그래프 안에서 `StringContains`(목록 대조) → `ComfyMathExpression`(`b if b > 0 else (12 if a else 6)`) → `MiniMaxH3SigmaShift` 로 정한다.
칸에서 6·12 를 직접 고르면 그 값으로 고정한다. 시프트 12 를 쓰는 LoRA 가 새로 나오면 노드 240 의 목록(`;파일;` 로 감쌈)에 그 선택지 값을 더한다.
R2V 판의 터보 LoRA 는 8step v1.0 768p 하나다 — 예전 4step v0.1 은 544p 혼합 비율 학습(시프트 12/3)이라 1344x768 과 맞지 않고, 빠른 동작 비교에서 가장 심하게 갈라져 뺐다 (#1127). R2V 판은
참조 이미지 해상도 기본값이 base 판과 달리 **match** (터보 증류 학습 조건).
**빠른 동작에는 약하다** (#1127, 2026-11 같은 시드 비교) — 휘두르기·회전 같은 장면에서 R2V 는 머리카락·옷 가장자리가
털처럼 갈라지고, FL2V 는 화면이 일렁이며 옷이 번진다. 시프트·Sol-Attn 을 바꾸거나 v1.1 LoRA·PDD 가속 LoRA 로 바꿔도
나아지지 않았다. 같은 장면에서 Pika Flex 판·R2V (FastH3 Omni)·LoRA 없는 (AV1) 판은 이렇게 깨지지 않았다
(모션 블러는 남는다). 세 Turbo 판 설명에 이 안내를 적었다.

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

R2V 의 참조 영상은 프레임(동작·구도·카메라)을 참조한다 (`VHS_LoadVideo` 필요). 영상의 소리는 "참조 영상 N의 소리도 참조"를
켰을 때만 함께 참조되며 **기본은 꺼짐**이다 — 영상을 넣을 때 소리까지 쓰는 경우가 드물고, 켜면 아래처럼 참조 오디오의
`<Audio N>` 번호가 밀린다.

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
근사 연산이라 끈 결과와 세부가 다르다 — 같은 시점 프레임 비교로 화질 차이는 보이지 않았다.
**토큰 보강(`extra_tokens`)은 0 으로 둔다** (#1248). ComfyUI 기본값 256 은 같은 시드로 다시 만들어도 생성할 때마다 세부가 달라진다 —
예산을 넘칠 때 남길 토큰을 원자 연산 순서로 고르는 comfy-kitchen 의 알려진 문제다
([comfy-kitchen 이슈 241](https://github.com/Comfy-Org/comfy-kitchen/issues/241), ComfyUI 0.46.0 · comfy-kitchen 0.2.41 에 수정 없음).
0 이면 다시 돌려도 비트 단위로 같다. FL2V (Pika Flex) 구성 두 장면에서 256 과 견줘 속도(55초 안팎)와 흐림 수치(`blurdetect`)가 같았고,
원본 크기 크롭으로도 차이가 보이지 않았다 (2026-11-23, 수치는 #1248). v4.25 까지의 판은 256 이었으므로 같은 시드라도 그때와 다른 결과가 나온다. 첫 실행은 커널 컴파일 때문에 느리다.

**SageAttention 이 없는 서버라면** ComfyUI 기동 인자 `--use-sage-attention` 없이도 같은 속도를 낼 수 있다 —
ComfyUI 0.38 의 *Model Attention Backend* 노드에서 `comfy kitchen attention`(INT8, Nvidia·AMD)을 고르면 된다.
실측(sol-attn 켬, 1344×768·5초): PyTorch 기본 157.3초 / SageAttention 136.1초 / INT8 135.9초.
작업판에는 넣지 않았다 — Sage 로 기동한 서버에서는 이득이 없고 결과만 미세하게 바뀌기 때문이다. 필요하면 워크플로의
UNETLoader 바로 뒤에 이 노드를 끼우면 된다.

> 예전에는 커스텀 노드 `ComfyUI-sol-attn`(`SolAttnPatch`)을 썼다 (끔/켬 1344×768 기준 1.13~1.21×).
> 정식 노드가 더 빠르고 결과도 가속 끈 쪽에 더 가까워 바꿨다. 상세 실측은 union-wiki `wiki/comfyui/h3-comfyui-038-attention-w6a8-bench`.

### H3 업샘플러 — 영상 업스케일 판과 R2V 판 선택지

**영상 업스케일 (H3 업샘플러 x2)** 판은 이미 만든 영상을 받아 **정확히 2배**로 키운다 (832×448 → 1664×896, 1344×768 → 2688×1536).
R2V 판(기본·터보·Pika Flex·PRISM·pi-H3)에는 같은 처리를 생성 직후에 붙이는 **업스케일 — H3 업샘플러** 선택지(없음 / 2배, 기본 없음)가 있다.

처리: 완성된 영상을 VAE 로 다시 latent 로 바꾸고 → H3 latent 업스케일러로 2배 → H3 모델이 Regen2K LoRA 로 세부를 다시 그린다
(3스텝) → 디코드. 작은 얼굴은 따로 확대해 한 번 더 그린다. 구도·움직임·소리는 원본 그대로이고, 얼굴 생김새는 조금 달라질 수 있다.

- **2배로 고정** — 노드는 면적(메가픽셀)만 받으므로 정식 노드 `GetImageSize` + `ComfyMathExpression` 으로 원본 크기 × 4 를 계산해 넣는다
- **다시 그리는 정도** — `denoise` 0.8 · `redraw_start` 0.6 (노드 기본값). `redraw_start` 를 0.8 로 올리면 더 선명하지만 얼굴이 더 달라진다
- **모델** — 업스케일 판은 `minimax_h3_fl2va_int8_convrot`, R2V 판은 그 판에서 고른 베이스 모델(가속·스타일 LoRA 를 걸기 전)로 다시 그린다.
  노드 안내는 fl2va pruned int8 을 권하지만, fl2va int8 · ref2va int8 · 8스텝 병합 모델에서도 같은 수준으로 나왔다 (아래 실측)
- **FL2V · 키프레임 판에는 없다** — 그 판의 결과는 영상 업스케일 판으로 따로 키운다
- **프롬프트 없음** — 글 조건 없이 그린다 (업스케일 판의 생성 화면에는 프롬프트 칸이 나오지 않는다)

필요한 것 (영상 ComfyUI, 0.38 이상):
- 커스텀 노드 [`ComfyUI-H3-Video-Upsampler`](https://github.com/sandpies/ComfyUI-H3-Video-Upsampler) **0.7 이상** (검증 `44db226` · 0.7.3, pip 의존성 없음).
  0.1 대의 옛 노드와는 입력이 달라 서로 바꿔 쓸 수 없다 — 노드를 올리면 판도 함께 갱신해야 한다
- LoRA `loras/open_h3_regenerate_2k_r256pp_bf16.safetensors` (3.8 GB) — [🤗 sandpies/ComfyUI-H3-Video-Upsampler](https://huggingface.co/sandpies/ComfyUI-H3-Video-Upsampler/tree/main/lora).
  **`loras` 폴더 바로 아래에 이 이름 그대로** 둔다 (노드의 얼굴 다시 그리기가 이 위치에서 직접 찾는다)
- latent 업스케일러 `latent_upscale_models/minimax_h3_latent_upscaler_3d_conv_v1_bf16.safetensors` — [🤗 LBH-123-AI](https://huggingface.co/LBH-123-AI/Minimax_h3_latent_Upscaler)
- `diffusion_models/minimax/minimax_h3_fl2va_int8_convrot.safetensors` (업스케일 판. FL2V 판과 같은 것)

실측 (RTX PRO 6000, 1344×768·5초 → 2688×1536, VCC 작업 시간, 각 1회):

| 경우 | 시간 | 흐림 (ffmpeg `blurdetect` 평균, 낮을수록 선명) |
|---|---|---|
| 업스케일 판 · 움직임 적은 실내 | 219초 | 9.03 (단순 확대 9.13 · 옛 방식 10.42) |
| 업스케일 판 · 움직임 많은 야시장 | 275초 | 8.89 (단순 확대 9.36 · 옛 방식 9.57) |
| 같은 영상 · ref2va int8 로 | 324초 | 8.92 |
| R2V (Pika Flex) · 생성 + 2배 | 389초 | — |
| R2V (PRISM) 3초 · 끔 / 2배 | 49초 / 203초 | 11.08 (단순 확대) / 9.73 |

연속 프레임 사이의 변화량은 단순 확대의 1.08배였고, 특정 프레임에서 튀는 곳은 없었다 (야시장 영상).
옛 방식(0.1 노드 + `h3upscale_v2_x2` LoRA, denoise 0.1)은 움직이는 구간에서 단순 확대보다 흐려져서 바꿨다 (#1176).
R2V 판에서 아래 **업스케일 (인코딩 전)** 픽셀 업스케일과 함께 켜면 두 번 커지니 하나만 쓴다.

### pi-H3 — 2~4스텝 FL2V · R2V 판

**MiniMax H3 - FL2V (pi-H3)** 판은 [`ComfyUI-piFlow`](https://github.com/Lakonik/ComfyUI-piFlow) 의 pi-H3 어댑터로 FL2V 를 2스텝 또는 4스텝에 만든다.
어댑터가 마지막 스텝에서 프레임을 바로 내놓아(DWD) 영상 VAE 디코드를 건너뛴다. 소리는 다른 판처럼 오디오 VAE 로 푼다.
구성은 piFlow 가 배포하는 `pi-H3-DWD-Spark-SM120` 워크플로를 따랐다 (euler · 시프트 12/3 · pi-Flow Scheduler).

- **샘플링 스텝** (기본 4) — 2스텝용과 4스텝용 어댑터가 따로 있다. 칸 하나가 어댑터 파일, 스케줄러 스텝, `max_raw_t`
  (4스텝 0.96 · 2스텝 0.93, piFlow 권장값), Spark-Attn 스텝을 함께 바꾼다
- **가속 — Spark-Attn** (기본 켬) — [Spark-H3](https://github.com/zechengtang/Spark-H3) 의 희소 어텐션. 이 노드는 GPU 구조마다 따로 나오고,
  판에는 RTX 50 시리즈 · RTX PRO Blackwell 용 `MiniMaxH3SparkAttentionSM120` 이 들어 있다. 노드가 없거나 GPU 가 다르면 칸을 끈다 — 노드를 빼고 돈다.
  RTX 30 · 40 시리즈용 노드(SM86 · SM89)는 시험하지 않았다 — piFlow 가 GPU 별로 배포하는 워크플로를 참고한다
- **ComfyUI 내장 Sol-Attn 은 넣지 않았다** — piFlow 문서가 pi-H3 영상을 눈에 띄게 떨어뜨린다고 적었고, 시험에서도 인물이 뭉개졌다
- **베이스 모델은 pruned 만** — 어댑터가 pruned 모델에 맞춰져 있다. non-pruned 모델(ref2va int8 로 확인)에 걸면 모양이 맞지 않아 실패한다
- **스타일 LoRA** 는 어댑터 앞에 건다. LoRA 하나로 걸리는 것만 확인했다 (같은 시드에서 결과가 달라짐)

필요한 것 (영상 ComfyUI, 0.45 이상):
- 커스텀 노드 [`ComfyUI-piFlow`](https://github.com/Lakonik/ComfyUI-piFlow) (검증 v1.4.2 `e0ca46f`, pip 의존성 없음)
- 어댑터 `loras/pi_h3_4step_dwd_adapter_int8_convrot.safetensors` · `loras/pi_h3_2step_dwd_adapter_int8_convrot.safetensors` —
  [🤗 Lakonik/pi-H3](https://huggingface.co/Lakonik/pi-H3). **`loras` 폴더 바로 아래에 이 이름 그대로** 둔다
- `diffusion_models/minimax/minimax_h3_fl2va_pruned_int8_convrot.safetensors` (기본) 또는 `minimax_h3_fl2va_pruned_w6a8.safetensors`
- (Spark-Attn 을 켤 때) Spark-H3 — 운영체제 · GPU 에 맞는 배포본을 받아 설치한다 (검증 v0.2.0 SM120).
  Spark-H3 는 ComfyUI 0.44 까지를 지원 범위로 적어 두었고, 여기서는 0.46.0 에서 돌렸다

실측 (RTX PRO 6000, 1344×768, 첫 프레임 1장, 모델이 올라온 뒤 ComfyUI 실행 시간):

| 구성 | 5초 | 10초 |
|---|---|---|
| pi-H3 4스텝 · Spark-Attn | 30.6초 (3회 중앙값) | 67.8 · 75.4초 |
| pi-H3 2스텝 · Spark-Attn | 18.4초 (3회 중앙값) | 38.9초 (1회) |
| pi-H3 2스텝 · Spark-Attn 끔 | 22.5초 (1회) | |
| FL2V (Pika Flex) 6스텝 · Sol-Attn 켬 | 53.2초 (3회 중앙값) | |

- 화질은 한 장면(비 오는 야시장을 달리는 인물)에서 본 것이다. 전체 구도 · 움직임은 FL2V (Pika Flex) 에 가깝다.
  빠르게 움직이는 작은 얼굴은 2스텝 · 4스텝 모두 무르거나 몇 프레임 일그러진 실행이 있었고(4스텝에서도 3프레임), Pika Flex 는 같은 구간에서 안정적이었다.
  `blurdetect` 평균은 Pika Flex 7.23 · 4스텝 7.45 · 2스텝 7.70 (낮을수록 선명)
- 판으로 돌려 본 것 (각 1회): 첫 프레임만 · 끝 프레임만 · 둘 다 · 프레임 없음, 2스텝, Spark-Attn 끔, 스타일 LoRA, 인코딩 전 업스케일(3초),
  768×1344 · 15초, pruned w6a8 베이스. 모두 지정한 크기 · 프레임 수로 나왔다
- 끝 프레임은 목표 이미지와 PSNR 29.3 dB (첫+끝) · 29.0 dB (끝만). 같은 프레임 · 같은 방법으로 잰 FL2V (Pika Flex) 는 31.3 dB
- 기본값(스텝 · 코덱 생략)으로도 만들어지고, 생성 화면에 칸과 허용 모델 2개가 나오는 것을 확인했다
- 소리는 트랙이 있고 음량이 정상 범위인 것만 확인했다. 내용을 듣고 평가하지는 않았다

**MiniMax H3 - R2V (pi-H3)** 판은 같은 DWD 어댑터를 REF2VA 베이스에 걸고 조건 노드만 R2V 용으로 바꾼 구성이다.
어댑터는 FL2VA 용으로 공개됐고 모델 카드는 REF2VA 를 말하지 않는다 — 돌려 보니 되는 구성이지 제작자가 안내한 쓰임은 아니다.

- 칸은 R2V (Pika Flex) 판과 같고(참조 이미지 3 · 영상 2 · 소리 2, H3 업샘플러, 스타일 LoRA), Sol-Attn 칸 대신 **샘플링 스텝** 과 **가속 — Spark-Attn** 이 있다
- **베이스 모델은 `minimax_h3_ref2va_pruned_w6a8`** — non-pruned `ref2va_int8_convrot` 는 어댑터 모양이 맞지 않아 로드에서 실패한다
- 판으로 돌려 본 것 (알파, RTX PRO 6000, 1344×768, 각 1회, VCC 작업 시간): 참조 이미지 1장 4스텝 49초 · 2스텝 32초 · Spark-Attn 끔 56초,
  이미지 2장 40초, 참조 영상 170초, 참조 영상 + 영상 소리 178초, 참조 오디오 41초, 10초 81초, 스타일 LoRA 49초, H3 업샘플러 2배(3초 영상) 186초.
  모두 지정한 크기 · 프레임 수로 나왔고 참조 인물이 유지됐다 (줄인 프레임 묶음으로 봄, 업샘플러와 연속 프레임은 원본 크기 크롭). 참조 영상을 넣으면 다른 R2V 판처럼 시간이 크게 는다
- 참조 오디오 시험에서는 프롬프트의 장소(빈 아케이드)가 반영되지 않고 참조 이미지의 장소가 그대로 나왔다 (1회)
- 소리 내용은 듣고 평가하지 않았다. 참조 영상의 동작을 얼마나 따르는지도 재지 않았다

### Pika H3 Flex — 6스텝 판 2개와 Turbo 판 합본 선택지

Pika Labs 의 [Pika H3 Flex](https://huggingface.co/Pika-Labs/Pika-H3-Flex) 는 H3 에 얹는 LoRA 어댑터로, 6스텝에 영상과 소리를 함께 만든다
(FL2VA·Ref2VA 두 가지). 두 방식으로 넣었다.

| | 어디에 | 파일 (`loras/optimizer/minimax/`) |
|---|---|---|
| **공식 어댑터** | **FL2V (Pika Flex)** · **R2V (Pika Flex)** 판 | `pika_h3_flex_fl2va_v1_bf16` · `pika_h3_flex_ref2va_v1_bf16` (각 1.96 GB) — [🤗 Comfy-Org/MiniMax-H3](https://huggingface.co/Comfy-Org/MiniMax-H3/tree/main/loras) |
| **커뮤니티 합본** | FL2V (Turbo) · 키프레임 앵커 (Turbo) 판의 터보 LoRA 선택지 "Pika Flex 합본 4step" | `pika_h3_flex_turbo_4step_fl2va` (3.91 GB) — [🤗 akhaliq/Pika-H3-Flex-Turbo-LoRA](https://huggingface.co/akhaliq/Pika-H3-Flex-Turbo-LoRA) |

**Pika Flex 판**은 ComfyUI 공식 템플릿(`video_pika_h3_flex_fl2va` / `_ref2va`)의 샘플링을 그대로 쓴다 — 고정 시그마 6단계
(`ManualSigmas`, Pika 의 계단 1000/750/500/250/100/40/0 에 시프트 12 를 건 값) + `lcm` 샘플러, LoRA 강도 1.0. 어댑터가 이 계단으로
학습돼 스텝·시프트는 고르지 않는다. 시프트 노드가 없어도 ComfyUI 가 H3 기본값(영상 12·오디오 3)을 쓰므로 Pika 설정과 같다
(ComfyUI 0.43.0 에서 확인). 템플릿과 다른 점은 베이스 모델(non-pruned `minimax_h3_*_int8_convrot`)·영상 VAE(fp16 — 템플릿은 int8)와
기본으로 켠 Sol-Attn 이다. 모델과 VAE 는 다른 H3 판과 같은 파일이다. 그래서 Sol-Attn 을 꺼도 템플릿과 같아지는 것은 샘플링까지다.

**합본 4step**은 공식 어댑터(강도 0.5)와 lightx2v 4step v1.2 768p 를 한 파일에 담은 것이다 (만든 쪽 설명으로는 랭크 이어붙이기라 두 LoRA 를
겹쳐 거는 것과 같은 계산). 기존 터보 설정(스텝 4 · euler · 시프트 6/3) 그대로 쓴다. 공식 배포본이 아니라 커뮤니티가 에이전트로 만든 저장소다.
R2V 용 합본도 있지만, 시험에서 참조 이미지에 없는 역광·배경 변화가 세 시드 모두 보여 아직 넣지 않았다.

실측 (RTX PRO 6000 · ComfyUI 0.43.0 · 1344×768·124프레임 · 같은 프롬프트 · 시드 3개 · ComfyUI 실행 시간 3회 중앙값):

| 구성 | FL2V | R2V |
|---|---|---|
| Turbo 기본 (8step · Sol-Attn 켬) | 58.4초 | 66.3초 |
| Turbo 4step (lightx2v) | 36.4초 | 41.6초 |
| Turbo + Pika 합본 4step | 36.4초 | 41.6초 (판에 넣지 않음) |
| **Pika Flex 판** (6스텝 · Sol-Attn 켬) | **48.7초** | **55.4초** |
| Pika Flex 판 · Sol-Attn 끔 (= 공식 템플릿 샘플링) | 59.5초 | 66.6초 |

- 합본 4step 은 같은 4스텝과 시간이 같고 카메라 회전·동작이 더 컸다 (연속 프레임 밝기 차이 평균 13.5 대 12.0)
- Pika Flex 판은 Turbo 기본값보다 약 10초 빠르다. 정지 화면으로 보면 FL2V 는 카메라·동작이 크고, R2V 는 카메라가 차분했다
- 끝의 대사 한 줄은 30개 중 29개에서 그대로 들렸고, 소리 크기(−12~−14 LUFS)는 구성 사이에 차이가 없었다
- 시작·끝 프레임, 키프레임 앵커 ①②③ 을 넣은 경우에도 합본 4step 이 lightx2v 4step 만큼 앵커를 지켰다 (앵커 위치 SSIM 0.97 · 0.93 · 0.97, 대조군과 같음)

### 8스텝 병합 모델용 판 — R2V (PRISM) · FL2V (PRISM)

8스텝 가속(터보·Pika 등)이 본체에 병합된 커뮤니티 모델을 돌리는 판이다. PRISM 계열 병합 모델로 시험해 만들었고, 같은 방식의 다른 병합 모델도 고를 수 있다.
이런 모델을 Turbo·Pika Flex 판에서 고르면 가속이 두 번 걸리고(소리 전 대역에 울림), 공식 판(20스텝)에서 고르면 스텝이 맞지 않는다 — 그래서 판을 따로 둔다.

- **모델을 고정하지 않는다.** 허용 모델 목록도 기본 모델도 비어 있고, `diffusion_models/minimax/` 의 모델에서 직접 고른다. 모델은 각자 준비한다.
  이 판에서 가속이 없는 모델(공식 H3 본체 등)을 고르면 LoRA 없이 8스텝으로 돌게 되므로 맞지 않는다. API·MCP 로 부를 때는 모델을 반드시 넘긴다
- **가속 LoRA 를 걸지 않는다.** 워크플로는 R2V (Turbo)·FL2V (Pika Flex) 판에서 가속 LoRA 노드를 뺀 구성이다 (스타일 LoRA 칸은 있다 — 아래 「스타일 LoRA」). 8스텝 · 시프트 12/3 고정
- **「샘플링」 칸** — 모델 배포처가 권하는 쪽을 고른다. 고르면 샘플러와 스케줄러가 함께 바뀐다

  | 선택 | 구성 | 쓰는 경우 |
  |---|---|---|
  | euler · beta57 (R2V 기본) | `euler` + `BetaSamplingScheduler` (alpha 0.5 · beta 0.7) | 터보만 병합된 모델 (배포처 권장 조합) |
  | lcm · simple (FL2V 기본) | `lcm` + `BasicScheduler` (simple) | Pika 가 섞인 병합 모델 (소리가 더 깨끗했다 — 아래 시험) |

  beta57 은 RES4LYF 커스텀 노드팩이 목록에 넣는 이름인데, 실체는 ComfyUI 기본 `beta` 스케줄러를 alpha 0.5·beta 0.7 로 부른 것이다 (기본값 0.6·0.6).
  판은 ComfyUI 기본 노드로 같은 시그마를 만든다 — 노드팩이 필요 없다. 두 구성의 전환도 기본 노드(`StringCompare`·`ComfySwitchNode`)다
- **R2V 는 프롬프트에서 참조를 태그로 불러야 한다.** 참조를 `<Picture 1>` 처럼 부르고 이어받을 특징을 글로도 적은 Ref2VA 형식에서는 참조를 지켰다.
  태그도 설명도 없는 기본 형식 프롬프트에서는 참조를 거의 따르지 않았다 (공식 모델은 지켰다). AI 프롬프트 생성은 이 형식으로 써 준다
- R2V 시험은 장면 1개(애니 화풍)·각 1회다. 속도는 3회 중앙값을 재지 않아 적지 않는다
- **FL2V (PRISM)** (#1242) — ref2va 계열에서 나온 병합 모델을 FL2V 로 돌리는 것은 원래 용도 밖이다. 그래서 시험한 뒤에 넣었다.
  장면 4개(끝 프레임 있음·없음·같음)를 시드 1개씩, 각 1회 돌렸다 (Pika 가 섞인 병합 모델)
  - 첫·끝 프레임은 FL2V (Pika Flex) 공식 구성과 비슷하게 지켰다 (끝 프레임 PSNR 39.1, 공식 40.7). 세부 묘사도 비슷하다.
    카메라가 일찍 뒤로 빠져 전신 구도가 되는 경향이 있고, "Static Shot" 같은 고정 지시를 덜 따랐다
  - **기본 샘플링은 소리로 골랐다.** 같은 시드로 네 구성을 비교했다 (장면 3개, 각 1회, 지표와 스펙트로그램 — 사람이 들은 판정은 아니다)

    | 구성 | 잡음 바닥 (장면 B · B-FL) | 장면 C 피크 · 저역 | 판정 |
    |---|---|---|---|
    | FL2V (Pika Flex) 공식 구성 (기준) | −94 · −94 dB | −1.4 dB · −41 dB | 효과음 사이가 진짜 무음 |
    | Pika 6스텝 고정 시그마 · lcm | −55 · −63 dB | **+1.9 dB (클리핑)** · −20 dB | 처음부터 낮은 험이 깔리고 저음이 부풀었다 |
    | euler · simple 8스텝 · 시프트 6/3 | −40 · −90 dB | −1.8 dB · −25 dB | 효과음에 음정 있는 울림이 층층이 쌓였다 |
    | er_sde · sgm_uniform 8스텝 · 시프트 12/3 | −60 · −94 dB | +0.1 dB · −27 dB | 험이 남았다 |
    | **lcm · simple 8스텝 · 시프트 12/3 (기본)** | **−94 · −94 dB** | −0.4 dB · −35 dB | 험이 없어졌다 |

    화면(원본 크롭·흐림 지표)과 첫·끝 프레임은 구성 사이에 뚜렷한 차이가 없었다
  - **남은 약점:** 기본 구성에서도 효과음 구간에 음정 있는 울림이 몇 줄 남고, 효과음 사이 무음이 공식 구성의 절반쯤이다. 소리가 중요하면 FL2V (Pika Flex) 판을 쓴다
- **R2V 에서 Pika 가 섞인 병합 모델은 lcm · simple 이 낫다** (#1247). Pika 6스텝 고정 시그마와 비교했다.
  참조 이미지 3장(새로 생성한 애니·실사·회화 그림)을 같은 시드로 공식 R2V (Pika Flex) · 계단 · lcm 8 세 구성에 각 1회 돌렸다
  - 대사 장면은 세 구성 모두 대사를 그대로 받아 적었다 (음성 인식). 고역은 lcm 8 이 공식과 같았다 (−42.6 · −64.4 dB, 공식 −42.2 · −64.4, 계단 −39.6 · −59.6)
  - 효과음 장면은 lcm 8 의 저역이 공식에 가까웠다 (−36.8 dB, 공식 −37.7, 계단 −28.0). 잡음 바닥 −71 dB (계단 −62, 공식 −87)
  - 바람이 계속 부는 장면은 lcm 8 이 조금 나빴다 — 더 크고 저역이 공식에서 더 멀었다 (RMS −19.7 dB, 계단 −21.3, 공식 −26.8 · 저역 −24.9, −27.3, −38.2)
  - 화면과 참조 유지는 셋 다 비슷했다
  - **같은 페이로드를 다시 돌려도 결과가 달라진다.** 바람 장면 lcm 8 을 그대로 한 번 더 돌리니 영상 PSNR 23.5 dB, 소리 지표는 대역별로 0.2~2.7 dB 움직였다
    (원인은 Sol-Attn 의 토큰 보강이다 — 위 「가속 — Sol-Attn」, #1248). 그래서 대사·바람 장면 차이는 크지 않다고 본다.
    효과음 장면의 저역·잡음 바닥 차이(9 dB)와 FL2V 의 잡음 바닥 차이(30~40 dB)·클리핑은 이 편차보다 훨씬 크다
- 라이선스: H3 파생 모델은 **MiniMax H3 커뮤니티 라이선스**로 다룬다. 병합 모델은 원본마다 조건이 더 붙을 수 있으니, 쓰기 전에 그 모델의 배포처 안내를 확인한다

### 스타일 LoRA — 판 11개의 선택 칸

FL2V (Turbo)·FL2V (Pika Flex)·FL2V (PRISM)·FL2V (pi-H3)·키프레임 앵커 (Turbo)·R2V (Turbo)·R2V (Pika Flex)·R2V (FastH3 Omni)·R2V (PRISM)·R2V (pi-H3)·R2V 긴 영상 (Turbo)
판에는 **스타일 LoRA** 와 **스타일 LoRA 강도** 칸이 있다. (AV1) 두 판에는 없다.

- **비워 두면 LoRA 노드를 건너뛴다** — 칸이 생기기 전과 같은 워크플로로 돈다. 강도 기본값은 1.0
- **LoRA 는 본체 계열별 폴더에 둔다.** H3 LoRA 는 FL2VA 본체용과 REF2VA 본체용이 따로 나온다 (같은 Civitai 버전에 파일 두 개가
  함께 올라오기도 한다). LoRA 종류나 파일 이름으로는 가를 수 없어 폴더로 가른다

  | 둘 곳 (`loras/`) | 쓰는 판 |
  |---|---|
  | `style/Minimax/fl2va/` | FL2V (Turbo) · FL2V (Pika Flex) · FL2V (PRISM) · FL2V (pi-H3) · 키프레임 앵커 (Turbo) |
  | `style/Minimax/ref2va/` | R2V 판 6개 (R2V 긴 영상 Turbo 포함) |

  파일을 넣은 뒤 관리자 화면의 서버 관리에서 **LoRA 동기화**를 해야 선택 목록에 나온다
- 걸리는 자리: 가속 LoRA(터보·Pika 합본)가 있는 판은 그 뒤, 없는 판(PRISM·FastH3)은 본체 바로 뒤다. 시그마 시프트보다 앞이다.
  R2V 판의 H3 업샘플러 단계에는 걸지 않는다 — 터보 LoRA 도 그 단계에는 걸지 않는다
- **스텝 12** — (Turbo) 판 셋(FL2V·키프레임 앵커·R2V)은 샘플링 스텝에 12 를 고를 수 있다 (기본 8, 터보 LoRA 는 8step 그대로).
  스타일 LoRA 를 걸었을 때 12 가 나은 경우가 있어 넣었다 — R2V (Turbo) 같은 시드 비교에서 머리카락·옷 선이 더 또렷했다.
  LoRA 마다 달라 **스타일 LoRA 를 골라도 스텝은 자동으로 바뀌지 않는다.** 스텝이 늘어난 만큼 오래 걸린다.
  가속이 든 본체 판(PRISM·FastH3 Omni)은 8 그대로다 — PRISM 에 12 를 주면 화면 전체에 격자 무늬가 생긴다 (#1161)
- 프롬프트에 `<lora:이름:가중치>` 태그를 적어도 H3 판에서는 걸리지 않는다. 이 판들의 워크플로에는 태그를 읽는 LoRA 태그 로더가 없고,
  그래서 생성 화면에 "LoRA 추가" 칸도 뜨지 않는다 (#1155). LoRA 는 이 선택 칸으로 건다

### 긴 영상 — I2V Context Windows 판 (실험)

`MiniMax H3 - I2V 긴 영상 (Context Windows)` 은 첫 프레임에서 시작하는 **20 · 30 · 45 · 60초** 영상을 만든다.
H3 가 한 번에 학습한 길이는 약 5~15초라, ComfyUI 정식 노드 `MiniMaxH3ContextWindows` (ComfyUI **0.44 이상**)로
124프레임(약 5초) 창을 39프레임씩 겹쳐 가며 이어 붙인다. 창 설정은 노드 기본값 그대로이고 판에서 바꾸지 않는다.
업스트림 노드 설명대로 학습 범위를 넘는 길이라 **실험 판**이다.

| 길이 | 프레임 | 창 수 (노드 기본값) |
|---|---|---|
| 20초 | 481 | 6 |
| 30초 | 719 | 8 |
| 45초 | 1076 | 13 |
| 60초 | 1450 | 17 |

- **첫 프레임은 필수다.** 첫 창에만 이미지로 고정되고, 나머지 창은 텍스트 인코더가 본 그림(프롬프트에 함께 들어간
  `<Picture 1>`)으로 인물·옷·장소를 이어 간다
- **구간 프롬프트** — 메인 프롬프트가 구간 1이고, "구간 2~4 프롬프트" 칸을 채우면 영상을 채운 수만큼 똑같이 나눠
  구간마다 그 프롬프트를 쓴다 (노드의 `split_conds_to_windows`, 창 중심이 속한 구간). 칸 수가 창 수와 같을 필요는 없다.
  비운 칸은 건너뛰고 그 구간의 조건화 노드는 요청에서 빠진다 (`_vcc.bypassUnless`)
- 창마다 프롬프트 전체를 다시 읽는다. 그래서 한 프롬프트에 사건을 시간 순서로 적으면 창마다 처음부터 다시 하려 한다.
  **한 동작이 이어지는 장면**(춤·걷기·연주·풍경)은 프롬프트 하나로 되고, 순서가 있는 장면은 구간 프롬프트로 나눈다.
  판의 AI 프롬프트 생성 지침도 이렇게 쓴다 (컷·시각 없이 `[Shot 1]` 하나)
- 나머지 칸(모델 · 크기 · 스텝 · Sol-Attn · 코덱)은 FL2V (AV1) 판과 같다. **업스케일 칸은 없다** (아래 「긴 영상 판에 업스케일이 없는 이유」)

실측 (RTX PRO 6000 Blackwell · ComfyUI 0.45.0 · 20스텝 · Sol-Attn 켬 · ComfyUI 실행 시간):

| 크기 · 길이 | 생성 시간 | 비고 |
|---|---|---|
| 1344×768 · 20초 (6창) | **808.0초** (약 13분 30초) | 3회 중앙값 (793.4 · 808.0 · 808.5초) |
| 1344×768 · 60초 (17창) | 2250.6초 (약 37분 30초) | 1회 — 끝까지 도는지 본 것이라 속도 수치로 쓰지 않는다 |

- 시간은 창 수에 거의 비례한다 (20초 808.0초 ÷ 6창 ≈ 135초, 60초 2250.6초 ÷ 17창 ≈ 132초). 창 하나가
  5초 영상 한 번(위 「가속 — Sol-Attn」 표의 136.0초)과 비슷하다 — 나눗셈으로 낸 계산값이다
- GPU 메모리는 장치 전체 사용량 최고점이 20초 84.9~85.2 GiB, 60초 86.0 GiB 였다. 길이가 세 배가 돼도
  약 1 GiB 만 늘었다. ComfyUI 가 잡아 둔 캐시까지 든 값이라 이 판에 꼭 필요한 양은 아니다.
  60초(1450프레임)도 타일 없는 VAE 디코드로 끝났다 (96 GiB GPU)
- 결과: 60초 끝까지 인물·옷·장소가 유지됐다. 머리 모양 같은 세부는 뒤쪽 창에서 조금 달라진다.
  소리는 5초마다 −13~−15 dB 로 고르게 이어졌다. 구간 프롬프트 2개로 돌린 시험(832×448 · 20초)에서는
  약 11초부터 구간 2 의 동작으로 넘어갔다

#### Turbo 판 — `MiniMax H3 - I2V 긴 영상 (Context Windows · Turbo)`

긴 영상 판에 FL2V (Turbo) 판의 가속을 얹은 **별도 판**이다. 모델은 UNET → 터보 LoRA → SigmaShift (6/3) → Sol-Attn →
Context Windows 순서로 지나고, 샘플러는 euler, 기본 8스텝이다. 구간 프롬프트 · 창 설정 · AI 프롬프트 생성 지침은 위 판과 같다.
터보 LoRA 선택지는 8step v1.0 (기본) · 4step v1.1 둘이다. FL2V (Turbo) 판에 있는 Pika Flex 합본은 아래 실측에서
8step 보다 느리고 움직임도 줄어 이 판에서는 뺐다.

실측 (위와 같은 장비 · ComfyUI 실행 시간):

| 크기 · 길이 | 터보 LoRA · 스텝 | 생성 시간 | 비고 |
|---|---|---|---|
| 1344×768 · 20초 | 8step v1.0 · 8 | **353.8초** (약 6분) | 3회 중앙값 (353.1 · 353.8 · 471.7초). 원본 판 808.0초의 약 44% |
| 832×448 · 20초 | 8step v1.0 · 8 | 98.8초 | 1회 |
| 〃 | 4step v1.1 · 4 | 66.0초 | 1회 · 움직임이 8step 의 절반 정도 |
| 〃 | Pika Flex 합본 4step · 4 | 129.6초 | 1회 · 움직임이 8step 의 절반 정도 (판에서 뺌) |

- 1344×768 첫 회(471.7초)만 느렸다. 앞선 작업과 터보 LoRA 가 달라 다시 올린 시간이 섞인 것으로 보이지만 확인하지는 않았다. 뒤의 두 번은 같은 판으로 연달아 돌렸다
- 결과: 모두 첫 프레임이 원본 그림과 같았고 20초 내내 인물 · 옷 · 장소가 유지됐다. 창 경계에서 프레임 간 변화량이
  튀지 않았다 (창이 끝나는 지점 근처 최대값 ÷ 전체 중앙값 0.5~1.6)
- GPU 메모리는 장치 전체 사용량 최고점이 1344×768 · 20초에서 59.4 GiB 였다

#### R2V 긴 영상 Turbo 판 — `MiniMax H3 - R2V 긴 영상 (Context Windows · Turbo)`

R2V (Turbo) 판에 Context Windows (노드 기본값 124/39)를 얹은 별도 판이다. 참조 이미지 · 영상 · 소리로 인물 · 장소 · 화풍 ·
목소리를 이어받아 20~60초를 만든다. 모델 경로는 R2V (Turbo) 판 그대로(터보 LoRA → 스타일 LoRA → SigmaShift 12/3 →
Sol-Attn)이고 그 뒤에 창을 붙였다.

- **참조는 모든 창에 들어간다.** ComfyUI 는 참조 latent 를 조건화에 실어 창마다 그대로 넘긴다. I2V 의 첫 프레임이 첫 창에만
  고정되는 것과 다르다. 대신 참조 토큰이 모든 창의 모든 스텝에 붙으므로, 참조 해상도 `max` 는 창 수만큼 더 느려진다
- **구간 프롬프트** — I2V 긴 영상 판과 같다. 구간마다 같은 참조로 R2V 조건화 노드를 하나씩 두고 묶는다. 비운 칸의 노드는
  요청에서 빠진다. 채운 구간마다 참조를 다시 인코딩하므로 참조 영상이 있으면 그만큼 시간이 는다
- 길이 · 크기 선택지와 AI 프롬프트 생성 규칙(`[Shot 1]` 하나, 컷 · 시각 없음, 끝나는 장면 없음)은 I2V 긴 영상 판과 같고,
  프롬프트 형식은 R2V 판의 여섯 섹션이다
- R2V (Turbo) 판의 업스케일 칸 둘(H3 업샘플러 · 인코딩 전 업스케일)은 뺐다 (아래)

실측 (위와 같은 장비 · ComfyUI 실행 시간 · 20초 · 6창, 참조 이미지 1장 · match):

| 크기 | 생성 시간 | 비고 |
|---|---|---|
| 832×448 | 132.8초 · 133.5초 | 시드 둘. 공용 서버라 앞에 다른 작업이 있었다 |
| 1344×768 | 395.3초 | 1회 |

- 셋 다 20초 내내 인물 · 옷 · 장소가 유지됐고 창 경계에서 프레임 간 변화량이 튀지 않았다
- 1344×768 한 번에서 약 7.5초에 카메라가 한 번 끊겨 다른 각도로 넘어갔다. 창 2 · 3 이 겹치는 구간 안이다.
  창을 이어 붙여서 생긴 것인지 모델이 넣은 컷인지는 1회로는 알 수 없다
- 장치 전체 GPU 메모리 최고점 56.3~59.3 GiB

#### 긴 영상 판에 업스케일이 없는 이유

다른 H3 판의 "업스케일 (인코딩 전)" 은 디코드한 프레임 전체를 한 번에 키우고, 2배 출력 전체를 float32 로 **시스템 RAM** 에
잡는다 (RAM ≈ 프레임 × 가로 × 세로 × 배율² × 12 B). 2026-08-31 영상 서버가 멈춘 사고가 이 경로였다.

| 길이 (1344×768) | 프레임 | 2배 업스케일 출력 |
|---|---|---|
| 20초 | 481 | 23.8 GB |
| 30초 | 719 | 35.6 GB |
| 45초 | 1076 | 53.3 GB |
| 60초 | 1450 | 71.8 GB |

판은 길이에 따라 칸을 막을 수 없어서 긴 영상 판 셋 모두에서 업스케일 칸을 뺐다. R2V 판의 H3 업샘플러도 프레임 전체를
다시 그리는 방식이라 함께 뺐다.

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

**배포 작업판에는 이 형식으로 써 주는 AI 프롬프트 생성 지침이 들어 있다** (작업판 편집기 → AI 프롬프트 생성 지침).
H3 판의 실행 화면에서 AI 프롬프트 생성을 열면 어느 텍스트 판을 고르든 그 지침이 함께 전달되므로, 사용자가 문법을
외울 필요가 없다. 프레임·참조는 입력란에 평범하게 적으면 된다:

- FL2V: "그림 1에서 시작해서 그림 2로 끝나는 10초 영상. 그림 1은 현관 앞에 선 남자, 그림 2는 소파에 앉은 남자"
- R2V: "그림 1의 여자가 영상 1처럼 춤춘다. 목소리는 오디오 1"
- 길이를 말하지 않으면 5초로 본다. 생성기는 첨부한 그림을 보지 못하므로, 그림에 무엇이 있는지는 적어 준 만큼만 반영된다

지침은 MiniMax 공식 스킬의 구조(필드 이름 · 섹션 순서 · 참조 라벨 · 정렬 문장)를 따라 판마다 **새로 쓴 요약**이다.
공식 원문은 이 저장소에 동봉하지 않는다 — 해당 문서가 MiniMax H3 Community License Agreement 아래 배포되고, 그
재배포 조항의 적용 지역에서 한국이 제외돼 있기 때문이다 (모델 사용과는 무관하며, 재배포에만 걸린다).
원문 전체를 함께 쓰고 싶으면 [MiniMax-AI/MiniMax-H3 · `skills/h3-prompt-writing`](https://github.com/MiniMax-AI/MiniMax-H3/tree/main/skills/h3-prompt-writing)
의 `SKILL.md` 와 `references/base-en.txt` · `references/ref-en.txt` 를 받아 관리자 → **프롬프트 가이드**에 등록하고,
프롬프트를 쓸 **텍스트** 작업판에 연결한다 (가이드는 프롬프트를 생성하는 텍스트 판 쪽에서 적용된다).

프롬프트를 직접 쓸 때도 아래는 같다 (ComfyUI `comfy_extras/nodes_minimax_h3.py` 기준):

| 항목 | 규칙 |
|---|---|
| 참조 번호 (R2V) | 종류마다 1부터, **채운 칸만** 순서대로. 참조 이미지 → `<Picture N>`, 참조 영상 → `<Video N>` |
| 소리 번호 (R2V) | 기본(영상 소리 끔)에서는 참조 오디오 1 = `<Audio 1>`. 영상 소리를 켜면 그 소리가 영상 순서대로 먼저 `<Audio N>` 을 받고, 참조 오디오가 그 뒤를 잇는다. 예: 참조 영상 1(소리 켬) + 참조 오디오 1 → 영상 소리 `<Audio 1>`, 참조 오디오 1 `<Audio 2>`. AI 프롬프트 생성을 쓸 때는 "영상 1의 소리도 사용"처럼 적어 준다 — 생성기는 판의 스위치 상태를 보지 못한다. 영상 소리와 참조 오디오를 함께 쓰면 작은 모델은 이 밀림을 자주 놓치므로, 큰 모델로 생성하거나 결과의 `<Audio N>` 을 확인한다 |
| 정렬 문장의 초 (FL2V) | 영상 길이 = 프레임 수 ÷ 24. 3초(73) 3.04 · 5초(124) 5.17 · 10초(243) 10.13 · 15초(362) 15.08 |
| 키프레임 앵커 판 | 앵커 이미지는 영상에 직접 고정될 뿐 텍스트 인코더에는 들어가지 않는다. `<Picture N>` 대신 앵커 시각의 화면 상태를 본문에 말로 쓴다 |

MiniMax 공식 API·SGLang·diffusers 는 영상에 소리가 있으면 자동으로 함께 쓰고, 참조를 **요청에 넣은 순서대로** 번호를
매긴다. ComfyUI 는 입력 칸이 종류별이라 이미지 → 영상(켠 소리가 먼저) → 참조 오디오 순서로 고정이다. 그쪽 도구에서
만든 R2V 프롬프트를 가져올 때는 영상 소리를 켜고 `<Audio N>` 이 같은 소리를 가리키는지 확인한다.

### MiniMax-H3-Image — 공식 이미지 판 2개 (영상 서버에 연결)

MiniMax 가 11-03 에 낸 공식 이미지 생성·편집 모델 [MiniMax-H3-Image](https://huggingface.co/MiniMaxAI/MiniMax-H3-Image) 의 판이다.
PrunaAI 의 커뮤니티 모델 P-H3-Image(H3 영상 본체에 LoRA 를 거는 방식 — 그 판 2개는 #1121 에서 들어왔다가 #1197 에서 퇴역)와
이름이 비슷하지만 **다른 모델이다.** MiniMax-H3-Image 는 H3 구조(오디오 층을 뺀 33.1B DiT)로 이미지만 따로 학습해 6스텝으로 증류한 본체와 전용 VAE 를 쓴다.
텍스트 인코더는 H3 영상 판과 같은 파일이다 (모델 카드). 워크플로는 ComfyUI 공식 템플릿(`image_minimax_h3_image_t2i` ·
`image_minimax_h3_image_edit`)을 그대로 옮겼다.

**H3 영상 판과 같은 ComfyUI 서버에 연결한다.** 이미지 서버와 영상 서버가 GPU 하나를 함께 쓰는 구성에서, 이미지 서버에 붙이면
두 프로세스가 텍스트 인코더(15.7 GB)와 본체를 따로 올려 VRAM 을 넘길 수 있다. 영상 서버 한 곳이면 ComfyUI 가 본체를 갈아 끼우고
텍스트 인코더는 같이 쓴다.

필요한 파일 ([🤗 Comfy-Org/MiniMax-H3-Image](https://huggingface.co/Comfy-Org/MiniMax-H3-Image)):

```
models/
├── diffusion_models/minimax/minimax_h3_image_pruned_int8_convrot.safetensors   (21.0 GB)  ← 새로
├── vae/minimax/minimax_h3_image_vae_fp16.safetensors                           (1.2 GB)   ← 새로
├── text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors                  (15.7 GB)  H3 영상 판과 같은 파일
└── text_encoders/openmoss/qwen3.5_9b_w4a8_gptq.safetensors                     (7.3 GB)   MOSS-Image 판과 같은 파일 (프롬프트 보강)
```

- 공식 템플릿은 텍스트 인코더로 `qwen3vl_32b_minimax_h3_int8_convrot` (27.1 GB)를 쓴다. 이 판은 H3 영상 판이 쓰는 nvfp4 판을 쓴다
- 노드는 전부 ComfyUI 기본 노드다 (`MiniMaxH3ImageConditioning` · `TextGenerateV2` · `JsonExtractString` · `ResolutionSelector` 등, **0.45.0 이상**)

| | Text to Image - MiniMax-H3-Image | Image Edit - MiniMax-H3-Image |
|---|---|---|
| 입력 | 프롬프트 · 비율 8가지 · 4/8/16MP | 고칠 이미지(필수) + 참조 이미지 최대 3장 · 결과 4/8/16MP |
| 기본 크기 | 4MP — 1:1 이면 2048×2048 | 4MP, 고칠 이미지의 비율 그대로 |

- 샘플링은 공식 템플릿 그대로다 — KSampler 6스텝 · CFG 1 · euler · simple, 부정 조건은 긍정 조건을 비운 것(부정 프롬프트 없음)
- **화소 수** — 모델 카드는 4~20MP 를 쓸 수 있는 범위로, 16MP 근처를 가장 좋은 크기로 든다. 공식 템플릿의 기본값 4MP 를 기본으로 두었다.
  16MP 는 세부가 더 살지만 PNG 한 장이 22~26 MB 다 (4MP 는 약 8 MB)
- **AI 프롬프트 생성 권장 (T2I, #1207)** — T2I 판의 「AI 프롬프트 작성 지침」에 MiniMax 공식 T2I 보강 지시문(`MiniMaxAI/MiniMax-H3-Image-PE`)을
  넣었다. 비율 고르기 절과 JSON 출력은 빼고 "캡션 한 문단만, 캔버스 비율은 도구가 정하며 말이 없으면 1:1" 규칙을 붙였다.
  AI 프롬프트 생성에서 텍스트 판(Qwen3.8 Flash Next 권장)을 골라 캡션을 받고, 판 안 늘려 쓰기는 끈 채 생성한다.
  같은 요청 8개 비교에서 판 안 9B 는 4개에서 요청에 없는 것을 넣거나 바꿨고(흑백 선화 고양이, 우동 → Ramen, 안경 누락, 청재킷),
  Flash Next 는 모두 요청을 지켰다. 캡션은 중앙값 8.2초. 늘려 쓴 글이 화면과 작업 기록에 남는다
  - 공식 지시문을 비율 절까지 그대로 넣으면 8개 중 2개 캡션이 "vertical composition" 으로 쓰였다 — 그래서 뺐다
- **프롬프트 늘려 쓰기**(판 안 보강, T2I 기본 끔 · 편집 기본 켬) — 공식 템플릿의 보강 지시문으로 Qwen3.5 9B 가 요청을 영어 캡션(JSON 의 `expanded_caption`)으로
  늘려 쓴다. 한국어 요청도 된다. 시드가 바뀌면 늘려 쓴 글도 달라진다. 끄면 요청을 그대로 쓴다. 공식 템플릿과 다르게 둔 것 셋 (#1204):
  - **생각(thinking) 단계를 끈다.** 템플릿대로 켜 두면 4번에 1번꼴로 생각만 되풀이하다 출력 한도(8192 토큰)를 다 쓰고 빈 글을 냈고,
    그러면 그림 모델에 빈 프롬프트가 들어가 요청과 상관없는 그림이 나왔다 (같은 시드의 빈 프롬프트 결과와 픽셀까지 같았다).
    끄면 시드 8개 모두 캡션을 냈고 한 번에 약 3초다 (켰을 때 18~34초)
  - **늘려 쓴 글을 얻지 못하면 요청을 그대로 쓴다** (꺼낸 캡션이 비었는지 보고 고른다)
  - **고른 비율을 보강에 넘긴다.** 보강 지시문은 캡션과 함께 비율도 스스로 고르는데, 템플릿은 사용자가 고른 비율을 넘기지 않아
    캔버스는 1:1 인데 캡션은 세로 구도로 쓰이곤 했다. T2I 는 고른 비율을 "Final output canvas aspect ratio", 편집은 결과 크기의
    가로:세로를 "User Aspect Ratio Selection" 으로 요청 뒤에 붙인다. 보강이 고른 비율은 쓰지 않고 캔버스는 판의 칸이 정한다
- **편집 판의 그림 번호** — 고칠 이미지가 `<Picture 1>`, 참조 이미지 1~3 이 `<Picture 2>`~`<Picture 4>` 다. 모델은 넣은 이미지를
  놓인 순서대로 번호를 매기므로 참조는 **1번 칸부터 차례로** 채운다. 앞 칸이 비면 그 뒤 칸은 쓰지 않는다 (참조 1·3 만 넣으면 3은 빠진다).
  채운 칸만 순서대로 번호를 매기는 R2V 판과 다르다
- 모델 선택 목록은 H3-Image 본체 하나로 좁혀 두었다

실측 (RTX PRO 6000 · ComfyUI 0.45.0 · ComfyUI 실행 시간):

| 구성 | 시간 | 비고 |
|---|---|---|
| T2I 4MP · 늘려 쓰기 켬 | **6.8초** | 3회 중앙값 (6.7 · 6.8 · 7.2) |
| T2I 16MP · 늘려 쓰기 켬 | **22.2초** | 3회 중앙값 (22.0 · 22.2 · 22.6) |
| T2I 4MP · 늘려 쓰기 끔 | 4.7초 | 1회 |
| T2I 16MP · 늘려 쓰기 끔 | 20.0초 | 1회 |
| 편집 4MP · 늘려 쓰기 켬 | **21.0초** | 3회 중앙값 (20.9 · 21.0 · 21.0) |
| 편집 4MP · 참조 1장 · 늘려 쓰기 켬 | 32.8초 | 1회 |
| 편집 4MP · 늘려 쓰기 끔 | 14.0초 | 1회 |

- 처음 판(#1201, 보강의 생각 단계 켬)은 T2I 4MP 25.1초 · 16MP 35.2초 · 편집 38.9초였다 (각 3회 중앙값)
- 편집 판의 보강은 그림을 함께 읽어 T2I 보다 오래 걸린다 (약 7초)
- 같은 요청·시드를 그대로 다시 보내면 ComfyUI 가 앞 결과를 그대로 돌려준다 (0초). 위 측정은 매번 시드를 바꿨다
- 장치 전체 GPU 메모리 최고점은 16MP 에서 46.6 GiB 였다
- 결과: 수채화 그림책 · 사진풍 요청 모두 깨끗하게 나왔다. 편집은 인물의 얼굴·옷·자세를 유지한 채 배경을 바꾸고, 참조 이미지의
  대상(다른 화풍의 그림)을 옮겨 왔다. 사진풍 서울 골목 시험에서 간판의 한글은 실제 글자가 아닌 모양만 비슷한 글자로 나왔다

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

### LoRA

- 두 판 모두 LoRA 태그 로더(`LoraTagLoader`, [badjeff/comfyui_lora_tag_loader](https://github.com/badjeff/comfyui_lora_tag_loader))를 쓴다.
  생성 화면의 LoRA 선택에서 고르면 프롬프트에 `<lora:이름:가중치>` 가 들어가고, 이 노드가 그 태그를 읽어 LoRA 를 건 뒤 프롬프트에서 태그를 지운다
- 허용 LoRA 폴더는 `style/openmoss/` 다. LoRA 목록에는 이 폴더의 LoRA 만 나오고, 다른 LoRA 태그로는 실행이 거절된다
- 첫 LoRA 는 애니 화풍 [🤗 axiomofmind/Moss-image-anime-lora](https://huggingface.co/axiomofmind/Moss-image-anime-lora) 의
  **ComfyUI 변환본**이다 (Apache-2.0, 71 MiB). 같은 저장소의 `pytorch_lora_weights.safetensors`(Diffusers 형식)는 ComfyUI 에서 읽히지 않는다

  ```
  models/loras/style/openmoss/MOSS-Image-Anime-LoRA-ComfyUI.safetensors
  ```

- **파일 이름을 바꾸지 않는다.** 태그 로더는 파일 이름의 앞부분으로 찾는다. 다른 LoRA 파일 이름의 앞부분과 겹치면 엉뚱한 파일이 걸린다
- 파일을 둔 뒤 관리자 서버 관리에서 **LoRA 동기화**를 돌려야 목록에 나온다
- 모델 카드 권장값은 가중치 1.0, 50스텝 · CFG 3(기본 판의 기본값)이다. 트리거 단어 `moss_seinen_style` 는 넣지 않아도 된다
- 텍스트 인코더에는 LoRA 를 걸지 않는다 (이 LoRA 파일에는 인코더 키가 없다). 빠름 판은 태그를 뺀 프롬프트로 늘려 쓰기를 한다
- 실측 (RTX PRO 6000, 1024x1024):
  - 태그를 넣지 않으면 LoRA 를 넣기 전의 판과 픽셀까지 같다 (두 판 · bf16·int8 모델 · 늘려 쓰기 켬·끔)
  - 효과는 장면에 따라 다르다. 인물은 일러스트 쪽으로 분명히 바뀌고, 풍경·실내는 은은하다. bf16·int8 모델 모두 비슷하게 걸리고, 빠름 판에서도 걸린다
  - 가중치 0 은 bf16 모델에서 LoRA 없음과 픽셀이 같다. int8 모델에서는 같지 않다 — ComfyUI 가 int8 가중치에 LoRA 를 더한 뒤
    다시 int8 로 반올림하기 때문으로 본다 (ComfyUI 소스 기준 추정). LoRA 를 끄려면 가중치를 0 으로 두지 말고 태그를 지운다
  - 빠름 판의 늘려 쓰기가 "A photorealistic …" 처럼 화풍 문구를 넣을 때가 있다 (장면 4개 중 2개). 이때는 LoRA 의 화풍과 부딪혀
    효과가 약해지는 것으로 보인다 (추정 — 따로 갈라 재지는 않았다). 화풍을 분명히 하려면 프롬프트에 화풍을 적거나 늘려 쓰기를 끈다. 태그는 늘려 쓰기 전에 빠진다 (늘려 쓴 글 12건에 태그 없음)
  - 속도 (3회 중앙값, 한 번 데운 뒤, 매번 다른 프롬프트, vcc 작업 시간): LoRA 를 걸면 한 장에 약 1~2초 늘어난다

    | 판 · 구성 | LoRA 없음 | LoRA 있음 |
    |---|---|---|
    | 기본 판 · bf16 | 24.7초 | 26.5초 |
    | 기본 판 · int8 | 14.2초 | 15.3초 |
    | 빠름 판 · 늘려 쓰기 켬 | 9.9초 | 10.9초 |
    | 빠름 판 · 늘려 쓰기 끔 | 7.9초 | 8.7초 |

## 갱신 규칙

- 워크플로나 필드를 고쳤으면 **작업판을 다시 내보내 이 디렉토리의 파일을 교체**한다. 그러지 않으면
  배포본과 실제 동작이 어긋난다
- `appVersion` 은 내보낸 시점의 앱 버전이다. `package.json` 의 version 에서 파생된다
- 새 작업판을 추가할 때는 이 README 의 목록과 요구 사항도 함께 갱신한다
- 작업판을 새로 만들거나 워크플로·설정값을 고칠 때는 그 이슈에 **`## 설계 근거` 표**를 남긴다
  - 설정마다 기준: 공식 템플릿(저장소·커밋), 모델 카드·체크포인트 메타데이터(링크), 기존 판
  - 기준과 다르게 둔 값과 그 이유. 이유가 없으면 "근거 없음"이라고 적는다
  - 측정한 것과 추정한 것을 나눈다. 속도는 3회 이상 중앙값만 쓴다
  - 판 파일(JSON)에는 메모를 넣을 수 없다(동기화 diff). 그래서 이슈가 기록 자리다

## 관련 문서

- [COMFYUI_WORKFLOW_AUTHORING.md](../docs/COMFYUI_WORKFLOW_AUTHORING.md) — 워크플로를 직접 만들 때
- [AGENT_SKILL_INTEGRATION.md](../docs/AGENT_SKILL_INTEGRATION.md) — 모델 제작사 프롬프트 스킬을 어떻게 붙일지
- [COMFYUI_WORKFLOW.md](../docs/COMFYUI_WORKFLOW.md) — VCC 내부 처리 로직

## SaaS 작업판 (`openai/`)

ComfyUI 워크플로가 없는 provider 직결 작업판. `workflowData` 가 비어 있고 모델·크기·품질은 필드로만 정해진다.
관리자 "새 작업판" 화면의 OpenAI 이미지 시작 양식 셋은 이 판 파일에서 만든 사본이다 — 판 파일을 고치면 `node scripts/sync-workboard-templates.js` 로 다시 만든다 (#1142).

| 파일 | 작업판 | 출력 | 필요한 것 |
|---|---|---|---|
| `openai/gpt-image.json` | GPT Image | 이미지 | OpenAI 서버(`serverType: OpenAI`) + API 키 |
| `openai/gpt-image-2.6.json` | GPT Image 2.6 | 이미지 · SVG 벡터 | 〃 |
| `openai/gpt-image-2.6-gif.json` | GPT Image 2.6 GIF | GIF 애니메이션 | 〃 + OpenAI 계정의 GIF 미리보기 권한 |

**GPT-Image-2.5 (2026-09-08)** 대응 — 모델 노출은 **노출 목록**(`gpt-image-2.5-flare` 기본 · `2.5-sunburst` · `2` · `1.5` · `1-mini`, #1136).
OpenAI 모델은 파일이 아니라 ComfyUI 판처럼 폴더로 거를 수 없어서 노출 목록으로 막는다. 예전 `full` 에서는 영상 모델(`sora-2`)·종료된 `gpt-image-1`·
가리키는 모델이 바뀌는 `chatgpt-image-latest`·날짜 스냅샷까지 선택 목록에 보였다. 2.6 은 아래 별도 판이다.
OpenAI 서버의 모델 목록은 관리자 **모델 동기화**로만 새로 고쳐진다 — 새 모델이 선택 목록에 안 보이면 서버 관리에서 동기화한다.
크기는 권장 3종 + 2K/4K, 품질은 `low~max`. 커스텀 크기 규칙은 각 변 16의 배수 · 비율 1:3~3:1 · 한 변 ≤3840 ·
총 픽셀 655,360~8,294,400 이며 **2560x1440 초과는 OpenAI 문서상 experimental** 이다.
4K PNG 는 파일이 8MB 를 넘으므로 `output_format` 을 webp/jpeg 로 두는 편이 낫다 (실측 4K PNG 8.61MB vs 2K webp 2.58MB).

**GPT-Image-2.6 (2026-10-28)** 은 별도 판 둘이다 — 정지 이미지·SVG 는 `GPT Image 2.6`, GIF 는 `GPT Image 2.6 GIF` (#1132, #1142).
모델 노출은 둘 다 화이트리스트(`gpt-image-2.6-flare` 기본 · `gpt-image-2.6-sunburst`). 2.6 에서 생긴 것:
- **복잡도** `complexity` (low/medium/high) — 그리기 전 계획량. 판 기본값은 OpenAI 기본값과 같은 high (웹 화면의 선택 칸은 비울 수 없어서 기본값을 명시했다). 값이 있을 때만 요청에 넣어 GPT Image 판의 요청은 예전 그대로다
- **GIF** — `GPT Image 2.6 GIF` 판 (`frame_count` 2~16 기본 9, `frame_duration_ms` 20~ 기본 200). 크기는 **프레임 한 장의 크기**이고, OpenAI 는 프레임을 정해진 칸 배치의 시트 한 장에 그린다 (2~8장 4×2·2×4, 9장 3×3, 10~12장 3×4·4×3·4×4, 13~16장 4×4). 시트가 일반 크기 규칙(한 변 ≤3840 · ≤8,294,400px)을 지켜야 해서 **정지 이미지 크기(1024² 이상)는 GIF 에서 전부 거절**된다 (실측 2026-11-07, #1132). 그래서 판을 나누고 크기 선택지를 **프레임 수와 상관없이 늘 들어가는 크기**(가로·세로 ≤960 · 넓이 ≤518,400px)만 두었다: 512x512(기본) · 720x720 · 944x528 · 528x944 · 자동. 720x720·944x528 은 16장으로 실제 생성 확인, 528x944 는 배치가 대칭이라 같다고 본다(추정), 자동은 9장에서 512x512 를 골랐다. 배경·압축률 칸은 없다 (GIF 투명 배경은 미확인, 압축률은 API 가 거절)
- **SVG** — 한 장만(n=1), 압축률 무시. 래스터 참조를 그린 뒤 텍스트 모델이 벡터를 쓴다. 계정에 **작성 모델 선택이 켜져 있으면 `svg.model` 이 필수**라 판에 "SVG 작성 모델" 필드를 두었다 (기본 `gpt-6.1-sol`, 선택 `gpt-5.4-mini` — 같은 프롬프트 1회 비교에서 mini 는 선이 겹치고 어긋났다). 꺼진 계정은 비운다. 응답의 `svg_usage`(작성 모델 토큰)는 단가를 몰라 **비용 추정을 내지 않고** 토큰 수만 남긴다. SVG 파일은 `/api/files` 가 스크립트를 막는 `Content-Security-Policy … sandbox` 헤더로 내보낸다

나눈 까닭: 2.5 이하는 복잡도·GIF·SVG 를 모두 거절하고(실측 2026-11-07 — 새 파라미터가 생긴 경계는 2.6 하나다), OpenAI 판에는 모델이나 출력 포맷에 따라 필드·선택지를 숨기는 장치가 없다. GIF 는 크기의 뜻(프레임 한 장)과 들어가는 크기가 정지 이미지와 달라서 2.6 안에서도 판을 나눴다.
API·MCP 로 부를 때 빠뜨린 칸은 판의 기본값으로 채운다 (#1142 — 예전에는 GIF 판도 출력 포맷이 빠지면 png 로 갔다).
품질 `xhigh` 는 2.6-flare 에서 실제로 된다 (API 레퍼런스는 2.5 전용이라고 적지만 가이드가 맞았다, 실호출 2026-11-07). `max` 는 시험하지 않았다.
같은 1024² · low 에서 출력 토큰은 2.6-flare(복잡도 low) 824 대 2.5-flare 196 — **2.6 은 같은 설정에서 비용이 약 4배**다 (각 1회).
