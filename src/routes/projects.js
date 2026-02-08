const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Project = require('../models/Project');
const Tag = require('../models/Tag');
const User = require('../models/User');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const PromptData = require('../models/PromptData');
const ImageGenerationJob = require('../models/ImageGenerationJob');
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

// GET / - 프로젝트 목록
router.get('/', requireAuth, async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { userId: req.user._id };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
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
router.post('/', requireAuth, async (req, res) => {
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

// PUT /:id - 프로젝트 수정 (name, description만)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;

    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!project) {
      return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다' });
    }

    if (name) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();

    await project.save();
    await project.populate('tagId', 'name color');

    res.json({ success: true, data: { project } });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ success: false, message: '프로젝트 수정 실패' });
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

module.exports = router;
