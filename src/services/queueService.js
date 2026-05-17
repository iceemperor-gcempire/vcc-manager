const Queue = require('bull');
const Redis = require('redis');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const comfyUIService = require('./comfyUIService');
const geminiService = require('./geminiService');
const gptImageService = require('./gptImageService');
const { computeOpenAIImageCost } = require('../utils/pricing');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const UploadedImage = require('../models/UploadedImage');
const { getFieldValueByRole } = require('../utils/customFieldHelpers');
const { FIELD_ROLES } = require('../constants/fieldRoles');

let imageGenerationQueue;
let redisClient;

// JSON 문자열에서 안전하게 사용할 수 있도록 값을 이스케이핑하는 함수
const escapeForJsonString = (value) => {
  if (typeof value === 'string') {
    // JSON 문자열에서 안전하게 사용할 수 있도록 특수문자 이스케이핑
    return value
      .replace(/\\/g, '\\\\')  // 역슬래시
      .replace(/"/g, '\\"')    // 큰따옴표
      .replace(/\n/g, '\\n')   // 줄바꿈
      .replace(/\r/g, '\\r')   // 캐리지 리턴
      .replace(/\t/g, '\\t');  // 탭
  }
  return value;
};

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
      console.log(`Result videos count: ${result?.videos?.length || 0}`);
      await updateJobStatus(job.data.jobId, 'completed', {
        resultImages: result.images,
        resultVideos: result.videos,
        usage: result.usage,
        costEstimate: result.costEstimate
      });
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

// (serverType, outputFormat) → 핸들러 매핑.
// 신규 provider/capability 추가 시 이 테이블에만 추가하면 됨.
// 핸들러 시그니처: ({ workboardData, inputData, jobId, job }) => Promise<{ images?, videos?, seed? }>
const SERVICE_MAP = {
  'Gemini:image': handleGeminiImage,
  'OpenAI:image': handleOpenAIImage,
  'OpenAI Compatible:image': handleOpenAIImage,
  'ComfyUI:image': handleComfyUIWorkflow,
  'ComfyUI:video': handleComfyUIWorkflow,
};

const resolveServiceKey = (workboardData) => {
  const serverType = workboardData.serverType;
  const outputFormat = workboardData.outputFormat || 'image';
  return { key: `${serverType}:${outputFormat}`, serverType, outputFormat };
};

async function handleGeminiImage({ workboardData, inputData, job }) {
  const geminiImages = await loadImageInputs(
    workboardData.additionalInputFields || [],
    inputData
  );
  job.progress(20);

  const result = await geminiService.generateImage(
    workboardData.serverUrl,
    workboardData.apiKey || process.env.GEMINI_API_KEY,
    buildGeminiPrompt(inputData, workboardData),
    {
      model: getFieldValueByRole(workboardData, inputData, FIELD_ROLES.MODEL),
      aspectRatio: deriveAspectRatio(extractOptionValue(getFieldValueByRole(workboardData, inputData, FIELD_ROLES.IMAGE_SIZE))),
      resolution: extractOptionValue(inputData.additionalParams?.resolution),
      images: geminiImages,
      timeout: workboardData.timeout,
    }
  );
  job.progress(90);
  return result;
}

async function handleOpenAIImage({ workboardData, inputData, job }) {
  const result = await gptImageService.generateImage(
    workboardData.serverUrl,
    workboardData.apiKey || process.env.OPENAI_IMAGE_API_KEY,
    buildGeminiPrompt(inputData, workboardData),
    {
      model: getFieldValueByRole(workboardData, inputData, FIELD_ROLES.MODEL),
      size: extractOptionValue(getFieldValueByRole(workboardData, inputData, FIELD_ROLES.IMAGE_SIZE)),
      quality: extractOptionValue(
        inputData.additionalParams?.quality || inputData.quality
      ),
      n: extractOptionValue(
        inputData.additionalParams?.n || inputData.n
      ) || 1,
      outputFormat: extractOptionValue(
        inputData.additionalParams?.outputFormat || inputData.outputFormat
      ) || 'png',
      background: extractOptionValue(inputData.additionalParams?.background),
      outputCompression: extractOptionValue(inputData.additionalParams?.output_compression),
      timeout: workboardData.timeout,
    }
  );
  job.progress(90);

  // 토큰 사용량 → 비용 추정 (#364)
  let usageNormalized = null;
  let costEstimate = null;
  if (result.usage) {
    usageNormalized = {
      inputTokens: result.usage.input_tokens,
      inputTextTokens: result.usage.input_tokens_details?.text_tokens,
      inputImageTokens: result.usage.input_tokens_details?.image_tokens,
      outputTokens: result.usage.output_tokens,
      totalTokens: result.usage.total_tokens,
    };
    costEstimate = computeOpenAIImageCost(result.model, result.usage);
  }

  return {
    images: result.images,
    videos: result.videos,
    usage: usageNormalized,
    costEstimate,
  };
}

async function handleComfyUIWorkflow({ workboardData, inputData, job, jobId }) {
  const uploadedImageMap = await uploadImageFieldsToComfyUI(
    workboardData.serverUrl,
    workboardData.additionalInputFields || [],
    inputData
  );
  job.progress(15);

  let workflowJson;
  let actualSeed;
  try {
    ({ workflowJson, actualSeed } = await injectInputsIntoWorkflow(
      workboardData.workflowData,
      inputData,
      workboardData,
      uploadedImageMap
    ));
  } catch (injectError) {
    const resolvedString = injectError.resolvedWorkflowString || workboardData.workflowData;
    try {
      await ImageGenerationJob.findByIdAndUpdate(jobId, {
        resolvedWorkflowData: resolvedString,
      });
    } catch (saveError) {
      console.error(`⚠️ Failed to save workflow data for job ${jobId}:`, saveError.message);
    }
    throw injectError;
  }
  job.progress(20);

  try {
    await ImageGenerationJob.findByIdAndUpdate(jobId, {
      resolvedWorkflowData: JSON.stringify(workflowJson),
    });
  } catch (saveError) {
    console.error(`⚠️ Failed to save resolved workflow data for job ${jobId}:`, saveError.message);
  }

  console.log(`🚀 Submitting workflow to ComfyUI for job ${jobId} with seed: ${actualSeed}`);
  console.log(`🔗 ComfyUI Server URL: ${workboardData.serverUrl}`);
  console.log(`📝 Workflow JSON preview:`, JSON.stringify(workflowJson).substring(0, 200) + '...');

  const result = await comfyUIService.submitWorkflow(
    workboardData.serverUrl,
    workflowJson,
    (progress) => job.progress(20 + (progress * 0.7))
  );
  job.progress(90);

  console.log(`✅ ComfyUI workflow completed for job ${jobId}`);
  console.log(`📊 ComfyUI result:`, {
    hasImages: !!result.images,
    imageCount: result.images?.length || 0,
    hasVideos: !!result.videos,
    videoCount: result.videos?.length || 0,
    resultKeys: Object.keys(result),
  });

  return { ...result, seed: actualSeed };
}

const processImageGeneration = async (job) => {
  const { jobId, workboardData, inputData } = job.data;

  try {
    job.progress(5);

    const { key, serverType, outputFormat } = resolveServiceKey(workboardData);
    const handler = SERVICE_MAP[key];
    if (!handler) {
      throw new Error(
        `지원하지 않는 서비스 조합입니다: serverType=${serverType ?? '(unknown)'}, outputFormat=${outputFormat}`
      );
    }
    console.log(`[dispatch] job ${jobId} → ${key}`);

    const generationResult = await handler({ workboardData, inputData, job, jobId });
    const enhancedInputData = generationResult.seed != null
      ? { ...inputData, seed: generationResult.seed }
      : inputData;
    
    const hasImages = generationResult.images && generationResult.images.length > 0;
    const hasVideos = generationResult.videos && generationResult.videos.length > 0;
    
    if (!hasImages && !hasVideos) {
      console.error('❌ No images or videos returned from generation backend!');
      console.error('🔍 Full generation result for debugging:', JSON.stringify(generationResult, null, 2));
      throw new Error('No media returned from generation backend');
    }
    
    let savedImages = [];
    let savedVideos = [];
    
    if (hasImages) {
      console.log(`💾 Starting to save ${generationResult.images.length} images...`);
      savedImages = await saveGeneratedMedia(jobId, generationResult.images, enhancedInputData, 'image', workboardData);
      console.log(`✅ Saved ${savedImages.length} images successfully`);
    }

    if (hasVideos) {
      console.log(`🎬 Starting to save ${generationResult.videos.length} videos...`);
      savedVideos = await saveGeneratedMedia(jobId, generationResult.videos, enhancedInputData, 'video', workboardData);
      console.log(`✅ Saved ${savedVideos.length} videos successfully`);
    }
    
    job.progress(100);
    
    return { images: savedImages, videos: savedVideos };
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    throw error;
  }
};

const extractOptionValue = (value) => {
  if (value && typeof value === 'object' && value.value !== undefined) {
    return value.value;
  }
  return value;
};

const deriveAspectRatio = (imageSize) => {
  if (!imageSize || typeof imageSize !== 'string') return undefined;

  if (/^\d+:\d+$/.test(imageSize)) return imageSize;

  const match = imageSize.match(/^(\d+)x(\d+)$/i);
  if (!match) return undefined;

  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);
  if (!width || !height) return undefined;

  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
};

