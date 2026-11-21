/**
 * 작업판의 기본 프롬프트·기본 부정 프롬프트 (#1262) — 저장·내보내기·제자리 갱신·실행 시 값 고르기.
 *
 * 모델 제공자가 권하는 품질 태그·부정 프롬프트를 워크플로 문자열에 박지 않고 판 설정으로 둔다.
 * export 에 빠지거나 diff 가 보지 못하면 sync 로 배포되지 않고, 부정 프롬프트 폴백이 빈 문자열까지
 * 기본값으로 바꾸면 사용자가 칸을 비운 것이 무시된다.
 */
const Workboard = require('../models/Workboard');
const { diffWorkboard, UPDATABLE_FIELDS } = require('../utils/workboardDiff');
const { buildWorkboardExportEntry } = require('../utils/workboardExport');
const { getNegativePromptValue } = require('../utils/customFieldHelpers');

const base = {
  description: '', workboardType: 'image', outputFormat: 'image',
  additionalInputFields: [], workflowData: '{}',
};
const KEYS = ['defaultPrompt', 'defaultNegativePrompt'];

describe('Workboard 기본 프롬프트 (#1262)', () => {
  test.each(KEYS)('%s — 기본값은 빈 문자열, 저장 시 앞뒤 공백을 걷는다', (k) => {
    expect(new Workboard({ name: 't' })[k]).toBe('');
    expect(new Workboard({ name: 't', [k]: '  masterpiece, \n' })[k]).toBe('masterpiece,');
  });

  test.each(KEYS)('%s — 상한을 넘으면 검증 오류', (k) => {
    const max = Workboard.DEFAULT_PROMPT_MAX;
    expect(new Workboard({ name: 't', [k]: 'a'.repeat(max) }).validateSync()?.errors?.[k]).toBeUndefined();
    expect(new Workboard({ name: 't', [k]: 'a'.repeat(max + 1) }).validateSync().errors[k]).toBeDefined();
  });
});

describe('export · 제자리 갱신 (#1262)', () => {
  test.each(KEYS)('%s — export 에 실리고, 없으면 빈 문자열', (k) => {
    expect(buildWorkboardExportEntry({ ...base, name: 't', [k]: 'low quality' }).workboard[k]).toBe('low quality');
    expect(buildWorkboardExportEntry({ ...base, name: 't' }).workboard[k]).toBe('');
  });

  test.each(KEYS)('%s — 갱신 모드가 덮어쓰는 필드에 들어 있다', (k) => {
    expect(UPDATABLE_FIELDS).toContain(k);
  });

  test.each(KEYS)('%s — 바뀌면 변경으로 잡히고 경고는 붙지 않는다', (k) => {
    const d = diffWorkboard({ ...base, [k]: '' }, { ...base, [k]: 'low quality' });
    expect(d.identical).toBe(false);
    expect(d.changes.map((c) => c.target)).toContain(k);
    expect(d.warnings).toEqual([]);
  });

  test.each(KEYS)('%s — 앞뒤 공백만 다르면 같다', (k) => {
    const d = diffWorkboard({ ...base, [k]: 'low quality' }, { ...base, [k]: ' low quality\n' });
    expect(d.changes.filter((c) => c.target === k)).toEqual([]);
  });

  test.each(KEYS)('%s — 이 설정이 없는 옛 export 는 비교하지 않는다', (k) => {
    const d = diffWorkboard({ ...base, [k]: 'low quality' }, { ...base });
    expect(d.changes.filter((c) => c.target === k)).toEqual([]);
  });

  test('필드가 없던 옛 판과 빈 값 export 는 같다 — 배포 후 첫 dry-run 이 would-update 로 뜨지 않는다', () => {
    const d = diffWorkboard({ ...base }, { ...base, defaultPrompt: '', defaultNegativePrompt: '' });
    expect(d.identical).toBe(true);
  });
});

describe('getNegativePromptValue — 실행에 쓸 부정 프롬프트 (#1262)', () => {
  const wb = { additionalInputFields: [], defaultNegativePrompt: 'worst quality' };

  test('보낸 값이 먼저다', () => {
    expect(getNegativePromptValue(wb, { negativePrompt: 'blurry' })).toBe('blurry');
  });

  test('빈 문자열도 값이다 — 사용자가 칸을 비운 것을 기본값으로 되돌리지 않는다', () => {
    expect(getNegativePromptValue(wb, { negativePrompt: '' })).toBe('');
  });

  test('아예 보내지 않았으면 판 기본값', () => {
    expect(getNegativePromptValue(wb, {})).toBe('worst quality');
    expect(getNegativePromptValue(wb, { negativePrompt: undefined })).toBe('worst quality');
    expect(getNegativePromptValue(wb, { negativePrompt: null })).toBe('worst quality');
  });

  test('판 기본값도 없으면 undefined', () => {
    expect(getNegativePromptValue({ additionalInputFields: [] }, {})).toBeUndefined();
    expect(getNegativePromptValue({ additionalInputFields: [], defaultNegativePrompt: '' }, {})).toBeUndefined();
  });
});
