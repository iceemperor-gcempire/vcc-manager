const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { reverseSignedUrl } = require('../utils/signedUrl');
const Project = require('../models/Project');
const Tag = require('../models/Tag');
const User = require('../models/User');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const PromptData = require('../models/PromptData');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const { escapeRegex } = require('../utils/escapeRegex');
const { validateBody, projectCreateSchema, projectUpdateSchema } = require('../utils/validation');
const { WORKBOARD_EXPORT_VERSION, APP_VERSION, buildWorkboardExportEntry } = require('../utils/workboardExport');
const router = express.Router();

// GET /favorites - 즐겨찾기 프로젝트 목록 (대시보드용) - 구체적 경로를 /:id 위에 배치
router.get('/favorites', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'favoriteProjects',
      populate: { path: 'tagId', select: 'name color' }
    });

    const projects = user.favoriteProjects || [];

    // 각 프로젝트의 콘텐츠 카운트 조회
    const projectsWithCounts = await Promise.all(projects.map(async (project) => {
      const [imageCount, videoCount, promptDataCount, jobCount] = await Promise.all([
        GeneratedImage.countDocuments({ userId: req.user._id, tags: project.tagId._id }),
        GeneratedVideo.countDocuments({ userId: req.user._id, tags: project.tagId._id }),
        PromptData.countDocuments({ createdBy: req.user._id, tags: project.tagId._id }),
        ImageGenerationJob.countDocuments({ userId: req.user._id, 'inputData.tags': project.tagId._id })
      ]);
      return {
        ...project.toObject(),
        counts: { images: imageCount + videoCount, promptData: promptDataCount, jobs: jobCount }
      };
    }));

    res.json({ success: true, data: { projects: projectsWithCounts } });
  } catch (error) {
    console.error('Get favorite projects error:', error);
    res.status(500).json({ success: false, message: '즐겨찾기 프로젝트 목록 조회 실패' });
  }
});

// GET /by-tag/:tagId - 태그 ID로 프로젝트 조회 (프로젝트 태그 클릭 시 이동용)
router.get('/by-tag/:tagId', requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({
      tagId: req.params.tagId,
      userId: req.user._id
    });

    if (!project) {
      return res.status(404).json({ success: false, message: '해당 태그의 프로젝트를 찾을 수 없습니다' });
    }

    res.json({ success: true, data: { projectId: project._id } });
  } catch (error) {
    console.error('Get project by tag error:', error);
    res.status(500).json({ success: false, message: '프로젝트 조회 실패' });
  }
});

// GET / - 프로젝트 목록
router.get('/', requireAuth, async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { userId: req.user._id };

    if (search) {
      filter.$or = [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { description: { $regex: escapeRegex(search), $options: 'i' } }
      ];
    }

    const projects = await Project.find(filter)
      .populate('tagId', 'name color')
      .sort({ createdAt: -1 });

    // 각 프로젝트의 콘텐츠 카운트 조회
    const projectsWithCounts = await Promise.all(projects.map(async (project) => {
      const [imageCount, videoCount, promptDataCount, jobCount] = await Promise.all([
        GeneratedImage.countDocuments({ userId: req.user._id, tags: project.tagId._id }),
        GeneratedVideo.countDocuments({ userId: req.user._id, tags: project.tagId._id }),
        PromptData.countDocuments({ createdBy: req.user._id, tags: project.tagId._id }),
        ImageGenerationJob.countDocuments({ userId: req.user._id, 'inputData.tags': project.tagId._id })
      ]);
      return {
        ...project.toObject(),
        counts: { images: imageCount + videoCount, promptData: promptDataCount, jobs: jobCount }
      };
    }));

    // 즐겨찾기 목록 가져오기
    const user = await User.findById(req.user._id).select('favoriteProjects');
    const favoriteIds = (user.favoriteProjects || []).map(id => id.toString());

    res.json({
      success: true,
      data: {
        projects: projectsWithCounts,
        favoriteIds
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ success: false, message: '프로젝트 목록 조회 실패' });
  }
});

