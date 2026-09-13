const express = require('express');
const {
  requireAuth, requireAdmin, userHasWorkboardAccess, userHasSequenceAccess, buildSequenceAccessFilter,
} = require('../middleware/auth');
const Sequence = require('../models/Sequence');
const SequenceDoc = require('../models/SequenceDoc');
const Workboard = require('../models/Workboard');
const Group = require('../models/Group');
const { idOf } = require('../utils/runSteps');
const { normalizeSequenceSteps, computeGroupCoverage, checkRunnable } = require('../utils/sequenceSteps');
const { resolveStepInputs, defaultValueOf, maxItemsOf } = require('../utils/sequenceInputs');
const { ATTACHMENT_FIELD_TYPES } = require('../constants/mediaTypes');

const router = express.Router();

// 작업 절차 (#952, Epic #951). mounted at /api/sequences
//
// 목록·상세는 그룹 판정(작업판과 같은 축), 생성·수정·삭제는 admin.
// ?view=manage (admin 전용) 는 편집기용 전체 정의와 그룹 커버리지 점검을 돌려준다.
// 일반 응답에는 운영 정보(접근 그룹·잠긴 입력의 작성자 값·문서 id·작업판의 접근 그룹)를 싣지 않는다.
// 입력 출처(노출·잠금·앞 단계, #953)는 utils/sequenceInputs 가 계산한 결과를 그대로 싣는다 — 화면이 따로 판정하지 않게.
// 없는 것과 권한 없는 것은 같은 404 — 존재 여부를 흘리지 않는다.

const NOT_FOUND = '작업 절차를 찾을 수 없습니다';
const isId = (v) => /^[a-f0-9]{24}$/i.test(String(v));

async function loadStepWorkboards(sequences, { withFields = false } = {}) {
  const ids = [...new Set(sequences.flatMap((s) => (s.steps || []).map((st) => idOf(st.workboardId))))].filter(isId);
  if (ids.length === 0) return new Map();
  const fields = `name description outputFormat isActive allowedGroupIds serverId${withFields ? ' additionalInputFields allowedModelTypes' : ''}`;
  let query = Workboard.find({ _id: { $in: ids } }).select(fields);
  if (withFields) query = query.populate('serverId', 'name serverType');
  const workboards = await query.lean();
  return new Map(workboards.map((w) => [String(w._id), w]));
}

function presentField(field) {
  return {
    name: field.name,
    label: field.label,
    type: field.type,
    required: field.required,
    implicit: !!field.implicit,
    description: field.description,
    placeholder: field.placeholder,
    options: field.options,
    validation: field.validation,
    maxItems: ATTACHMENT_FIELD_TYPES.includes(field.type) ? maxItemsOf(field) : undefined,
  };
}

function resolvedFor(steps, stepIndex, workboardsById) {
  const step = steps[stepIndex];
  const workboard = workboardsById.get(idOf(step.workboardId));
  if (!workboard) return null;
  const previousWorkboard = stepIndex > 0 ? workboardsById.get(idOf(steps[stepIndex - 1].workboardId)) : null;
  return resolveStepInputs({ workboard, step, stepIndex, previousWorkboard });
}

// 실행 화면용 — 노출·앞 단계 필드만. 잠긴 필드는 개수만 (작성자 값은 싣지 않는다)
function runnerFields(steps, stepIndex, workboardsById) {
  const resolved = resolvedFor(steps, stepIndex, workboardsById);
  if (!resolved) return { fields: [], lockedCount: 0 };
  const step = steps[stepIndex];
  const fields = resolved
    .filter((r) => r.mode !== 'locked')
    .map(({ field, mode }) => ({
      ...presentField(field),
      mode,
      defaultValue: mode === 'exposed' ? defaultValueOf(field, step.inputs) : undefined,
    }));
  return { fields, lockedCount: resolved.length - fields.length };
}

// 편집기용 — 전 필드의 분류·기본 출처·현재 출처
function fieldModes(resolved) {
  return (resolved || []).map(({ field, kind, defaultMode, mode }) => ({
    ...presentField(field),
    defaultValue: field.defaultValue,
    kind,
    defaultMode,
    mode,
  }));
}

