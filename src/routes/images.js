const express = require('express');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const { upload, processAndSaveImage, deleteFile, validateImageDimensions } = require('../utils/fileUpload');
const UploadedImage = require('../models/UploadedImage');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const Tag = require('../models/Tag');
const router = express.Router();

router.post('/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }
    
    const { tags } = req.body;
    
    const result = await processAndSaveImage(
      req.file.buffer,
      req.file.originalname,
      req.user._id
    );
    
    const validation = validateImageDimensions(result.metadata);
    if (!validation.valid) {
      await deleteFile(result.filepath);
      return res.status(400).json({ message: validation.error });
    }
    
    const parsedTags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

    const uploadedImage = new UploadedImage({
      filename: result.filename,
      originalName: req.file.originalname,
      mimeType: 'image/png',
      size: result.size,
      path: result.filepath,
      url: result.url,
      userId: req.user._id,
      metadata: result.metadata,
      tags: parsedTags
    });

    await uploadedImage.save();

    // 태그 사용 카운트 증가
    if (parsedTags.length > 0) {
      await Tag.updateMany(
        { _id: { $in: parsedTags } },
        { $inc: { usageCount: 1 } }
      );
    }
    
    res.status(201).json({
      message: 'Image uploaded successfully',
      image: uploadedImage
    });
  } catch (error) {
    if (req.file) {
      const tempPath = path.join(process.env.UPLOAD_PATH || './uploads', 'reference', req.file.filename);
      await deleteFile(tempPath);
    }
    
    res.status(400).json({ message: error.message });
  }
});

