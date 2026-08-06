# VCC Manager ComfyUI 커스텀 노드 (#758)
# 설치: 이 디렉토리(vcc-nodes)를 ComfyUI 의 custom_nodes/ 아래에 복사(또는 심링크)하고 재시작.
from .vcc_optional_image import VCCOptionalImage

NODE_CLASS_MAPPINGS = {
    "VCCOptionalImage": VCCOptionalImage,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "VCCOptionalImage": "VCC Optional Image",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
