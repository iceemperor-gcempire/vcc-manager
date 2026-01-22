const express = require('express');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const { upload, processAndSaveImage, deleteFile, validateImageDimensions } = require('../utils/fileUpload');
const UploadedImage = require('../models/UploadedImage');
const GeneratedImage = require('../models/GeneratedImage');
const ImageGenerationJob = require('../models/ImageGenerationJob');
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
    
    const uploadedImage = new UploadedImage({
      filename: result.filename,
      originalName: req.file.originalname,
      mimeType: 'image/png',
      size: result.size,
      path: result.filepath,
      url: result.url,
      userId: req.user._id,
      metadata: result.metadata,
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []
    });
    
    await uploadedImage.save();
    
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
    
    if (tags) {
      image.tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
    
    await image.save();
    
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
    
    if (tags) {
      image.tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
    
    if (isPublic !== undefined) {
      image.isPublic = isPublic;
    }
    
    await image.save();
    
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

module.exports = router;