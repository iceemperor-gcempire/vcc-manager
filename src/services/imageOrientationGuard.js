/**
 * 이미지·영상 방향 불일치 가드 (#862).
 *
 * H3 FL2V 의 first_frame 은 비율 무시 스트레치라, 세로 이미지 + 가로 캔버스(또는 그 반대)
 * 조합이면 시작 프레임이 찌그러져 캐릭터가 붕괴한다. anchorSizeField 가 선언된 image 필드에
 * 대해 제출 시점에 방향을 대조해 명확한 400 사유를 돌려준다 (#859 videoAudioGuard 와 동형).
 *
 * 발동 조건: 맞춤 방식(anchorFitField)이 '늘리기'(disabled)일 때만. 크롭(center) 등
 * 비율 보존 모드는 의도적 사용이므로 막지 않는다. 판정 불가(메타데이터 없음)는 허용.
 */
const UploadedImage = require('../models/UploadedImage');
const GeneratedImage = require('../models/GeneratedImage');

// 'WxH' → { w, h } (파싱 불가 시 null)
const parseSize = (value) => {
  const m = /^(\d+)\s*[xX]\s*(\d+)$/.exec(String(value || '').trim());
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
};

// 세로/가로 방향. 정사각형은 null (어느 쪽과도 충돌로 안 본다)
const orientationOf = (w, h) => {
  if (!w || !h || w === h) return null;
  return w > h ? 'landscape' : 'portrait';
};

const fieldValueOf = (inputLike, name) => {
  const ap = inputLike.additionalParams || {};
  return ap[name] !== undefined ? ap[name] : inputLike[name];
};

const firstImageId = (value) => {
  const entry = Array.isArray(value) ? value[0] : value;
  if (!entry) return null;
  return entry.imageId || entry;
};

const imageDimensionsOf = async (imageId) => {
  if (!imageId) return null;
  const doc =
    (await UploadedImage.findById(imageId).catch(() => null)) ||
    (await GeneratedImage.findById(imageId).catch(() => null));
  const meta = doc?.metadata;
  if (!meta?.width || !meta?.height) return null;
  return { w: meta.width, h: meta.height };
};

/**
 * 위반 시 사용자용 사유 문자열, 문제없으면 null.
 * @param workboard additionalInputFields 를 가진 Workboard 문서 (lean 가능)
 * @param inputLike { additionalParams, ...top-level } — generate 요청 body 또는 job.inputData
 */
const findOrientationViolation = async (workboard, inputLike) => {
  const fields = workboard.additionalInputFields || [];
  const checked = [];

  for (const field of fields) {
    if (field.type !== 'image' || !field.anchorSizeField) continue;

    // 맞춤 방식이 비율 보존 모드면 왜곡이 없다 — 늘리기(disabled)일 때만 검사
    if (field.anchorFitField) {
      const fit = fieldValueOf(inputLike, field.anchorFitField);
      const fitField = fields.find((f) => f.name === field.anchorFitField);
      const effective = fit !== undefined && fit !== null && fit !== '' ? fit : fitField?.defaultValue;
      if (effective !== 'disabled') continue;
    }

    const imageId = firstImageId(fieldValueOf(inputLike, field.name));
    if (!imageId) continue;

    const size = parseSize(fieldValueOf(inputLike, field.anchorSizeField));
    const dims = await imageDimensionsOf(imageId);
    if (!size || !dims) {
      checked.push({ field: field.name, verdict: 'unknown' });
      continue; // 판정 불가 — 오판으로 막지 않는다
    }

    const imgOri = orientationOf(dims.w, dims.h);
    const canvasOri = orientationOf(size.w, size.h);
    checked.push({ field: field.name, image: `${dims.w}x${dims.h}`, canvas: `${size.w}x${size.h}` });

    if (imgOri && canvasOri && imgOri !== canvasOri) {
      const sizeField = fields.find((f) => f.name === field.anchorSizeField);
      console.log('📐 방향 불일치 차단 (#862):', JSON.stringify(checked));
      const dir = imgOri === 'portrait' ? '세로' : '가로';
      const canvasDir = canvasOri === 'portrait' ? '세로' : '가로';
      return `"${field.label}"의 이미지(${dims.w}x${dims.h}, ${dir})와 ` +
        `"${sizeField?.label || field.anchorSizeField}"(${size.w}x${size.h}, ${canvasDir})의 방향이 다릅니다. ` +
        `늘리기 모드에서는 이미지가 심하게 왜곡됩니다 — ${dir} 크기를 선택하거나 맞춤 방식을 '크롭'으로 바꿔 주세요.`;
    }
  }

  console.log(`📐 방향 검사 (#862): ${checked.length}건 확인, 위반 없음`,
    checked.length ? JSON.stringify(checked) : '');
  return null;
};

module.exports = { findOrientationViolation, parseSize, orientationOf };
