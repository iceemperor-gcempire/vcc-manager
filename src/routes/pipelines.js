const express = require('express');
const { requireAuth, userHasWorkboardAccess } = require('../middleware/auth');
const { loadProjectForRead, loadProjectForManage } = require('../middleware/projectAccess');
const Pipeline = require('../models/Pipeline');
const Project = require('../models/Project');
const Workboard = require('../models/Workboard');

const router = express.Router({ mergeParams: true });

// 프로젝트 종속 파이프라인 CRUD (#397). mounted at /api/projects/:projectId/pipelines

// #802 — 프로젝트 접근 판정은 middleware/projectAccess 로 이관.
// 읽기·실행은 공유 그룹까지 허용, 구조 변경은 소유자·admin 만.
const loadProject = loadProjectForRead('projectId');
const loadProjectManage = loadProjectForManage('projectId');

// 모든 단계 워크보드가 사용자 소유인지 검증
async function validateSteps(user, steps) {
  if (!Array.isArray(steps) || steps.length === 0) return { ok: false, message: '단계가 비어 있습니다' };
  const ids = steps.map((s) => s.workboardId).filter(Boolean);
  if (ids.length !== steps.length) return { ok: false, message: '각 단계에 workboardId 필수' };
  const wbs = await Workboard.find({ _id: { $in: ids } }).lean();
  if (wbs.length !== new Set(ids.map(String)).size) {
    // 일부 id 가 중복일 수 있으므로 unique 비교
    if (wbs.length === 0) return { ok: false, message: '존재하지 않는 작업판이 있습니다' };
  }
  // 작업판 접근 검사 (#802) — 예전에는 "작업판은 공용일 수 있으니 존재만 확인" 했다.
  // 그룹 접근 통제(#198) 도입으로 그 전제가 깨졌고, 접근 권한 없는 작업판을
  // 파이프라인 단계로 넣어 실행하는 우회가 가능했다.
  const denied = wbs.filter((wb) => !userHasWorkboardAccess(user, wb));
  if (denied.length > 0) {
    return { ok: false, message: `접근 권한이 없는 작업판이 포함되어 있습니다: ${denied.map((w) => w.name).join(', ')}` };
  }
  return { ok: true };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const pipelines = await Pipeline.find({ projectId: project._id })
      .sort({ createdAt: -1 })
      .populate('steps.workboardId', 'name description workboardType outputFormat isActive serverId')
      .lean();
    res.json({ success: true, data: { pipelines } });
  } catch (error) {
    console.error('List pipelines error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const pipeline = await Pipeline.findOne({ _id: req.params.id, projectId: project._id })
      .populate({
        path: 'steps.workboardId',
        select: 'name description workboardType outputFormat isActive serverId additionalInputFields',
        populate: { path: 'serverId', select: 'name serverType' }
      })
      .lean();
    if (!pipeline) return res.status(404).json({ success: false, message: '파이프라인을 찾을 수 없습니다' });
    res.json({ success: true, data: { pipeline } });
  } catch (error) {
    console.error('Get pipeline error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const project = await loadProjectManage(req, res);
    if (!project) return;
    // useWorldview 는 더 이상 사용 안 함 (#401) — 들어와도 무시.
    const { name, description, steps } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: '이름 필수' });
    if (Array.isArray(steps) && steps.length > 0) {
      const check = await validateSteps(req.user, steps);
      if (!check.ok) return res.status(400).json({ success: false, message: check.message });
    }
    const pipeline = await Pipeline.create({
      // 파이프라인은 프로젝트 자산이다 (#802) — 조회·삭제는 projectId 로 스코프하고
      // userId 는 '누가 만들었나' 기록으로만 남긴다. 편집 권한은 프로젝트 관리 권한이 판정.
      userId: req.user._id,
      projectId: project._id,
      name: name.trim(),
      description: (description || '').trim(),
      steps: Array.isArray(steps) ? steps.map((s) => ({
        workboardId: s.workboardId,
        autoInject: s.autoInject !== false,
        inputs: (s.inputs && typeof s.inputs === 'object') ? s.inputs : {},
        contextDocIds: Array.isArray(s.contextDocIds) ? s.contextDocIds : [],
        systemPromptDocId: s.systemPromptDocId || undefined,
        note: s.note,
      })) : [],
    });
    res.status(201).json({ success: true, data: { pipeline } });
  } catch (error) {
    console.error('Create pipeline error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const project = await loadProjectManage(req, res);
    if (!project) return;
    const pipeline = await Pipeline.findOne({ _id: req.params.id, projectId: project._id });
    if (!pipeline) return res.status(404).json({ success: false, message: '파이프라인을 찾을 수 없습니다' });
    // useWorldview 는 더 이상 사용 안 함 (#401) — 들어와도 무시.
    const { name, description, steps } = req.body;
    if (typeof name === 'string') pipeline.name = name.trim();
    if (typeof description === 'string') pipeline.description = description.trim();
    if (Array.isArray(steps)) {
      const check = await validateSteps(req.user, steps);
      if (!check.ok) return res.status(400).json({ success: false, message: check.message });
      pipeline.steps = steps.map((s) => ({
        workboardId: s.workboardId,
        autoInject: s.autoInject !== false,
        inputs: (s.inputs && typeof s.inputs === 'object') ? s.inputs : {},
        contextDocIds: Array.isArray(s.contextDocIds) ? s.contextDocIds : [],
        systemPromptDocId: s.systemPromptDocId || undefined,
        note: s.note,
      }));
      // Mixed 타입 (step.inputs) 변경은 mongoose 가 자동 감지 못 함 — 명시 markModified
      pipeline.markModified('steps');
    }
    await pipeline.save();
    res.json({ success: true, data: { pipeline } });
  } catch (error) {
    console.error('Update pipeline error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const project = await loadProjectManage(req, res);
    if (!project) return;
    const result = await Pipeline.deleteOne({ _id: req.params.id, projectId: project._id });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: '파이프라인을 찾을 수 없습니다' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete pipeline error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
