# VCC File Hash - ComfyUI Custom Node

VCC Manager 를 위한 ComfyUI 커스텀 노드. 임의 folder_type (loras, checkpoints, vae 등) 의 단일 파일에 대한 SHA256 해시를 제공하여 Civitai 메타데이터 매칭을 가능하게 함.

> v2.0 변경: 기존 LoRA 전용 노드 (`comfyui-vcc-lora-hash`) 를 일반화. 기존 LoRA 엔드포인트는 backward-compat alias 로 유지.

## 설치

ComfyUI 의 `custom_nodes` 폴더에 이 폴더를 복사:

```bash
# 기존 LoRA 전용 노드 제거 (v1.x 에서 설치했던 경우)
rm -rf ComfyUI/custom_nodes/comfyui-vcc-lora-hash

# 신규 노드 설치
cp -r /path/to/vcc-manager/tools/comfyui-vcc-file-hash ComfyUI/custom_nodes/

# 또는 심볼릭 링크 (개발 시 권장)
ln -s /path/to/vcc-manager/tools/comfyui-vcc-file-hash ComfyUI/custom_nodes/comfyui-vcc-file-hash
```

ComfyUI 를 재시작하면 자동 로드됨.

## API 엔드포인트

### GET /api/vcc/file-hash/ping

노드 설치 / 지원 folder_type 확인.

**응답 예시:**
```json
{
  "success": true,
  "message": "VCC File Hash node is running",
  "version": "3.1",
  "supported_folder_types": ["checkpoints", "clip", "loras", "vae", ...]
}
```

### POST /api/vcc/file-hash/refresh/{folder_type}

ComfyUI `folder_paths.cached_filename_list_` 의 해당 folder 캐시 무효화 + 즉시 재스캔. 파일 추가/삭제가 mtime 변화로 즉시 반영되지 않을 때 사용. vcc-manager 동기화 시작 시 자동 호출 (v2.2+).

**응답 예시:**
```json
{
  "success": true,
  "folder_type": "checkpoints",
  "invalidated": true,
  "count": 54
}
```

### GET /api/vcc/file-hash/{folder_type}/{filename}

특정 folder_type 디렉토리 안의 단일 파일에 대한 SHA256 해시 반환.

- `folder_type`: ComfyUI 의 `folder_paths` 등록 type 중 하나 (loras / checkpoints / vae / controlnet / embeddings / upscale_models / ...)
- `filename`: 파일명 또는 base 디렉토리 기준 상대 경로 (URL 인코딩 필요)

**응답 예시:**
```json
{
  "success": true,
  "folder_type": "checkpoints",
  "filename": "sdxl_base_1.0.safetensors",
  "sha256": "31e35c80fc..."
}
```

**에러 응답:**
```json
{
  "success": false,
  "error": "checkpoints/example.safetensors not found"
}
```

### GET /api/vcc/lora-hash/ping  (legacy)
### GET /api/vcc/lora-hash/{filename}  (legacy)

기존 LoRA 전용 엔드포인트. 신규 `/api/vcc/file-hash/loras/{filename}` 로 동일 동작 위임. 구 vcc-manager 버전 (v1.x) 호환용으로만 유지.

## 보안

`folder_type` 은 화이트리스트로 제한 (ComfyUI 의 표준 type 만 허용). 사용자 입력으로 임의 디렉토리에 접근 불가능.

## 지원 파일 형식

ComfyUI 의 `folder_paths.get_folder_paths()` 가 반환하는 모든 디렉토리 안의 파일. 일반적으로 `.safetensors` / `.ckpt` / `.pt` 등.

## 확인 방법

```bash
# Health check
curl "http://localhost:8188/api/vcc/file-hash/ping"

# Checkpoint 해시
curl "http://localhost:8188/api/vcc/file-hash/checkpoints/sdxl_base_1.0.safetensors"

# 하위 폴더 (URL 인코딩 필요)
curl "http://localhost:8188/api/vcc/file-hash/loras/character%2Fexample.safetensors"

# Legacy LoRA endpoint (v1.x 호환)
curl "http://localhost:8188/api/vcc/lora-hash/example.safetensors"
```

## 라이선스

MIT License
