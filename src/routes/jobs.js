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
const { computeOpenAITextCost, computeGeminiTextCost } = require('../utils/pricing');
const Project = require('../models/Project');
const Tag = require('../models/Tag');
const UploadedText = require('../models/UploadedText');
const { loadVisionImages } = require('../utils/visionImages');

// 세계관 (사전 컨텍스트) + 작업 지침 → 단일 system 메시지로 합성 (#396).
// system prompt = LLM 의 역할 / 작업 방침 (작업판 admin 정의)
// worldview = 프로젝트의 사실 / 컨텍스트 (사용자가 보유)
function composeSystemPrompt(systemPrompt, worldviewTexts) {
  const parts = [];
  if (systemPrompt) {
    parts.push('[작업 지침]\n' + systemPrompt);
  }
  if (worldviewTexts && worldviewTexts.length > 0) {
    const ctx = worldviewTexts.map((t) => {
      const head = t.title ? `## ${t.title}\n` : '';
      return head + (t.content || '');
    }).join('\n\n---\n\n');
    parts.push('[배경 / 사전 컨텍스트]\n' + ctx);
  }
  return parts.join('\n\n');
}

// 프로젝트의 세계관 UploadedText 들 로드 (#396 → #400 일반화).
// 더 이상 flag (isWorldviewTag) 가 아닌 name 으로 세계관 태그를 조회 — 일반화된 태그 시스템.
const { BUILTIN_TAG_NAMES } = require('../constants/builtinTags');
async function getProjectWorldview(userId, projectId) {
  if (!projectId) return [];
  const project = await Project.findOne({ _id: projectId, userId }).lean();
  if (!project || !project.tagId) return [];
  const worldviewTag = await Tag.findOne({ userId, name: BUILTIN_TAG_NAMES.WORLDVIEW }).lean();
  if (!worldviewTag) return [];
  const texts = await UploadedText.find({
    userId,
    tags: { $all: [project.tagId, worldviewTag._id] },
  }).sort({ createdAt: 1 }).lean();
  return texts;
}
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
  let heartbeat = null; // SSE 하트비트 타이머 — 외부 catch 에서도 정리할 수 있도록 try 밖에 선언
  try {
    const { workboardId, inputData, conversationId, projectId, useWorldview, contextDocIds, systemPromptDocId } = req.body;

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

    // role 기반 lookup (#377) — 작업판 customField (`base_model`, `system_prompt`, ...) 가 단일 진입점.
    // legacy baseInputFields fallback 제거됨 — F2 / baseInputFields migration 완료 후 DB 에 잔존 없음.
    const extractOpt = (v) => (v && typeof v === 'object' && v.value !== undefined ? v.value : v);
    const systemPrompt = extractOpt(getFieldValueByRole(workboard, inputData, FIELD_ROLES.SYSTEM_PROMPT)) || '';
    const resolvedModel = extractOpt(getFieldValueByRole(workboard, inputData, FIELD_ROLES.MODEL));
    if (!resolvedModel && !conversationId) {
      // 멀티턴(이어가기) 은 inputData 에 model 이 없어도 conversation 에 저장된 model 을 사용
      return res.status(400).json({ message: '작업판에 모델이 선택되지 않았습니다.' });
    }
    const temperatureValue = extractOpt(getFieldValueByRole(workboard, inputData, FIELD_ROLES.TEMPERATURE));
    const temperature = temperatureValue != null ? Number(temperatureValue) : 0.7;
    // maxTokens 는 두 chat 서비스 모두 모델 기본값을 사용하도록 단순화됨 (#391 후속) — 입력 받지 않음.
    // 멀티턴 시 model 은 기존 대화에 저장된 값을 우선 (작업판 변경에도 일관성 유지)
    let model = resolvedModel;

    console.log('Prompt generation request:', {
      workboardId,
      model,
      temperature,
      serverUrl: server.serverUrl,
      hasApiKey: !!server.configuration?.apiKey,
      isContinuation: !!conversationId,
    });

    // 비전 첨부 (#517 → #519 통합): 작업판의 image 타입 customField 값(imageId)을 비전 입력으로.
    // 별도 토글 없이 image 필드가 있으면 동작하고, 첨부가 없으면 그냥 일반 채팅으로 진행.
    // turnImages = LLM 전송용 base64, turnAttachments = 대화 저장용 imageId/url 참조.
    let turnImages = [];
    let turnAttachments = [];
    const imageFieldNames = (workboard.additionalInputFields || [])
      .filter((f) => f.type === 'image')
      .map((f) => f.name);
    const collectedImageIds = [];
    for (const fname of imageFieldNames) {
      const v = inputData[fname];
      if (Array.isArray(v)) collectedImageIds.push(...v.filter(Boolean));
      else if (v) collectedImageIds.push(v);
    }
    if (collectedImageIds.length > 0) {
      const loaded = await loadVisionImages(collectedImageIds, req.user._id);
      turnImages = loaded.map((v) => ({ base64: v.base64, mimeType: v.mimeType }));
      turnAttachments = loaded.map((v) => ({ imageId: v.imageId, url: v.url }));
    }

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
      // 멀티턴은 대화에 저장된 model 유지 (#377)
      if (conversation.model) {
        model = conversation.model;
      }
      conversation.messages.push({
        role: 'user',
        content: inputData.userPrompt,
        attachments: turnAttachments,
        createdAt: new Date(),
      });
      conversation.status = 'processing';
      conversation.error = undefined;
      await conversation.save();
      // LLM 에는 전체 시퀀스 전달. 첨부 있는 메시지는 base64 로 로드해 비전 콘텐츠로 전송 (#517).
      messages = await Promise.all(conversation.messages.map(async (m) => {
        const base = { role: m.role, content: m.content };
        if (m.attachments && m.attachments.length > 0) {
          const imgs = await loadVisionImages(m.attachments.map((a) => a.imageId), conversation.userId);
          if (imgs.length > 0) base.images = imgs.map((v) => ({ base64: v.base64, mimeType: v.mimeType }));
        }
        return base;
      }));
    } else {
      // 신규 대화 — 세계관 / 사전 컨텍스트 / 시스템 프롬프트 문서 주입 (#396, #401).
      // 우선순위:
      //   1. 명시적 doc IDs (파이프라인 단계가 보낸 contextDocIds / systemPromptDocId)
      //   2. useWorldview + projectId → 프로젝트의 모든 세계관 문서 (단일샷 fallback)
      let worldviewTexts = [];
      let resolvedSystemPrompt = systemPrompt; // 작업판 customField 의 system_prompt 가 기본
      if (Array.isArray(contextDocIds) && contextDocIds.length > 0) {
        worldviewTexts = await UploadedText.find({
          userId: req.user._id,
          _id: { $in: contextDocIds },
        }).sort({ createdAt: 1 }).lean();
      } else if (useWorldview) {
        worldviewTexts = await getProjectWorldview(req.user._id, projectId);
      }
      if (systemPromptDocId) {
        const spDoc = await UploadedText.findOne({
          userId: req.user._id,
          _id: systemPromptDocId,
        }).lean();
        if (spDoc) {
          // 문서의 title + content 를 합쳐서 system prompt 로 사용 (title 은 헤더로)
          resolvedSystemPrompt = spDoc.title ? `## ${spDoc.title}\n${spDoc.content || ''}` : (spDoc.content || '');
        }
      }
      const worldviewContext = worldviewTexts.length > 0
        ? worldviewTexts.map((t) => (t.title ? `## ${t.title}\n` : '') + (t.content || '')).join('\n\n---\n\n')
        : '';
      const composedSystem = composeSystemPrompt(resolvedSystemPrompt, worldviewTexts);
      messages = [];
      if (composedSystem) {
        messages.push({ role: 'system', content: composedSystem });
      }
      // 단발: 사용자 메시지에 첨부 이미지 동봉 (#517). attachments 는 영속(스키마), images 는
      // LLM 전송용이라 ConversationJob.create 시 mongoose strict 가 떨궈낸다(스키마 미정의).
      messages.push({
        role: 'user',
        content: inputData.userPrompt,
        attachments: turnAttachments,
        images: turnImages,
      });
      // 프로젝트 작업 시 자동으로 프로젝트 태그 주입 (이미지 작업과 통일된 필터 메커니즘, #397 후속)
      let projectTagIds = [];
      if (projectId) {
        const projectDoc = await Project.findOne({ _id: projectId, userId: req.user._id }).lean();
        if (projectDoc?.tagId) projectTagIds = [projectDoc.tagId];
      }
      conversation = await ConversationJob.create({
        userId: req.user._id,
        workboardId: workboard._id,
        projectId: projectId || undefined,
        tags: projectTagIds,
        serverType: server.serverType,
        model,
        workboardSystemPrompt: resolvedSystemPrompt || undefined,
        worldviewContext: worldviewContext || undefined,
        messages: messages.map((m) => ({ ...m, createdAt: new Date() })),
        status: 'processing',
      });
    }

    // ── 여기서부터 SSE 스트리밍 (#490) ──
    // 위의 검증(400/403/404)은 모두 JSON 응답을 유지하고, 생성 단계부터 스트리밍한다.
    // 첫 바이트를 즉시 흘려보내 Cloudflare Tunnel 등 앞단 프록시의 TTFB 타임아웃(100초)을 회피.
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx 버퍼링 방지 (proxy_buffering off 와 병행)
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    // TTFB 즉시 확보용 SSE 코멘트
    res.write(': open\n\n');

    // 클라이언트가 중간에 나가도 LLM 스트림은 끝까지 받아 대화를 저장한다 (현재 sync 동작 보존).
    // clientGone 이면 res 쓰기만 멈추고, 저장 로직은 그대로 진행.
    let clientGone = false;
    let finished = false;
    res.on('close', () => { if (!finished) clientGone = true; });
    const sse = (event, data) => {
      if (clientGone || res.writableEnded) return;
      try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (_) { /* socket 닫힘 */ }
    };

    // 하트비트 — 첫 토큰까지 오래 걸리는(느린 로컬 LLM) 동안 SSE 코멘트를 주기적으로 흘려
    // 앞단 프록시(Cloudflare 등)의 idle 타임아웃을 회피. 클라이언트는 코멘트(:)를 무시.
    heartbeat = setInterval(() => {
      if (clientGone || res.writableEnded) return;
      try { res.write(': ping\n\n'); } catch (_) {}
    }, 15000);

    let result, usage;
    try {
      if (server.serverType === 'Gemini') {
        // Gemini 는 스트리밍 미구현 — 헤더는 이미 flush 됐으니 TTFB 는 확보됨.
        // 결과를 단일 token 이벤트로 전송해 프론트 SSE 처리 경로를 통일.
        ({ content: result, usage } = await geminiService.complete(
          server.serverUrl,
          server.configuration?.apiKey,
          messages,
          { model, temperature, timeout: server.configuration?.timeout || 60000, extraParams: workboard.llmExtraParams }
        ));
        if (result) sse('token', { delta: result });
      } else {
        ({ content: result, usage } = await openAIChatService.completeStream(
          server.serverUrl,
          server.configuration?.apiKey,
          messages,
          { model, temperature, timeout: server.configuration?.timeout || 60000, extraParams: workboard.llmExtraParams },
          (delta) => sse('token', { delta })
        ));
      }
    } catch (chatError) {
      clearInterval(heartbeat);
      conversation.status = 'failed';
      conversation.error = { message: chatError.message };
      conversation.completedAt = new Date();
      await conversation.save();
      sse('error', { message: chatError.message });
      finished = true;
      return res.end();
    }

    if (!result || !String(result).trim()) {
      clearInterval(heartbeat);
      conversation.status = 'failed';
      conversation.error = { message: 'LLM 서버에서 빈 응답을 반환했습니다.' };
      conversation.completedAt = new Date();
      await conversation.save();
      sse('error', { message: 'LLM 서버에서 빈 응답을 반환했습니다.' });
      finished = true;
      return res.end();
    }

    // assistant 응답 + usage + 비용 추정 (#377). usage 누적 (멀티턴 시 직전 턴 토큰 합산).
    conversation.messages.push({
      role: 'assistant',
      content: result,
      createdAt: new Date(),
    });
    const turnUsage = usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const prevUsage = conversation.usage || {};
    conversation.usage = {
      promptTokens: (prevUsage.promptTokens || 0) + (turnUsage.promptTokens || 0),
      completionTokens: (prevUsage.completionTokens || 0) + (turnUsage.completionTokens || 0),
      totalTokens: (prevUsage.totalTokens || 0) + (turnUsage.totalTokens || 0),
    };
    const computeCost = server.serverType === 'Gemini'
      ? computeGeminiTextCost
      : computeOpenAITextCost;
    const turnCost = computeCost(model, turnUsage);
    if (turnCost) {
      const prevAmount = conversation.costEstimate?.amount || 0;
      conversation.costEstimate = {
        amount: +(prevAmount + turnCost.amount).toFixed(6),
        currency: turnCost.currency,
        pricingVersion: turnCost.pricingVersion,
      };
    }
    conversation.status = 'completed';
    conversation.completedAt = new Date();
    await conversation.save();

    await workboard.incrementUsage();

    clearInterval(heartbeat);
    // 완료 이벤트 — 프론트는 여기서 conversationId 확보 + 저장된 메시지 refetch
    sse('done', {
      conversationId: conversation._id,
      result,
      usage: turnUsage,
      costEstimate: conversation.costEstimate || null,
      model,
    });
    finished = true;
    res.end();
  } catch (error) {
    console.error('Prompt generation error:', error);
    if (heartbeat) clearInterval(heartbeat);
    // 헤더가 이미 나갔으면(스트리밍 시작 후) error 이벤트로, 아니면 JSON 으로.
    if (res.headersSent) {
      try { res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`); } catch (_) {}
      return res.end();
    }
    res.status(502).json({ message: error.message });
  }
});

module.exports = router;