function toUserView(seq, user, workboardsById, { withFields = false } = {}) {
  const { runnable, blockedSteps } = checkRunnable(user, seq, workboardsById, userHasWorkboardAccess);
  const blockedByIndex = new Map(blockedSteps.map((b) => [b.stepIndex, b.reason]));
  const steps = seq.steps || [];
  return {
    _id: seq._id,
    name: seq.name,
    description: seq.description,
    isActive: seq.isActive,
    updatedAt: seq.updatedAt,
    runnable,
    steps: steps.map((st, i) => {
      const wb = workboardsById.get(idOf(st.workboardId));
      const view = {
        _id: st._id,
        workboard: wb ? { _id: wb._id, name: wb.name, description: wb.description, outputFormat: wb.outputFormat } : null,
        note: st.note || '',
        autoInject: st.autoInject !== false,
        docCount: (st.contextDocIds || []).length + (st.systemPromptDocId ? 1 : 0),
        blocked: blockedByIndex.get(i) || null,
      };
      if (withFields && wb) {
        // 모델·LoRA 선택기와 첨부 안내에 필요한 것만
        view.workboard.serverId = idOf(wb.serverId);
        view.workboard.serverType = wb.serverId?.serverType;
        view.workboard.allowedModelTypes = wb.allowedModelTypes || [];
        Object.assign(view, runnerFields(steps, i, workboardsById));
      }
      return view;
    }),
  };
}

function toManageView(seq, workboardsById, { withFields = false } = {}) {
  const groupNames = new Map((seq.allowedGroupIds || [])
    .filter((g) => g && typeof g === 'object' && 'name' in g)
    .map((g) => [String(g._id), g.name]));
  const coverage = computeGroupCoverage(seq, workboardsById).map((c) => ({
    ...c,
    missingGroups: c.missingGroupIds.map((id) => ({ _id: id, name: groupNames.get(id) || null })),
  }));
  const steps = seq.steps || [];
  return {
    ...seq,
    // 관리 보기는 작업판의 접근 그룹까지 싣는다 — 편집기가 그룹 공백을 바로 계산한다
    steps: steps.map((st, i) => ({
      ...st,
      workboard: workboardsById.get(idOf(st.workboardId)) || null,
      ...(withFields ? { fieldModes: fieldModes(resolvedFor(steps, i, workboardsById)) } : {}),
    })),
    coverage,
  };
}

async function prepareSteps(rawSteps) {
  if (!Array.isArray(rawSteps)) return { ok: false, message: 'steps 는 배열이어야 합니다' };
  const workboardIds = rawSteps.map((s) => idOf(s && s.workboardId)).filter(isId);
  const docIds = rawSteps
    .flatMap((s) => [...(Array.isArray(s?.contextDocIds) ? s.contextDocIds : []), s?.systemPromptDocId])
    .filter(Boolean)
    .map(idOf)
    .filter(isId);
  const [workboards, docs] = await Promise.all([
    workboardIds.length
      ? Workboard.find({ _id: { $in: workboardIds } }).select('name outputFormat additionalInputFields').lean()
      : [],
    docIds.length ? SequenceDoc.find({ _id: { $in: docIds } }).select('_id').lean() : [],
  ]);
  return normalizeSequenceSteps(rawSteps, {
    workboardsById: new Map(workboards.map((w) => [String(w._id), w])),
    existingDocIds: new Set(docs.map((d) => String(d._id))),
  });
}

// 없는 그룹 id 는 저장하지 않는다 — 삭제된 그룹 참조가 유령 권한이 된 사고(#740) 방지.
async function resolveGroupIds(raw) {
  const ids = [...new Set((Array.isArray(raw) ? raw : []).map(idOf).filter(isId))];
  if (ids.length === 0) return { ids: [], warnings: [] };
  const found = await Group.find({ _id: { $in: ids } }).select('_id').lean();
  const existing = new Set(found.map((g) => String(g._id)));
  const dropped = ids.filter((id) => !existing.has(id));
  return {
    ids: ids.filter((id) => existing.has(id)),
    warnings: dropped.length ? [`존재하지 않는 그룹 ${dropped.length}개는 저장하지 않았습니다`] : [],
  };
}

function handleError(res, error, message) {
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error(`${message}:`, error);
  return res.status(500).json({ success: false, message });
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const manage = req.query.view === 'manage';
    if (manage && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: '관리자만 사용할 수 있습니다' });
    }
    // 사용자 목록은 활성만 — 비활성은 관리 화면에서만 다룬다 (admin 포함)
    const filter = manage ? {} : { ...buildSequenceAccessFilter(req.user), isActive: true };
    let query = Sequence.find(filter).sort({ updatedAt: -1 });
    if (manage) query = query.populate('allowedGroupIds', 'name isDefault').populate('createdBy', 'nickname email');
    const sequences = await query.lean();
    const workboardsById = await loadStepWorkboards(sequences);
    res.json({
      success: true,
      data: {
        sequences: sequences.map((s) => (manage ? toManageView(s, workboardsById) : toUserView(s, req.user, workboardsById))),
      },
    });
  } catch (error) {
    handleError(res, error, '작업 절차 목록을 불러오지 못했습니다');
  }
});

