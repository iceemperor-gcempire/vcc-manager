const Queue = require('bull');
const Redis = require('redis');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
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
    
    const { workflowJson, actualSeed } = injectInputsIntoWorkflow(workboardData.workflowData, inputData, workboardData);
    job.progress(20);
    
    // 실제 사용된 시드 값을 inputData에 추가
    const enhancedInputData = {
      ...inputData,
      seed: actualSeed
    };
    
    console.log(`🚀 Submitting workflow to ComfyUI for job ${jobId} with seed: ${actualSeed}`);
    console.log(`🔗 ComfyUI Server URL: ${workboardData.serverUrl}`);
    console.log(`📝 Workflow JSON preview:`, JSON.stringify(workflowJson).substring(0, 200) + '...');
    
    const comfyResult = await comfyUIService.submitWorkflow(
      workboardData.serverUrl,
      workflowJson,
      (progress) => job.progress(20 + (progress * 0.7))
    );
    job.progress(90);
    
    console.log(`✅ ComfyUI workflow completed for job ${jobId}`);
    console.log(`📊 ComfyUI result:`, {
      hasImages: !!comfyResult.images,
      imageCount: comfyResult.images?.length || 0,
      resultKeys: Object.keys(comfyResult),
      fullResult: comfyResult
    });
    
    if (!comfyResult.images || comfyResult.images.length === 0) {
      console.error('❌ No images returned from ComfyUI!');
      console.error('🔍 Full ComfyUI result for debugging:', JSON.stringify(comfyResult, null, 2));
      throw new Error('No images returned from ComfyUI');
    }
    
    console.log(`💾 Starting to save ${comfyResult.images.length} images...`);
    const savedImages = await saveGeneratedImages(jobId, comfyResult.images, enhancedInputData);
    console.log(`✅ Saved ${savedImages.length} images successfully`);
    
    job.progress(100);
    
    return { images: savedImages };
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    throw error;
  }
};

// 64비트 부호없는 정수 범위에서 랜덤 시드 생성
const generateRandomSeed = () => {
  // ComfyUI는 64비트 부호없는 정수를 사용 (음수 불가)
  const min = 0; // 0
  const max = 18446744073709551615; // 2^64-1 (UInt64 최대값)
  // JavaScript의 안전한 정수 범위 내에서 생성 (0 ~ Number.MAX_SAFE_INTEGER)
  return Math.floor(Math.random() * (Number.MAX_SAFE_INTEGER + 1));
};

