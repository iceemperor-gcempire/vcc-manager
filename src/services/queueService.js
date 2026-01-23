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
  let workflowString = workflowTemplate;
  
  // 기본 고정 형식 문자열들
  const replacements = {
    '{{##prompt##}}': inputData.prompt || '',
    '{{##negative_prompt##}}': inputData.negativePrompt || '',
    '{{##model##}}': inputData.aiModel || '',
    '{{##width##}}': inputData.imageSize?.split('x')[0] || '512',
    '{{##height##}}': inputData.imageSize?.split('x')[1] || '512',
    '{{##seed##}}': Math.floor(Math.random() * 1000000000),
    '{{##steps##}}': inputData.additionalParams?.steps || 20,
    '{{##cfg##}}': inputData.additionalParams?.cfg || 7,
    '{{##sampler##}}': inputData.additionalParams?.sampler || 'euler',
    '{{##scheduler##}}': inputData.additionalParams?.scheduler || 'normal',
    '{{##reference_method##}}': inputData.referenceImageMethod || '',
    '{{##upscale_method##}}': inputData.upscaleMethod || '',
    '{{##base_style##}}': inputData.baseStyle || ''
  };

  // 추가 입력 필드들의 커스톰 형식 문자열 처리
  if (workboard && workboard.additionalInputFields) {
    workboard.additionalInputFields.forEach(field => {
      const fieldName = field.name;
      const formatString = field.formatString || `{{##${fieldName}##}}`;
      const value = inputData[fieldName] || field.defaultValue || '';
      replacements[formatString] = value;
    });
  }
  
  Object.keys(replacements).forEach(key => {
    workflowString = workflowString.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacements[key]);
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