// POST / - 프로젝트 생성 (전용 태그 자동 생성)
router.post('/', requireAuth, validateBody(projectCreateSchema), async (req, res) => {
  try {
    const { name, description, tagName } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: '프로젝트 이름은 필수입니다' });
    }

    if (!tagName || !tagName.trim()) {
      return res.status(400).json({ success: false, message: '태그명은 필수입니다' });
    }

    // 태그명 중복 체크
    const existingTag = await Tag.findOne({
      userId: req.user._id,
      name: tagName.trim().toLowerCase()
    });
    if (existingTag) {
      return res.status(400).json({ success: false, message: '이미 존재하는 태그명입니다' });
    }

    // 전용 태그 생성
    const tag = new Tag({
      name: tagName.trim().toLowerCase(),
      userId: req.user._id,
      color: '#7c4dff',
      isProjectTag: true,
      createdBy: req.user._id
    });
    await tag.save();

    // 프로젝트 생성
    const project = new Project({
      name: name.trim(),
      description: description?.trim() || '',
      tagId: tag._id,
      userId: req.user._id
    });
    await project.save();
    await project.populate('tagId', 'name color');

    res.status(201).json({ success: true, data: { project } });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ success: false, message: '프로젝트 생성 실패' });
  }
});

// GET /:id - 프로젝트 상세
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).populate('tagId', 'name color');

    if (!project) {
      return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    }

    const [imageCount, videoCount, promptDataCount, jobCount] = await Promise.all([
      GeneratedImage.countDocuments({ userId: req.user._id, tags: project.tagId._id }),
      GeneratedVideo.countDocuments({ userId: req.user._id, tags: project.tagId._id }),
      PromptData.countDocuments({ createdBy: req.user._id, tags: project.tagId._id }),
      ImageGenerationJob.countDocuments({ userId: req.user._id, 'inputData.tags': project.tagId._id })
    ]);

    // 즐겨찾기 여부 확인
    const user = await User.findById(req.user._id).select('favoriteProjects');
    const isFavorite = (user.favoriteProjects || []).some(id => id.toString() === project._id.toString());

    res.json({
      success: true,
      data: {
        project: {
          ...project.toObject(),
          counts: { images: imageCount + videoCount, promptData: promptDataCount, jobs: jobCount },
          isFavorite
        }
      }
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ success: false, message: '프로젝트 조회 실패' });
  }
});

// PUT /:id - 프로젝트 수정
router.put('/:id', requireAuth, validateBody(projectUpdateSchema), async (req, res) => {
  try {
    const { name, description, coverImage } = req.body;

    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!project) {
      return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    }

    if (name) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();

    if (coverImage === null) {
      project.coverImage = undefined;
    } else if (coverImage && typeof coverImage === 'object') {
      // MediaGrid에서 imageType이 모델명(GeneratedImage/UploadedImage)으로 올 수 있으므로 정규화
      let normalizedType = coverImage.imageType;
      if (normalizedType === 'GeneratedImage') normalizedType = 'generated';
      else if (normalizedType === 'UploadedImage') normalizedType = 'uploaded';

      project.coverImage = {
        url: reverseSignedUrl(coverImage.url),
        imageId: coverImage.imageId,
        imageType: normalizedType
      };
    }

    await project.save();
    await project.populate('tagId', 'name color');

    res.json({ success: true, data: { project } });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ success: false, message: '프로젝트 수정 실패' });
  }
});

