"""
VCC LoRA Hash - ComfyUI Custom Node
LoRA 파일 목록과 SHA256 해시를 제공하는 간단한 API 엔드포인트

설치: ComfyUI/custom_nodes/ 폴더에 이 폴더를 복사
API: GET /api/vcc/lora-hashes
"""

import os
import hashlib
import folder_paths
from aiohttp import web
from server import PromptServer

# SHA256 해시 계산 (파일 청크 단위로 읽어 메모리 효율적)
def calculate_sha256(file_path):
    sha256_hash = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    except Exception as e:
        print(f"[VCC LoRA Hash] Error calculating hash for {file_path}: {e}")
        return None

# LoRA 파일 경로 목록 가져오기
def get_lora_files():
    lora_paths = folder_paths.get_folder_paths("loras")
    lora_files = []

    for base_path in lora_paths:
        if not os.path.exists(base_path):
            continue
        for root, dirs, files in os.walk(base_path):
            for file in files:
                if file.endswith(('.safetensors', '.ckpt', '.pt')):
                    full_path = os.path.join(root, file)
                    # 상대 경로 계산 (base_path 기준)
                    relative_path = os.path.relpath(full_path, base_path)
                    lora_files.append({
                        "filename": file,
                        "relative_path": relative_path,
                        "full_path": full_path
                    })

    return lora_files

# API 엔드포인트: LoRA 해시 목록 조회
@PromptServer.instance.routes.get("/api/vcc/lora-hashes")
async def get_lora_hashes(request):
    """
    LoRA 파일 목록과 SHA256 해시 반환

    Response:
    {
        "success": true,
        "loras": [
            {
                "filename": "example.safetensors",
                "relative_path": "subfolder/example.safetensors",
                "sha256": "abc123..."
            }
        ]
    }
    """
    try:
        lora_files = get_lora_files()
        result = []

        for lora in lora_files:
            sha256 = calculate_sha256(lora["full_path"])
            result.append({
                "filename": lora["filename"],
                "relative_path": lora["relative_path"],
                "sha256": sha256
            })

        return web.json_response({
            "success": True,
            "loras": result,
            "total": len(result)
        })
    except Exception as e:
        print(f"[VCC LoRA Hash] Error: {e}")
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)

# API 엔드포인트: 단일 LoRA 해시 조회 (선택적)
@PromptServer.instance.routes.get("/api/vcc/lora-hash/{filename}")
async def get_single_lora_hash(request):
    """
    단일 LoRA 파일의 SHA256 해시 반환
    """
    filename = request.match_info.get("filename", "")

    if not filename:
        return web.json_response({
            "success": False,
            "error": "filename is required"
        }, status=400)

    try:
        lora_files = get_lora_files()

        for lora in lora_files:
            if lora["filename"] == filename or lora["relative_path"] == filename:
                sha256 = calculate_sha256(lora["full_path"])
                return web.json_response({
                    "success": True,
                    "filename": lora["filename"],
                    "relative_path": lora["relative_path"],
                    "sha256": sha256
                })

        return web.json_response({
            "success": False,
            "error": f"LoRA not found: {filename}"
        }, status=404)
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)

# 노드 클래스 (필수 - ComfyUI가 로드하기 위해)
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

print("[VCC LoRA Hash] Loaded - API endpoint: /api/vcc/lora-hashes")
