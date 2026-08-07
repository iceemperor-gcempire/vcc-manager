// 시스템 프롬프트 합성 — 단일 소스 (#766).
//
// 이전에는 routes/jobs.js 와 services/pipelineRunService.js 에 같은 함수가 중복 정의돼 있었다.
// 가이드 층을 추가하면서 한쪽만 고치면 파이프라인 단계에서만 가이드가 조용히 빠지므로
// 여기로 합친다. 두 호출자는 이 모듈만 사용할 것.
//
// 층 순서 (앞선 층일수록 더 일반적인 지침):
//   1. [프롬프트 가이드]      — PromptGuide. 작업판에 연결된 전역 문서, 모든 사용자에게 동일
//   2. [작업 지침]            — 작업판 system_prompt 필드 또는 사용자의 systemPromptDoc
//   3. [배경 / 사전 컨텍스트]  — 사용자 소유 세계관/컨텍스트 문서
//
// 1 과 2·3 의 소유 모델이 다르다는 점이 핵심이다. 1 은 소유자가 없고, 2·3 은 요청자 소유다.

/** 문서 배열 → "## 제목\n본문" 을 구분선으로 이은 문자열 */
function joinDocs(docs) {
  return (docs || [])
    .map((d) => (d.title ? `## ${d.title}\n` : '') + (d.content || ''))
    .join('\n\n---\n\n');
}

/**
 * 시스템 프롬프트 합성.
 * @param {Object} parts
 * @param {Array}  [parts.guides]          — PromptGuide 문서 배열 (title/content)
 * @param {string} [parts.systemPrompt]    — 작업 지침
 * @param {Array}  [parts.worldviewTexts]  — 사용자 소유 컨텍스트 문서 (title/content)
 * @returns {string}
 */
function composeSystemPrompt({ guides, systemPrompt, worldviewTexts } = {}) {
  const sections = [];
  if (guides && guides.length > 0) {
    sections.push('[프롬프트 가이드]\n' + joinDocs(guides));
  }
  if (systemPrompt) {
    sections.push('[작업 지침]\n' + systemPrompt);
  }
  if (worldviewTexts && worldviewTexts.length > 0) {
    sections.push('[배경 / 사전 컨텍스트]\n' + joinDocs(worldviewTexts));
  }
  return sections.join('\n\n');
}

module.exports = { composeSystemPrompt, joinDocs };
