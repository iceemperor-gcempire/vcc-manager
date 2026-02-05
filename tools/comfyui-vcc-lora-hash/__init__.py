"""
VCC LoRA Hash - ComfyUI Custom Node
단일 LoRA 파일의 SHA256 해시를 제공하는 API 엔드포인트

설치: ComfyUI/custom_nodes/ 폴더에 이 폴더를 복사
API: GET /api/vcc/lora-hash/{filename}
"""

import os
import hashlib
import urllib.parse
import folder_paths
from aiohttp import web
from server import PromptServer

# SHA256 해시 계산 (파일 청크 단위로 읽어 메모리 효율적)
def calculate_sha256(file_path):
    sha256_hash = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):  # 64KB 청크
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    except Exception as e:
        print(f"[VCC LoRA Hash] Error calculating hash for {file_path}: {e}")
        return None

# LoRA 파일 경로 찾기
def find_lora_file(filename):
    """
    filename 또는 relative_path로 LoRA 파일의 전체 경로를 찾음
    """
    lora_paths = folder_paths.get_folder_paths("loras")

    for base_path in lora_paths:
        if not os.path.exists(base_path):
            continue

        # 직접 경로 확인 (relative_path인 경우)
        full_path = os.path.join(base_path, filename)
        if os.path.isfile(full_path):
            return full_path

        # 파일명으로 검색 (하위 폴더 포함)
        for root, dirs, files in os.walk(base_path):
            for file in files:
                if file == filename:
                    return os.path.join(root, file)

    return None

# API 엔드포인트: 상태 확인 (빠른 응답)
@PromptServer.instance.routes.get("/api/vcc/lora-hash/ping")
async def ping(request):
    """노드 설치 확인용 빠른 응답"""
    return web.json_response({
        "success": True,
        "message": "VCC LoRA Hash node is running",
        "version": "2.0"
    })

# API 엔드포인트: 단일 LoRA 해시 조회
@PromptServer.instance.routes.get("/api/vcc/lora-hash/{filename:.*}")
async def get_lora_hash(request):
    """
    단일 LoRA 파일의 SHA256 해시 반환

    Parameters:
        filename: LoRA 파일명 또는 상대 경로 (URL 인코딩됨)

    Response:
    {
        "success": true,
        "filename": "example.safetensors",
        "sha256": "abc123..."
    }
    """
    filename = request.match_info.get("filename", "")

    if not filename:
        return web.json_response({
            "success": False,
            "error": "filename is required"
        }, status=400)

    # URL 디코딩
    filename = urllib.parse.unquote(filename)

    try:
        # 파일 찾기
        file_path = find_lora_file(filename)

        if not file_path:
            return web.json_response({
                "success": False,
                "error": f"LoRA not found: {filename}"
            }, status=404)

        # 해시 계산
        sha256 = calculate_sha256(file_path)

        if sha256 is None:
            return web.json_response({
                "success": False,
                "error": f"Failed to calculate hash for: {filename}"
            }, status=500)

        return web.json_response({
            "success": True,
            "filename": filename,
            "sha256": sha256
        })

    except Exception as e:
        print(f"[VCC LoRA Hash] Error: {e}")
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)

# 노드 클래스 (필수 - ComfyUI가 로드하기 위해)
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

print("[VCC LoRA Hash] Loaded - API endpoints:")
print("[VCC LoRA Hash]   GET /api/vcc/lora-hash/ping - Health check")
print("[VCC LoRA Hash]   GET /api/vcc/lora-hash/{filename} - Get SHA256 hash for single file")
