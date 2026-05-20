const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Tag = require('../models/Tag');
const GeneratedImage = require('../models/GeneratedImage');
const UploadedImage = require('../models/UploadedImage');
const PromptData = require('../models/PromptData');
const { escapeRegex } = require('../utils/escapeRegex');
const router = express.Router();

// 세계관 역할 태그 조회 — 없으면 자동 생성 (#396). 신규 사용자 대응.
router.get('/worldview', requireAuth, async (req, res) => {
  try {
    let tag = await Tag.findOne({ userId: req.user._id, isWorldviewTag: true });
    if (!tag) {
      const sameName = await Tag.findOne({ userId: req.user._id, name: '세계관' });
      if (sameName) {
        sameName.isWorldviewTag = true;
        await sameName.save();
        tag = sameName;
      } else {
        tag = await Tag.create({
          userId: req.user._id,
          createdBy: req.user._id,
          name: '세계관',
          color: '#9c27b0',
          isWorldviewTag: true,
        });
      }
    }
    res.json({ tag });
  } catch (error) {
    console.error('Worldview tag fetch error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { search, limit = 50 } = req.query;
    
    const filter = { userId: req.user._id };
    if (search) {
      filter.name = { $regex: escapeRegex(search), $options: 'i' };
    }
    
    const tags = await Tag.find(filter)
      .sort({ usageCount: -1, name: 1 })
      .limit(parseInt(limit));
    
    res.json({ tags });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, color } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Tag name is required' });
    }
    
    const existingTag = await Tag.findOne({ 
      userId: req.user._id,
      name: name.trim().toLowerCase() 
    });
    if (existingTag) {
      return res.status(400).json({ message: 'Tag already exists' });
    }
    
    const tag = new Tag({
      name: name.trim().toLowerCase(),
      userId: req.user._id,
      color: color || '#1976d2',
      createdBy: req.user._id
    });
    
    await tag.save();
    
    res.status(201).json({ tag });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, color } = req.body;
    
    const tag = await Tag.findOne({ _id: req.params.id, userId: req.user._id });
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    if (tag.isProjectTag) {
      return res.status(400).json({ message: '프로젝트 태그는 프로젝트에서 관리합니다' });
    }

    const oldName = tag.name;
    
    if (name && name.trim() !== oldName) {
      const existingTag = await Tag.findOne({ 
        userId: req.user._id,
        name: name.trim().toLowerCase(),
        _id: { $ne: req.params.id }
      });
      if (existingTag) {
        return res.status(400).json({ message: 'Tag name already exists' });
      }
      tag.name = name.trim().toLowerCase();
    }
    
    if (color) {
      tag.color = color;
    }
    
    await tag.save();
    
    res.json({ tag, message: 'Tag updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const tag = await Tag.findOne({ _id: req.params.id, userId: req.user._id });
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    if (tag.isProjectTag) {
      return res.status(400).json({ message: '프로젝트 태그는 프로젝트 삭제를 통해서만 삭제할 수 있습니다' });
    }

    await Promise.all([
      GeneratedImage.updateMany(
        { userId: req.user._id, tags: req.params.id },
        { $pull: { tags: req.params.id } }
      ),
      UploadedImage.updateMany(
        { userId: req.user._id, tags: req.params.id },
        { $pull: { tags: req.params.id } }
      ),
      PromptData.updateMany(
        { createdBy: req.user._id, tags: req.params.id },
        { $pull: { tags: req.params.id } }
      )
    ]);
    
    await Tag.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Tag deleted and removed from all items' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/search', requireAuth, async (req, res) => {
  try {
    const { tags, limit = 20 } = req.query;
    
    if (!tags) {
      return res.status(400).json({ message: 'Tags parameter is required' });
    }
    
    const tagIds = tags.split(',').filter(id => id.trim());
    
    const [generatedImages, uploadedImages, promptData] = await Promise.all([
      GeneratedImage.find({ userId: req.user._id, tags: { $in: tagIds } })
        .populate('tags', 'name color')
        .select('url originalName metadata tags createdAt generationParams.prompt')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit)),
      
      UploadedImage.find({ userId: req.user._id, tags: { $in: tagIds } })
        .populate('tags', 'name color')
        .select('url originalName metadata tags createdAt')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit)),
      
      PromptData.find({ createdBy: req.user._id, tags: { $in: tagIds } })
        .populate('tags', 'name color')
        .select('name memo prompt representativeImage tags createdAt')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
    ]);
    
    res.json({
      results: {
        generatedImages,
        uploadedImages,
        promptData
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/my', requireAuth, async (req, res) => {
  try {
    const tags = await Tag.find({ userId: req.user._id })
      .sort({ usageCount: -1 })
      .limit(50);
    
    const totalTags = await Tag.countDocuments({ userId: req.user._id });
    
    res.json({ tags, totalTags });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
