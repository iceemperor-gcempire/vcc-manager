const express = require('express');
const router = express.Router();

const { requireAuth, buildWorkboardAccessFilter } = require('../middleware/auth');
const PipelineRun = require('../models/PipelineRun');
const GeneratedImage = require('../models/GeneratedImage');
const Workboard = require('../models/Workboard');

// 대시보드 위젯 전용 읽기 전용 집계 엔드포인트 (#453).
// req.user 는 server.js 의 전역 /api 인증 미들웨어가 주입한다.

const TZ = 'Asia/Seoul'; // 한국어 사용자 기준 — 일 경계를 KST 로 맞춘다

// PipelineRun 문서를 대시보드/히스토리 행 형태로 정규화. 단계 완료비율로 progress 계산.
function mapRun(run) {
  const steps = run.steps || [];
  const total = steps.length;
  const done = steps.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  return {
    _id: run._id,
    projectId: run.projectId?._id || null,
    projectName: run.projectId?.name || '',
    pipelineName: run.pipelineId?.name || '파이프라인',
    status: run.status,
    progress,
    stepTotal: total,
    stepDone: done,
    stepStatuses: steps.map((s) => s.status),
    initialPrompt: run.initialPrompt || '',
    startedAt: run.startedAt || run.createdAt,
    createdAt: run.createdAt,
  };
}

// 1) 실행 중 파이프라인 — 요청 사용자의 전 프로젝트에서 pending/running 인 런.
//    단계 완료 비율로 progress 를 계산해 함께 반환. 대시보드에서 polling.
router.get('/active-pipeline-runs', requireAuth, async (req, res) => {
  try {
    const runs = await PipelineRun.find({
      userId: req.user._id,
      status: { $in: ['pending', 'running'] },
    })
      .populate('pipelineId', 'name')
      .populate('projectId', 'name')
      .sort({ startedAt: -1, createdAt: -1 })
      .limit(10)
      .lean();

    res.json({ success: true, data: { runs: runs.map(mapRun) } });
  } catch (error) {
    console.error('대시보드 active-pipeline-runs 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 1b) 전역 파이프라인 런 — 작업 히스토리 통합 피드용. 모든 상태, 전 프로젝트, 페이지네이션.
router.get('/pipeline-runs', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const filter = { userId: req.user._id };

    const [total, runs] = await Promise.all([
      PipelineRun.countDocuments(filter),
      PipelineRun.find(filter)
        .populate('pipelineId', 'name')
        .populate('projectId', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        runs: runs.map(mapRun),
        pagination: { current: page, pages: Math.ceil(total / limit), total },
      },
    });
  } catch (error) {
    console.error('대시보드 pipeline-runs 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2) 일별 생성 이미지 추이 — 최근 N일(기본 7, 최대 31). KST 기준 일별 카운트.
//    빈 날짜는 0 으로 채워 연속 배열을 반환. 오늘/평균/피크 요약 포함.
router.get('/image-trend', requireAuth, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 31);

    const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
    since.setHours(0, 0, 0, 0);

    const rows = await GeneratedImage.aggregate([
      { $match: { userId: req.user._id, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = new Map(rows.map((r) => [r._id, r.count]));
    const fmt = (d) => d.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD

    const trend = [];
    const now = Date.now();
    for (let i = days - 1; i >= 0; i--) {
      const key = fmt(new Date(now - i * 24 * 60 * 60 * 1000));
      trend.push({ date: key, count: counts.get(key) || 0 });
    }

    const values = trend.map((t) => t.count);
    const sum = values.reduce((a, b) => a + b, 0);
    const today = values[values.length - 1] || 0;
    const average = Math.round(sum / days);
    const peak = values.length ? Math.max(...values) : 0;

    res.json({ success: true, data: { trend, today, average, peak, days } });
  } catch (error) {
    console.error('대시보드 image-trend 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3) 자주 쓰는 작업판 — usageCount 상위 N(기본 4, 최대 10).
//    활성 작업판 한정 + 사용자 접근 권한(그룹) 필터. admin 은 전체.
router.get('/workboard-usage', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 4, 1), 10);
    const filter = { isActive: true, ...buildWorkboardAccessFilter(req.user) };

    const workboards = await Workboard.find(filter)
      .select('name usageCount outputFormat serverId')
      .populate('serverId', 'name serverType')
      .sort({ usageCount: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, data: { workboards } });
  } catch (error) {
    console.error('대시보드 workboard-usage 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