// 편집 중인 단계 구성의 입력 출처 미리보기 (admin). 순서·자동 주입·출처를 바꾸면 기본 분류가 달라지는데,
// 분류는 서버 한 곳에서만 계산한다 — 편집기가 따로 흉내 내면 저장 뒤 실제 동작과 어긋난다.
router.post('/preview-inputs', requireAdmin, async (req, res) => {
  try {
    const raw = Array.isArray(req.body?.steps) ? req.body.steps : [];
    const steps = raw.map((s) => ({
      workboardId: idOf(s?.workboardId),
      autoInject: s?.autoInject,
      inputSources: s?.inputSources,
      inputs: s?.inputs,
    }));
    const workboardsById = await loadStepWorkboards([{ steps }], { withFields: true });
    res.json({
      success: true,
      data: { steps: steps.map((_, i) => ({ fieldModes: fieldModes(resolvedFor(steps, i, workboardsById)) })) },
    });
  } catch (error) {
    handleError(res, error, '입력 출처를 계산하지 못했습니다');
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: NOT_FOUND });
    const manage = req.query.view === 'manage';
    if (manage && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: '관리자만 사용할 수 있습니다' });
    }
    let query = Sequence.findById(req.params.id);
    if (manage) query = query.populate('allowedGroupIds', 'name isDefault').populate('createdBy', 'nickname email');
    const seq = await query.lean();
    if (!seq || (!manage && !userHasSequenceAccess(req.user, seq))) {
      return res.status(404).json({ success: false, message: NOT_FOUND });
    }
    const workboardsById = await loadStepWorkboards([seq], { withFields: true });
    res.json({
      success: true,
      data: {
        sequence: manage
          ? toManageView(seq, workboardsById, { withFields: true })
          : toUserView(seq, req.user, workboardsById, { withFields: true }),
      },
    });
  } catch (error) {
    handleError(res, error, '작업 절차를 불러오지 못했습니다');
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, description, steps = [], allowedGroupIds = [], isActive } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: '이름은 필수입니다' });
    }
    const prepared = await prepareSteps(steps);
    if (!prepared.ok) return res.status(400).json({ success: false, message: prepared.message });
    const groups = await resolveGroupIds(allowedGroupIds);
    const sequence = await Sequence.create({
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      steps: prepared.steps,
      allowedGroupIds: groups.ids,
      isActive: isActive !== false,
      createdBy: req.user._id,
    });
    res.status(201).json({
      success: true,
      data: { sequence, warnings: [...prepared.warnings, ...groups.warnings] },
      message: '작업 절차가 생성되었습니다',
    });
  } catch (error) {
    handleError(res, error, '작업 절차 생성에 실패했습니다');
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: NOT_FOUND });
    const sequence = await Sequence.findById(req.params.id);
    if (!sequence) return res.status(404).json({ success: false, message: NOT_FOUND });

    const { name, description, steps, allowedGroupIds, isActive } = req.body || {};
    const warnings = [];
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: '이름은 비울 수 없습니다' });
      }
      sequence.name = name.trim();
    }
    if (typeof description === 'string') sequence.description = description.trim();
    if (isActive !== undefined) sequence.isActive = !!isActive;
    if (steps !== undefined) {
      const prepared = await prepareSteps(steps);
      if (!prepared.ok) return res.status(400).json({ success: false, message: prepared.message });
      sequence.steps = prepared.steps;
      // Mixed 타입(step.inputs · inputSources) 변경은 mongoose 가 감지하지 못한다
      sequence.markModified('steps');
      warnings.push(...prepared.warnings);
    }
    if (allowedGroupIds !== undefined) {
      const groups = await resolveGroupIds(allowedGroupIds);
      sequence.allowedGroupIds = groups.ids;
      warnings.push(...groups.warnings);
    }
    await sequence.save();
    res.json({ success: true, data: { sequence, warnings }, message: '작업 절차가 수정되었습니다' });
  } catch (error) {
    handleError(res, error, '작업 절차 수정에 실패했습니다');
  }
});

// 삭제 — 실행 기록(SequenceRun)은 실행자 자산이라 남긴다. 기록에는 실행 시점 이름이 남아 있다.
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: NOT_FOUND });
    const deleted = await Sequence.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: NOT_FOUND });
    res.json({ success: true, message: '작업 절차가 삭제되었습니다. 실행 기록은 남습니다' });
  } catch (error) {
    handleError(res, error, '작업 절차 삭제에 실패했습니다');
  }
});

module.exports = router;