const buildGeminiPrompt = (inputData, workboard) => {
  const prompt = getFieldValueByRole(workboard, inputData, FIELD_ROLES.PROMPT);
  const negativePrompt = getFieldValueByRole(workboard, inputData, FIELD_ROLES.NEGATIVE_PROMPT);
  const segments = [prompt];

  if (negativePrompt) {
    segments.push(`Avoid: ${negativePrompt}`);
  }

  return segments.filter(Boolean).join('\n\n');
};

const findImageDocumentById = async (imageId) => {
  let imageDoc = await GeneratedImage.findById(imageId);
  if (!imageDoc) {
    imageDoc = await UploadedImage.findById(imageId);
  }
  return imageDoc;
};

const loadImageInput = async (imageId) => {
  if (!imageId) return null;

  const imageDoc = await findImageDocumentById(imageId);
  if (!imageDoc?.path || !fs.existsSync(imageDoc.path)) {
    return null;
  }

  const buffer = await fs.promises.readFile(imageDoc.path);
  return {
    buffer,
    mimeType: imageDoc.mimeType,
    filename: imageDoc.filename || path.basename(imageDoc.path)
  };
};

const loadImageInputs = async (additionalInputFields, inputData) => {
  const loadedImages = [];

  // role 기반 lookup 은 workboard 전체가 필요한데 여기선 fields 만 받음 — 호환성 위해 직접 access.
  // 모든 호출처가 inputData.referenceImages 를 사용 중이므로 fallback 만 유지.
  if (Array.isArray(inputData.referenceImages)) {
    for (const referenceImage of inputData.referenceImages) {
      const loaded = await loadImageInput(referenceImage?.imageId);
      if (loaded) {
        loadedImages.push(loaded);
      }
    }
  }

  const imageFields = (additionalInputFields || []).filter((field) => field.type === 'image');
  for (const field of imageFields) {
    let fieldValue = inputData.additionalParams?.[field.name] || inputData[field.name];
    if (!fieldValue) continue;

    const values = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
    for (const entry of values) {
      const loaded = await loadImageInput(entry?.imageId || entry);
      if (loaded) {
        loadedImages.push(loaded);
      }
    }
  }

  return loadedImages;
};