const injectInputsIntoWorkflow = (workflowTemplate, inputData, workboard = null) => {
  console.log('🔄 Injecting inputs into workflow...');
  console.log('📝 Input data received:', JSON.stringify(inputData, null, 2));
  
  // 값 추출 헬퍼 함수: 키-값 객체에서 값만 추출하거나 문자열 그대로 반환
  const extractValue = (field) => {
    if (typeof field === 'object' && field?.value !== undefined) {
      console.log('🔍 Extracting value from object:', field, '-> extracted:', field.value);
      return field.value;
    }
    console.log('🔍 Using field as-is:', field);
    return field || '';
  };
  
  // 시드 값 처리: 사용자 지정 또는 랜덤 생성
  let seedValue;
  if (inputData.seed !== undefined && inputData.seed !== null && inputData.seed !== '') {
    // extractValue를 사용하여 키-값 객체에서 값 추출
    const extractedSeed = extractValue(inputData.seed);
    const parsedSeed = parseInt(extractedSeed);
    
    // 유효한 정수인지 확인 및 UInt64 범위 보정
    if (!isNaN(parsedSeed)) {
      // ComfyUI는 음수 seed를 받지 않으므로 절댓값으로 변환
      if (parsedSeed < 0) {
        seedValue = Math.abs(parsedSeed);
        console.log(`🔄 Converted negative seed ${parsedSeed} to positive ${seedValue}`);
      } else {
        seedValue = parsedSeed;
      }
    } else {
      console.warn('⚠️ Invalid seed value, using random seed:', extractedSeed);
      seedValue = generateRandomSeed();
    }
  } else {
    seedValue = generateRandomSeed();
  }
  
  console.log('🎲 Processed seed value:', seedValue);
  
  // 이미지 크기 추출 (예: "512x768" 또는 {key: "512x768", value: "512x768"})
  const extractedImageSize = extractValue(inputData.imageSize) || '512x512';
  console.log('📐 Extracted image size:', extractedImageSize);
  
  let width = 512, height = 512;
  try {
    if (extractedImageSize && extractedImageSize.includes('x')) {
      [width, height] = extractedImageSize.split('x').map(s => parseInt(s) || 512);
    }
  } catch (error) {
    console.warn('⚠️ Error parsing image size, using defaults:', error.message);
    width = 512;
    height = 512;
  }
  console.log('📏 Parsed dimensions:', { width, height });
  
  // 기본 고정 형식 문자열들과 타입 정보
  const replacements = {
    '{{##prompt##}}': { value: inputData.prompt || '', type: 'string' },
    '{{##negative_prompt##}}': { value: inputData.negativePrompt || '', type: 'string' },
    '{{##model##}}': { value: extractValue(inputData.aiModel), type: 'string' },
    '{{##width##}}': { value: width, type: 'number' },
    '{{##height##}}': { value: height, type: 'number' },
    '{{##seed##}}': { value: seedValue, type: 'number' },
    '{{##steps##}}': { value: parseInt(inputData.additionalParams?.steps) || 20, type: 'number' },
    '{{##cfg##}}': { value: parseFloat(inputData.additionalParams?.cfg) || 7, type: 'number' },
    '{{##sampler##}}': { value: inputData.additionalParams?.sampler || 'euler', type: 'string' },
    '{{##scheduler##}}': { value: inputData.additionalParams?.scheduler || 'normal', type: 'string' },
    '{{##reference_method##}}': { value: extractValue(inputData.referenceImageMethod), type: 'string' },
    '{{##upscale_method##}}': { value: extractValue(inputData.upscaleMethod), type: 'string' },
    '{{##base_style##}}': { value: extractValue(inputData.baseStyle), type: 'string' }
  };
  
  console.log('🔧 Built replacements object:', JSON.stringify(replacements, null, 2));

  // 추가 입력 필드들의 커스톰 형식 문자열 처리
  if (workboard && workboard.additionalInputFields) {
    workboard.additionalInputFields.forEach(field => {
      const fieldName = field.name;
      const formatString = field.formatString || `{{##${fieldName}##}}`;
      
      // additionalParams에서 필드 값 추출
      let rawValue;
      if (inputData.additionalParams && inputData.additionalParams[fieldName] !== undefined) {
        rawValue = inputData.additionalParams[fieldName];
      } else {
        rawValue = inputData[fieldName] || field.defaultValue || '';
      }
      
      // 키-값 객체에서 값 추출
      let value = extractValue(rawValue);
      
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
    const replacedObj = replaceInObject(workflowObj, replacements, seedValue);
    return {
      workflowJson: replacedObj,
      actualSeed: seedValue
    };
  } catch (error) {
    console.error('Error parsing workflow template as JSON:', error);
    // fallback: 기존 문자열 치환 방식
    const fallbackResult = fallbackStringReplacement(workflowTemplate, replacements);
    return {
      workflowJson: fallbackResult,
      actualSeed: seedValue
    };
  }
};

// JSON 객체 내에서 재귀적으로 값을 치환하는 함수
const replaceInObject = (obj, replacements, seedValue = null) => {
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
    return obj.map(item => replaceInObject(item, replacements, seedValue));
  } else if (obj && typeof obj === 'object') {
    const result = {};
    Object.keys(obj).forEach(key => {
      // seed 키를 발견하면 자동으로 생성된 seedValue로 치환
      if (key === 'seed' && seedValue !== null && typeof obj[key] === 'number') {
        console.log(`🎲 Auto-replacing hardcoded seed ${obj[key]} with generated seed ${seedValue}`);
        result[key] = seedValue;
      } else {
        result[key] = replaceInObject(obj[key], replacements, seedValue);
      }
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
  console.log(`🖼️ Starting to save ${comfyImages?.length || 0} generated images for job ${jobId}`);
  console.log('📊 ComfyUI images data:', comfyImages);
  console.log('📋 Input data for saving:', inputData);
  
  if (!comfyImages || comfyImages.length === 0) {
    console.warn('⚠️ No images received from ComfyUI to save!');
    return [];
  }
  
  const savedImages = [];
  
  for (let i = 0; i < comfyImages.length; i++) {
    try {
      const imageData = comfyImages[i];
      console.log(`🔍 Processing image ${i+1}:`, {
        hasBuffer: !!imageData.buffer,
        bufferSize: imageData.buffer?.length || 0,
        imageDataKeys: Object.keys(imageData)
      });
      
      if (!imageData.buffer) {
        console.error(`❌ Image ${i+1} has no buffer data!`);
        continue;
      }
      
      const filename = `generated_${Date.now()}_${i}.png`;
      const generatedDir = path.join(process.env.UPLOAD_PATH || './uploads', 'generated');
      
      // Ensure directory exists
      await fs.promises.mkdir(generatedDir, { recursive: true });
      console.log(`📁 Directory ensured: ${generatedDir}`);
      
      const imagePath = path.join(generatedDir, filename);
      
      console.log(`💾 Saving image ${i+1}/${comfyImages.length} to ${imagePath}`);
      await fs.promises.writeFile(imagePath, imageData.buffer);
      console.log(`✅ Successfully wrote file to disk: ${imagePath}`);
      
      // 실제 이미지 파일에서 크기 정보 추출
      let imageMetadata = {
        format: 'png'
      };
      
      try {
        const sharpImage = sharp(imageData.buffer);
        const { width, height, format } = await sharpImage.metadata();
        imageMetadata = {
          width,
          height,
          format: format || 'png'
        };
        console.log(`Image ${i+1} metadata: ${width}x${height} ${format}`);
      } catch (metadataError) {
        console.warn(`Failed to extract metadata for image ${i+1}:`, metadataError.message);
        // fallback to ComfyUI provided data if available
        if (imageData.width && imageData.height) {
          imageMetadata.width = imageData.width;
          imageMetadata.height = imageData.height;
        }
      }
      
      const generatedImageData = {
        filename,
        originalName: filename,
        mimeType: 'image/png',
        size: imageData.buffer.length,
        path: imagePath,
        url: `/uploads/generated/${filename}`,
        userId: inputData.userId,
        jobId,
        metadata: imageMetadata,
        generationParams: {
          prompt: inputData.prompt,
          negativePrompt: inputData.negativePrompt,
          model: inputData.aiModel,
          seed: inputData.seed,
          imageSize: inputData.imageSize,
          stylePreset: inputData.stylePreset,
          upscaleMethod: inputData.upscaleMethod,
          referenceImageMethod: inputData.referenceImageMethod,
          additionalParams: inputData.additionalParams
        }
      };
      
      console.log(`💾 Creating GeneratedImage with data:`, JSON.stringify(generatedImageData, null, 2));
      
      const generatedImage = new GeneratedImage(generatedImageData);
      
      console.log(`📝 Saving GeneratedImage to database...`);
      await generatedImage.save();
      
      savedImages.push(generatedImage._id);
      console.log(`✅ Successfully saved image ${generatedImage._id} to database`);
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