/**
 * 작업판의 AI 프롬프트 생성 지침 (#1109) — 저장·내보내기·제자리 갱신 경로.
 *
 * 지침은 판 export 로 프로덕션에 배포된다. export 에 빠지거나 diff 가 보지 못하면 sync 로 영영 못 보내고,
 * 정규화(trim) 가 어긋나면 dry-run 이 영원히 would-update 로 남는다 (#939 와 같은 부류).
 */
const Workboard = require('../models/Workboard');
const { diffWorkboard, UPDATABLE_FIELDS } = require('../utils/workboardDiff');
const { buildWorkboardExportEntry } = require('../utils/workboardExport');

const base = {
  description: '', workboardType: 'image', outputFormat: 'image',
  additionalInputFields: [], workflowData: '{}',
};

describe('Workboard.promptGeneratorInstructions (#1109)', () => {
  test('기본값은 빈 문자열, 저장 시 앞뒤 공백을 걷는다', () => {
    expect(new Workboard({ name: 't' }).promptGeneratorInstructions).toBe('');
    expect(new Workboard({ name: 't', promptGeneratorInstructions: '  지침\n' }).promptGeneratorInstructions).toBe('지침');
  });

  test('상한을 넘으면 검증 오류', () => {
    const max = Workboard.PROMPT_GENERATOR_INSTRUCTIONS_MAX;
    const ok = new Workboard({ name: 't', promptGeneratorInstructions: 'a'.repeat(max) }).validateSync();
    const over = new Workboard({ name: 't', promptGeneratorInstructions: 'a'.repeat(max + 1) }).validateSync();
    expect(ok?.errors?.promptGeneratorInstructions).toBeUndefined();
    expect(over.errors.promptGeneratorInstructions).toBeDefined();
  });
});

describe('export · 제자리 갱신 (#1109)', () => {
  test('export 에 실린다 — 없으면 빈 문자열', () => {
    expect(buildWorkboardExportEntry({ ...base, name: 't', promptGeneratorInstructions: '지침' }).workboard.promptGeneratorInstructions).toBe('지침');
    expect(buildWorkboardExportEntry({ ...base, name: 't' }).workboard.promptGeneratorInstructions).toBe('');
  });

  test('갱신 모드가 덮어쓰는 필드에 들어 있다', () => {
    expect(UPDATABLE_FIELDS).toContain('promptGeneratorInstructions');
  });

  test('바뀌면 변경으로 잡히고, 경고는 붙지 않는다 — 기존 작업의 입출력과 무관', () => {
    const d = diffWorkboard({ ...base, promptGeneratorInstructions: '' }, { ...base, promptGeneratorInstructions: '영어로 쓴다' });
    expect(d.identical).toBe(false);
    expect(d.changes).toContainEqual({ kind: 'promptGeneratorInstructions', target: 'promptGeneratorInstructions' });
    expect(d.warnings).toEqual([]);
  });

  test('앞뒤 공백만 다르면 같다 — 저장 정규화와 맞춘다', () => {
    const d = diffWorkboard({ ...base, promptGeneratorInstructions: '지침' }, { ...base, promptGeneratorInstructions: '  지침\n' });
    expect(d.changes.filter((c) => c.target === 'promptGeneratorInstructions')).toEqual([]);
  });

  test('이 설정이 없는 옛 export 는 비교하지 않는다 — 갱신 때도 덮어쓰지 않으므로', () => {
    const d = diffWorkboard({ ...base, promptGeneratorInstructions: '지침' }, { ...base });
    expect(d.changes.filter((c) => c.target === 'promptGeneratorInstructions')).toEqual([]);
  });

  test('필드가 없던 옛 판과 빈 지침 export 는 같다 — 배포 후 첫 dry-run 이 would-update 로 뜨지 않는다', () => {
    const d = diffWorkboard({ ...base }, { ...base, promptGeneratorInstructions: '' });
    expect(d.identical).toBe(true);
  });
});
