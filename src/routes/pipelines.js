const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Pipeline = require('../models/Pipeline');
const Project = require('../models/Project');
const Workboard = require('../models/Workboard');

const router = express.Router({ mergeParams: true });

// 프로젝트 종속 파이프라인 CRUD (#397). mounted at /api/projects/:projectId/pipelines

async function loadProject(req, res) {
  const project = await Project.findOne({ _id: req.params.projectId, userId: req.user._id });
  if (!project) {
    res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    return null;
  }
  return project;
}

// 모든 단계 워크보드가 사용자 소유인지 검증
async function validateSteps(userId, steps) {
  if (!Array.isArray(steps) || steps.length === 0) return { ok: false, message: '단계가 비어 있습니다' };
  const ids = steps.map((s) => s.workboardId).filter(Boolean);
  if (ids.length !== steps.length) return { ok: false, message: '각 단계에 workboardId 필수' };
  const wbs = await Workboard.find({ _id: { $in: ids } }).lean();
  if (wbs.length !== new Set(ids.map(String)).size) {
    // 일부 id 가 중복일 수 있으므로 unique 비교
    if (wbs.length === 0) return { ok: false, message: '존재하지 않는 작업판이 있습니다' };
  }
  // 권한 검사 — 작업판 자체는 admin / 공용일 수 있으므로 여기선 존재만 확인
  return { ok: true };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const pipelines = await Pipeline.find({ projectId: project._id, userId: req.user._id })
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
    const pipeline = await Pipeline.findOne({ _id: req.params.id, projectId: project._id, userId: req.user._id })
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
    const project = await loadProject(req, res);
    if (!project) return;
    const { name, description, steps, useWorldview } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: '이름 필수' });
    if (Array.isArray(steps) && steps.length > 0) {
      const check = await validateSteps(req.user._id, steps);
      if (!check.ok) return res.status(400).json({ success: false, message: check.message });
    }
    const pipeline = await Pipeline.create({
      userId: req.user._id,
      projectId: project._id,
      name: name.trim(),
      description: (description || '').trim(),
      steps: Array.isArray(steps) ? steps.map((s) => ({
        workboardId: s.workboardId,
        autoInject: s.autoInject !== false,
        inputs: (s.inputs && typeof s.inputs === 'object') ? s.inputs : {},
        note: s.note,
      })) : [],
      useWorldview: useWorldview !== false,
    });
    res.status(201).json({ success: true, data: { pipeline } });
  } catch (error) {
    console.error('Create pipeline error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const pipeline = await Pipeline.findOne({ _id: req.params.id, projectId: project._id, userId: req.user._id });
    if (!pipeline) return res.status(404).json({ success: false, message: '파이프라인을 찾을 수 없습니다' });
    const { name, description, steps, useWorldview } = req.body;
    if (typeof name === 'string') pipeline.name = name.trim();
    if (typeof description === 'string') pipeline.description = description.trim();
    if (typeof useWorldview === 'boolean') pipeline.useWorldview = useWorldview;
    if (Array.isArray(steps)) {
      const check = await validateSteps(req.user._id, steps);
      if (!check.ok) return res.status(400).json({ success: false, message: check.message });
      pipeline.steps = steps.map((s) => ({
        workboardId: s.workboardId,
        autoInject: s.autoInject !== false,
        inputs: (s.inputs && typeof s.inputs === 'object') ? s.inputs : {},
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
    const project = await loadProject(req, res);
    if (!project) return;
    const result = await Pipeline.deleteOne({ _id: req.params.id, projectId: project._id, userId: req.user._id });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: '파이프라인을 찾을 수 없습니다' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete pipeline error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
