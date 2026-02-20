const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const { addImageGenerationJob, getQueueStats } = require('../services/queueService');
const { deleteFile } = require('../utils/fileUpload');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const UploadedImage = require('../models/UploadedImage');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const Workboard = require('../models/Workboard');
const { escapeRegex } = require('../utils/escapeRegex');
const Server = require('../models/Server');
const router = express.Router();

router.post('/generate', requireAuth, async (req, res) => {
  try {
    console.log('🎯 Image generation request received');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    
    const {
      workboardId,
      prompt,
      negativePrompt,
      aiModel,
      imageSize,
      referenceImages,
      referenceImageMethod,
      stylePreset,
      upscaleMethod,
      additionalParams,
      seed,
      randomSeed,
      tags
    } = req.body;
    
    console.log('🔍 Extracted fields:', {
      workboardId,
      prompt: prompt?.substring(0, 50) + '...',
      aiModel,
      imageSize,
      seed,
      randomSeed,
      additionalParamsKeys: additionalParams ? Object.keys(additionalParams) : []
    });
    
    if (!workboardId || !prompt || !aiModel) {
      console.error('❌ Missing required fields:', { workboardId: !!workboardId, prompt: !!prompt, aiModel: !!aiModel });
      return res.status(400).json({
        message: 'Missing required fields: workboardId, prompt, aiModel'
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
    const { workboardId, inputData } = req.body;
    
    if (!workboardId || !inputData?.userPrompt) {
      return res.status(400).json({
        message: 'Missing required fields: workboardId, inputData.userPrompt'
      });
    }
    
    const workboard = await Workboard.findById(workboardId).populate('serverId');
    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }
    
    if (workboard.workboardType !== 'prompt') {
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
      hasApiKey: !!server.configuration?.apiKey
    });
    
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: inputData.userPrompt });
    
    const apiUrl = `${server.serverUrl}/v1/chat/completions`;
    const requestBody = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    };
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (server.configuration?.apiKey) {
      headers['Authorization'] = `Bearer ${server.configuration.apiKey}`;
    }
    
    const response = await axios.post(apiUrl, requestBody, { headers, timeout: 60000 });
    
    console.log('LLM API response:', JSON.stringify(response.data, null, 2));
    
    if (!response.data?.choices || !Array.isArray(response.data.choices) || response.data.choices.length === 0) {
      console.error('Invalid LLM response structure:', response.data);
      return res.status(502).json({
        message: response.data?.error?.message || 'LLM 서버에서 유효한 응답을 받지 못했습니다. 서버 URL과 설정을 확인해주세요.'
      });
    }
    
    const result = response.data.choices[0]?.message?.content || '';
    if (!result) {
      return res.status(502).json({
        message: 'LLM 서버에서 빈 응답을 반환했습니다.'
      });
    }
    
    const usage = {
      promptTokens: response.data?.usage?.prompt_tokens || 0,
      completionTokens: response.data?.usage?.completion_tokens || 0,
      totalTokens: response.data?.usage?.total_tokens || 0
    };
    
    await workboard.incrementUsage();
    
    res.json({
      success: true,
      result,
      usage,
      model
    });
  } catch (error) {
    console.error('Prompt generation error:', error);
    
    if (error.response) {
      return res.status(error.response.status).json({
        message: error.response.data?.error?.message || 'API request failed'
      });
    }
    
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;