// 1024x1024 흰색 PNG 의 메모리 캐시. 첫 호출에서만 sharp 가 raw 픽셀 buffer (~3MB) 를 일시
// 할당하고, 이후엔 캐시된 PNG 버퍼 (5.3KB) 만 재사용. 동시성 N 잡일 때 raw buffer peak 가
// N 배로 증폭되는 위험을 차단.
let blankWhitePngBuffer = null;
const getBlankWhitePngBuffer = async () => {
  if (!blankWhitePngBuffer) {
    blankWhitePngBuffer = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    }).png().toBuffer();
  }
  return blankWhitePngBuffer;
};

// 미첨부 이미지 필드용 1024x1024 흰색 PNG 를 ComfyUI 에 업로드 (#230).
// ComfyUI 의 LoadImage 노드는 입력이 없으면 워크플로우 실행 자체가 실패하므로 placeholder 주입 필요.
// 동일 잡 내 여러 빈 이미지 필드는 1회 업로드 후 재사용 (cache 인자로 전달).
const uploadBlankWhitePngToComfyUI = async (serverUrl, cache) => {
  if (cache.blankFilename) return cache.blankFilename;
  const buffer = await getBlankWhitePngBuffer();
  const filename = `vcc_blank_white_${Date.now()}.png`;
  const uploadResult = await comfyUIService.uploadImage(serverUrl, buffer, filename);
  cache.blankFilename = uploadResult.name;
  return uploadResult.name;
};

