const { GENERATED_MEDIA_MODELS_BY_TYPE, UPLOADED_MEDIA_MODELS_BY_TYPE } = require('../models/mediaModels');
const { ATTACHMENT_FIELD_TYPES } = require('../constants/mediaTypes');

// 작업 입력의 첨부 참조 검증 (#959).
//
// 작업판 첨부 필드(이미지·영상·오디오)와 참조 이미지는 미디어 id 로 들어오고, 큐는 그 id 로 파일을 읽는다.
// "이 요청이 쓸 수 있는 미디어인가" 를 판정하는 곳은 여기 하나다 — 작업 생성·재시도·파이프라인·
// 작업 절차 단계가 모두 거친다. 한 경로만 검사하면 나머지가 우회로가 된다.
//
// 쓸 수 있는 미디어 = 허용된 소유자(ownerIds)의 업로드본 또는 생성물.
// 없는 id 와 남의 id 는 호출자에게 같은 결과로 돌려준다 — 메시지로 존재 여부를 흘리지 않는다.
// 사유는 서버 로그에만 남긴다.

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const ID_KEY_BY_TYPE = { image: 'imageId', video: 'videoId', audio: 'audioId' };

function idOfEntry(entry, type) {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object') return entry[ID_KEY_BY_TYPE[type]] || entry._id || entry.id || null;
  return null;
}

/**
 * 입력의 첨부 참조를 모은다. 필드 값은 additionalParams 우선, 없으면 최상위 — queueService 가 읽는 순서와 같다.
 * @returns {Array<{ field: string, label: string, type: 'image'|'video'|'audio', id: string }>}
 */
function collectAttachmentRefs(workboard, inputData = {}) {
  const refs = [];
  for (const entry of Array.isArray(inputData.referenceImages) ? inputData.referenceImages : []) {
    const id = idOfEntry(entry, 'image');
    if (id) refs.push({ field: 'referenceImages', label: '참조 이미지', type: 'image', id: String(id) });
  }
  for (const field of workboard?.additionalInputFields || []) {
    if (!ATTACHMENT_FIELD_TYPES.includes(field.type)) continue;
    const raw = inputData.additionalParams?.[field.name] || inputData[field.name];
    const values = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    for (const entry of values) {
      const id = idOfEntry(entry, field.type);
      if (id) refs.push({ field: field.name, label: field.label || field.name, type: field.type, id: String(id) });
    }
  }
  return refs;
}

async function ownerOf(type, id) {
  for (const Model of [UPLOADED_MEDIA_MODELS_BY_TYPE[type], GENERATED_MEDIA_MODELS_BY_TYPE[type]]) {
    const doc = await Model.findById(id).select('userId').lean();
    if (doc) return doc.userId ? String(doc.userId) : null;
  }
  return null;
}

/**
 * 허용된 소유자 것이 아닌 첨부 참조.
 * @param {{ workboard: Object, inputData: Object, ownerIds: Array, label?: string }} args
 * @returns {Promise<Array<{ field, label, type, id, reason: 'invalid'|'not_found'|'not_owned' }>>} 없으면 []
 */
async function findUnusableAttachments({ workboard, inputData, ownerIds, label = 'attachments' }) {
  const refs = collectAttachmentRefs(workboard, inputData);
  const owners = new Set((ownerIds || []).filter(Boolean).map(String));
  const unusable = [];
  for (const ref of refs) {
    if (!OBJECT_ID_RE.test(ref.id)) {
      unusable.push({ ...ref, reason: 'invalid' });
      continue;
    }
    const owner = await ownerOf(ref.type, ref.id);
    if (!owner) unusable.push({ ...ref, reason: 'not_found' });
    else if (!owners.has(owner)) unusable.push({ ...ref, reason: 'not_owned' });
  }
  const detail = unusable.length
    ? ` ${JSON.stringify(unusable.map(({ field, type, id, reason }) => ({ field, type, id, reason })))}`
    : '';
  console.log(`[attachmentOwnership] ${label}: asked=${refs.length} unusable=${unusable.length}${detail}`);
  return unusable;
}

/** 사용자에게 보일 메시지 — 사유는 싣지 않는다 */
function describeUnusableAttachments(unusable) {
  const labels = [...new Set(unusable.map((u) => u.label))];
  return `쓸 수 없는 첨부가 있습니다: ${labels.join(', ')}`;
}

module.exports = {
  collectAttachmentRefs,
  findUnusableAttachments,
  describeUnusableAttachments,
};
