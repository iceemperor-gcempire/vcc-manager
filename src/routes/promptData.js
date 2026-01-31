const express = require('express');
const router = express.Router();
const PromptData = require('../models/PromptData');
const Tag = require('../models/Tag');
const { verifyJWT } = require('../middleware/auth');

router.get('/', verifyJWT, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const userId = req.user._id;
    
    const query = { createdBy: userId };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { memo: { $regex: search, $options: 'i' } },
        { prompt: { $regex: search, $options: 'i' } }
      ];
    }
    
    const [promptDataList, total] = await Promise.all([
      PromptData.find(query)
        .populate('tags')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      PromptData.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        promptDataList,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get prompt data list error:', error);
    res.status(500).json({ success: false, message: '프롬프트 데이터 목록 조회 실패' });
  }
});

router.get('/:id', verifyJWT, async (req, res) => {
  try {
    const promptData = await PromptData.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });
    
    if (!promptData) {
      return res.status(404).json({ success: false, message: '프롬프트 데이터를 찾을 수 없습니다' });
    }
    
    res.json({ success: true, data: { promptData } });
  } catch (error) {
    console.error('Get prompt data error:', error);
    res.status(500).json({ success: false, message: '프롬프트 데이터 조회 실패' });
  }
});

router.post('/', verifyJWT, async (req, res) => {
  try {
    const { name, memo, representativeImage, prompt, negativePrompt, seed, tags } = req.body;
    
    if (!name || !prompt) {
      return res.status(400).json({ success: false, message: '이름과 프롬프트는 필수입니다' });
    }
    
    const newTags = Array.isArray(tags) ? tags : [];
    
    const promptData = new PromptData({
      name,
      memo,
      representativeImage,
      prompt,
      negativePrompt,
      seed,
      tags: newTags,
      createdBy: req.user._id
    });
    
    await promptData.save();
    
    if (newTags.length > 0) {
      await Tag.updateMany(
        { _id: { $in: newTags } },
        { $inc: { usageCount: 1 } }
      );
    }
    
    await promptData.populate('tags');
    
    res.status(201).json({ success: true, data: { promptData } });
  } catch (error) {
    console.error('Create prompt data error:', error);
    res.status(500).json({ success: false, message: '프롬프트 데이터 생성 실패' });
  }
});

router.put('/:id', verifyJWT, async (req, res) => {
  try {
    const { name, memo, representativeImage, prompt, negativePrompt, seed, tags } = req.body;
    
    const promptData = await PromptData.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });
    
    if (!promptData) {
      return res.status(404).json({ success: false, message: '프롬프트 데이터를 찾을 수 없습니다' });
    }
    
    if (name) promptData.name = name;
    if (memo !== undefined) promptData.memo = memo;
    if (representativeImage !== undefined) promptData.representativeImage = representativeImage;
    if (prompt) promptData.prompt = prompt;
    if (negativePrompt !== undefined) promptData.negativePrompt = negativePrompt;
    if (seed !== undefined) promptData.seed = seed;
    
    if (tags !== undefined) {
      const newTags = Array.isArray(tags) ? tags : [];
      const oldTags = promptData.tags.map(t => t.toString());
      
      const addedTags = newTags.filter(t => !oldTags.includes(t));
      const removedTags = oldTags.filter(t => !newTags.includes(t));
      
      if (addedTags.length > 0) {
        await Tag.updateMany(
          { _id: { $in: addedTags } },
          { $inc: { usageCount: 1 } }
        );
      }
      if (removedTags.length > 0) {
        await Tag.updateMany(
          { _id: { $in: removedTags } },
          { $inc: { usageCount: -1 } }
        );
      }
      
      promptData.tags = newTags;
    }
    
    await promptData.save();
    await promptData.populate('tags');
    
    res.json({ success: true, data: { promptData } });
  } catch (error) {
    console.error('Update prompt data error:', error);
    res.status(500).json({ success: false, message: '프롬프트 데이터 수정 실패' });
  }
});

router.delete('/:id', verifyJWT, async (req, res) => {
  try {
    const promptData = await PromptData.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id
    });
    
    if (!promptData) {
      return res.status(404).json({ success: false, message: '프롬프트 데이터를 찾을 수 없습니다' });
    }
    
    res.json({ success: true, message: '프롬프트 데이터가 삭제되었습니다' });
  } catch (error) {
    console.error('Delete prompt data error:', error);
    res.status(500).json({ success: false, message: '프롬프트 데이터 삭제 실패' });
  }
});

router.post('/:id/use', verifyJWT, async (req, res) => {
  try {
    const promptData = await PromptData.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });
    
    if (!promptData) {
      return res.status(404).json({ success: false, message: '프롬프트 데이터를 찾을 수 없습니다' });
    }
    
    await promptData.incrementUsage();
    
    res.json({ success: true, data: { promptData } });
  } catch (error) {
    console.error('Use prompt data error:', error);
    res.status(500).json({ success: false, message: '프롬프트 데이터 사용 기록 실패' });
  }
});

module.exports = router;
