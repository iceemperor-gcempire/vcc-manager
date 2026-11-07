/**
 * #1142 — 판 파일에서 만든 작업판 템플릿 동기화 회귀 테스트.
 *
 * OpenAI 이미지 템플릿이 1.x 시절 필드로 멈춰 있던 건, 판 파일만 고치고 템플릿 사본은 잊었기 때문이다.
 * 판 파일을 고치고 `node scripts/sync-workboard-templates.js` 재실행을 잊으면 여기서 실패한다.
 * (serverTypesMirror.test.js 와 같은 single-source-of-truth 정책)
 */
const fs = require('fs');
const path = require('path');
const {
  TEMPLATE_SOURCES,
  TEMPLATE_KEYS,
  TEMPLATE_DIR,
  renderTemplate,
} = require('../../scripts/sync-workboard-templates');

const REPO_ROOT = path.join(__dirname, '../..');

describe('판 파일 → 작업판 템플릿 동기화 (#1142)', () => {
  test.each(TEMPLATE_SOURCES.map((e) => [e.target, e]))('%s 가 생성 결과와 일치 (sync 스크립트 재실행 필요 여부)', (_target, entry) => {
    const onDisk = fs.readFileSync(path.join(TEMPLATE_DIR, entry.target), 'utf8');
    expect(onDisk).toBe(renderTemplate(entry));
  });

  // "스크립트 출력 == 파일" 만 보면 스크립트 자신이 틀린 경우를 못 잡는다 (serverTypesMirror #805 교훈).
  // 원본 판 파일과 직접 대조한다
  test.each(TEMPLATE_SOURCES.map((e) => [e.target, e]))('%s 의 입력 칸·모델 제한이 판 파일과 같다', (_target, entry) => {
    const template = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, entry.target), 'utf8'));
    const { workboard } = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, entry.source), 'utf8'));
    expect(template.additionalInputFields).toEqual(workboard.additionalInputFields);
    expect(template.modelExposurePolicy).toBe(workboard.modelExposurePolicy);
    expect(template.modelWhitelist).toEqual(workboard.modelWhitelist);
  });

  test('이름·설명은 템플릿에 넣지 않는다 — 만들기 화면이 템플릿을 입력값 위에 덮어쓴다', () => {
    expect(TEMPLATE_KEYS).not.toContain('name');
    expect(TEMPLATE_KEYS).not.toContain('description');
    for (const entry of TEMPLATE_SOURCES) {
      const template = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, entry.target), 'utf8'));
      expect(template).not.toHaveProperty('name');
      expect(template).not.toHaveProperty('description');
    }
  });

  test('생성한 템플릿은 모두 index.js 에 등록돼 있다', () => {
    const indexSrc = fs.readFileSync(path.join(TEMPLATE_DIR, 'index.js'), 'utf8');
    for (const entry of TEMPLATE_SOURCES) {
      expect(indexSrc).toContain(`'./${entry.target}'`);
    }
  });

  test('템플릿 id 는 겹치지 않는다', () => {
    const ids = TEMPLATE_SOURCES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
