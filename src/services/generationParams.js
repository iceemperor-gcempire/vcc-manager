// 생성 요청의 입력 칸 값을 판 스키마로 거르고 채운다 (#1284).
//
// 웹 생성 화면은 판의 칸을 그려서 값을 받으므로 없는 칸·선택지 밖 값이 나올 수 없다. LLM 이 값을 채우는
// 채팅 도구는 그렇지 않다 — 칸 이름을 지어내거나 선택지에 없는 값을 준다. 등록(submitGenerationRequest) 전에
// 여기서 거르고, 오류는 모델이 고쳐 다시 부를 수 있게 무엇이 허용되는지와 함께 돌려준다.
//
// 빈 칸은 판 기본값으로 채운다. 실행(queueService)도 빈 칸에 기본값을 넣지만, 채워서 보내야 작업 기록에
// 실제로 쓴 값이 남아 계속하기·재시도가 같은 값으로 이어진다.
//
// ⚠️ 같은 규칙이 MCP 서버(mcp-server/src/utils/fieldDefaults.js, tools/jobs.js 의 선택지 매칭)에도 있다.
// 단일 source 정리는 #1267 의 "정할 것". 그때까지 규칙을 바꾸면 양쪽을 함께 본다.

const { ATTACHMENT_FIELD_TYPES } = require('../constants/mediaTypes');

const ID_KEY_BY_TYPE = { image: 'imageId', video: 'videoId', audio: 'audioId' };
const MAX_KEY_BY_TYPE = { image: ['imageConfig', 'maxImages'], video: ['videoConfig', 'maxVideos'], audio: ['audioConfig', 'maxAudios'] };
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const MAX_LISTED_OPTIONS = 30;

const valueOf = (v) => (v && typeof v === 'object' && v.value !== undefined ? v.value : v);
const isEmpty = (v) => v === undefined || v === null || v === '';

/** 판에서 고를 수 있는 값 안내 — 길면 자른다 (조용히 자르지 않고 몇 개 더 있는지 적는다) */
function listed(values) {
  const shown = values.slice(0, MAX_LISTED_OPTIONS).map((v) => JSON.stringify(v)).join(', ');
  return values.length > MAX_LISTED_OPTIONS ? `${shown} 외 ${values.length - MAX_LISTED_OPTIONS}개` : shown;
}

/** 첨부 칸이 받는 최대 개수 */
function attachmentLimit(field) {
  const [config, key] = MAX_KEY_BY_TYPE[field.type];
  return Math.max(1, Number(field[config]?.[key]) || 1);
}

function normalizeAttachment(field, raw, errors) {
  const idKey = ID_KEY_BY_TYPE[field.type];
  const entries = Array.isArray(raw) ? raw : [raw];
  const ids = [];
  for (const entry of entries) {
    const id = typeof entry === 'string' ? entry : (entry && (entry[idKey] || entry.id || entry._id));
    if (!id || !OBJECT_ID_RE.test(String(id))) {
      errors.push(`"${field.name}": 첨부 id 가 올바르지 않습니다 (${JSON.stringify(entry)}). 사용자가 붙인 첨부의 id 를 그대로 쓰세요.`);
      return undefined;
    }
    ids.push(String(id));
  }
  const limit = attachmentLimit(field);
  if (ids.length > limit) {
    errors.push(`"${field.name}": 최대 ${limit}개까지 받습니다 (${ids.length}개를 보냈습니다).`);
    return undefined;
  }
  const values = ids.map((id) => ({ [idKey]: id }));
  return limit > 1 ? values : values[0];
}

/**
 * @param {Object} workboard additionalInputFields·modelExposurePolicy·modelWhitelist 를 읽는다
 * @param {Object} [params] 호출자가 준 칸 값 (칸 이름 → 값)
 * @returns {{ additionalParams: Object, filled: string[], errors: string[] }}
 *   errors 가 비어 있지 않으면 additionalParams 를 쓰지 않는다
 */
function normalizeGenerationParams(workboard, params = {}) {
  const fields = (workboard?.additionalInputFields || []).filter(Boolean);
  const byName = new Map(fields.map((f) => [f.name, f]));
  const given = params && typeof params === 'object' && !Array.isArray(params) ? params : {};
  const errors = [];
  const out = {};
  const filled = [];

  for (const name of Object.keys(given)) {
    if (!byName.has(name)) {
      errors.push(`"${name}": 이 작업판에 없는 입력 칸입니다. 있는 칸: ${listed(fields.map((f) => f.name))}`);
    }
  }

  for (const field of fields) {
    const raw = given[field.name];

    if (ATTACHMENT_FIELD_TYPES.includes(field.type)) {
      // 첨부 칸은 기본값이 없다. 필수 누락은 등록 쪽(submitGenerationRequest)이 판정한다
      if (isEmpty(raw) || (Array.isArray(raw) && raw.length === 0)) continue;
      const value = normalizeAttachment(field, raw, errors);
      if (value !== undefined) out[field.name] = value;
      continue;
    }

    if (isEmpty(raw)) {
      if (field.type === 'select' && field.options?.length > 0) {
        const want = valueOf(field.defaultValue);
        const option = (!isEmpty(want) && field.options.find((o) => o.value === want || o.key === want)) || field.options[0];
        out[field.name] = { key: option.key, value: option.value };
        filled.push(field.name);
      } else if (!isEmpty(valueOf(field.defaultValue))) {
        out[field.name] = field.defaultValue;
        filled.push(field.name);
      }
      continue;
    }

    const value = valueOf(raw);
    if (field.type === 'select') {
      const options = field.options || [];
      // 값과 표시 이름 둘 다 받는다. 숫자 선택지를 문자열로 주는 모델이 있어 글자로도 견준다
      const option = options.find((o) => o.value === value || o.key === value)
        || options.find((o) => String(o.value) === String(value) || String(o.key) === String(value));
      if (!option) {
        errors.push(`"${field.name}": ${JSON.stringify(value)} 는 선택지에 없습니다. 고를 수 있는 값: ${listed(options.map((o) => o.value))}`);
        continue;
      }
      out[field.name] = { key: option.key, value: option.value };
    } else if (field.type === 'number') {
      const n = typeof value === 'number' ? value : Number(String(value).trim());
      if (!Number.isFinite(n) || String(value).trim() === '') {
        errors.push(`"${field.name}": 숫자여야 합니다 (${JSON.stringify(value)}).`);
        continue;
      }
      out[field.name] = n;
    } else if (field.type === 'boolean') {
      if (typeof value === 'boolean') out[field.name] = value;
      else if (value === 'true' || value === 'false') out[field.name] = value === 'true';
      else errors.push(`"${field.name}": true 또는 false 여야 합니다 (${JSON.stringify(value)}).`);
    } else if (field.type === 'baseModel') {
      // 허용 목록 정책인 판은 그 목록이 곧 고를 수 있는 모델이다. 폴더 제한은 등록 쪽이 검사한다 (#1086)
      const whitelist = workboard.modelExposurePolicy === 'whitelist' ? (workboard.modelWhitelist || []) : null;
      if (whitelist && whitelist.length > 0 && !whitelist.includes(value)) {
        errors.push(`"${field.name}": ${JSON.stringify(value)} 는 이 작업판에서 쓸 수 없는 모델입니다. 쓸 수 있는 모델: ${listed(whitelist)}`);
        continue;
      }
      out[field.name] = raw;
    } else {
      out[field.name] = raw;
    }
  }

  return { additionalParams: out, filled, errors };
}

module.exports = { normalizeGenerationParams, attachmentLimit, MAX_LISTED_OPTIONS };
