# VCC LoRA Hash - ComfyUI Custom Node

VCC Manager를 위한 ComfyUI 커스텀 노드입니다. LoRA 파일의 SHA256 해시를 제공하여 Civitai 메타데이터 조회를 가능하게 합니다.

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

### GET /api/vcc/lora-hashes

모든 LoRA 파일의 목록과 SHA256 해시를 반환합니다.

**응답 예시:**
```json
{
  "success": true,
  "loras": [
    {
      "filename": "add_detail.safetensors",
      "relative_path": "add_detail.safetensors",
      "sha256": "7c6bad76eb54..."
    },
    {
      "filename": "style_anime.safetensors",
      "relative_path": "styles/style_anime.safetensors",
      "sha256": "a1b2c3d4e5f6..."
    }
  ],
  "total": 2
}
```

### GET /api/vcc/lora-hash/{filename}

단일 LoRA 파일의 SHA256 해시를 반환합니다.

**응답 예시:**
```json
{
  "success": true,
  "filename": "add_detail.safetensors",
  "relative_path": "add_detail.safetensors",
  "sha256": "7c6bad76eb54..."
}
```

## 지원 파일 형식

- `.safetensors`
- `.ckpt`
- `.pt`

## 확인 방법

ComfyUI 실행 후 브라우저에서 확인:
```
http://localhost:8188/api/vcc/lora-hashes
```

또는 curl:
```bash
curl http://localhost:8188/api/vcc/lora-hashes
```

## 로그

ComfyUI 시작 시 다음 메시지가 표시됩니다:
```
[VCC LoRA Hash] Loaded - API endpoint: /api/vcc/lora-hashes
```

## 라이선스

MIT License
