# vcc-nodes — VCC Manager 용 ComfyUI 커스텀 노드

vcc-manager 작업판 워크플로우에서 쓰는 보조 노드 모음 (#758).

## 설치 (ComfyUI 서버에서)

```bash
# ComfyUI 루트에서
cp -r /path/to/vcc-manager/comfyui-nodes/vcc-nodes custom_nodes/vcc-nodes
# ComfyUI 재시작
```

의존성: 추가 설치 불필요 (torch/numpy/PIL 은 ComfyUI 기본 동봉).

## VCC Optional Image

**이미지 미첨부를 허용하는 LoadImage 대체 노드.** 기존 LoadImage 는 파일 미지정 시
제출 검증에서 실패하지만, 이 노드는 미첨부여도 오류 없이 흰색 이미지를 반환한다.

| 입력 | 값 | 설명 |
|---|---|---|
| `image` | `{{##필드명##}}` | vcc 가 업로드된 ComfyUI 파일명으로 치환 (미첨부 시 흰 PNG 파일명) |
| `attached` | `{{##필드명_attached##}}` | vcc 가 첨부 여부를 1/0 으로 치환 |
| `blank_width/height` | 숫자 | 미첨부 시 반환할 흰 이미지 크기 (기본 1024) |

| 출력 | 설명 |
|---|---|
| `IMAGE` / `MASK` | LoadImage 와 동일 관례 (mask = 알파 반전) |
| `attached` (BOOLEAN) | 실제 첨부 여부 — Logic/Impact 계열 분기 입력용 |
| `select` (INT) | 미첨부=1, 첨부=2 — `ImpactSwitch` 등 1-based select 에 바로 연결 |

### 사용 패턴

**패턴 1 — 미첨부 오류만 없애기** (분기 불필요):
LoadImage 를 이 노드로 교체하고 `image`/`attached` 위젯에 vcc 플레이스홀더 두 개를 넣는다. 끝.

**패턴 2 — 첨부 시 img2img, 미첨부 시 txt2img 분기**:
`select` 출력을 `ImpactSwitch` (또는 `Any Switch (rgthree)`, `LazySwitchKJ`) 의 select 에 연결하고,
input1 = txt2img 경로(EmptyLatent 등), input2 = img2img 경로(VAEEncode 등)를 배선한다.
ComfyUI 실행은 수요 기반이라 선택되지 않은 분기는 실행되지 않는다.

### vcc-manager 쪽 계약 (#758)

vcc 는 작업판의 image/video 타입 필드마다 다음 플레이스홀더를 치환한다:
- `{{##필드명##}}` → ComfyUI 에 업로드된 파일명 (image 필드 미첨부 시 흰 PNG — #230 검증 통과용)
- `{{##필드명_attached##}}` → 사용자가 실제 첨부했으면 `1`, 아니면 `0` (number)
