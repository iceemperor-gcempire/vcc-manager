// 작업 히스토리 메모 길이 상한 (#879) — 백엔드 src/constants/jobMemo.js 의 mirror.
// 검증은 백엔드가 한다 (초과 시 400). 여기 값은 입력칸 maxLength 와 글자 수 표시용.
// 바꾸면 백엔드도 함께 — src/tests/jobMemoMirror.test.js 가 어긋남을 잡는다.
export const JOB_MEMO_MAX_LENGTH = 100;
