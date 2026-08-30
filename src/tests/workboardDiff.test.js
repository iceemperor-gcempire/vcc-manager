const { diffWorkboard, UPDATABLE_FIELDS } = require('../utils/workboardDiff');

/**
 * #886 — 작업판 갱신 diff · 위험 경고.
 * 경고는 입력·출력 계약이 깨지는 변경에만 붙는다. 라벨·설명·기본값 조정은 changes 에만.
 */
const wf = (nodes) => JSON.stringify(nodes);
const base = () => ({
  description: 'd',
  workboardType: 'image',
  outputFormat: 'video',
  additionalInputFields: [
    { name: 'first_frame', label: '첫 프레임', type: 'image', required: true },
    { name: 'steps', label: '스텝', type: 'select', defaultValue: '8', options: [{ key: '8', value: '8' }, { key: '4', value: '4' }] },
    { name: 'use_sol_attn', label: 'SolAttn', type: 'boolean', defaultValue: true },
  ],
  workflowData: wf({
    1: { class_type: 'LoadImage', inputs: { image: '{{##first_frame##}}' } },
    9: { class_type: 'BasicScheduler', inputs: { steps: '{{##steps##}}' } },
    200: { class_type: 'SolAttnPatch', inputs: { model: ['6', 0] }, _vcc: { bypassUnless: { condition: '{{##use_sol_attn##}}', passthrough: { 0: 'model' } } } },
    201: { class_type: 'VHS_VideoCombine', inputs: { images: ['10', 0], filename_prefix: '{{##user_id##}}\\video\\x' } },
  }),
  modelExposurePolicy: 'full', modelWhitelist: [], loraExposurePolicy: 'full', loraWhitelist: [], allowedModelTypes: [],
});
const clone = (o) => JSON.parse(JSON.stringify(o));

describe('diffWorkboard (#886)', () => {
  test('동일하면 identical, 경고 없음', () => {
    const r = diffWorkboard(base(), base());
    expect(r.identical).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  test('라벨·설명·기본값·옵션 추가는 경고 없이 changes 만', () => {
    const inc = clone(base());
    inc.description = 'd2';
    inc.additionalInputFields[1].label = '스텝 수';
    inc.additionalInputFields[1].defaultValue = '4';
    inc.additionalInputFields[1].options.push({ key: '12', value: '12' });
    const r = diffWorkboard(base(), inc);
    expect(r.identical).toBe(false);
    expect(r.warnings).toEqual([]);
    expect(r.changes.map((c) => c.kind)).toEqual(expect.arrayContaining(['description', 'field.label', 'field.default', 'field.options.added']));
  });

  test('필드 삭제 → FIELD_REMOVED, 같은 라벨·타입 추가면 이름 변경 힌트', () => {
    const inc = clone(base());
    inc.additionalInputFields[1] = { name: 'num_steps', label: '스텝', type: 'select', defaultValue: '8', options: [{ key: '8', value: '8' }] };
    inc.workflowData = inc.workflowData.replace('{{##steps##}}', '{{##num_steps##}}');
    const r = diffWorkboard(base(), inc);
    const w = r.warnings.find((x) => x.code === 'FIELD_REMOVED');
    expect(w).toBeTruthy();
    expect(w.target).toBe('steps');
    expect(w.message).toMatch(/num_steps/);
  });

  test('옵션 축소 → FIELD_OPTIONS_REMOVED (기본값 포함 시 명시)', () => {
    const inc = clone(base());
    inc.additionalInputFields[1].options = [{ key: '4', value: '4' }];
    inc.additionalInputFields[1].defaultValue = '4';
    const r = diffWorkboard(base(), inc);
    const w = r.warnings.find((x) => x.code === 'FIELD_OPTIONS_REMOVED');
    expect(w.message).toMatch(/기존 기본값도/);
  });

  test('타입 변경·필수화·출력 형식 변경은 각각 경고', () => {
    const inc = clone(base());
    inc.additionalInputFields[2].type = 'select';
    inc.additionalInputFields[1].required = true;
    inc.outputFormat = 'image';
    const codes = diffWorkboard(base(), inc).warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(['FIELD_TYPE_CHANGED', 'FIELD_REQUIRED_ADDED', 'OUTPUT_FORMAT_CHANGED']));
  });

  test('워크플로: 노드 추가는 changes, 저장 노드 제거는 SAVE_NODE_CHANGED', () => {
    const inc = clone(base());
    const nodes = JSON.parse(inc.workflowData);
    nodes[202] = { class_type: 'UpscaleModelLoader', inputs: { model_name: 'x' } };
    delete nodes[201];
    inc.workflowData = wf(nodes);
    const r = diffWorkboard(base(), inc);
    expect(r.summary.nodesAdded).toBe(1);
    expect(r.summary.nodesRemoved).toBe(1);
    expect(r.warnings.map((w) => w.code)).toContain('SAVE_NODE_CHANGED');
  });

  test('노드 inputs 만 바뀌면 node.inputs (경고 없음)', () => {
    const inc = clone(base());
    const nodes = JSON.parse(inc.workflowData);
    nodes[201].inputs.crf = 14;
    inc.workflowData = wf(nodes);
    const r = diffWorkboard(base(), inc);
    expect(r.changes).toEqual([{ kind: 'node.inputs', target: '201', detail: 'VHS_VideoCombine' }]);
    expect(r.warnings).toEqual([]);
  });

  test('필드 없는 placeholder → PLACEHOLDER_UNBOUND (내장·_attached 는 제외)', () => {
    const inc = clone(base());
    const nodes = JSON.parse(inc.workflowData);
    nodes[9].inputs.shift = '{{##shift_video##}}';
    nodes[9].inputs.seed = '{{##seed##}}';
    nodes[1].inputs.attached = '{{##first_frame_attached##}}';
    inc.workflowData = wf(nodes);
    const w = diffWorkboard(base(), inc).warnings.filter((x) => x.code === 'PLACEHOLDER_UNBOUND');
    expect(w.map((x) => x.target)).toEqual(['shift_video']);
  });

  test('mongoose doc (toObject) 도 받는다', () => {
    const doc = { toObject: () => base() };
    expect(diffWorkboard(doc, base()).identical).toBe(true);
  });

  test('UPDATABLE_FIELDS 에 소유·권한·통계 필드가 없다', () => {
    for (const k of ['_id', 'serverId', 'allowedGroupIds', 'isActive', 'usageCount', 'createdBy', 'version']) {
      expect(UPDATABLE_FIELDS).not.toContain(k);
    }
  });
});
