"""VCC Optional Image — 이미지 미첨부를 허용하는 LoadImage 대체 노드 (vcc-manager #758).

기존 LoadImage 는 파일이 지정되지 않으면 제출 검증에서 실패한다. 이 노드는:
- `image` 를 파일콤보 위젯이 아닌 STRING 으로 받아 (vcc 가 `{{##필드명##}}` 로 주입)
  제출 검증 단계의 파일 존재 검사를 우회하고,
- `attached` 플래그 (vcc 가 `{{##필드명_attached##}}` 로 0/1 주입) 가 0 이거나 파일이
  없으면 **오류 대신** 지정 크기의 흰색 이미지 + attached=False 를 반환한다.

출력:
- IMAGE / MASK : LoadImage 와 동일 관례 (mask 는 알파 채널 반전, 미첨부 시 전부 0)
- attached (BOOLEAN) : 실제 첨부 여부 — 논리 노드 분기용
- select (INT) : 미첨부=1, 첨부=2 — ImpactSwitch 등 1-based 스위치 select 에 바로 연결
"""

import os

import numpy as np
import torch
from PIL import Image, ImageOps

import folder_paths


def _blank(width, height):
    image = torch.ones((1, height, width, 3), dtype=torch.float32)
    mask = torch.zeros((1, height, width), dtype=torch.float32)
    return image, mask


class VCCOptionalImage:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                # STRING 입력 — vcc 플레이스홀더 주입용. 콤보 위젯이 아니므로 제출 검증을 통과한다.
                "image": ("STRING", {"default": ""}),
                "attached": ("INT", {"default": 1, "min": 0, "max": 1}),
            },
            "optional": {
                "blank_width": ("INT", {"default": 1024, "min": 8, "max": 8192, "step": 8}),
                "blank_height": ("INT", {"default": 1024, "min": 8, "max": 8192, "step": 8}),
            },
        }

    RETURN_TYPES = ("IMAGE", "MASK", "BOOLEAN", "INT")
    RETURN_NAMES = ("image", "mask", "attached", "select")
    FUNCTION = "load"
    CATEGORY = "VCC"

    def load(self, image, attached, blank_width=1024, blank_height=1024):
        if not attached or not image or not str(image).strip():
            img, mask = _blank(blank_width, blank_height)
            return (img, mask, False, 1)

        try:
            path = folder_paths.get_annotated_filepath(str(image).strip())
        except Exception:
            path = None

        if not path or not os.path.exists(path):
            print(f"[VCC] Optional image not found: {image!r} — returning blank")
            img, mask = _blank(blank_width, blank_height)
            return (img, mask, False, 1)

        pil = Image.open(path)
        pil = ImageOps.exif_transpose(pil)
        rgb = pil.convert("RGB")
        arr = np.array(rgb).astype(np.float32) / 255.0
        img = torch.from_numpy(arr)[None,]

        if "A" in pil.getbands():
            alpha = np.array(pil.getchannel("A")).astype(np.float32) / 255.0
            mask = 1.0 - torch.from_numpy(alpha)[None,]
        else:
            mask = torch.zeros((1, rgb.height, rgb.width), dtype=torch.float32)

        return (img, mask, True, 2)

    @classmethod
    def IS_CHANGED(cls, image, attached, blank_width=1024, blank_height=1024):
        # 같은 파일명이 overwrite 재업로드될 수 있으므로 mtime 으로 캐시 무효화
        if not attached or not image:
            return "blank"
        try:
            path = folder_paths.get_annotated_filepath(str(image).strip())
            return os.path.getmtime(path)
        except Exception:
            return "missing"
