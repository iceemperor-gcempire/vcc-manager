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

// 일괄 삭제 - 선택 항목
router.post('/bulk-delete', requireAuth, async (req, res) => {
  try {
    const { items = [], deleteJob = false } = req.body;
    const userId = req.user._id;

    if (!items.length) {
      return res.status(400).json({ message: 'No items provided' });
    }

    // type별 그룹핑
    const groups = { uploaded: [], generated: [], video: [] };
    for (const item of items) {
      if (groups[item.type]) groups[item.type].push(item.id);
    }

    const deleted = [];
    const failed = [];
    const errors = [];

    // 유틸: 태그 usageCount 일괄 차감
    const decrementTagCounts = async (docs) => {
      const tagCountMap = {};
      for (const doc of docs) {
        if (doc.tags?.length) {
          for (const tagId of doc.tags) {
            const key = tagId.toString();
            tagCountMap[key] = (tagCountMap[key] || 0) + 1;
          }
        }
      }
      const ops = Object.entries(tagCountMap).map(([tagId, count]) =>
        Tag.updateOne({ _id: tagId }, { $inc: { usageCount: -count } })
      );
      await Promise.allSettled(ops);
    };

    // uploaded 처리
    if (groups.uploaded.length) {
      const docs = await UploadedImage.find({ _id: { $in: groups.uploaded }, userId }).lean();
      const ownedIds = new Set(docs.map(d => d._id.toString()));

      // 소유권 없는 항목
      for (const id of groups.uploaded) {
        if (!ownedIds.has(id)) {
          failed.push(id);
          errors.push({ id, reason: 'Access denied or not found' });
        }
      }

      // 활성 작업 참조 중인 항목 제외
      const referencedDocs = docs.filter(d => d.isReferenced);
      let activeRefIds = new Set();
      if (referencedDocs.length) {
        const allJobRefs = referencedDocs.flatMap(d => (d.referencedBy || []).map(r => r.jobId));
        const activeJobs = await ImageGenerationJob.find({
          _id: { $in: allJobRefs },
          status: { $in: ['pending', 'processing'] }
        }).select('_id').lean();
        const activeJobIds = new Set(activeJobs.map(j => j._id.toString()));

        for (const doc of referencedDocs) {
          const hasActive = (doc.referencedBy || []).some(r => activeJobIds.has(r.jobId.toString()));
          if (hasActive) {
            activeRefIds.add(doc._id.toString());
            failed.push(doc._id.toString());
            errors.push({ id: doc._id.toString(), reason: 'Referenced by active job' });
          }
        }
      }

      const toDelete = docs.filter(d => !activeRefIds.has(d._id.toString()));
      if (toDelete.length) {
        await decrementTagCounts(toDelete);
        await Promise.allSettled(toDelete.map(d => deleteFile(d.path)));
        const idsToDelete = toDelete.map(d => d._id);
        await UploadedImage.deleteMany({ _id: { $in: idsToDelete } });
        deleted.push(...idsToDelete.map(id => id.toString()));
      }
    }

    // generated 처리
    if (groups.generated.length) {
      const docs = await GeneratedImage.find({ _id: { $in: groups.generated }, userId }).lean();
      const ownedIds = new Set(docs.map(d => d._id.toString()));

      for (const id of groups.generated) {
        if (!ownedIds.has(id)) {
          failed.push(id);
          errors.push({ id, reason: 'Access denied or not found' });
        }
      }

      if (docs.length) {
        await decrementTagCounts(docs);
        await Promise.allSettled(docs.map(d => deleteFile(d.path)));

        if (deleteJob) {
          const jobIds = docs.filter(d => d.jobId).map(d => d.jobId);
          if (jobIds.length) {
            await ImageGenerationJob.deleteMany({ _id: { $in: jobIds } });
          }
        }

        const idsToDelete = docs.map(d => d._id);
        await GeneratedImage.deleteMany({ _id: { $in: idsToDelete } });
        deleted.push(...idsToDelete.map(id => id.toString()));
      }
    }

    // video 처리
    if (groups.video.length) {
      const docs = await GeneratedVideo.find({ _id: { $in: groups.video }, userId }).lean();
      const ownedIds = new Set(docs.map(d => d._id.toString()));

      for (const id of groups.video) {
        if (!ownedIds.has(id)) {
          failed.push(id);
          errors.push({ id, reason: 'Access denied or not found' });
        }
      }

      if (docs.length) {
        await decrementTagCounts(docs);
        await Promise.allSettled(docs.map(d => deleteFile(d.path)));

        if (deleteJob) {
          const jobIds = docs.filter(d => d.jobId).map(d => d.jobId);
          if (jobIds.length) {
            await ImageGenerationJob.deleteMany({ _id: { $in: jobIds } });
          }
        }

        const idsToDelete = docs.map(d => d._id);
        await GeneratedVideo.deleteMany({ _id: { $in: idsToDelete } });
        deleted.push(...idsToDelete.map(id => id.toString()));
      }
    }

    res.json({
      success: true,
      data: { deleted: deleted.length, failed: failed.length, errors }
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 일괄 삭제 - 검색 결과 전체
router.post('/bulk-delete-by-filter', requireAuth, async (req, res) => {
  try {
    const { type, search = '', tags = '', deleteJob = false } = req.body;
    const userId = req.user._id;

    if (!type || !['uploaded', 'generated', 'video'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type' });
    }

    // 필터 구성 (기존 목록 API와 동일)
    const filter = { userId };

    if (type === 'uploaded') {
      if (search) {
        filter.$or = [
          { originalName: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ];
      }
      if (tags) {
        const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
        filter.tags = { $in: tagArray };
      }
    } else if (type === 'generated') {
      if (search) {
        filter.$or = [
          { originalName: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } },
          { 'generationParams.prompt': { $regex: search, $options: 'i' } }
        ];
      }
      if (tags) {
        const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
        filter.tags = { $in: tagArray };
      }
    } else {
      // video
      if (search) {
        filter.$or = [
          { originalName: { $regex: search, $options: 'i' } },
          { 'generationParams.prompt': { $regex: search, $options: 'i' } }
        ];
      }
    }

    const Model = type === 'uploaded' ? UploadedImage
      : type === 'generated' ? GeneratedImage
      : GeneratedVideo;

    const docs = await Model.find(filter).select('_id path tags jobId isReferenced referencedBy').lean();

    if (!docs.length) {
      return res.json({ success: true, data: { deleted: 0, failed: 0, errors: [] } });
    }

    // bulk-delete 로직 재사용 - items 형태로 변환
    const items = docs.map(d => ({ id: d._id.toString(), type }));

    // 내부적으로 bulk-delete와 동일한 로직 적용을 위해 리디렉트 대신 직접 처리
    // 이미 userId 필터링이 되어 있으므로 소유권 검사 불필요
    const deleted = [];
    const failed = [];
    const errors = [];

    // 태그 usageCount 일괄 차감
    const tagCountMap = {};
    for (const doc of docs) {
      if (doc.tags?.length) {
        for (const tagId of doc.tags) {
          const key = tagId.toString();
          tagCountMap[key] = (tagCountMap[key] || 0) + 1;
        }
      }
    }
    const tagOps = Object.entries(tagCountMap).map(([tagId, count]) =>
      Tag.updateOne({ _id: tagId }, { $inc: { usageCount: -count } })
    );
    await Promise.allSettled(tagOps);

    if (type === 'uploaded') {
      // 활성 작업 참조 중인 항목 제외
      const referencedDocs = docs.filter(d => d.isReferenced);
      let activeRefIds = new Set();
      if (referencedDocs.length) {
        const allJobRefs = referencedDocs.flatMap(d => (d.referencedBy || []).map(r => r.jobId));
        const activeJobs = await ImageGenerationJob.find({
          _id: { $in: allJobRefs },
          status: { $in: ['pending', 'processing'] }
        }).select('_id').lean();
        const activeJobIds = new Set(activeJobs.map(j => j._id.toString()));

        for (const doc of referencedDocs) {
          const hasActive = (doc.referencedBy || []).some(r => activeJobIds.has(r.jobId.toString()));
          if (hasActive) {
            activeRefIds.add(doc._id.toString());
            failed.push(doc._id.toString());
            errors.push({ id: doc._id.toString(), reason: 'Referenced by active job' });
          }
        }
      }

      const toDelete = docs.filter(d => !activeRefIds.has(d._id.toString()));
      await Promise.allSettled(toDelete.map(d => deleteFile(d.path)));
      const idsToDelete = toDelete.map(d => d._id);
      await UploadedImage.deleteMany({ _id: { $in: idsToDelete } });
      deleted.push(...idsToDelete.map(id => id.toString()));
    } else {
      await Promise.allSettled(docs.map(d => deleteFile(d.path)));

      if (deleteJob) {
        const jobIds = docs.filter(d => d.jobId).map(d => d.jobId);
        if (jobIds.length) {
          await ImageGenerationJob.deleteMany({ _id: { $in: jobIds } });
        }
      }

      const idsToDelete = docs.map(d => d._id);
      await Model.deleteMany({ _id: { $in: idsToDelete } });
      deleted.push(...idsToDelete.map(id => id.toString()));
    }

    res.json({
      success: true,
      data: { deleted: deleted.length, failed: failed.length, errors }
    });
  } catch (error) {
    console.error('Bulk delete by filter error:', error);
    res.status(500).json({ message: error.message });
  }
});

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