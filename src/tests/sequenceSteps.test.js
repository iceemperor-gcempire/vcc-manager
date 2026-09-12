/**
 * 작업 절차 단계 정규화·점검 (#952).
 */
const {
  normalizeSequenceSteps, computeGroupCoverage, checkRunnable, describeBlockedSteps,
} = require('../utils/sequenceSteps');

const WB_TEXT = {
  _id: 'a'.repeat(24), name: '프롬프트 LLM', outputFormat: 'text', isActive: true, allowedGroupIds: ['g1', 'g2'],
  additionalInputFields: [{ name: 'system_prompt', type: 'string' }],
};
const WB_IMAGE = {
  _id: 'b'.repeat(24), name: '이미지', outputFormat: 'image', isActive: true, allowedGroupIds: ['g1'],
  additionalInputFields: [
    { name: 'ref_image', type: 'image' },
    { name: 'steps', type: 'number' },
    { name: 'voice', type: 'audio' },
  ],
};
const DOC1 = 'c'.repeat(24);
const DOC2 = 'd'.repeat(24);

const refs = () => ({
  workboardsById: new Map([[WB_TEXT._id, WB_TEXT], [WB_IMAGE._id, WB_IMAGE]]),
  existingDocIds: new Set([DOC1, DOC2]),
});

describe('normalizeSequenceSteps', () => {
  test('미디어 필드 사전 입력은 저장하지 않고 경고, 나머지 값은 보존', () => {
    const out = normalizeSequenceSteps([
      { workboardId: WB_IMAGE._id, inputs: { ref_image: ['x'], steps: 8, voice: 'y', prompt: '고정' } },
    ], refs());
    expect(out.ok).toBe(true);
    expect(out.steps[0].inputs).toEqual({ steps: 8, prompt: '고정' });
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toContain('ref_image');
    expect(out.warnings[0]).toContain('voice');
  });

  test('존재하지 않는 작업판 → 실패', () => {
    const out = normalizeSequenceSteps([{ workboardId: 'e'.repeat(24) }], refs());
    expect(out).toEqual({ ok: false, message: '1단계: 존재하지 않는 작업판입니다' });
  });

  test('작업판 미지정·형식 오류 → 실패', () => {
    expect(normalizeSequenceSteps([{}], refs()).ok).toBe(false);
    expect(normalizeSequenceSteps([{ workboardId: 'nope' }], refs()).ok).toBe(false);
  });

  test('존재하지 않는 문서 → 실패', () => {
    const out = normalizeSequenceSteps([
      { workboardId: WB_TEXT._id, contextDocIds: [DOC1, 'f'.repeat(24)] },
    ], refs());
    expect(out.ok).toBe(false);
    expect(out.message).toContain('문서');
  });

  test('populate 된 작업판·문서 객체도 id 로 받고, 중복 문서는 한 번만', () => {
    const out = normalizeSequenceSteps([
      { workboardId: { _id: WB_TEXT._id, name: 'x' }, contextDocIds: [{ _id: DOC1 }, DOC1], systemPromptDocId: { _id: DOC2 } },
    ], refs());
    expect(out.ok).toBe(true);
    expect(out.steps[0]).toMatchObject({ workboardId: WB_TEXT._id, contextDocIds: [DOC1], systemPromptDocId: DOC2 });
    expect(out.warnings).toEqual([]);
  });

  test('텍스트가 아닌 단계에 문서 → 저장하되 경고', () => {
    const out = normalizeSequenceSteps([{ workboardId: WB_IMAGE._id, contextDocIds: [DOC1] }], refs());
    expect(out.ok).toBe(true);
    expect(out.steps[0].contextDocIds).toEqual([DOC1]);
    expect(out.warnings[0]).toContain('텍스트 단계에만');
  });

  test('단계 _id 보존 — 같은 _id 가 또 오면 두 번째는 새로 발급받게 비운다', () => {
    const sid = '1'.repeat(24);
    const out = normalizeSequenceSteps([
      { _id: sid, workboardId: WB_TEXT._id },
      { _id: sid, workboardId: WB_IMAGE._id },
      { _id: 'bad', workboardId: WB_IMAGE._id },
    ], refs());
    expect(out.steps[0]._id).toBe(sid);
    expect(out.steps[1]._id).toBeUndefined();
    expect(out.steps[2]._id).toBeUndefined();
  });

  test('autoInject 기본 true, note 는 trim + 500자', () => {
    const out = normalizeSequenceSteps([
      { workboardId: WB_TEXT._id, note: `  ${'가'.repeat(600)}  ` },
      { workboardId: WB_IMAGE._id, autoInject: false },
    ], refs());
    expect(out.steps[0].autoInject).toBe(true);
    expect(out.steps[0].note).toHaveLength(500);
    expect(out.steps[1].autoInject).toBe(false);
  });

  test('steps 가 배열이 아니면 실패', () => {
    expect(normalizeSequenceSteps('x', refs()).ok).toBe(false);
  });
});

