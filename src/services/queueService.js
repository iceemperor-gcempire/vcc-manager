const Queue = require('bull');
const Redis = require('redis');
const path = require('path');
const fs = require('fs');
const comfyUIService = require('./comfyUIService');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const GeneratedImage = require('../models/GeneratedImage');

let imageGenerationQueue;
let redisClient;

const initializeQueues = async () => {
  try {
    // Parse Redis URL or use default
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log('Connecting to Redis:', redisUrl);
    
    const redisUrlParsed = new URL(redisUrl);
    
    const redisConfig = {
      host: redisUrlParsed.hostname,
      port: parseInt(redisUrlParsed.port) || 6379,
      password: redisUrlParsed.password || process.env.REDIS_PASSWORD || undefined
    };

    console.log('Redis config for Bull queue:', { 
      host: redisConfig.host, 
      port: redisConfig.port, 
      hasPassword: !!redisConfig.password 
    });

    redisClient = Redis.createClient({
      url: redisUrl,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      retryDelayOnClusterDown: 300,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3
    });
    
    await redisClient.connect();
    console.log('Redis connected successfully');

    imageGenerationQueue = new Queue('image generation', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    imageGenerationQueue.process('generateImage', 5, processImageGeneration);

    imageGenerationQueue.on('waiting', (jobId) => {
      console.log(`Job ${jobId} is waiting`);
    });

    imageGenerationQueue.on('active', async (job, jobPromise) => {
      console.log(`Job ${job.id} started processing`);
      await updateJobStatus(job.data.jobId, 'processing');
    });

    imageGenerationQueue.on('completed', async (job, result) => {
      console.log(`Job ${job.id} completed successfully`);
      console.log(`ComfyUI result:`, JSON.stringify(result, null, 2));
      console.log(`Result images count: ${result?.images?.length || 0}`);
      await updateJobStatus(job.data.jobId, 'completed', { resultImages: result.images });
    });

    imageGenerationQueue.on('failed', async (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
      await updateJobStatus(job.data.jobId, 'failed', { 
        error: { 
          message: err.message,
          code: err.code || 'PROCESSING_ERROR'
        }
      });
    });

    imageGenerationQueue.on('progress', async (job, progress) => {
      await updateJobProgress(job.data.jobId, progress);
    });

    console.log('Job queue initialized successfully');
  } catch (error) {
    console.error('Failed to initialize queues:', error);
    throw error;
  }
};

const processImageGeneration = async (job) => {
  const { jobId, workboardData, inputData } = job.data;
  
  try {
    job.progress(10);
    
    const workflowJson = injectInputsIntoWorkflow(workboardData.workflowData, inputData, workboardData);
    job.progress(20);
    
    console.log(`Submitting workflow to ComfyUI for job ${jobId}`);
    const comfyResult = await comfyUIService.submitWorkflow(
      workboardData.serverUrl,
      workflowJson,
      (progress) => job.progress(20 + (progress * 0.7))
    );
    job.progress(90);
    
    console.log(`ComfyUI returned ${comfyResult.images?.length || 0} images for job ${jobId}`);
    if (!comfyResult.images || comfyResult.images.length === 0) {
      throw new Error('No images returned from ComfyUI');
    }
    
    const savedImages = await saveGeneratedImages(jobId, comfyResult.images, inputData);
    job.progress(100);
    
    return { images: savedImages };
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    throw error;
  }
};

const injectInputsIntoWorkflow = (workflowTemplate, inputData, workboard = null) => {
  // 기본 고정 형식 문자열들과 타입 정보
  const replacements = {
    '{{##prompt##}}': { value: inputData.prompt || '', type: 'string' },
    '{{##negative_prompt##}}': { value: inputData.negativePrompt || '', type: 'string' },
    '{{##model##}}': { value: inputData.aiModel || '', type: 'string' },
    '{{##width##}}': { value: parseInt(inputData.imageSize?.split('x')[0]) || 512, type: 'number' },
    '{{##height##}}': { value: parseInt(inputData.imageSize?.split('x')[1]) || 512, type: 'number' },
    '{{##seed##}}': { value: Math.floor(Math.random() * 1000000000), type: 'number' },
    '{{##steps##}}': { value: parseInt(inputData.additionalParams?.steps) || 20, type: 'number' },
    '{{##cfg##}}': { value: parseFloat(inputData.additionalParams?.cfg) || 7, type: 'number' },
    '{{##sampler##}}': { value: inputData.additionalParams?.sampler || 'euler', type: 'string' },
    '{{##scheduler##}}': { value: inputData.additionalParams?.scheduler || 'normal', type: 'string' },
    '{{##reference_method##}}': { value: inputData.referenceImageMethod || '', type: 'string' },
    '{{##upscale_method##}}': { value: inputData.upscaleMethod || '', type: 'string' },
    '{{##base_style##}}': { value: inputData.baseStyle || '', type: 'string' }
  };

  // 추가 입력 필드들의 커스톰 형식 문자열 처리
  if (workboard && workboard.additionalInputFields) {
    workboard.additionalInputFields.forEach(field => {
      const fieldName = field.name;
      const formatString = field.formatString || `{{##${fieldName}##}}`;
      let value = inputData[fieldName] || field.defaultValue || '';
      
      // 필드 타입에 따른 값 변환
      switch (field.type) {
        case 'number':
          value = parseFloat(value) || 0;
          break;
        case 'boolean':
          value = Boolean(value);
          break;
        case 'string':
        case 'select':
        default:
          value = String(value);
          break;
      }
      
      replacements[formatString] = { value, type: field.type || 'string' };
    });
  }
  
  // JSON 객체로 파싱 후 재귀적으로 치환
  try {
    const workflowObj = JSON.parse(workflowTemplate);
    const replacedObj = replaceInObject(workflowObj, replacements);
    return replacedObj;
  } catch (error) {
    console.error('Error parsing workflow template as JSON:', error);
    // fallback: 기존 문자열 치환 방식
    return fallbackStringReplacement(workflowTemplate, replacements);
  }
};

// JSON 객체 내에서 재귀적으로 값을 치환하는 함수
const replaceInObject = (obj, replacements) => {
  if (typeof obj === 'string') {
    // 문자열 내 플레이스홀더 확인 및 치환
    const replacement = replacements[obj];
    if (replacement) {
      return replacement.value;
    }
    
    // 부분 문자열 치환 (문자열 내 일부만 플레이스홀더인 경우)
    let result = obj;
    Object.keys(replacements).forEach(key => {
      if (result.includes(key)) {
        result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacements[key].value);
      }
    });
    return result;
  } else if (Array.isArray(obj)) {
    return obj.map(item => replaceInObject(item, replacements));
  } else if (obj && typeof obj === 'object') {
    const result = {};
    Object.keys(obj).forEach(key => {
      result[key] = replaceInObject(obj[key], replacements);
    });
    return result;
  }
  return obj;
};

