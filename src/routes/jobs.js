const express = require('express');
const { requireAuth, userHasWorkboardAccess } = require('../middleware/auth');
const { addImageGenerationJob, getQueueStats } = require('../services/queueService');
const openAIChatService = require('../services/openAIChatService');
const geminiService = require('../services/geminiService');
const { deleteFile } = require('../utils/fileUpload');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const ConversationJob = require('../models/ConversationJob');
const UploadedImage = require('../models/UploadedImage');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const Workboard = require('../models/Workboard');
const { escapeRegex } = require('../utils/escapeRegex');
const Server = require('../models/Server');
const { getFieldValueByRole } = require('../utils/customFieldHelpers');
const { FIELD_ROLES } = require('../constants/fieldRoles');
const router = express.Router();

router.post('/generate', requireAuth, async (req, res) => {
  try {
    console.log('🎯 Image generation request received');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    
    const {
      workboardId,
      prompt,
      negativePrompt,
      referenceImages,
      referenceImageMethod,
      stylePreset,
      upscaleMethod,
      additionalParams,
      seed,
      randomSeed,
      tags
    } = req.body;

    if (!workboardId || !prompt) {
      return res.status(400).json({ message: 'Missing required fields: workboardId, prompt' });
    }

    // 작업판 접근 권한 검사 (#198)
    const wb = await Workboard.findById(workboardId);
    if (!wb) {
      return res.status(404).json({ message: 'Workboard not found' });
    }
    if (!userHasWorkboardAccess(req.user, wb)) {
      return res.status(403).json({ message: '이 작업판에 접근할 권한이 없습니다.' });
    }

    // 모델 / 이미지 크기 추출 — customField 이름이 임의일 수 있어 schema-aware lookup.
    // 작업판의 additionalInputFields 에서 type='baseModel' 인 필드 (없으면 well-known name fallback) 의
    // name 으로 inputData (top-level 또는 additionalParams) 에서 값 조회.
    const ap = additionalParams || {};
    const lookupInput = { ...req.body, additionalParams: ap };
    const aiModel = req.body.aiModel || getFieldValueByRole(wb, lookupInput, FIELD_ROLES.MODEL);
    const imageSize = req.body.imageSize || getFieldValueByRole(wb, lookupInput, FIELD_ROLES.IMAGE_SIZE);

    console.log('🔍 Extracted fields:', {
      workboardId,
      prompt: prompt?.substring(0, 50) + '...',
      aiModel,
      imageSize,
      seed,
      randomSeed,
      additionalParamsKeys: Object.keys(ap)
    });

    if (!aiModel) {
      console.error('❌ aiModel 추출 실패 — workboard customField (type=baseModel) 또는 inputData 확인 필요');
      return res.status(400).json({
        message: '베이스 모델이 지정되지 않았습니다. 작업판 \"입력 양식\" 에 베이스 모델 타입 필드가 있는지, 사용자 페이지에서 모델을 선택했는지 확인하세요.'
      });
    }

    if (referenceImages && referenceImages.length > 0) {
      for (const refImg of referenceImages) {
        const image = await UploadedImage.findById(refImg.imageId);
        if (!image || image.userId.toString() !== req.user._id.toString()) {
          return res.status(400).json({
            message: 'Invalid reference image'
          });
        }
      }
    }
    
    const inputData = {
      prompt: prompt.trim(),
      negativePrompt: negativePrompt?.trim(),
      aiModel,
      imageSize,
      referenceImages: referenceImages || [],
      referenceImageMethod,
      stylePreset,
      upscaleMethod,
      additionalParams: additionalParams || {},
      seed,
      randomSeed,
      tags: Array.isArray(tags) ? tags : []
    };
    
    console.log('📦 Prepared inputData for job creation:', JSON.stringify(inputData, null, 2));
    
    const job = await addImageGenerationJob(req.user._id, workboardId, inputData);
    
    console.log('✅ Job created successfully:', {
      jobId: job._id,
      status: job.status,
      createdAt: job.createdAt
    });
    
    if (referenceImages && referenceImages.length > 0) {
      for (const refImg of referenceImages) {
        await UploadedImage.findByIdAndUpdate(refImg.imageId, {
          $push: { referencedBy: { jobId: job._id } },
          isReferenced: true
        });
      }
    }
    
    res.status(201).json({
      message: 'Image generation job created successfully',
      job: {
        id: job._id,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/my', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status = '', search = '' } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = { userId: req.user._id };
    if (status) filter.status = status;
    
    // 프롬프트 검색 기능 추가
    if (search) {
      filter['inputData.prompt'] = {
        $regex: escapeRegex(search),
        $options: 'i' // case insensitive
      };
    }
    
    const jobs = await ImageGenerationJob.find(filter)
      .select('-resolvedWorkflowData -workflowData')
      .populate('workboardId', 'name')
      .populate('resultImages')
      .populate('resultVideos')
      .populate('inputData.tags', 'name color isProjectTag')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await ImageGenerationJob.countDocuments(filter);
    
    res.json({
      jobs,
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

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const job = await ImageGenerationJob.findById(req.params.id)
      .populate('workboardId', 'name')
      .populate('resultImages')
      .populate('resultVideos')
      .populate('inputData.referenceImages.imageId');
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    if (job.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { deleteContent } = req.query;
    const shouldDeleteContent = deleteContent === 'true';

    const job = await ImageGenerationJob.findById(req.params.id).populate('resultImages').populate('resultVideos');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (job.status === 'processing') {
      return res.status(400).json({ message: 'Cannot delete job that is currently processing' });
    }

    // 참조 이미지 연결 해제
    if (job.inputData.referenceImages && job.inputData.referenceImages.length > 0) {
      for (const refImg of job.inputData.referenceImages) {
        await UploadedImage.findByIdAndUpdate(refImg.imageId, {
          $pull: { referencedBy: { jobId: job._id } }
        });

        const updatedImage = await UploadedImage.findById(refImg.imageId);
        if (updatedImage) {
          updatedImage.isReferenced = updatedImage.referencedBy.length > 0;
          await updatedImage.save();
        }
      }
    }

    let deletedImagesCount = 0;
    let deletedVideosCount = 0;

    // deleteContent가 true인 경우에만 연결된 컨텐츠 삭제
    if (shouldDeleteContent) {
      // 연결된 생성 이미지들 삭제 (물리적 파일과 DB 레코드)
      if (job.resultImages && job.resultImages.length > 0) {
        console.log(`🗑️  Deleting ${job.resultImages.length} generated images for job ${job._id}`);

        for (const image of job.resultImages) {
          try {
            // 물리적 파일 삭제
            if (image.path) {
              await deleteFile(image.path);
              console.log(`✅ Deleted file: ${image.path}`);
            }

            // DB에서 이미지 레코드 삭제
            await GeneratedImage.findByIdAndDelete(image._id);
            console.log(`✅ Deleted image record: ${image._id}`);
            deletedImagesCount++;
          } catch (fileError) {
            console.error(`⚠️  Failed to delete file for image ${image._id}:`, fileError.message);
            // 파일 삭제에 실패해도 DB 레코드는 삭제
            await GeneratedImage.findByIdAndDelete(image._id);
            deletedImagesCount++;
          }
        }
      }

      // 연결된 생성 비디오들 삭제 (물리적 파일과 DB 레코드)
      if (job.resultVideos && job.resultVideos.length > 0) {
        console.log(`🗑️  Deleting ${job.resultVideos.length} generated videos for job ${job._id}`);

        for (const video of job.resultVideos) {
          try {
            // 물리적 파일 삭제
            if (video.path) {
              await deleteFile(video.path);
              console.log(`✅ Deleted video file: ${video.path}`);
            }

            // DB에서 비디오 레코드 삭제
            await GeneratedVideo.findByIdAndDelete(video._id);
            console.log(`✅ Deleted video record: ${video._id}`);
            deletedVideosCount++;
          } catch (fileError) {
            console.error(`⚠️  Failed to delete file for video ${video._id}:`, fileError.message);
            // 파일 삭제에 실패해도 DB 레코드는 삭제
            await GeneratedVideo.findByIdAndDelete(video._id);
            deletedVideosCount++;
          }
        }
      }
    } else {
      // 컨텐츠를 삭제하지 않는 경우, jobId 참조만 해제
      if (job.resultImages && job.resultImages.length > 0) {
        await GeneratedImage.updateMany(
          { _id: { $in: job.resultImages.map(img => img._id) } },
          { $unset: { jobId: 1 } }
        );
      }
      if (job.resultVideos && job.resultVideos.length > 0) {
        await GeneratedVideo.updateMany(
          { _id: { $in: job.resultVideos.map(vid => vid._id) } },
          { $unset: { jobId: 1 } }
        );
      }
    }

    // 작업 레코드 삭제
    await ImageGenerationJob.findByIdAndDelete(req.params.id);

    const message = shouldDeleteContent
      ? `Job and ${deletedImagesCount} image(s), ${deletedVideosCount} video(s) deleted successfully`
      : 'Job deleted successfully (content preserved)';

    res.json({ message, deletedImagesCount, deletedVideosCount });
  } catch (error) {
    console.error('Job deletion error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/retry', requireAuth, async (req, res) => {
  try {
    const job = await ImageGenerationJob.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    if (job.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (job.status !== 'failed') {
      return res.status(400).json({ message: 'Only failed jobs can be retried' });
    }
    
    if (!job.canRetry()) {
      return res.status(400).json({ message: 'Maximum retry attempts reached' });
    }
    
    await job.incrementRetry();
    
    const newJob = await addImageGenerationJob(
      job.userId,
      job.workboardId,
      job.inputData
    );
    
    res.json({
      message: 'Job retry initiated successfully',
      job: {
        id: newJob._id,
        status: newJob.status,
        progress: newJob.progress,
        createdAt: newJob.createdAt
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/queue/stats', requireAuth, async (req, res) => {
  try {
    const stats = await getQueueStats();
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const job = await ImageGenerationJob.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    if (job.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (!['pending', 'processing'].includes(job.status)) {
      return res.status(400).json({ message: 'Job cannot be cancelled' });
    }
    
    await job.updateStatus('cancelled');
    
    res.json({ message: 'Job cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/generate-prompt', requireAuth, async (req, res) => {
  try {
    const { workboardId, inputData, conversationId } = req.body;

    if (!workboardId || !inputData?.userPrompt) {
      return res.status(400).json({
        message: 'Missing required fields: workboardId, inputData.userPrompt'
      });
    }

    const workboard = await Workboard.findById(workboardId).populate('serverId');
    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }

    // 작업판 접근 권한 검사 (#198)
    if (!userHasWorkboardAccess(req.user, workboard)) {
      return res.status(403).json({ message: '이 작업판에 접근할 권한이 없습니다.' });
    }

    if (workboard.outputFormat !== 'text' && workboard.workboardType !== 'prompt') {
      return res.status(400).json({ message: 'This workboard is not a prompt workboard' });
    }

    const server = workboard.serverId;
    if (!server || !server.isActive) {
      return res.status(400).json({ message: 'Server is not available' });
    }

    const systemPrompt = workboard.baseInputFields?.systemPrompt || '';
    const model = inputData.model || workboard.baseInputFields?.aiModel?.[0]?.value || 'gpt-4';
    const temperature = workboard.baseInputFields?.temperature ?? 0.7;
    const maxTokens = workboard.baseInputFields?.maxTokens ?? 2000;

    console.log('Prompt generation request:', {
      workboardId,
      model,
      temperature,
      maxTokens,
      serverUrl: server.serverUrl,
      hasApiKey: !!server.configuration?.apiKey,
      isContinuation: !!conversationId,
    });

    // 멀티턴 (#375): conversationId 가 있으면 기존 대화 로드 후 append.
    // 없으면 신규 대화 생성 (#373 Phase 1 동일 흐름).
    let conversation;
    let messages;
    if (conversationId) {
      conversation = await ConversationJob.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: '대화를 찾을 수 없습니다.' });
      }
      if (String(conversation.userId) !== String(req.user._id) && !req.user.isAdmin) {
        return res.status(403).json({ message: '이 대화에 접근할 권한이 없습니다.' });
      }
      if (String(conversation.workboardId) !== String(workboard._id)) {
        return res.status(400).json({ message: '대화가 다른 작업판에 속해 있습니다.' });
      }
      conversation.messages.push({
        role: 'user',
        content: inputData.userPrompt,
        createdAt: new Date(),
      });
      conversation.status = 'processing';
      conversation.error = undefined;
      await conversation.save();
      // LLM 에는 전체 시퀀스 전달
      messages = conversation.messages.map((m) => ({ role: m.role, content: m.content }));
    } else {
      messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: inputData.userPrompt });
      conversation = await ConversationJob.create({
        userId: req.user._id,
        workboardId: workboard._id,
        serverType: server.serverType,
        model,
        messages: messages.map((m) => ({ ...m, createdAt: new Date() })),
        status: 'processing',
      });
    }

    // server.serverType 기반 chat 서비스 분기. Gemini 는 generateContent (텍스트 모드),
    // 그 외 (OpenAI / OpenAI Compatible) 는 /v1/chat/completions.
    const chatService = server.serverType === 'Gemini'
      ? geminiService
      : openAIChatService;

    let result, usage;
    try {
      ({ content: result, usage } = await chatService.complete(
        server.serverUrl,
        server.configuration?.apiKey,
        messages,
        { model, temperature, maxTokens, timeout: server.configuration?.timeout || 60000 }
      ));
    } catch (chatError) {
      conversation.status = 'failed';
      conversation.error = { message: chatError.message };
      conversation.completedAt = new Date();
      await conversation.save();
      throw chatError;
    }

    // assistant 응답 messages 에 append + usage (Phase 3 에서 비용 추정 채움)
    conversation.messages.push({
      role: 'assistant',
      content: result,
      createdAt: new Date(),
    });
    conversation.usage = usage;
    conversation.status = 'completed';
    conversation.completedAt = new Date();
    await conversation.save();

    await workboard.incrementUsage();

    res.json({
      success: true,
      conversationId: conversation._id,
      result,
      usage,
      model
    });
  } catch (error) {
    console.error('Prompt generation error:', error);
    res.status(502).json({ message: error.message });
  }
});

module.exports = router;