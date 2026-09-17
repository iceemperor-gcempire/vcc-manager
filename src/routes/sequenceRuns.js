const express = require('express');
const {
  requireAuth, userHasProjectAccess, userHasSequenceAccess, userHasWorkboardAccess,
} = require('../middleware/auth');
const Sequence = require('../models/Sequence');
const SequenceRun = require('../models/SequenceRun');
const Workboard = require('../models/Workboard');
const Project = require('../models/Project');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const ConversationJob = require('../models/ConversationJob');
const { startSequenceRun, retrySequenceRun } = require('../services/pipelineRunService');
const { deleteJobRecord } = require('../services/jobDeletionService');
const { findUnusableAttachments, describeUnusableAttachments } = require('../services/attachmentOwnership');
const { checkRunnable, describeBlockedSteps } = require('../utils/sequenceSteps');
const { validateRunInputs, firstPromptOf, stepFields } = require('../utils/sequenceInputs');
const { reverseUploadUrls } = require('../utils/signedUrl');

const router = express.Router();

// 작업 절차 실행 기록 (#952). mounted at /api/sequence-runs
// 실행 기록과 결과물은 실행자 개인 자산 — 모든 조회·변경을 본인 것으로 한정한다.
// 단계 작업은 일반 작업 히스토리에서 빠지므로(utils/historyFilters) 단계 결과는 여기서 본다.

const NOT_FOUND = '실행 기록을 찾을 수 없습니다';
const SEQUENCE_NOT_FOUND = '작업 절차를 찾을 수 없습니다';
const RUN_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'];
const isId = (v) => /^[a-f0-9]{24}$/i.test(String(v));
const isInProgress = (run) => run.status === 'pending' || run.status === 'running';

router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const filter = { userId: req.user._id };
    if (isId(req.query.sequenceId)) filter.sequenceId = req.query.sequenceId;
    if (RUN_STATUSES.includes(req.query.status)) filter.status = req.query.status;
    const [runs, total] = await Promise.all([
      SequenceRun.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-runInputs')
        .populate('steps.workboardId', 'name outputFormat')
        .populate('targetProjectId', 'name')
        .lean(),
      SequenceRun.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: { runs, pagination: { current: page, pages: Math.ceil(total / limit), total } },
    });
  } catch (error) {
    console.error('작업 절차 실행 목록 오류:', error);
    res.status(500).json({ success: false, message: '실행 기록을 불러오지 못했습니다' });
  }
});

