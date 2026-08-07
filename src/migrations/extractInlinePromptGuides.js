const Workboard = require('../models/Workboard');
const PromptGuide = require('../models/PromptGuide');
const { FIELD_ROLES, WELL_KNOWN_FIELD_NAME_TO_ROLE } = require('../constants/fieldRoles');

// #766: 작업판 system_prompt 필드의 defaultValue 에 인라인으로 박혀 있던 대형 가이드를
// PromptGuide 문서로 분리한다.
//
// 배경 — MiniMax H3 공식 가이드를 쓰려고 41,387자 전문을 작업판 필드 defaultValue 에
// 그대로 넣어둔 임시 구성이 있었다. 그 상태의 문제:
//   1. 편집기에서 41K 자 textarea 를 다루게 되고 실수로 날리기 쉽다
//   2. 생성 화면의 "시스템 프롬프트" 입력란이 41K 자로 채워져 사용자가 쓸 수 없다
//   3. 다른 작업판에서 재사용할 수 없어 모델별 가이드가 늘면 복붙이 반복된다
//
// 이전 후 동일한 내용이 [프롬프트 가이드] 층으로 LLM 에 전달되므로 결과는 보존되고,
// 비워진 system_prompt 필드는 본래 용도(작업판별 작업 지침)로 돌아간다.
//
// 멱등 — 이전 후 defaultValue 가 비므로 다음 실행에서 대상이 아니다.

// 이 길이를 넘는 system_prompt 기본값은 "작업 지침" 이 아니라 문서로 본다.
// 통상적인 작업 지침은 길어야 수백~2천 자다.
const INLINE_GUIDE_THRESHOLD = 5000;

/**
 * 이 필드가 가이드 추출 대상인지 판정 (순수 함수 — 테스트 대상).
 * @param {Object} field — additionalInputFields entry
 * @returns {boolean}
 */
function isInlineGuideField(field) {
  if (!field || typeof field.defaultValue !== 'string') return false;
  if (WELL_KNOWN_FIELD_NAME_TO_ROLE[field.name] !== FIELD_ROLES.SYSTEM_PROMPT) return false;
  return field.defaultValue.length > INLINE_GUIDE_THRESHOLD;
}

/**
 * 작업판에서 추출 대상 필드를 찾는다 (순수 함수 — 테스트 대상).
 * @param {Object} workboard
 * @returns {{ index: number, field: Object } | null}
 */
function findInlineGuideField(workboard) {
  const fields = workboard?.additionalInputFields || [];
  const index = fields.findIndex(isInlineGuideField);
  return index === -1 ? null : { index, field: fields[index] };
}

async function extractInlinePromptGuides() {
  try {
    // 텍스트 작업판만 대상 — 가이드는 프롬프트 생성 경로에만 적용된다.
    const workboards = await Workboard.find({
      $or: [{ outputFormat: 'text' }, { workboardType: 'prompt' }],
    });

    let migrated = 0;
    for (const wb of workboards) {
      const found = findInlineGuideField(wb);
      if (!found) continue;

      const content = found.field.defaultValue;
      const guide = await PromptGuide.create({
        title: `${wb.name} 가이드`,
        description: `${wb.name} 작업판의 시스템 프롬프트에 인라인으로 있던 가이드를 분리한 문서입니다.`,
        content,
        targetModel: '',
        createdBy: wb.createdBy,
      });

      // 연결은 맨 앞에 둔다 — 기존에 단독으로 적용되던 내용이므로 다른 가이드보다 앞선다.
      wb.promptGuideIds = [guide._id, ...(wb.promptGuideIds || []).filter((id) => String(id) !== String(guide._id))];
      wb.additionalInputFields[found.index].defaultValue = '';
      wb.markModified('additionalInputFields');
      await wb.save();

      migrated += 1;
      console.log(
        `[Migration] "${wb.name}" 의 인라인 가이드 ${content.length}자 → PromptGuide 분리 (${guide._id})`
      );
    }

    if (migrated > 0) {
      console.log(`[Migration] 인라인 프롬프트 가이드 분리 (${migrated}건)`);
    }
    return migrated;
  } catch (error) {
    console.error('[Migration] 인라인 프롬프트 가이드 분리 오류:', error);
    return 0;
  }
}

module.exports = extractInlinePromptGuides;
module.exports.isInlineGuideField = isInlineGuideField;
module.exports.findInlineGuideField = findInlineGuideField;
module.exports.INLINE_GUIDE_THRESHOLD = INLINE_GUIDE_THRESHOLD;