// POST /:id/workboards/:workboardId - 작업판을 프로젝트에 추가 (#396)
router.post('/:id/workboards/:workboardId', requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
    if (!project) return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    const wbId = req.params.workboardId;
    if (!project.workboardIds.some((id) => id.toString() === wbId)) {
      project.workboardIds.push(wbId);
      await project.save();
    }
    res.json({ success: true, data: { workboardIds: project.workboardIds } });
  } catch (error) {
    console.error('Add workboard to project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /:id/workboards/:workboardId - 작업판을 프로젝트에서 제거
router.delete('/:id/workboards/:workboardId', requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
    if (!project) return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    const wbId = req.params.workboardId;
    project.workboardIds = project.workboardIds.filter((id) => id.toString() !== wbId);
    await project.save();
    res.json({ success: true, data: { workboardIds: project.workboardIds } });
  } catch (error) {
    console.error('Remove workboard from project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /:id/workboards - 프로젝트의 작업판 목록 (populate)
router.get('/:id/workboards', requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id })
      .populate({
        path: 'workboardIds',
        // additionalInputFields 도 포함 — 파이프라인 빌더의 단계 추가 시 customField 정보 필요 (#400 후속)
        select: 'name description workboardType outputFormat isActive serverId additionalInputFields',
        populate: { path: 'serverId', select: 'name serverType' }
      });
    if (!project) return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    res.json({ success: true, data: { workboards: project.workboardIds || [] } });
  } catch (error) {
    console.error('Project workboards fetch error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /:id - 프로젝트 삭제 (전용 태그 + 관련 아이템 태그 해제)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!project) {
      return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    }

    const tagId = project.tagId;

    // 관련 아이템에서 태그 제거
    await Promise.all([
      GeneratedImage.updateMany(
        { userId: req.user._id, tags: tagId },
        { $pull: { tags: tagId } }
      ),
      GeneratedVideo.updateMany(
        { userId: req.user._id, tags: tagId },
        { $pull: { tags: tagId } }
      ),
      PromptData.updateMany(
        { createdBy: req.user._id, tags: tagId },
        { $pull: { tags: tagId } }
      ),
      ImageGenerationJob.updateMany(
        { userId: req.user._id, 'inputData.tags': tagId },
        { $pull: { 'inputData.tags': tagId } }
      )
    ]);

    // 즐겨찾기에서 제거
    await User.updateMany(
      { favoriteProjects: project._id },
      { $pull: { favoriteProjects: project._id } }
    );

    // 전용 태그 삭제
    await Tag.findByIdAndDelete(tagId);

    // 프로젝트 삭제
    await Project.findByIdAndDelete(project._id);

    res.json({ success: true, message: '프로젝트가 삭제되었습니다' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ success: false, message: '프로젝트 삭제 실패' });
  }
});

// POST /:id/favorite - 즐겨찾기 토글
router.post('/:id/favorite', requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!project) {
      return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    }

    const user = await User.findById(req.user._id);
    const favoriteIndex = user.favoriteProjects.findIndex(
      id => id.toString() === project._id.toString()
    );

    if (favoriteIndex > -1) {
      // 이미 즐겨찾기에 있으면 제거
      user.favoriteProjects.splice(favoriteIndex, 1);
    } else {
      // 최대 3개 제한
      if (user.favoriteProjects.length >= 3) {
        return res.status(400).json({ success: false, message: '즐겨찾기는 최대 3개까지 가능합니다' });
      }
      user.favoriteProjects.push(project._id);
    }

    await user.save();

    res.json({
      success: true,
      data: {
        isFavorite: favoriteIndex === -1,
        favoriteCount: user.favoriteProjects.length
      }
    });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ success: false, message: '즐겨찾기 토글 실패' });
  }
});

// GET /:id/images - 프로젝트 태그 기반 이미지 목록
router.get('/:id/images', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!project) {
      return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    }

    const filter = { userId: req.user._id, tags: project.tagId };

    const [images, videos, imageTotal, videoTotal] = await Promise.all([
      GeneratedImage.find(filter)
        .populate('tags', 'name color')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      GeneratedVideo.find(filter)
        .populate('tags', 'name color')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      GeneratedImage.countDocuments(filter),
      GeneratedVideo.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        images,
        videos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: imageTotal + videoTotal,
          imageTotal,
          videoTotal
        }
      }
    });
  } catch (error) {
    console.error('Get project images error:', error);
    res.status(500).json({ success: false, message: '프로젝트 이미지 조회 실패' });
  }
});

// GET /:id/prompt-data - 프로젝트 태그 기반 프롬프트 데이터 목록
router.get('/:id/prompt-data', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!project) {
      return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    }

    const filter = { createdBy: req.user._id, tags: project.tagId };

    const [promptDataList, total] = await Promise.all([
      PromptData.find(filter)
        .populate('tags', 'name color')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      PromptData.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        promptDataList,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get project prompt data error:', error);
    res.status(500).json({ success: false, message: '프로젝트 프롬프트 데이터 조회 실패' });
  }
});

// GET /:id/jobs - 프로젝트 태그 기반 작업 히스토리 목록
router.get('/:id/jobs', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!project) {
      return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    }

    const filter = {
      userId: req.user._id,
      'inputData.tags': project.tagId
    };
    if (status) filter.status = status;

    const [jobs, total] = await Promise.all([
      ImageGenerationJob.find(filter)
        .populate('workboardId', 'name')
        .populate('resultImages')
        .populate('resultVideos')
        .populate('inputData.tags', 'name color isProjectTag')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      ImageGenerationJob.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        jobs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get project jobs error:', error);
    res.status(500).json({ success: false, message: '프로젝트 작업 히스토리 조회 실패' });
  }
});