// 이미지 타입 필드들을 ComfyUI에 업로드하고 파일명 맵 반환
const uploadImageFieldsToComfyUI = async (serverUrl, additionalInputFields, inputData) => {
  const uploadedImageMap = {};
  const blankCache = {};

  if (!additionalInputFields || additionalInputFields.length === 0) {
    return uploadedImageMap;
  }

  // 이미지 타입 필드 찾기
  const imageFields = additionalInputFields.filter(field => field.type === 'image');

  for (const field of imageFields) {
    const fieldName = field.name;
    let fieldValue = inputData.additionalParams?.[fieldName] || inputData[fieldName];

    // 배열인 경우 첫 번째 이미지만 사용 (단일 이미지 필드)
    if (Array.isArray(fieldValue)) {
      fieldValue = fieldValue.length > 0 ? fieldValue[0] : null;
    }

    const imageId = fieldValue ? (fieldValue.imageId || fieldValue) : null;

    // 미첨부 / imageId 부재 시 흰색 1024x1024 PNG 자동 주입 (#230)
    if (!imageId) {
      try {
        const blankName = await uploadBlankWhitePngToComfyUI(serverUrl, blankCache);
        uploadedImageMap[fieldName] = blankName;
        console.log(`🔳 Image field "${fieldName}" empty, injected blank white PNG: ${blankName}`);
      } catch (error) {
        console.error(`❌ Failed to inject blank PNG for field "${fieldName}":`, error.message);
      }
      continue;
    }

    try {
      console.log(`🔍 Looking up image for field "${fieldName}": ${imageId}`);

      // 이미지 정보 조회 (GeneratedImage 또는 UploadedImage)
      const imageDoc = await findImageDocumentById(imageId);

      if (!imageDoc) {
        console.warn(`⚠️ Image not found for field "${fieldName}": ${imageId}`);
        continue;
      }

      // 이미지 파일 읽기
      const imagePath = imageDoc.path;
      if (!fs.existsSync(imagePath)) {
        console.warn(`⚠️ Image file not found: ${imagePath}`);
        continue;
      }

      const imageBuffer = await fs.promises.readFile(imagePath);
      const filename = `vcc_${fieldName}_${Date.now()}_${path.basename(imagePath)}`;

      // ComfyUI에 업로드
      const uploadResult = await comfyUIService.uploadImage(serverUrl, imageBuffer, filename);

      // 업로드된 파일명 저장
      uploadedImageMap[fieldName] = uploadResult.name;
      console.log(`✅ Uploaded image for field "${fieldName}": ${uploadResult.name}`);

    } catch (error) {
      console.error(`❌ Failed to upload image for field "${fieldName}":`, error.message);
    }
  }

  return uploadedImageMap;
};