// 기존 문자열 치환 방식 (fallback)
const fallbackStringReplacement = (workflowTemplate, replacements) => {
  let workflowString = workflowTemplate;
  
  Object.keys(replacements).forEach(key => {
    const { value } = replacements[key];
    workflowString = workflowString.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  });
  
  return JSON.parse(workflowString);
};

const saveGeneratedImages = async (jobId, comfyImages, inputData) => {
  console.log(`Saving ${comfyImages.length} generated images for job ${jobId}`);
  const savedImages = [];
  
  for (let i = 0; i < comfyImages.length; i++) {
    try {
      const imageData = comfyImages[i];
      const filename = `generated_${Date.now()}_${i}.png`;
      const generatedDir = path.join(process.env.UPLOAD_PATH || './uploads', 'generated');
      
      // Ensure directory exists
      await fs.promises.mkdir(generatedDir, { recursive: true });
      
      const imagePath = path.join(generatedDir, filename);
      
      console.log(`Saving image ${i+1}/${comfyImages.length} to ${imagePath}`);
      await fs.promises.writeFile(imagePath, imageData.buffer);
      
      const generatedImage = new GeneratedImage({
        filename,
        originalName: filename,
        mimeType: 'image/png',
        size: imageData.buffer.length,
        path: imagePath,
        url: `/uploads/generated/${filename}`,
        userId: inputData.userId,
        jobId,
        metadata: {
          width: imageData.width,
          height: imageData.height,
          format: 'png'
        },
        generationParams: {
          prompt: inputData.prompt,
          negativePrompt: inputData.negativePrompt,
          model: inputData.aiModel,
          seed: inputData.seed
        }
      });
      
      await generatedImage.save();
      savedImages.push(generatedImage._id);
      console.log(`Successfully saved image ${generatedImage._id}`);
    } catch (error) {
      console.error(`Error saving image ${i+1}:`, error);
    }
  }
  
  console.log(`Completed saving ${savedImages.length} images for job ${jobId}`);
  return savedImages;
};

const updateJobStatus = async (jobId, status, data = {}) => {
  try {
    const job = await ImageGenerationJob.findById(jobId);
    if (job) {
      await job.updateStatus(status, data);
    }
  } catch (error) {
    console.error(`Error updating job status for ${jobId}:`, error);
  }
};

const updateJobProgress = async (jobId, progress) => {
  try {
    const job = await ImageGenerationJob.findById(jobId);
    if (job) {
      job.progress = progress;
      await job.save();
    }
  } catch (error) {
    console.error(`Error updating job progress for ${jobId}:`, error);
  }
};

const addImageGenerationJob = async (userId, workboardId, inputData) => {
  try {
    const Workboard = require('../models/Workboard');
    const workboard = await Workboard.findById(workboardId);
    
    if (!workboard || !workboard.isActive) {
      throw new Error('Workboard not found or inactive');
    }
    
    const job = new ImageGenerationJob({
      userId,
      workboardId,
      inputData,
      workflowData: workboard.workflowData
    });
    
    await job.save();
    
    const queueJob = await imageGenerationQueue.add('generateImage', {
      jobId: job._id.toString(),
      workboardData: {
        serverUrl: workboard.serverUrl,
        workflowData: workboard.workflowData,
        additionalInputFields: workboard.additionalInputFields
      },
      inputData: {
        ...inputData,
        userId
      }
    }, {
      priority: inputData.priority || 0
    });
    
    await job.updateStatus('pending', { queueJobId: queueJob.id });
    await workboard.incrementUsage();
    
    return job;
  } catch (error) {
    console.error('Error adding image generation job:', error);
    throw error;
  }
};

const getQueueStats = async () => {
  if (!imageGenerationQueue) {
    console.log('Queue not initialized, returning empty stats');
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    };
  }
  
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      imageGenerationQueue.getWaiting(),
      imageGenerationQueue.getActive(),
      imageGenerationQueue.getCompleted(),
      imageGenerationQueue.getFailed(),
      imageGenerationQueue.getDelayed()
    ]);
    
    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length
    };
  } catch (error) {
    console.error('Error getting queue stats:', error);
    // Return empty stats instead of null to prevent frontend errors
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    };
  }
};

module.exports = {
  initializeQueues,
  addImageGenerationJob,
  getQueueStats,
  imageGenerationQueue
};