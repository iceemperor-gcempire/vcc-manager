const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Tag = require('../models/Tag');
const Workboard = require('../models/Workboard');
const GeneratedImage = require('../models/GeneratedImage');
const UploadedImage = require('../models/UploadedImage');
const PromptData = require('../models/PromptData');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { search, limit = 50 } = req.query;
    
    const filter = {};
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
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
    
    const existingTag = await Tag.findOne({ name: name.trim().toLowerCase() });
    if (existingTag) {
      return res.status(400).json({ message: 'Tag already exists' });
    }
    
    const tag = new Tag({
      name: name.trim().toLowerCase(),
      color: color || '#1976d2',
      createdBy: req.user._id
    });
    
    await tag.save();
    
    res.status(201).json({ tag });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, color } = req.body;
    
    const tag = await Tag.findById(req.params.id);
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }
    
    const oldName = tag.name;
    
    if (name && name.trim() !== oldName) {
      const existingTag = await Tag.findOne({ 
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

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }
    
    await Promise.all([
      Workboard.updateMany(
        { tags: req.params.id },
        { $pull: { tags: req.params.id } }
      ),
      GeneratedImage.updateMany(
        { tags: req.params.id },
        { $pull: { tags: req.params.id } }
      ),
      UploadedImage.updateMany(
        { tags: req.params.id },
        { $pull: { tags: req.params.id } }
      ),
      PromptData.updateMany(
        { tags: req.params.id },
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
    const { tags, page = 1, limit = 20 } = req.query;
    
    if (!tags) {
      return res.status(400).json({ message: 'Tags parameter is required' });
    }
    
    const tagIds = tags.split(',').filter(id => id.trim());
    const skip = (page - 1) * limit;
    
    const [workboards, generatedImages, uploadedImages, promptData] = await Promise.all([
      Workboard.find({ tags: { $in: tagIds }, isActive: true })
        .populate('tags', 'name color')
        .populate('createdBy', 'nickname email')
        .select('name description workboardType usageCount tags createdAt')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit)),
      
      GeneratedImage.find({ tags: { $in: tagIds } })
        .populate('tags', 'name color')
        .populate('userId', 'nickname email')
        .select('url originalName metadata tags createdAt generationParams.prompt')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit)),
      
      UploadedImage.find({ tags: { $in: tagIds } })
        .populate('tags', 'name color')
        .populate('userId', 'nickname email')
        .select('url originalName metadata tags createdAt')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit)),
      
      PromptData.find({ tags: { $in: tagIds } })
        .populate('tags', 'name color')
        .populate('createdBy', 'nickname email')
        .select('name memo prompt representativeImage tags createdAt')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
    ]);
    
    res.json({
      results: {
        workboards,
        generatedImages,
        uploadedImages,
        promptData
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const tags = await Tag.find()
      .sort({ usageCount: -1 })
      .limit(50);
    
    const totalTags = await Tag.countDocuments();
    
    res.json({ tags, totalTags });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
