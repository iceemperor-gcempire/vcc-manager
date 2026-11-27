const express = require('express');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const { upload, processAndSaveImage, deleteFile, validateImageDimensions } = require('../utils/fileUpload');
const { videoUpload, processUploadedVideo } = require('../utils/videoUpload');
const { audioUpload, processUploadedAudio } = require('../utils/audioUpload');
const UploadedImage = require('../models/UploadedImage');
const UploadedVideo = require('../models/UploadedVideo');
const UploadedAudio = require('../models/UploadedAudio');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const GeneratedAudio = require('../models/GeneratedAudio');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const Tag = require('../models/Tag');
const { escapeRegex } = require('../utils/escapeRegex');
const { readQueryFlag } = require('../utils/booleanFlag');
const {
  buildMediaListFilter, parseTagIds, isObjectIdString, digestOfIds, validateListCondition, MEDIA_TYPES,
} = require('../utils/mediaSearchFilter');
const router = express.Router();

const MEDIA_MODELS = { uploaded: UploadedImage, generated: GeneratedImage, video: GeneratedVideo };

// 지운 문서에 붙어 있던 태그의 사용 횟수를 줄인다 — 실제로 지우는 문서만 넘긴다
async function decrementTagCounts(docs) {
  const tagCountMap = {};
  for (const doc of docs) {
    for (const tagId of doc.tags || []) {
      const key = tagId.toString();
      tagCountMap[key] = (tagCountMap[key] || 0) + 1;
    }
  }
  await Promise.allSettled(Object.entries(tagCountMap).map(([tagId, count]) =>
    Tag.updateOne({ _id: tagId }, { $inc: { usageCount: -count } })
  ));
}

// 실행 중인 작업이 쓰고 있는 업로드 이미지의 id — 이것들은 지우지 않는다
async function findActivelyReferencedIds(docs) {
  const referencedDocs = docs.filter(d => d.isReferenced);
  if (!referencedDocs.length) return new Set();
  const allJobRefs = referencedDocs.flatMap(d => (d.referencedBy || []).map(r => r.jobId));
  const activeJobs = await ImageGenerationJob.find({
    _id: { $in: allJobRefs },
    status: { $in: ['pending', 'processing'] }
  }).select('_id').lean();
  const activeJobIds = new Set(activeJobs.map(j => j._id.toString()));
  return new Set(referencedDocs
    .filter(d => (d.referencedBy || []).some(r => activeJobIds.has(r.jobId.toString())))
    .map(d => d._id.toString()));
}

// 찾아 둔 문서를 지운다. 여기까지 오면 대상은 이미 정해져 있다 (찾기 · 검증은 호출하는 쪽이 끝낸다)
async function deleteMediaDocs(type, docs, { deleteJob }) {
  if (!docs.length) return [];
  // 지우지 않는 다른 문서가 같은 파일을 쓰고 있으면 그 파일은 남긴다 — 문서만 지운다.
  // 예전에 저장된 결과 중에는 파일 이름이 겹쳐 한 파일을 나눠 가진 것이 있을 수 있다 (#1314)
  // 이 조회는 아무것도 바꾸기 전에 한다 — 여기서 실패하면 태그 횟수도 문서도 그대로다
  const deletingIds = docs.map(d => d._id);
  const paths = [...new Set(docs.map(d => d.path).filter(Boolean))];
  const sharers = paths.length
    ? await MEDIA_MODELS[type].find({ path: { $in: paths }, _id: { $nin: deletingIds } }).select('path').lean()
    : [];
  const sharedPaths = new Set(sharers.map(d => d.path));
  await decrementTagCounts(docs);
  if (sharedPaths.size) console.warn(`⚠️ 일괄 삭제: 다른 문서가 함께 쓰는 파일 ${sharedPaths.size}개는 남깁니다 (${type})`);
  await Promise.allSettled(paths.filter(p => !sharedPaths.has(p)).map(p => deleteFile(p)));
  if (deleteJob && type !== 'uploaded') {
    const jobIds = docs.filter(d => d.jobId).map(d => d.jobId);
    if (jobIds.length) await ImageGenerationJob.deleteMany({ _id: { $in: jobIds } });
  }
  const ids = docs.map(d => d._id);
  await MEDIA_MODELS[type].deleteMany({ _id: { $in: ids } });
  return ids.map(id => id.toString());
}