// 유저 ID를 해시하여 파일명에 안전한 문자열로 변환
const hashUserId = (userId) => {
  if (!userId) return 'anonymous';
  // SHA256 해시 후 처음 8자리만 사용 (파일명 일관성 유지)
  return crypto.createHash('sha256').update(String(userId)).digest('hex').substring(0, 8);
};

// 64비트 부호없는 정수 범위에서 랜덤 시드 생성
const generateRandomSeed = () => {
  // ComfyUI는 64비트 부호없는 정수를 사용 (음수 불가)
  const min = 0; // 0
  const max = 18446744073709551615; // 2^64-1 (UInt64 최대값)
  // JavaScript의 안전한 정수 범위 내에서 생성 (0 ~ Number.MAX_SAFE_INTEGER)
  return Math.floor(Math.random() * (Number.MAX_SAFE_INTEGER + 1));
};

const injectInputsIntoWorkflow = async (workflowTemplate, inputData, workboard = null, uploadedImageMap = {}) => {
  console.log('🔄 Injecting inputs into workflow...');
  console.log('📝 Input data received:', JSON.stringify(inputData, null, 2));
  console.log('🖼️ Uploaded image map:', uploadedImageMap);
  
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
  const seedFromRole = getFieldValueByRole(workboard, inputData, FIELD_ROLES.SEED);
  if (seedFromRole !== undefined && seedFromRole !== null && seedFromRole !== '') {
    // extractValue를 사용하여 키-값 객체에서 값 추출
    const extractedSeed = extractValue(seedFromRole);
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
  const extractedImageSize = extractValue(getFieldValueByRole(workboard, inputData, FIELD_ROLES.IMAGE_SIZE)) || '512x512';
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
  
  // 유저 ID 해시 생성
  const hashedUserId = hashUserId(inputData.userId);

  const promptValue = getFieldValueByRole(workboard, inputData, FIELD_ROLES.PROMPT) || '';
  const negativePromptValue = getFieldValueByRole(workboard, inputData, FIELD_ROLES.NEGATIVE_PROMPT) || '';
  const modelValue = getFieldValueByRole(workboard, inputData, FIELD_ROLES.MODEL);

  // placeholder 키 정의는 src/constants/workflowVariables.js 와 frontend mirror 에 등록.
  // 신규 placeholder 추가 시 세 곳 모두 갱신 필요.
  const replacements = {
    '{{##prompt##}}': { value: promptValue, type: 'string' },
    '{{##negative_prompt##}}': { value: negativePromptValue, type: 'string' },
    '{{##base_model##}}': { value: extractValue(modelValue), type: 'string' },
    '{{##width##}}': { value: width, type: 'number' },
    '{{##height##}}': { value: height, type: 'number' },
    '{{##seed##}}': { value: seedValue, type: 'number' },
    '{{##user_id##}}': { value: hashedUserId, type: 'string' }
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
        case 'image':
          // 이미지 필드는 업로드된 파일명 사용
          if (uploadedImageMap[fieldName]) {
            value = uploadedImageMap[fieldName];
            console.log(`🖼️ Using uploaded image for field "${fieldName}": ${value}`);
          } else {
            value = '';
            console.log(`⚠️ No uploaded image found for field "${fieldName}"`);
          }
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
    try {
      const fallbackResult = fallbackStringReplacement(workflowTemplate, replacements);
      return {
        workflowJson: fallbackResult,
        actualSeed: seedValue
      };
    } catch (fallbackError) {
      // 치환된 워크플로우 문자열을 에러에 포함
      fallbackError.actualSeed = seedValue;
      throw fallbackError;
    }
  }
};

// JSON 객체 내에서 재귀적으로 값을 치환하는 함수
const replaceInObject = (obj, replacements, seedValue = null) => {
  if (typeof obj === 'string') {
    // 문자열이 완전히 플레이스홀더인 경우 — raw value 반환.
    // 이미 JSON.parse 된 object 의 string field 이므로 backslash 등은 literal 로 들어가야 함;
    // 직렬화는 axios / JSON.stringify 에서 자동 escape.
    const replacement = replacements[obj];
    if (replacement) {
      return replacement.value;
    }

    // 부분 문자열 치환 — 마찬가지로 raw value 사용. escapeForJsonString 적용 시 axios 의 JSON.stringify 가
    // 다시 escape 하여 double-escape 됨 (Windows 경로 `IXL\nova...` 가 ComfyUI 에 `IXL\\nova...` 로 전달).
    let result = obj;
    Object.keys(replacements).forEach(key => {
      if (result.includes(key)) {
        const value = replacements[key].value;
        // String.replace 의 $ 패턴 충돌 방지 위해 replacement 함수 형태 사용 (raw literal substitute)
        result = result.replace(
          new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          () => String(value)
        );
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

// 기존 문자열 치환 방식 (fallback) - 역슬래시 자동 이스케이핑 적용
const fallbackStringReplacement = (workflowTemplate, replacements) => {
  let workflowString = workflowTemplate;

  Object.keys(replacements).forEach(key => {
    const { value } = replacements[key];
    // JSON 문자열에서 안전하게 사용할 수 있도록 값을 이스케이핑
    const escapedValue = escapeForJsonString(value);
    workflowString = workflowString.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), escapedValue);

    if (value !== escapedValue) {
      console.log(`🔧 Auto-escaped backslashes in value: "${value}" → "${escapedValue}"`);
    }
  });

  try {
    return JSON.parse(workflowString);
  } catch (parseError) {
    const error = new Error(`Workflow JSON parse failed: ${parseError.message}`);
    error.resolvedWorkflowString = workflowString;
    throw error;
  }
};

const getExtensionFromMimeType = (mimeType) => {
  const mimeToExt = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/apng': 'apng',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv'
  };
  return mimeToExt[mimeType] || 'bin';
};

const saveGeneratedMedia = async (jobId, mediaItems, inputData, mediaType, workboard = null) => {
  const typeLabel = mediaType === 'video' ? 'videos' : 'images';
  console.log(`🖼️ Starting to save ${mediaItems?.length || 0} generated ${typeLabel} for job ${jobId}`);
  console.log('📊 Media data:', mediaItems);
  console.log('📋 Input data for saving:', inputData);
  
  if (!mediaItems || mediaItems.length === 0) {
    console.warn(`⚠️ No ${typeLabel} received from ComfyUI to save!`);
    return [];
  }
  
  const savedItems = [];
  const subDir = mediaType === 'video' ? 'videos' : 'generated';
  
  for (let i = 0; i < mediaItems.length; i++) {
    try {
      const itemData = mediaItems[i];
      console.log(`🔍 Processing ${mediaType} ${i+1}:`, {
        hasBuffer: !!itemData.buffer,
        bufferSize: itemData.buffer?.length || 0,
        filename: itemData.filename,
        mimeType: itemData.mimeType,
        mediaType: itemData.mediaType,
        itemDataKeys: Object.keys(itemData)
      });
      
      if (!itemData.buffer) {
        console.error(`❌ ${mediaType} ${i+1} has no buffer data!`);
        continue;
      }
      
      const ext = getExtensionFromMimeType(itemData.mimeType) || itemData.filename?.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'png');
      const filename = `generated_${Date.now()}_${i}.${ext}`;
      const targetDir = path.join(process.env.UPLOAD_PATH || './uploads', subDir);
      
      await fs.promises.mkdir(targetDir, { recursive: true });
      console.log(`📁 Directory ensured: ${targetDir}`);
      
      const filePath = path.join(targetDir, filename);
      
      console.log(`💾 Saving ${mediaType} ${i+1}/${mediaItems.length} to ${filePath}`);
      await fs.promises.writeFile(filePath, itemData.buffer);
      console.log(`✅ Successfully wrote file to disk: ${filePath}`);
      
      let metadata = {
        format: ext
      };
      
      if (mediaType === 'image' || itemData.mediaType === 'animated') {
        try {
          const sharpImage = sharp(itemData.buffer);
          const sharpMeta = await sharpImage.metadata();
          metadata = {
            width: sharpMeta.width,
            height: sharpMeta.height,
            format: sharpMeta.format || ext
          };
          console.log(`${mediaType} ${i+1} metadata: ${metadata.width}x${metadata.height} ${metadata.format}`);
        } catch (metadataError) {
          console.warn(`Failed to extract metadata for ${mediaType} ${i+1}:`, metadataError.message);
          if (itemData.width && itemData.height) {
            metadata.width = itemData.width;
            metadata.height = itemData.height;
          }
        }
      } else {
        if (itemData.width && itemData.height) {
          metadata.width = itemData.width;
          metadata.height = itemData.height;
        }
      }
      
      const mediaTags = inputData.tags || [];

      const generatedData = {
        filename,
        originalName: itemData.filename || filename,
        mimeType: itemData.mimeType || (mediaType === 'video' ? 'video/mp4' : 'image/png'),
        size: itemData.buffer.length,
        path: filePath,
        url: `/uploads/${subDir}/${filename}`,
        userId: inputData.userId,
        jobId,
        orderIndex: i,
        metadata,
        tags: mediaTags,
        generationParams: {
          prompt: getFieldValueByRole(workboard, inputData, FIELD_ROLES.PROMPT),
          negativePrompt: getFieldValueByRole(workboard, inputData, FIELD_ROLES.NEGATIVE_PROMPT),
          model: getFieldValueByRole(workboard, inputData, FIELD_ROLES.MODEL),
          seed: getFieldValueByRole(workboard, inputData, FIELD_ROLES.SEED),
          imageSize: getFieldValueByRole(workboard, inputData, FIELD_ROLES.IMAGE_SIZE),
          stylePreset: getFieldValueByRole(workboard, inputData, FIELD_ROLES.STYLE_PRESET),
          upscaleMethod: getFieldValueByRole(workboard, inputData, FIELD_ROLES.UPSCALE_METHOD),
          referenceImageMethod: getFieldValueByRole(workboard, inputData, FIELD_ROLES.REFERENCE_IMAGE_METHOD),
          additionalParams: inputData.additionalParams
        }
      };
      
      console.log(`💾 Creating Generated${mediaType === 'video' ? 'Video' : 'Image'} with data:`, JSON.stringify(generatedData, null, 2));
      
      let savedItem;
      if (mediaType === 'video') {
        savedItem = new GeneratedVideo(generatedData);
      } else {
        savedItem = new GeneratedImage(generatedData);
      }
      
      console.log(`📝 Saving to database...`);
      await savedItem.save();
      
      savedItems.push(savedItem._id);
      console.log(`✅ Successfully saved ${mediaType} ${savedItem._id} to database`);
    } catch (error) {
      console.error(`Error saving ${mediaType} ${i+1}:`, error);
    }
  }
  
  // 태그 usageCount 증가 (미디어가 실제로 저장된 경우에만)
  const mediaTags = inputData.tags || [];
  if (savedItems.length > 0 && mediaTags.length > 0) {
    try {
      const Tag = require('../models/Tag');
      await Tag.updateMany(
        { _id: { $in: mediaTags } },
        { $inc: { usageCount: savedItems.length } }
      );
      console.log(`📊 Incremented usageCount by ${savedItems.length} for ${mediaTags.length} tags`);
    } catch (tagError) {
      console.error('Failed to update tag usage counts:', tagError.message);
    }
  }

  console.log(`Completed saving ${savedItems.length} ${typeLabel} for job ${jobId}`);
  return savedItems;
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
    const workboard = await Workboard.findById(workboardId).populate('serverId');
    
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
        serverType: workboard.serverId?.serverType,
        outputFormat: workboard.outputFormat,
        serverUrl: workboard.serverUrl,
        apiKey: workboard.serverId?.configuration?.apiKey,
        timeout: workboard.serverId?.configuration?.timeout,
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
