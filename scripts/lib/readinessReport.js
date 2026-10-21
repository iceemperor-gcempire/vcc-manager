// 작업판 준비 검사 결과(#1087) 를 동기화 스크립트 출력으로 만든다. 순수 함수.
//
// 판마다 한 줄은 반드시 남긴다 — 문제가 0 이어도. "검사했고 없었다" 와 "검사가 안 돌았다"(옛 서버·
// ComfyUI 에 못 닿음)를 출력만으로 가를 수 있어야 한다.

/**
 * @param {Object|undefined} readiness — import 응답의 readiness
 * @returns {{ status: 'ok'|'issues'|'unavailable'|'skipped'|'unsupported', lines: string[] }}
 */
function formatReadiness(readiness) {
  if (!readiness) {
    return { status: 'unsupported', lines: ['준비 검사: 서버가 지원하지 않음 (v4.13.0 이상)'] };
  }
  if (readiness.skipped) return { status: 'skipped', lines: [`준비 검사: 해당 없음 — ${readiness.skipped}`] };
  if (readiness.unavailable) return { status: 'unavailable', lines: [`? 준비 검사 못 함 — ${readiness.unavailable}`] };
  const c = readiness.checked || {};
  const issues = readiness.issues || [];
  const lines = issues.map((i) => `✗ [${i.code}] ${i.message}`);
  const listCheck = c.defaultModel === 'missing' ? '건너뜀 (기본 모델 파일 없음)' : c.defaultModel ? '확인' : '해당 없음';
  lines.push(`준비 검사: 노드 ${c.nodes || 0} · 선택값 ${c.values || 0} · 기본 모델 목록 ${listCheck} — 문제 ${issues.length}`);
  return { status: issues.length ? 'issues' : 'ok', lines };
}

/** 판 전체 요약 한 줄 */
function summarizeReadiness(statuses) {
  const count = (s) => statuses.filter((x) => x.status === s).length;
  const problems = statuses.filter((x) => x.status === 'issues').reduce((n, x) => n + x.issueCount, 0);
  return `서버 준비 검사 — 판 ${statuses.length}개: 문제 있음 ${count('issues')} (${problems}건) · 확인 못 함 ${count('unavailable')} · 해당 없음 ${count('skipped')} · 지원 안 함 ${count('unsupported')}`;
}

module.exports = { formatReadiness, summarizeReadiness };
