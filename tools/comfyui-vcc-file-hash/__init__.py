"""
VCC File Hash - ComfyUI Custom Node
ComfyUI 의 임의 folder_type (loras, checkpoints, vae, ...) 파일의 SHA256 해시를
제공하는 API 엔드포인트. v2.0 에서 LoRA 전용 노드 (comfyui-vcc-lora-hash)
를 일반화하여 신규 모델 메타데이터 인프라가 checkpoint 도 hash 로 매칭 가능
하도록 함.

설치: ComfyUI/custom_nodes/ 폴더에 이 폴더를 복사
신규 API:  GET /api/vcc/file-hash/{folder_type}/{filename}
            GET /api/vcc/file-hash/ping
하위 호환: GET /api/vcc/lora-hash/{filename}  (folder_type=loras 로 위임)
            GET /api/vcc/lora-hash/ping
"""

import os
import hashlib
import urllib.parse
import folder_paths
from aiohttp import web
from server import PromptServer

NODE_VERSION = "3.1"

# ComfyUI folder_paths 가 인식하는 type 만 허용 (path traversal 방어)
SUPPORTED_FOLDER_TYPES = {
    "loras",
    "checkpoints",
    "vae",
    "controlnet",
    "embeddings",
    "upscale_models",
    "clip",
    "clip_vision",
    "diffusers",
    "diffusion_models",
    "unet",
    "style_models",
    "hypernetworks",
    "gligen",
    "photomaker",
}

# SHA256 해시 계산 (파일 청크 단위로 읽어 메모리 효율적)
def calculate_sha256(file_path):
    sha256_hash = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):  # 64KB 청크
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    except Exception as e:
        print(f"[VCC File Hash] Error calculating hash for {file_path}: {e}")
        return None

# folder_type 의 ComfyUI 등록 디렉토리 안에서 filename 의 실제 경로 찾기
def find_file_in_folder_type(folder_type, filename):
    try:
        base_paths = folder_paths.get_folder_paths(folder_type)
    except Exception:
        return None

    for base_path in base_paths:
        if not os.path.exists(base_path):
            continue

        # relative_path 직접 매칭
        full_path = os.path.join(base_path, filename)
        if os.path.isfile(full_path):
            return full_path

        # 파일명 매칭 (하위 폴더 포함)
        for root, _dirs, files in os.walk(base_path):
            for file in files:
                if file == filename:
                    return os.path.join(root, file)

    return None

def build_hash_response(folder_type, filename):
    if folder_type not in SUPPORTED_FOLDER_TYPES:
        return web.json_response({
            "success": False,
            "error": f"Unsupported folder_type: {folder_type}"
        }, status=400)

    if not filename:
        return web.json_response({
            "success": False,
            "error": "filename is required"
        }, status=400)

    decoded_filename = urllib.parse.unquote(filename)

    try:
        file_path = find_file_in_folder_type(folder_type, decoded_filename)
        if not file_path:
            return web.json_response({
                "success": False,
                "error": f"{folder_type}/{decoded_filename} not found"
            }, status=404)

        sha256 = calculate_sha256(file_path)
        if sha256 is None:
            return web.json_response({
                "success": False,
                "error": f"Failed to calculate hash for: {decoded_filename}"
            }, status=500)

        return web.json_response({
            "success": True,
            "folder_type": folder_type,
            "filename": decoded_filename,
            "sha256": sha256
        })
    except Exception as e:
        print(f"[VCC File Hash] Error: {e}")
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)

# ── 신규 일반화 API ────────────────────────────────────────────────

@PromptServer.instance.routes.get("/api/vcc/file-hash/ping")
async def ping(request):
    return web.json_response({
        "success": True,
        "message": "VCC File Hash node is running",
        "version": NODE_VERSION,
        "supported_folder_types": sorted(SUPPORTED_FOLDER_TYPES),
    })

@PromptServer.instance.routes.get("/api/vcc/file-hash/{folder_type}/{filename:.*}")
async def get_file_hash(request):
    folder_type = request.match_info.get("folder_type", "")
    filename = request.match_info.get("filename", "")
    return build_hash_response(folder_type, filename)

@PromptServer.instance.routes.post("/api/vcc/file-hash/refresh/{folder_type}")
async def refresh_folder_cache(request):
    """
    ComfyUI folder_paths 의 특정 folder_type 캐시 무효화 + 즉시 재스캔.
    파일 삭제·추가가 즉시 반영되지 않을 때 vcc-manager 동기화 직전 호출 (#349).
    """
    folder_type = request.match_info.get("folder_type", "")
    if folder_type not in SUPPORTED_FOLDER_TYPES:
        return web.json_response({
            "success": False,
            "error": f"Unsupported folder_type: {folder_type}"
        }, status=400)

    try:
        invalidated = False
        cache_dict = getattr(folder_paths, "cached_filename_list_", None)
        if isinstance(cache_dict, dict) and folder_type in cache_dict:
            del cache_dict[folder_type]
            invalidated = True
        # 즉시 재스캔
        files = folder_paths.get_filename_list(folder_type)
        return web.json_response({
            "success": True,
            "folder_type": folder_type,
            "invalidated": invalidated,
            "count": len(files) if files else 0,
        })
    except Exception as e:
        print(f"[VCC File Hash] refresh error: {e}")
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)

# ── Legacy API (backward compat for older vcc-manager versions) ─────

@PromptServer.instance.routes.get("/api/vcc/lora-hash/ping")
async def legacy_ping(request):
    return web.json_response({
        "success": True,
        "message": "VCC LoRA Hash (legacy alias) is running",
        "version": NODE_VERSION,
    })

@PromptServer.instance.routes.get("/api/vcc/lora-hash/{filename:.*}")
async def legacy_lora_hash(request):
    filename = request.match_info.get("filename", "")
    return build_hash_response("loras", filename)

# 노드 클래스 (ComfyUI 가 로드하기 위해 필수)
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

print("[VCC File Hash] Loaded - API endpoints:")
print("[VCC File Hash]   GET  /api/vcc/file-hash/ping")
print("[VCC File Hash]   GET  /api/vcc/file-hash/{folder_type}/{filename}")
print("[VCC File Hash]   POST /api/vcc/file-hash/refresh/{folder_type}")
print("[VCC File Hash]   GET  /api/vcc/lora-hash/ping              (legacy alias)")
print("[VCC File Hash]   GET  /api/vcc/lora-hash/{filename}         (legacy alias for folder_type=loras)")