// 내 콘텐츠 목록 한 페이지.
// 조건(검색어 · 태그)이 있으면 조건에 맞는 id 전체를 한 번에 읽고, 페이지 항목 · 건수 · 대상 지문을
// 모두 그 한 번의 결과에서 만든다. 따로 조회하면 그 사이 대상이 바뀌었을 때 "보여 준 항목"과
// "지문이 가리키는 대상"이 어긋나고, 일괄 삭제는 그 지문을 믿고 지운다 (#1314)
// 조건이 없으면 지문을 주지 않는다 — 조건 없는 일괄 삭제는 없다.
async function listMediaPage(Model, filter, { page, limit, search, tags, populate = [] }) {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  // limit=0 은 예전처럼 "제한 없음"이다 (MongoDB 의 limit(0))
  const parsedLimit = parseInt(limit, 10);
  const pageSize = Number.isInteger(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 12;
  const skip = (pageNum - 1) * pageSize;
  const withPopulate = (query) => populate.reduce((q, args) => q.populate(...args), query);
  const hasCondition = !!String(search || '').trim() || parseTagIds(tags).ids.length > 0;

  if (!hasCondition) {
    const items = await withPopulate(Model.find(filter)).sort({ createdAt: -1 }).skip(skip).limit(pageSize);
    const total = await Model.countDocuments(filter);
    return { items, pagination: { current: pageNum, pages: pageSize ? Math.ceil(total / pageSize) : 1, total } };
  }

  const all = await Model.find(filter).sort({ createdAt: -1 }).select('_id').lean();
  const pageIds = (pageSize ? all.slice(skip, skip + pageSize) : all).map((d) => d._id);
  const order = new Map(pageIds.map((id, i) => [String(id), i]));
  const docs = pageIds.length
    ? await withPopulate(Model.find({ _id: { $in: pageIds }, userId: filter.userId }))
    : [];
  const items = [...docs].sort((x, y) => order.get(String(x._id)) - order.get(String(y._id)));
  return {
    items,
    pagination: { current: pageNum, pages: pageSize ? Math.ceil(all.length / pageSize) : 1, total: all.length, digest: digestOfIds(all) },
  };
}

// 일괄 삭제 - 선택 항목
// 휴지통이 없어 되돌릴 수 없다. 요청 전체를 먼저 검증하고, 지울 대상을 전부 찾은 뒤에 지운다 —
// 중간에 실패해 일부만 지워진 채 오류가 나지 않게 (#1314)
router.post('/bulk-delete', requireAuth, async (req, res) => {
  try {
    const { items, deleteJob = false } = req.body || {};
    const userId = req.user._id;

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: 'No items provided' });
    }
    if (typeof deleteJob !== 'boolean') {
      return res.status(400).json({ message: 'deleteJob 은 true 또는 false 여야 합니다' });
    }
    const badItem = items.find(item => !item || typeof item !== 'object'
      || !MEDIA_TYPES.includes(item.type) || !isObjectIdString(item.id));
    if (badItem !== undefined) {
      return res.status(400).json({ message: '항목 형식이 올바르지 않습니다 (id 는 24자 id, type 은 uploaded · generated · video)' });
    }

    const groups = { uploaded: [], generated: [], video: [] };
    for (const item of items) groups[item.type].push(item.id.toLowerCase()); // 대문자 id 도 같은 문서다

    // 1단계 — 찾기. 아무것도 지우지 않는다
    const failed = [];
    const errors = [];
    const plan = {};
    for (const type of MEDIA_TYPES) {
      const ids = [...new Set(groups[type])];
      if (!ids.length) continue;
      const docs = await MEDIA_MODELS[type].find({ _id: { $in: ids }, userId }).lean();
      const ownedIds = new Set(docs.map(d => d._id.toString()));
      for (const id of ids) {
        if (!ownedIds.has(id)) {
          failed.push(id);
          errors.push({ id, reason: 'Access denied or not found' });
        }
      }
      let toDelete = docs;
      if (type === 'uploaded') {
        const activeRefIds = await findActivelyReferencedIds(docs);
        for (const id of activeRefIds) {
          failed.push(id);
          errors.push({ id, reason: 'Referenced by active job' });
        }
        toDelete = docs.filter(d => !activeRefIds.has(d._id.toString()));
      }
      plan[type] = toDelete;
    }

    // 2단계 — 지우기
    const deleted = [];
    for (const type of MEDIA_TYPES) {
      if (plan[type]) deleted.push(...await deleteMediaDocs(type, plan[type], { deleteJob }));
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

// 일괄 삭제 - 조건에 맞는 것 전체
// 휴지통이 없어 되돌릴 수 없다. 그래서 두 번에 나눠 받는다 (#1314):
//   1) 확인 — 목록 API(조건이 있을 때 pagination.digest) 나 preview 가 대상 집합의 지문을 준다. 아무것도 지우지 않는다
//   2) 삭제 — 같은 조건과 그 지문을 보낸다. 지금 대상 집합의 지문이 다르면 지우지 않는다
// 화면은 목록이 준 지문을 그대로 쓴다 — 사용자가 본 목록과 지우는 대상이 같은 집합이다
// 조건은 목록 API 와 같은 함수(buildMediaListFilter)로 만든다.
const BULK_FILTER_SELECT = '_id path tags jobId isReferenced referencedBy';
const PREVIEW_SEEN_MAX = 200;

/** 요청을 검증하고 대상 문서를 찾는다. 틀리면 { status, message } */
async function resolveBulkFilterTarget(req) {
  const { type, search = '', tags = '' } = req.body || {};
  if (!MEDIA_TYPES.includes(type)) return { error: { status: 400, message: 'Invalid type' } };
  // 형식이 틀린 조건을 "조건 없음"으로 읽으면 삭제 범위가 전체로 넓어진다
  const invalid = validateListCondition({ search, tags });
  if (invalid) return { error: { status: 400, message: invalid } };
  // 조건 없이 부르면 그 종류의 내 콘텐츠 전체가 대상이 된다. 받지 않는다
  if (!search.trim() && !parseTagIds(tags).ids.length) {
    return { error: { status: 400, message: '삭제할 조건(검색어나 태그)이 필요합니다' } };
  }
  const filter = await buildMediaListFilter(type, req.user._id, { search, tags });
  const docs = await MEDIA_MODELS[type].find(filter).select(BULK_FILTER_SELECT).lean();
  return { type, docs };
}

router.post('/bulk-delete-by-filter/preview', requireAuth, async (req, res) => {
  try {
    // seenIds — 화면이 지금 보여 주고 있는 항목. 그중 하나라도 대상에 없으면 목록이 그 사이 바뀐 것이다
    const { seenIds } = req.body || {};
    if (seenIds !== undefined && (!Array.isArray(seenIds) || seenIds.length > PREVIEW_SEEN_MAX || !seenIds.every(isObjectIdString))) {
      return res.status(400).json({ message: `seenIds 는 id 목록이어야 합니다 (최대 ${PREVIEW_SEEN_MAX}개)` });
    }
    const target = await resolveBulkFilterTarget(req);
    if (target.error) return res.status(target.error.status).json({ message: target.error.message });
    if (seenIds && seenIds.length) {
      const targetIds = new Set(target.docs.map(d => d._id.toString()));
      if (!seenIds.every(id => targetIds.has(id.toLowerCase()))) {
        return res.status(409).json({
          message: '보고 계신 목록이 그 사이 바뀌었습니다. 목록을 다시 확인해 주세요',
          data: { count: target.docs.length }
        });
      }
    }
    res.json({ success: true, data: { count: target.docs.length, digest: digestOfIds(target.docs) } });
  } catch (error) {
    console.error('Bulk delete preview error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/bulk-delete-by-filter', requireAuth, async (req, res) => {
  try {
    const { deleteJob = false, expectedDigest } = req.body || {};
    if (typeof deleteJob !== 'boolean') {
      return res.status(400).json({ message: 'deleteJob 은 true 또는 false 여야 합니다' });
    }
    if (typeof expectedDigest !== 'string' || !/^[0-9a-f]{64}$/.test(expectedDigest)) {
      return res.status(400).json({ message: 'expectedDigest 가 필요합니다 — 먼저 /bulk-delete-by-filter/preview 로 대상을 확인하세요' });
    }
    const target = await resolveBulkFilterTarget(req);
    if (target.error) return res.status(target.error.status).json({ message: target.error.message });
    const { type, docs } = target;

    if (digestOfIds(docs) !== expectedDigest) {
      return res.status(409).json({
        message: `확인한 뒤에 목록이 바뀌었습니다. 지금 조건에 맞는 것은 ${docs.length}개입니다. 다시 확인해 주세요`,
        data: { count: docs.length }
      });
    }
    if (!docs.length) {
      return res.json({ success: true, data: { deleted: 0, failed: 0, errors: [] } });
    }

    const failed = [];
    const errors = [];
    let toDelete = docs;
    if (type === 'uploaded') {
      const activeRefIds = await findActivelyReferencedIds(docs);
      for (const id of activeRefIds) {
        failed.push(id);
        errors.push({ id, reason: 'Referenced by active job' });
      }
      toDelete = docs.filter(d => !activeRefIds.has(d._id.toString()));
    }
    const deleted = await deleteMediaDocs(type, toDelete, { deleteJob });

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

// 참조 비디오 업로드 (#753) — diskStorage 라 파일은 이미 최종 경로에 있음.
// ffprobe 메타데이터 + 첫 프레임 썸네일 후 UploadedVideo 문서 생성.
router.post('/upload-video', requireAuth, videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    const { tags } = req.body;
    const result = await processUploadedVideo(req.file);
    const parsedTags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

    const uploadedVideo = new UploadedVideo({
      ...result,
      userId: req.user._id,
      tags: parsedTags
    });

    await uploadedVideo.save();

    if (parsedTags.length > 0) {
      await Tag.updateMany(
        { _id: { $in: parsedTags } },
        { $inc: { usageCount: 1 } }
      );
    }

    res.status(201).json({
      message: 'Video uploaded successfully',
      video: uploadedVideo
    });
  } catch (error) {
    if (req.file?.path) {
      await deleteFile(req.file.path);
    }
    res.status(400).json({ message: error.message });
  }
});

// 업로드한 참조 비디오 목록 (#753)
router.get('/uploaded-videos', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '' } = req.query;
    const skip = (page - 1) * limit;

    const filter = { userId: req.user._id };
    if (search) {
      filter.originalName = { $regex: escapeRegex(search), $options: 'i' };
    }

    const videos = await UploadedVideo.find(filter)
      .populate('tags')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await UploadedVideo.countDocuments(filter);

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

// 업로드한 참조 비디오 삭제 (#753) — 파일 + 썸네일 + 문서
router.delete('/uploaded-videos/:id', requireAuth, async (req, res) => {
  try {
    const video = await UploadedVideo.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    if (video.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await deleteFile(video.path);
    if (video.thumbnailUrl) {
      const thumbPath = path.join(
        process.env.UPLOAD_PATH || './uploads',
        video.thumbnailUrl.replace(/^\/uploads\//, '')
      );
      await deleteFile(thumbPath);
    }
    await UploadedVideo.deleteOne({ _id: video._id });

    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 참조 오디오 업로드 (#772) — 비디오와 동일 구조. 썸네일 생성 단계만 없다.
router.post('/upload-audio', requireAuth, audioUpload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }

    const { tags } = req.body;
    const result = await processUploadedAudio(req.file);
    const parsedTags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

    const uploadedAudio = new UploadedAudio({
      ...result,
      userId: req.user._id,
      tags: parsedTags
    });

    await uploadedAudio.save();

    if (parsedTags.length > 0) {
      await Tag.updateMany(
        { _id: { $in: parsedTags } },
        { $inc: { usageCount: 1 } }
      );
    }

    res.status(201).json({
      message: 'Audio uploaded successfully',
      audio: uploadedAudio
    });
  } catch (error) {
    if (req.file?.path) {
      await deleteFile(req.file.path);
    }
    res.status(400).json({ message: error.message });
  }
});

// 업로드한 참조 오디오 목록 (#772)
router.get('/uploaded-audios', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '' } = req.query;
    const skip = (page - 1) * limit;

    const filter = { userId: req.user._id };
    if (search) {
      filter.originalName = { $regex: escapeRegex(search), $options: 'i' };
    }

    const audios = await UploadedAudio.find(filter)
      .populate('tags')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await UploadedAudio.countDocuments(filter);

    res.json({
      audios,
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

// 업로드한 참조 오디오 삭제 (#772) — 파일 + 문서
router.delete('/uploaded-audios/:id', requireAuth, async (req, res) => {
  try {
    const audio = await UploadedAudio.findById(req.params.id);
    if (!audio) {
      return res.status(404).json({ message: 'Audio not found' });
    }
    if (audio.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await deleteFile(audio.path);
    await UploadedAudio.deleteOne({ _id: audio._id });

    res.json({ message: 'Audio deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/uploaded', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '', tags = '' } = req.query;

    const invalidCondition = validateListCondition({ search, tags });
    if (invalidCondition) return res.status(400).json({ message: invalidCondition });
    // 일괄 삭제와 같은 함수로 조건을 만든다 (#1314)
    const filter = await buildMediaListFilter('uploaded', req.user._id, { search, tags });
    const { items, pagination } = await listMediaPage(UploadedImage, filter, { page, limit, search, tags, populate: [['tags']] });

    res.json({ images: items, pagination });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/generated', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '', tags = '' } = req.query;

    const invalidCondition = validateListCondition({ search, tags });
    if (invalidCondition) return res.status(400).json({ message: invalidCondition });
    // 일괄 삭제와 같은 함수로 조건을 만든다 (#1314)
    const filter = await buildMediaListFilter('generated', req.user._id, { search, tags });
    const { items, pagination } = await listMediaPage(GeneratedImage, filter, { page, limit, search, tags, populate: [['jobId', 'createdAt'], ['tags']] });

    res.json({ images: items, pagination });
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
    // 쿼리 값은 true · false 만 받는다 — 틀린 값을 꺼짐으로 읽고 지나가지 않는다 (#1323)
    const jobFlag = readQueryFlag(req.query.deleteJob, 'deleteJob');
    if (!jobFlag.ok) return res.status(400).json({ message: jobFlag.message });
    const deleteJob = jobFlag.value;
    
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

    if (deleteJob && image.jobId) {
      await ImageGenerationJob.findByIdAndDelete(image.jobId);
    }

    await GeneratedImage.findByIdAndDelete(req.params.id);

    res.json({
      message: `Image${deleteJob ? ' and job' : ''} deleted successfully`
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
    const { page = 1, limit = 12, search = '', tags = '' } = req.query;

    const invalidCondition = validateListCondition({ search, tags });
    if (invalidCondition) return res.status(400).json({ message: invalidCondition });
    // 일괄 삭제와 같은 함수로 조건을 만든다 (#1314)
    const filter = await buildMediaListFilter('video', req.user._id, { search, tags });
    const { items, pagination } = await listMediaPage(GeneratedVideo, filter, { page, limit, search, tags, populate: [['jobId', 'createdAt'], ['tags']] });

    res.json({ videos: items, pagination });
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
    // 쿼리 값은 true · false 만 받는다 — 틀린 값을 꺼짐으로 읽고 지나가지 않는다 (#1323)
    const jobFlag = readQueryFlag(req.query.deleteJob, 'deleteJob');
    if (!jobFlag.ok) return res.status(400).json({ message: jobFlag.message });
    const deleteJob = jobFlag.value;
    
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
    
    if (deleteJob && video.jobId) {
      await ImageGenerationJob.findByIdAndDelete(video.jobId);
    }
    
    await GeneratedVideo.findByIdAndDelete(req.params.id);
    
    res.json({
      message: `Video${deleteJob ? ' and job' : ''} deleted successfully`
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

// ── 생성 오디오 (#805) — 생성 비디오와 대칭. 썸네일이 없어 thumbnailUrl 관련 처리가 없다 ──
router.get('/audios', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '' } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = { userId: req.user._id };
    
    if (search) {
      filter.$or = [
        { originalName: { $regex: escapeRegex(search), $options: 'i' } },
        { 'generationParams.prompt': { $regex: escapeRegex(search), $options: 'i' } }
      ];
    }
    
    const audios = await GeneratedAudio.find(filter)
      .populate('jobId', 'createdAt')
      .populate('tags')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await GeneratedAudio.countDocuments(filter);
    
    res.json({
      audios,
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

router.get('/audios/:id', requireAuth, async (req, res) => {
  try {
    const audio = await GeneratedAudio.findById(req.params.id)
      .populate('jobId')
      .populate('tags');
    
    if (!audio) {
      return res.status(404).json({ message: 'Audio not found' });
    }
    
    if (audio.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ audio });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/audios/:id', requireAuth, async (req, res) => {
  try {
    const { tags, isPublic } = req.body;
    
    const audio = await GeneratedAudio.findById(req.params.id);
    
    if (!audio) {
      return res.status(404).json({ message: 'Audio not found' });
    }
    
    if (audio.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (tags !== undefined) {
      const newTags = Array.isArray(tags) ? tags : [];
      const oldTags = audio.tags.map(t => t.toString());
      
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
      
      audio.tags = newTags;
    }
    
    if (isPublic !== undefined) {
      audio.isPublic = isPublic;
    }
    
    await audio.save();
    await audio.populate('tags');
    
    res.json({
      message: 'Audio updated successfully',
      audio
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/audios/:id', requireAuth, async (req, res) => {
  try {
    // 쿼리 값은 true · false 만 받는다 — 틀린 값을 꺼짐으로 읽고 지나가지 않는다 (#1323)
    const jobFlag = readQueryFlag(req.query.deleteJob, 'deleteJob');
    if (!jobFlag.ok) return res.status(400).json({ message: jobFlag.message });
    const deleteJob = jobFlag.value;
    
    const audio = await GeneratedAudio.findById(req.params.id);
    
    if (!audio) {
      return res.status(404).json({ message: 'Audio not found' });
    }
    
    if (audio.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 태그 사용 카운트 감소
    if (audio.tags && audio.tags.length > 0) {
      await Tag.updateMany(
        { _id: { $in: audio.tags } },
        { $inc: { usageCount: -1 } }
      );
    }

    await deleteFile(audio.path);
    
    if (deleteJob && audio.jobId) {
      await ImageGenerationJob.findByIdAndDelete(audio.jobId);
    }
    
    await GeneratedAudio.findByIdAndDelete(req.params.id);
    
    res.json({
      message: `Audio${deleteJob ? ' and job' : ''} deleted successfully`
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/audios/:id/download', async (req, res) => {
  try {
    const audio = await GeneratedAudio.findById(req.params.id);
    
    if (!audio) {
      return res.status(404).json({ message: 'Audio not found' });
    }
    
    if (!audio.isPublic && (!req.user || audio.userId.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await audio.incrementDownloadCount();
    
    res.download(audio.path, audio.originalName);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;