const { composeSystemPrompt, joinDocs } = require('../utils/promptComposition');

// #766 — jobs.js / pipelineRunService.js 에 중복 정의돼 있던 합성 로직의 단일 소스.
// 가이드 층 추가 후에도 기존 두 층의 출력이 바뀌지 않아야 한다 (회귀 방지).

const GUIDE = { title: 'H3 가이드', content: '가이드 본문' };
const GUIDE2 = { title: '공통 원칙', content: '원칙 본문' };
const DOC = { title: '세계관', content: '배경 본문' };

describe('composeSystemPrompt (#766)', () => {
  describe('층 구성', () => {
    test('아무것도 없으면 빈 문자열', () => {
      expect(composeSystemPrompt({})).toBe('');
      expect(composeSystemPrompt()).toBe('');
    });

    test('작업 지침만 — 가이드 도입 전과 동일한 출력', () => {
      expect(composeSystemPrompt({ systemPrompt: '지침' })).toBe('[작업 지침]\n지침');
    });

    test('작업 지침 + 컨텍스트 — 가이드 도입 전과 동일한 출력', () => {
      const out = composeSystemPrompt({ systemPrompt: '지침', worldviewTexts: [DOC] });
      expect(out).toBe('[작업 지침]\n지침\n\n[배경 / 사전 컨텍스트]\n## 세계관\n배경 본문');
    });

    test('가이드만 있어도 합성된다', () => {
      expect(composeSystemPrompt({ guides: [GUIDE] })).toBe('[프롬프트 가이드]\n## H3 가이드\n가이드 본문');
    });

    test('세 층 모두 — 가이드 → 작업 지침 → 배경 순서', () => {
      const out = composeSystemPrompt({
        guides: [GUIDE],
        systemPrompt: '지침',
        worldviewTexts: [DOC],
      });
      expect(out.indexOf('[프롬프트 가이드]')).toBeLessThan(out.indexOf('[작업 지침]'));
      expect(out.indexOf('[작업 지침]')).toBeLessThan(out.indexOf('[배경 / 사전 컨텍스트]'));
    });
  });

  describe('가이드 배열 (작업판당 다중 연결)', () => {
    test('전달된 순서대로 이어붙인다 — 순서가 바뀌면 LLM 출력이 달라지므로 기능 요구사항', () => {
      const out = composeSystemPrompt({ guides: [GUIDE2, GUIDE] });
      expect(out.indexOf('공통 원칙')).toBeLessThan(out.indexOf('H3 가이드'));
    });

    test('여러 가이드는 구분선으로 분리된다', () => {
      expect(composeSystemPrompt({ guides: [GUIDE2, GUIDE] })).toContain('\n\n---\n\n');
    });

    test('빈 배열은 층을 만들지 않는다', () => {
      expect(composeSystemPrompt({ guides: [], systemPrompt: '지침' })).toBe('[작업 지침]\n지침');
    });
  });

  describe('joinDocs', () => {
    test('제목 없으면 헤더를 붙이지 않는다', () => {
      expect(joinDocs([{ content: '본문' }])).toBe('본문');
    });

    test('content 누락은 빈 문자열로 처리', () => {
      expect(joinDocs([{ title: 'T' }])).toBe('## T\n');
    });

    test('빈 입력', () => {
      expect(joinDocs([])).toBe('');
      expect(joinDocs(undefined)).toBe('');
    });
  });
});
