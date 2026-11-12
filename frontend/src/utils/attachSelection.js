// 첨부 목록 ↔ 갤러리 선택 변환 (#1182).
//
// 첨부 목록(ImageUploadField 의 images) 항목은 두 가지다.
//   - 새 파일:   { file, preview }  — 전송할 때 업로드한다
//   - 기존 이미지: { _id, url }     — 업로드한 이미지·생성한 이미지. 전송할 때 id 만 보낸다
// 기존 이미지는 갤러리(ImageSelectDialog)에서 고른다. 백엔드 비전 입력은 두 종류를 모두 받는다
// (src/utils/visionImages.js).

// 갤러리를 다시 열 때 이미 고른 기존 이미지가 선택된 채로 보이게 한다.
// MediaGrid 는 imageId 로 선택 여부를 본다.
export function galleryInitialSelection(images) {
  return images
    .filter((img) => !img.file && img._id)
    .map((img) => ({ imageId: img._id, image: { _id: img._id, url: img.url } }));
}

// 갤러리에서 고를 수 있는 최대 장수 — 새 파일이 차지한 자리를 뺀 나머지.
export function gallerySlots(images, maxImages) {
  const fileCount = images.filter((img) => img.file).length;
  return Math.max(0, maxImages - fileCount);
}

// 갤러리에서 확정한 선택을 첨부 목록에 합친다.
// selected 는 ImageSelectDialog onSelect 결과다 — 단일 선택이면 객체, 다중 선택이면 배열.
// 다중 선택 배열은 처음 선택(galleryInitialSelection)까지 포함한 전체 선택이라 그대로 덧붙이면
// 겹친다. 그래서:
//   - 새 파일은 자리 그대로 둔다
//   - 선택에서 빠진 기존 이미지는 뺀다
//   - 새로 고른 것은 뒤에 붙인다 (첨부 순서가 모델에 가는 순서다)
//   - 최대 장수를 넘는 뒤쪽은 자른다
export function mergeGallerySelection(images, selected, maxImages) {
  const list = (Array.isArray(selected) ? selected : [selected]).filter((s) => s && s.imageId);
  const pickedIds = new Set(list.map((s) => String(s.imageId)));

  const kept = images.filter((img) => img.file || (img._id && pickedIds.has(String(img._id))));
  const seen = new Set(kept.filter((img) => !img.file).map((img) => String(img._id)));

  const added = [];
  for (const s of list) {
    const id = String(s.imageId);
    if (seen.has(id)) continue;
    seen.add(id);
    added.push({ _id: s.imageId, url: s.image?.url || s.url });
  }

  return [...kept, ...added].slice(0, maxImages);
}