router.get('/uploaded', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '', tags = '' } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = { userId: req.user._id };
    
    if (search) {
      filter.$or = [
        { originalName: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      filter.tags = { $in: tagArray };
    }
    
    const images = await UploadedImage.find(filter)
      .populate('tags')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await UploadedImage.countDocuments(filter);
    
    res.json({
      images,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/generated', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '', tags = '' } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = { userId: req.user._id };
    
    if (search) {
      filter.$or = [
        { originalName: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { 'generationParams.prompt': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      filter.tags = { $in: tagArray };
    }
    
    const images = await GeneratedImage.find(filter)
      .populate('jobId', 'createdAt')
      .populate('tags')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await GeneratedImage.countDocuments(filter);
    
    res.json({
      images,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/uploaded/:id', requireAuth, async (req, res) => {
  try {
    const image = await UploadedImage.findById(req.params.id)
      .populate('referencedBy.jobId', 'createdAt status inputData.prompt');
    
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    if (image.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ image });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/generated/:id', requireAuth, async (req, res) => {
  try {
    const image = await GeneratedImage.findById(req.params.id)
      .populate('jobId');
    
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    if (image.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ image });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/uploaded/:id', requireAuth, async (req, res) => {
  try {
    const { tags } = req.body;
    
    const image = await UploadedImage.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    if (image.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (tags !== undefined) {
      const newTags = Array.isArray(tags) ? tags : [];
      const oldTags = image.tags.map(t => t.toString());
      
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
      
      image.tags = newTags;
    }
    
    await image.save();
    await image.populate('tags');
    
    res.json({
      message: 'Image updated successfully',
      image
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/generated/:id', requireAuth, async (req, res) => {
  try {
    const { tags, isPublic } = req.body;
    
    const image = await GeneratedImage.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    if (image.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (tags !== undefined) {
      const newTags = Array.isArray(tags) ? tags : [];
      const oldTags = image.tags.map(t => t.toString());
      
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
      
      image.tags = newTags;
    }
    
    if (isPublic !== undefined) {
      image.isPublic = isPublic;
    }
    
    await image.save();
    await image.populate('tags');
    
    res.json({
      message: 'Image updated successfully',
      image
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/uploaded/:id', requireAuth, async (req, res) => {
  try {
    const image = await UploadedImage.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    if (image.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (image.isReferenced) {
      const activeJobs = await ImageGenerationJob.countDocuments({
        _id: { $in: image.referencedBy.map(ref => ref.jobId) },
        status: { $in: ['pending', 'processing'] }
      });
      
      if (activeJobs > 0) {
        return res.status(400).json({
          message: 'Cannot delete image that is referenced by active jobs'
        });
      }
    }
    
    // 태그 사용 카운트 감소
    if (image.tags && image.tags.length > 0) {
      await Tag.updateMany(
        { _id: { $in: image.tags } },
        { $inc: { usageCount: -1 } }
      );
    }

    await deleteFile(image.path);
    await UploadedImage.findByIdAndDelete(req.params.id);

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/generated/:id', requireAuth, async (req, res) => {
  try {
    const { deleteJob = false } = req.query;
    
    const image = await GeneratedImage.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    if (image.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // 태그 사용 카운트 감소
    if (image.tags && image.tags.length > 0) {
      await Tag.updateMany(
        { _id: { $in: image.tags } },
        { $inc: { usageCount: -1 } }
      );
    }

    await deleteFile(image.path);

    if (deleteJob === 'true' && image.jobId) {
      await ImageGenerationJob.findByIdAndDelete(image.jobId);
    }

    await GeneratedImage.findByIdAndDelete(req.params.id);

    res.json({
      message: `Image${deleteJob === 'true' ? ' and job' : ''} deleted successfully`
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const [uploadedStats, generatedStats] = await Promise.all([
      UploadedImage.aggregate([
        { $match: { userId: req.user._id } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalSize: { $sum: '$size' },
            referencedCount: { $sum: { $cond: ['$isReferenced', 1, 0] } }
          }
        }
      ]),
      GeneratedImage.aggregate([
        { $match: { userId: req.user._id } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalSize: { $sum: '$size' },
            publicCount: { $sum: { $cond: ['$isPublic', 1, 0] } },
            totalDownloads: { $sum: '$downloadCount' }
          }
        }
      ])
    ]);
    
    res.json({
      uploaded: uploadedStats[0] || { count: 0, totalSize: 0, referencedCount: 0 },
      generated: generatedStats[0] || { count: 0, totalSize: 0, publicCount: 0, totalDownloads: 0 }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/generated/:id/download', async (req, res) => {
  try {
    const image = await GeneratedImage.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    if (!image.isPublic && (!req.user || image.userId.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await image.incrementDownloadCount();
    
    res.download(image.path, image.originalName);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/videos', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '' } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = { userId: req.user._id };
    
    if (search) {
      filter.$or = [
        { originalName: { $regex: search, $options: 'i' } },
        { 'generationParams.prompt': { $regex: search, $options: 'i' } }
      ];
    }
    
    const videos = await GeneratedVideo.find(filter)
      .populate('jobId', 'createdAt')
      .populate('tags')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await GeneratedVideo.countDocuments(filter);
    
    res.json({
      videos,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/videos/:id', requireAuth, async (req, res) => {
  try {
    const video = await GeneratedVideo.findById(req.params.id)
      .populate('jobId')
      .populate('tags');
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    if (video.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ video });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/videos/:id', requireAuth, async (req, res) => {
  try {
    const { tags, isPublic } = req.body;
    
    const video = await GeneratedVideo.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    if (video.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (tags !== undefined) {
      const newTags = Array.isArray(tags) ? tags : [];
      const oldTags = video.tags.map(t => t.toString());
      
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
      
      video.tags = newTags;
    }
    
    if (isPublic !== undefined) {
      video.isPublic = isPublic;
    }
    
    await video.save();
    await video.populate('tags');
    
    res.json({
      message: 'Video updated successfully',
      video
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/videos/:id', requireAuth, async (req, res) => {
  try {
    const { deleteJob = false } = req.query;
    
    const video = await GeneratedVideo.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    if (video.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 태그 사용 카운트 감소
    if (video.tags && video.tags.length > 0) {
      await Tag.updateMany(
        { _id: { $in: video.tags } },
        { $inc: { usageCount: -1 } }
      );
    }

    await deleteFile(video.path);
    
    if (deleteJob === 'true' && video.jobId) {
      await ImageGenerationJob.findByIdAndDelete(video.jobId);
    }
    
    await GeneratedVideo.findByIdAndDelete(req.params.id);
    
    res.json({
      message: `Video${deleteJob === 'true' ? ' and job' : ''} deleted successfully`
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/videos/:id/download', async (req, res) => {
  try {
    const video = await GeneratedVideo.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    if (!video.isPublic && (!req.user || video.userId.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await video.incrementDownloadCount();
    
    res.download(video.path, video.originalName);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;