router.get('/:runId', requireAuth, async (req, res) => {
  try {
    if (!isId(req.params.runId)) return res.status(404).json({ success: false, message: NOT_FOUND });
    const run = await SequenceRun.findOne({ _id: req.params.runId, userId: req.user._id })
      .populate('steps.workboardId', 'name description outputFormat additionalInputFields')
      // 단계 결과 표시 + 계속하기 (작업판·입력값이 필요하다)
      .populate({
        path: 'steps.imageGenerationJobId',
        select: 'workboardId inputData resultImages resultVideos resultAudios status error',
        populate: [
          { path: 'resultImages', select: 'url originalName fileSize width height' },
          { path: 'resultVideos', select: 'url originalName fileSize width height duration' },
          { path: 'resultAudios', select: 'url originalName fileSize duration' },
        ],
      })
      .populate({ path: 'steps.conversationJobId', select: 'workboardId model usage costEstimate status' })
      .populate('targetProjectId', 'name')
      .lean();
    if (!run) return res.status(404).json({ success: false, message: NOT_FOUND });

    // 실행 입력의 표시 이름 — 단계 작업판의 필드 정의에서 (#953). 필드 정의 자체는 응답에서 뺀다.
    const inputLabels = {};
    for (const step of run.steps || []) {
      const wb = step.workboardId && typeof step.workboardId === 'object' ? step.workboardId : null;
      if (step.stepId && wb) {
        inputLabels[String(step.stepId)] = Object.fromEntries(stepFields(wb).map((f) => [f.name, { label: f.label, type: f.type }]));
      }
      if (wb) delete wb.additionalInputFields;
    }

    // 지금도 이 작업 절차를 실행할 수 있는지 — "다시 실행" 노출용. 정의가 사라졌거나 권한이 빠졌을 수 있다.
    const sequence = await Sequence.findById(run.sequenceId).select('name isActive allowedGroupIds').lean();
    const available = !!sequence && userHasSequenceAccess(req.user, sequence);
    res.json({
      success: true,
      data: { run, inputLabels, sequence: available ? { _id: sequence._id, name: sequence.name } : null },
    });
  } catch (error) {
    console.error('작업 절차 실행 조회 오류:', error);
    res.status(500).json({ success: false, message: '실행 기록을 불러오지 못했습니다' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { sequenceId, initialPrompt = '', inputs, targetProjectId } = req.body || {};
    if (!isId(sequenceId)) return res.status(400).json({ success: false, message: 'sequenceId 필수' });

    const sequence = await Sequence.findById(sequenceId).lean();
    if (!sequence || !userHasSequenceAccess(req.user, sequence)) {
      return res.status(404).json({ success: false, message: SEQUENCE_NOT_FOUND });
    }
    if (!sequence.steps?.length) {
      return res.status(400).json({ success: false, message: '단계가 비어 있는 작업 절차입니다' });
    }

    // 작업판 접근은 작업 절차 권한과 따로 판정한다 (#802). 실행 중에도 단계마다 다시 본다.
    const workboards = await Workboard.find({ _id: { $in: sequence.steps.map((s) => s.workboardId) } })
      .select('name isActive allowedGroupIds outputFormat additionalInputFields')
      .lean();
    const workboardsById = new Map(workboards.map((w) => [String(w._id), w]));
    const { runnable, blockedSteps } = checkRunnable(req.user, sequence, workboardsById, userHasWorkboardAccess);
    if (!runnable) {
      return res.status(400).json({ success: false, message: describeBlockedSteps(blockedSteps), data: { blockedSteps } });
    }

    // 실행 입력 (#953) — 노출된 필드만, 필수·형식 검사. initialPrompt 는 첫 단계 프롬프트의 호환 별칭
    const legacyPrompt = typeof initialPrompt === 'string' ? initialPrompt : '';
    const checked = validateRunInputs({ steps: sequence.steps, workboardsById, inputs, initialPrompt: legacyPrompt });
    if (!checked.ok) {
      return res.status(400).json({ success: false, message: checked.errors.join(' · '), data: { errors: checked.errors } });
    }

    // 실행자가 넣은 첨부는 본인 것만 (#959) — 실행 중에도 단계마다 다시 본다
    if (!req.user.isAdmin) {
      for (const [i, step] of sequence.steps.entries()) {
        const stepInputs = checked.inputs[String(step._id)];
        if (!stepInputs) continue;
        const unusable = await findUnusableAttachments({
          workboard: workboardsById.get(String(step.workboardId)),
          inputData: { additionalParams: stepInputs },
          ownerIds: [req.user._id],
          label: `sequence-run step${i}`,
        });
        if (unusable.length > 0) {
          return res.status(400).json({
            success: false,
            message: `${i + 1}단계 ${describeUnusableAttachments(unusable)} — 내가 올리거나 만든 미디어만 첨부할 수 있습니다`,
          });
        }
      }
    }

    // 결과를 담을 프로젝트 — 실행자가 읽을 수 있는 곳이어야 한다 (#923 과 같은 규칙).
    // 존재하지 않는 것과 권한 없는 것을 같은 메시지로.
    let target = null;
    if (targetProjectId) {
      target = isId(targetProjectId) ? await Project.findById(targetProjectId) : null;
      if (!target || !userHasProjectAccess(req.user, target)) {
        return res.status(400).json({ success: false, message: '결과를 담을 프로젝트를 찾을 수 없습니다' });
      }
    }

    const run = await SequenceRun.create({
      userId: req.user._id,
      sequenceId: sequence._id,
      sequenceName: sequence.name,
      targetProjectId: target ? target._id : undefined,
      status: 'pending',
      initialPrompt: firstPromptOf({ steps: sequence.steps, runInputs: checked.inputs, initialPrompt: legacyPrompt }),
      runInputs: reverseUploadUrls(checked.inputs), // 첨부 주소는 서명을 떼고 저장 (#966)
      triggerCount: 1,
      steps: sequence.steps.map((s) => ({ workboardId: s.workboardId, stepId: s._id, status: 'pending' })),
    });

    try {
      await startSequenceRun(run._id);
    } catch (queueError) {
      // 큐에 못 넣으면 영영 대기로 남는다 — 실패로 닫는다
      run.status = 'failed';
      run.error = { message: `실행을 시작하지 못했습니다: ${queueError.message}` };
      run.completedAt = new Date();
      await run.save();
      throw queueError;
    }

    res.status(201).json({ success: true, data: { run } });
  } catch (error) {
    console.error('작업 절차 실행 시작 오류:', error);
    res.status(500).json({ success: false, message: '실행을 시작하지 못했습니다' });
  }
});

// 멈춘 단계부터 다시 — 정의는 참조라 지금의 작업 절차로 돈다. 단계 구성이 바뀌었으면 실행기가 멈춘다.
// 실행 입력은 처음에 넣은 값 그대로 쓰고, 그사이 노출이 풀린 필드의 값은 실행기가 무시한다.
router.post('/:runId/retry', requireAuth, async (req, res) => {
  try {
    if (!isId(req.params.runId)) return res.status(404).json({ success: false, message: NOT_FOUND });
    const run = await SequenceRun.findOne({ _id: req.params.runId, userId: req.user._id });
    if (!run) return res.status(404).json({ success: false, message: NOT_FOUND });
    if (isInProgress(run)) return res.status(400).json({ success: false, message: '아직 진행 중입니다' });

    const sequence = await Sequence.findById(run.sequenceId).lean();
    if (!sequence || !userHasSequenceAccess(req.user, sequence)) {
      return res.status(400).json({ success: false, message: '이 작업 절차는 더 이상 실행할 수 없습니다' });
    }

    let fromStep = Number.isInteger(req.body?.fromStep)
      ? req.body.fromStep
      : run.steps.findIndex((s) => s.status !== 'completed');
    if (fromStep < 0) fromStep = 0;
    fromStep = Math.min(fromStep, run.steps.length - 1);

    for (let i = fromStep; i < run.steps.length; i++) {
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
    run.markModified('steps');
    await run.save();

    await retrySequenceRun(run._id, fromStep);
    res.json({ success: true, data: { run } });
  } catch (error) {
    console.error('작업 절차 재실행 오류:', error);
    res.status(500).json({ success: false, message: '재실행하지 못했습니다' });
  }
});

// 삭제 — 이 실행이 만든 단계 작업 레코드도 함께 지운다. 단계 작업은 일반 히스토리에서 빠져 있어
// 남기면 어디서도 보이지 않는 고아가 된다 (재시도 전 시도분 포함 — sequenceRunId 로 찾는다).
// 생성된 콘텐츠는 보존한다 — 작업과의 연결(jobId)만 끊는다 (jobDeletionService, #902 규칙).
router.delete('/:runId', requireAuth, async (req, res) => {
  try {
    if (!isId(req.params.runId)) return res.status(404).json({ success: false, message: NOT_FOUND });
    const run = await SequenceRun.findOne({ _id: req.params.runId, userId: req.user._id });
    if (!run) return res.status(404).json({ success: false, message: NOT_FOUND });
    if (isInProgress(run)) {
      return res.status(400).json({ success: false, message: '진행 중인 실행은 삭제할 수 없습니다' });
    }

    const marker = { sequenceRunId: run._id, userId: req.user._id };
    const imageJobs = await ImageGenerationJob.find(marker)
      .select('status inputData resultImages resultVideos resultAudios');
    // 실행은 끝났어도(예: 10분 대기 초과) 생성 큐에서 아직 도는 작업이 있을 수 있다
    if (imageJobs.some((j) => j.status === 'pending' || j.status === 'processing')) {
      return res.status(400).json({ success: false, message: '아직 처리 중인 단계 작업이 있습니다 — 끝난 뒤 삭제하세요' });
    }
    for (const job of imageJobs) {
      await deleteJobRecord(job, { deleteContent: false });
    }
    const conversations = await ConversationJob.deleteMany(marker);
    await SequenceRun.deleteOne({ _id: run._id });

    res.json({
      success: true,
      data: { deletedImageJobs: imageJobs.length, deletedConversations: conversations.deletedCount || 0 },
    });
  } catch (error) {
    console.error('작업 절차 실행 삭제 오류:', error);
    res.status(500).json({ success: false, message: '실행 기록을 삭제하지 못했습니다' });
  }
});

module.exports = router;