// GET /:id/conversations - 프로젝트 컨텍스트로 실행된 LLM 대화 히스토리 (#396)
router.get('/:id/conversations', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    }
    const ConversationJob = require('../models/ConversationJob');
    // 통일된 태그 기반 필터 (#397 후속). projectId 또는 tags 가 매칭되는 항목.
    // 기존 데이터 호환 위해 둘 다 OR 로 검색.
    const filter = {
      userId: req.user._id,
      $or: [
        { projectId: project._id },
        { tags: project.tagId },
      ],
    };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      ConversationJob.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('workboardId', 'name workboardType outputFormat')
        .lean(),
      ConversationJob.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: {
        conversations: items,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get project conversations error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── 프로젝트 export (#404 P0) ────────────────────────────────────
// 프로젝트 자산(작업판 풀 정의·세계관/문서·파이프라인·태그)을 단일 JSON 으로.
// admin 전용 — export 에 작업판 풀 정의(workflowData 포함)가 들어가는데
// 작업판은 admin 관리 자산이라 일반 사용자에게 정의를 노출하지 않는다.
// binary(이미지/영상)는 v1 규격에서 제외 (기획 결정).
router.get('/:id/export', requireAdmin, async (req, res) => {
  try {
    const Workboard = require('../models/Workboard');
    const Server = require('../models/Server');
    const Pipeline = require('../models/Pipeline');
    const UploadedText = require('../models/UploadedText');

    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id }).populate('tagId');
    if (!project) {
      return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    }

    const pipelines = await Pipeline.find({ projectId: project._id }).sort({ createdAt: 1 }).lean();

    // 작업판 수집 — 프로젝트 소속 + 파이프라인 단계가 참조하는 것의 합집합.
    // export 안에서는 배열 index 가 참조 키 (ObjectId 는 instance 간 매칭 불가).
    const workboardIdSet = new Set((project.workboardIds || []).map(String));
    for (const pl of pipelines) {
      for (const step of pl.steps || []) {
        if (step.workboardId) workboardIdSet.add(String(step.workboardId));
      }
    }
    const workboardIds = [...workboardIdSet];
    const workboards = await Workboard.find({ _id: { $in: workboardIds } }).lean();
    const servers = await Server.find({ _id: { $in: workboards.map((w) => w.serverId).filter(Boolean) } }).lean();
    const serverById = new Map(servers.map((sv) => [String(sv._id), sv]));
    // index 안정화: 수집 순서 기준
    const wbIndexById = new Map();
    const workboardEntries = workboardIds
      .map((id) => workboards.find((w) => String(w._id) === id))
      .filter(Boolean)
      .map((wb, idx) => {
        wbIndexById.set(String(wb._id), idx);
        return buildWorkboardExportEntry(wb, wb.serverId ? serverById.get(String(wb.serverId)) : null);
      });

    // 문서 — 프로젝트 태그가 붙은 UploadedText. 태그는 이름으로 export (import 시 이름 매핑).
    const docs = await UploadedText.find({ userId: req.user._id, tags: project.tagId._id })
      .populate('tags', 'name')
      .sort({ createdAt: 1 })
      .lean();
    const docIndexById = new Map();
    const documents = docs.map((d, idx) => {
      docIndexById.set(String(d._id), idx);
      return {
        title: d.title,
        content: d.content,
        // 프로젝트 전용 태그는 제외 — import 시 새 프로젝트 태그가 대신 부여됨
        tagNames: (d.tags || []).map((t) => t.name).filter((n) => n && n !== project.tagId.name),
      };
    });

    const pipelineEntries = pipelines.map((pl) => ({
      name: pl.name,
      description: pl.description || '',
      steps: (pl.steps || []).map((step) => ({
        workboardIndex: wbIndexById.has(String(step.workboardId)) ? wbIndexById.get(String(step.workboardId)) : null,
        autoInject: step.autoInject !== false,
        inputs: step.inputs || {},
        contextDocIndexes: (step.contextDocIds || [])
          .map((id) => docIndexById.get(String(id)))
          .filter((i) => i !== undefined),
        systemPromptDocIndex: step.systemPromptDocId !== undefined && docIndexById.has(String(step.systemPromptDocId))
          ? docIndexById.get(String(step.systemPromptDocId))
          : null,
        note: step.note || '',
      })),
    }));

    const exportData = {
      projectExportVersion: 1,
      workboardExportVersion: WORKBOARD_EXPORT_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        description: project.description || '',
        tagColor: project.tagId?.color,
      },
      workboards: workboardEntries,
      documents,
      pipelines: pipelineEntries,
    };

    const filename = `${project.name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}_project.json`;
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(exportData);
  } catch (error) {
    console.error('Project export error:', error);
    res.status(500).json({ success: false, message: '프로젝트 내보내기에 실패했습니다.' });
  }
});


