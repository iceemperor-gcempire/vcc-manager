# VCC LoRA Hash - ComfyUI Custom Node

VCC Manager를 위한 ComfyUI 커스텀 노드입니다. 단일 LoRA 파일의 SHA256 해시를 제공하여 Civitai 메타데이터 조회를 가능하게 합니다.

## 설치

ComfyUI의 `custom_nodes` 폴더에 이 폴더를 복사합니다:

```bash
# vcc-manager 저장소에서 복사
cp -r /path/to/vcc-manager/tools/comfyui-vcc-lora-hash ComfyUI/custom_nodes/

# 또는 심볼릭 링크 (개발 시 권장)
ln -s /path/to/vcc-manager/tools/comfyui-vcc-lora-hash ComfyUI/custom_nodes/comfyui-vcc-lora-hash
```

ComfyUI를 재시작하면 자동으로 로드됩니다.

## API 엔드포인트

### GET /api/vcc/lora-hash/ping

노드 설치 확인용 빠른 응답

**응답 예시:**
```json
{
  "success": true,
  "message": "VCC LoRA Hash node is running",
  "version": "2.0"
}
```

### GET /api/vcc/lora-hash/{filename}

단일 LoRA 파일의 SHA256 해시를 반환합니다.

**Parameters:**
- `filename`: LoRA 파일명 또는 상대 경로 (URL 인코딩 필요)

**응답 예시:**
```json
{
  "success": true,
  "filename": "add_detail.safetensors",
  "sha256": "7c6bad76eb54..."
}
```

**에러 응답:**
```json
{
  "success": false,
  "error": "LoRA not found: example.safetensors"
}
```

## 지원 파일 형식

- `.safetensors`
- `.ckpt`
- `.pt`

## 확인 방법

ComfyUI 실행 후 브라우저에서 확인:
```
http://localhost:8188/api/vcc/lora-hash/ping
```

단일 파일 해시 조회:
```bash
curl "http://localhost:8188/api/vcc/lora-hash/add_detail.safetensors"
```

하위 폴더의 파일 (URL 인코딩 필요):
```bash
curl "http://localhost:8188/api/vcc/lora-hash/subfolder%2Fexample.safetensors"
```

## 로그

ComfyUI 시작 시 다음 메시지가 표시됩니다:
```
[VCC LoRA Hash] Loaded - API endpoints:
[VCC LoRA Hash]   GET /api/vcc/lora-hash/ping - Health check
[VCC LoRA Hash]   GET /api/vcc/lora-hash/{filename} - Get SHA256 hash for single file
```

## 동작 방식

1. VCC Manager가 ComfyUI의 기본 API (`/object_info/LoraLoader`)에서 LoRA 목록을 조회
2. 각 LoRA 파일에 대해 이 노드의 API로 해시를 개별 요청
3. 해시는 VCC Manager에서 캐시되어 재요청 시 재사용

## 라이선스

MIT License
