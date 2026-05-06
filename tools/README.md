# Tools (사전 설치 도구)

VCC Manager와 함께 사용하기 위해 외부 시스템에 설치해야 하는 도구들입니다.

## 포함된 도구

### comfyui-vcc-file-hash

ComfyUI용 커스텀 노드. 임의 folder_type (loras / checkpoints / vae / 등) 의 단일 파일에 대한 SHA256 해시를 제공합니다. v2.0 에서 LoRA 전용 노드 (`comfyui-vcc-lora-hash`) 를 일반화 — 기존 LoRA 엔드포인트는 backward-compat alias 로 유지.

**설치 방법:**
```bash
# 기존 LoRA 전용 노드 제거 (v1.x 에서 설치했던 경우)
rm -rf /path/to/ComfyUI/custom_nodes/comfyui-vcc-lora-hash

# 신규 노드 설치
cp -r tools/comfyui-vcc-file-hash /path/to/ComfyUI/custom_nodes/
```

자세한 내용은 [comfyui-vcc-file-hash/README.md](./comfyui-vcc-file-hash/README.md)를 참고하세요.

## 관련 문서

- [LoRA 메타데이터 가이드](../docs/LORA_METADATA.md)