describe('computeGroupCoverage — 작업 절차 그룹에 작업판이 안 열린 단계', () => {
  const byId = new Map([[WB_TEXT._id, WB_TEXT], [WB_IMAGE._id, { ...WB_IMAGE }]]);

  test('모든 단계 작업판이 그룹을 덮으면 빈 배열', () => {
    const seq = { allowedGroupIds: ['g1'], steps: [{ workboardId: WB_TEXT._id }, { workboardId: WB_IMAGE._id }] };
    expect(computeGroupCoverage(seq, byId)).toEqual([]);
  });

  test('일부 그룹이 빠진 단계만, 빠진 그룹 id 와 함께', () => {
    const seq = { allowedGroupIds: [{ _id: 'g1', name: 'A' }, { _id: 'g2', name: 'B' }], steps: [{ workboardId: WB_TEXT._id }, { workboardId: WB_IMAGE._id }] };
    expect(computeGroupCoverage(seq, byId)).toEqual([
      { stepIndex: 1, workboardId: WB_IMAGE._id, workboardName: '이미지', missingGroupIds: ['g2'], inactive: false, missing: false },
    ]);
  });

  test('비활성·삭제된 작업판도 표시', () => {
    const inactive = new Map([[WB_TEXT._id, { ...WB_TEXT, isActive: false }]]);
    const seq = { allowedGroupIds: ['g1'], steps: [{ workboardId: WB_TEXT._id }, { workboardId: 'e'.repeat(24) }] };
    const out = computeGroupCoverage(seq, inactive);
    expect(out[0]).toMatchObject({ stepIndex: 0, inactive: true, missingGroupIds: [] });
    expect(out[1]).toMatchObject({ stepIndex: 1, missing: true });
  });
});

describe('checkRunnable — 실행 전 점검 (작업판 접근은 독립 판정, #802)', () => {
  const access = (user, wb) => user.isAdmin || (wb.allowedGroupIds || []).some((g) => (user.groupIds || []).includes(g));
  const byId = new Map([[WB_TEXT._id, WB_TEXT], [WB_IMAGE._id, WB_IMAGE]]);
  const seq = { steps: [{ workboardId: WB_TEXT._id }, { workboardId: WB_IMAGE._id }] };

  test('모든 작업판에 접근 가능 → 실행 가능', () => {
    expect(checkRunnable({ groupIds: ['g1'] }, seq, byId, access)).toEqual({ runnable: true, blockedSteps: [] });
  });

  test('한 단계라도 작업판 접근이 없으면 막힌다', () => {
    const out = checkRunnable({ groupIds: ['g2'] }, seq, byId, access);
    expect(out.runnable).toBe(false);
    expect(out.blockedSteps).toEqual([{ stepIndex: 1, reason: 'no_access', workboardName: '이미지' }]);
    expect(describeBlockedSteps(out.blockedSteps)).toBe('실행할 수 없는 단계가 있습니다 — 2단계 (이미지): 작업판 접근 권한 없음');
  });

  test('비활성·삭제 작업판은 admin 도 막힌다', () => {
    const withInactive = new Map([[WB_TEXT._id, { ...WB_TEXT, isActive: false }]]);
    const out = checkRunnable({ isAdmin: true }, seq, withInactive, access);
    expect(out.blockedSteps.map((b) => b.reason)).toEqual(['inactive', 'missing']);
  });

  test('단계가 없으면 실행 불가', () => {
    expect(checkRunnable({ isAdmin: true }, { steps: [] }, byId, access).runnable).toBe(false);
  });
});
