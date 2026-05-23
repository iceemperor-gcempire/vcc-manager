const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Pipeline = require('../models/Pipeline');
const PipelineRun = require('../models/PipelineRun');
const Project = require('../models/Project');
const { startPipelineRun, retryPipelineRun } = require('../services/pipelineRunService');

const router = express.Router({ mergeParams: true });

// mounted at /api/projects/:projectId/pipeline-runs (#407)

async function loadProject(req, res) {
  const project = await Project.findOne({ _id: req.params.projectId, userId: req.user._id });
  if (!project) {
    res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    return null;
  }
  return project;
}

// GET — 프로젝트의 run 목록
router.get('/', requireAuth, async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const { pipelineId, limit = 20, page = 1 } = req.query;
    const filter = { projectId: project._id, userId: req.user._id };
    if (pipelineId) filter.pipelineId = pipelineId;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      PipelineRun.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('pipelineId', 'name')
        .populate('steps.workboardId', 'name outputFormat')
        .lean(),
      PipelineRun.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: {
        runs: items,
        pagination: { current: parseInt(page), pages: Math.ceil(total / parseInt(limit)), total },
      },
    });
  } catch (error) {
    console.error('List pipeline runs error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /:runId — 단일 run 상세
router.get('/:runId', requireAuth, async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const run = await PipelineRun.findOne({ _id: req.params.runId, projectId: project._id, userId: req.user._id })
      .populate('pipelineId', 'name description steps')
      .populate('steps.workboardId', 'name description outputFormat')
      .lean();
    if (!run) return res.status(404).json({ success: false, message: 'Run 을 찾을 수 없습니다' });
    res.json({ success: true, data: { run } });
  } catch (error) {
    console.error('Get pipeline run error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST — 새 run 시작
router.post('/', requireAuth, async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const { pipelineId, initialPrompt = '' } = req.body;
    if (!pipelineId) return res.status(400).json({ success: false, message: 'pipelineId 필수' });
    const pipeline = await Pipeline.findOne({ _id: pipelineId, projectId: project._id, userId: req.user._id });
    if (!pipeline) return res.status(404).json({ success: false, message: '파이프라인을 찾을 수 없습니다' });
    if (!pipeline.steps?.length) {
      return res.status(400).json({ success: false, message: '단계가 비어 있는 파이프라인입니다' });
    }

    const run = await PipelineRun.create({
      userId: req.user._id,
      projectId: project._id,
      pipelineId: pipeline._id,
      status: 'pending',
      initialPrompt,
      triggerCount: 1,
      steps: pipeline.steps.map((s) => ({
        workboardId: s.workboardId,
        status: 'pending',
      })),
    });

    // Bull queue 에 추가 (백그라운드 처리)
    await startPipelineRun(run._id);

    res.status(201).json({ success: true, data: { run } });
  } catch (error) {
    console.error('Create pipeline run error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /:runId/retry — 실패한 단계부터 재시작
router.post('/:runId/retry', requireAuth, async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const run = await PipelineRun.findOne({ _id: req.params.runId, projectId: project._id, userId: req.user._id });
    if (!run) return res.status(404).json({ success: false, message: 'Run 을 찾을 수 없습니다' });
    if (run.status === 'running') {
      return res.status(400).json({ success: false, message: '아직 진행 중입니다' });
    }

    const { fromStep } = req.body;
    // fromStep 미지정 시 첫 번째 failed 단계 자동 감지
    let resolvedFrom = fromStep;
    if (resolvedFrom == null) {
      resolvedFrom = run.steps.findIndex((s) => s.status !== 'completed');
      if (resolvedFrom < 0) resolvedFrom = 0;
    }
    resolvedFrom = Math.max(0, Math.min(resolvedFrom, run.steps.length - 1));

    // 재시작할 단계 + 이후 단계를 pending 으로
    for (let i = resolvedFrom; i < run.steps.length; i++) {
      run.steps[i].status = 'pending';
      run.steps[i].startedAt = undefined;
      run.steps[i].completedAt = undefined;
      run.steps[i].error = undefined;
      run.steps[i].output = undefined;
      run.steps[i].conversationJobId = undefined;
      run.steps[i].imageGenerationJobId = undefined;
    }
    run.status = 'pending';
    run.error = undefined;
    run.completedAt = undefined;
    run.triggerCount = (run.triggerCount || 0) + 1;
    await run.save();

    await retryPipelineRun(run._id, resolvedFrom);

    res.json({ success: true, data: { run } });
  } catch (error) {
    console.error('Retry pipeline run error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /:runId
router.delete('/:runId', requireAuth, async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const result = await PipelineRun.deleteOne({ _id: req.params.runId, projectId: project._id, userId: req.user._id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Run 을 찾을 수 없습니다' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete pipeline run error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
