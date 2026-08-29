// 작업 히스토리 메모 (#879) — 사용자가 작업 후 "이게 무슨 작업이었는지" 를 한 줄로 남긴다.
//
// 길이 상한의 단일 source. frontend/src/constants/jobMemo.js 는 mirror (모듈 시스템이
// 달라 직접 import 불가) — 바꾸면 양쪽 모두 갱신 (jobMemoMirror.test.js 가 어긋남을 잡는다).
const JOB_MEMO_MAX_LENGTH = 100;

/**
 * 입력을 저장 형태로 정규화한다.
 * - 문자열이 아니면 빈 메모 (null/undefined 로 지우기 허용)
 * - 개행·탭·연속 공백은 한 칸으로 — 한 줄 메모다
 * - 앞뒤 공백 제거 후 상한 초과면 error
 *
 * @returns {{ memo: string, error: string|null }}
 */
function normalizeJobMemo(raw) {
  if (raw === undefined || raw === null) return { memo: '', error: null };
  if (typeof raw !== 'string') return { memo: '', error: '메모는 문자열이어야 합니다.' };
  const memo = raw.replace(/\s+/g, ' ').trim();
  if (memo.length > JOB_MEMO_MAX_LENGTH) {
    return { memo, error: `메모는 ${JOB_MEMO_MAX_LENGTH}자 이내여야 합니다. (현재 ${memo.length}자)` };
  }
  return { memo, error: null };
}

module.exports = { JOB_MEMO_MAX_LENGTH, normalizeJobMemo };