// ── 프로젝트 import (#404 P1) ────────────────────────────────────
// export JSON 을 받아 새 프로젝트 + 작업판 + 문서 + 파이프라인을 일괄 생성.
// admin 전용. 서버 매핑이 자동으로 안 되면 needsMapping 응답으로 후보를 돌려주고,
// 프론트가 serverMapping(index→serverId) 을 채워 재요청한다.
// 실패 시 그때까지 만든 리소스를 best-effort 로 롤백 (standalone Mongo 라 트랜잭션 미사용).
router.post('/import', requireAdmin, async (req, res) => {
  const Workboard = require('../models/Workboard');
  const Server = require('../models/Server');
  const Group = require('../models/Group');
  const Pipeline = require('../models/Pipeline');
  const UploadedText = require('../models/UploadedText');
  const { BUILTIN_TAG_NAMES, BUILTIN_TAG_META } = require('../constants/builtinTags');

  const created = { tag: null, project: null, workboards: [], docs: [], pipelines: [] };
  try {
    const { data, name, tagName, serverMapping = {} } = req.body;

    if (!data || data.projectExportVersion !== 1) {
      return res.status(400).json({ success: false, message: '올바른 프로젝트 내보내기 파일이 아닙니다.' });
    }
    if (!tagName || !tagName.trim()) {
      return res.status(400).json({ success: false, message: '태그명은 필수입니다' });
    }

    // 1) 서버 해석 — 전 작업판이 해석돼야 생성 시작
    const entries = data.workboards || [];
    const activeServers = await Server.find({ isActive: true }).select('name serverType serverUrl').lean();
    const resolved = [];
    let unresolved = false;
    for (let i = 0; i < entries.length; i++) {
      const hint = entries[i].server;
      let serverId = serverMapping[i] || serverMapping[String(i)] || null;
      if (!serverId && hint) {
        const exact = activeServers.find((sv) => sv.name === hint.name && sv.serverType === hint.serverType);
        const byType = activeServers.filter((sv) => sv.serverType === hint.serverType);
        if (exact) serverId = exact._id;
        else if (byType.length === 1) serverId = byType[0]._id; // 타입 유일 서버는 자동 채택
      }
      if (!serverId) unresolved = true;
      resolved.push(serverId);
    }
    if (unresolved) {
      return res.json({
        needsMapping: true,
        workboards: entries.map((e, i) => ({
          index: i,
          name: e.workboard?.name,
          outputFormat: e.workboard?.outputFormat,
          server: e.server,
          resolvedServerId: resolved[i] || null,
        })),
        servers: activeServers,
      });
    }

    // 2) 프로젝트 태그 + 프로젝트 (기존 create 라우트와 동일 규칙)
    const normalizedTagName = tagName.trim().toLowerCase();
    const dupTag = await Tag.findOne({ userId: req.user._id, name: normalizedTagName });
    if (dupTag) {
      return res.status(400).json({ success: false, message: '이미 존재하는 태그명입니다' });
    }
    created.tag = await Tag.create({
      name: normalizedTagName,
      userId: req.user._id,
      color: data.project?.tagColor || '#7c4dff',
      isProjectTag: true,
      createdBy: req.user._id,
    });
    created.project = await Project.create({
      name: (name || data.project?.name || '가져온 프로젝트').trim(),
      description: data.project?.description || '',
      tagId: created.tag._id,
      userId: req.user._id,
      workboardIds: [],
    });

    // 3) 작업판 생성 (단건 import 와 동일 필드 규칙)
    const defaultGroup = await Group.findDefault();
    const serverById = new Map(activeServers.map((sv) => [String(sv._id), sv]));
    for (let i = 0; i < entries.length; i++) {
      const wb = entries[i].workboard || {};
      const server = serverById.get(String(resolved[i]));
      const newWorkboard = await Workboard.create({
        name: wb.name,
        description: wb.description,
        workboardType: wb.workboardType,
        outputFormat: wb.outputFormat || 'image',
        serverId: resolved[i],
        serverUrl: server?.serverUrl,
        additionalInputFields: wb.additionalInputFields || [],
        workflowData: wb.workflowData || '',
        allowedModelTypes: wb.allowedModelTypes || [],
        allowedGroupIds: defaultGroup ? [defaultGroup._id] : [],
        modelExposurePolicy: wb.modelExposurePolicy === 'whitelist' ? 'whitelist' : 'full',
        modelWhitelist: Array.isArray(wb.modelWhitelist) ? wb.modelWhitelist : [],
        loraExposurePolicy: wb.loraExposurePolicy === 'whitelist' ? 'whitelist' : 'full',
        loraWhitelist: Array.isArray(wb.loraWhitelist) ? wb.loraWhitelist : [],
        createdBy: req.user._id,
        version: 1,
        usageCount: 0,
        isActive: true,
        tags: [],
      });
      created.workboards.push(newWorkboard);
    }

    // 4) 문서 생성 — 분류 태그는 이름으로 findOrCreate (builtin 은 지정 색)
    const tagCache = new Map();
    const resolveDocTag = async (tName) => {
      if (tagCache.has(tName)) return tagCache.get(tName);
      let tag = await Tag.findOne({ userId: req.user._id, name: tName });
      if (!tag) {
        const builtinColor = BUILTIN_TAG_META[tName]?.color;
        tag = await Tag.create({
          userId: req.user._id,
          createdBy: req.user._id,
          name: tName,
          color: builtinColor || '#1976d2',
        });
      }
      tagCache.set(tName, tag);
      return tag;
    };
    for (const doc of data.documents || []) {
      const docTagIds = [created.tag._id];
      for (const tName of doc.tagNames || []) {
        const t = await resolveDocTag(tName);
        docTagIds.push(t._id);
      }
      const newDoc = await UploadedText.create({
        userId: req.user._id,
        title: doc.title || '',
        content: doc.content || '',
        tags: docTagIds,
      });
      created.docs.push(newDoc);
    }

    // 5) 파이프라인 — index 참조를 새 ObjectId 로 재배선
    for (const pl of data.pipelines || []) {
      const steps = (pl.steps || [])
        .filter((st) => st.workboardIndex !== null && created.workboards[st.workboardIndex])
        .map((st) => ({
          workboardId: created.workboards[st.workboardIndex]._id,
          autoInject: st.autoInject !== false,
          inputs: st.inputs || {},
          contextDocIds: (st.contextDocIndexes || [])
            .map((di) => created.docs[di]?._id)
            .filter(Boolean),
          systemPromptDocId: st.systemPromptDocIndex !== null && created.docs[st.systemPromptDocIndex]
            ? created.docs[st.systemPromptDocIndex]._id
            : undefined,
          note: st.note || '',
        }));
      if (steps.length === 0) continue;
      const newPl = await Pipeline.create({
        userId: req.user._id,
        projectId: created.project._id,
        name: pl.name,
        description: pl.description || '',
        steps,
      });
      created.pipelines.push(newPl);
    }

    // 6) 프로젝트에 작업판 연결
    created.project.workboardIds = created.workboards.map((w) => w._id);
    await created.project.save();

    res.status(201).json({
      success: true,
      projectId: created.project._id,
      summary: {
        workboards: created.workboards.length,
        documents: created.docs.length,
        pipelines: created.pipelines.length,
      },
    });
  } catch (error) {
    console.error('Project import error:', error);
    // best-effort 롤백 — 생성 순서 역순
    try {
      const Pipeline2 = require('../models/Pipeline');
      const UploadedText2 = require('../models/UploadedText');
      const Workboard2 = require('../models/Workboard');
      if (created.pipelines.length) await Pipeline2.deleteMany({ _id: { $in: created.pipelines.map((x) => x._id) } });
      if (created.docs.length) await UploadedText2.deleteMany({ _id: { $in: created.docs.map((x) => x._id) } });
      if (created.workboards.length) await Workboard2.deleteMany({ _id: { $in: created.workboards.map((x) => x._id) } });
      if (created.project) await Project.deleteOne({ _id: created.project._id });
      if (created.tag) await Tag.deleteOne({ _id: created.tag._id });
    } catch (rollbackErr) {
      console.error('Project import rollback error:', rollbackErr);
    }
    res.status(400).json({ success: false, message: error.message || '프로젝트 가져오기에 실패했습니다.' });
  }
});

module.exports = router;
