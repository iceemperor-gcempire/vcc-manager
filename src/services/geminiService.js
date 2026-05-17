const axios = require('axios');

const DEFAULT_SERVER_URL = 'https://generativelanguage.googleapis.com';

const SUPPORTED_ASPECT_RATIOS = new Set([
  '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'
]);
const SUPPORTED_RESOLUTIONS = new Set(['1K', '2K', '4K']);

const extractValue = (input) => {
  if (input && typeof input === 'object' && input.value !== undefined) {
    return input.value;
  }
  return input;
};

const buildImageConfig = (options) => {
  const config = {};
  const aspectRatio = extractValue(options.aspectRatio);
  const resolution = extractValue(options.resolution);

  if (typeof aspectRatio === 'string' && SUPPORTED_ASPECT_RATIOS.has(aspectRatio)) {
    config.aspectRatio = aspectRatio;
  }
  if (typeof resolution === 'string' && SUPPORTED_RESOLUTIONS.has(resolution)) {
    config.imageSize = resolution;
  }

  return config;
};

const getExtensionFromMimeType = (mimeType = '') => {
  const mimeToExt = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };

  return mimeToExt[mimeType] || 'png';
};

const generateImage = async (serverUrl, apiKey, prompt, options = {}) => {
  const resolvedServerUrl = (serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, '');
  const model = extractValue(options.model) || 'gemini-2.5-flash-image';

  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  const parts = [];

  for (const imageInput of options.images || []) {
    if (!imageInput?.buffer) continue;

    parts.push({
      inline_data: {
        data: imageInput.buffer.toString('base64'),
        mime_type: imageInput.mimeType || 'image/png'
      }
    });
  }

  parts.push({ text: prompt });

  const generationConfig = {
    responseModalities: ['TEXT', 'IMAGE']
  };
  const imageConfig = buildImageConfig(options);
  if (Object.keys(imageConfig).length > 0) {
    generationConfig.imageConfig = imageConfig;
  }

  const response = await axios.post(
    `${resolvedServerUrl}/v1beta/models/${model}:generateContent`,
    {
      contents: [{ parts }],
      generationConfig
    },
    {
      params: { key: apiKey },
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: options.timeout || 300000
    }
  );

  const partsList = response.data?.candidates?.[0]?.content?.parts || [];
  const images = partsList
    .filter((part) => part.inlineData?.data)
    .map((part, index) => {
      const mimeType = part.inlineData.mimeType || 'image/png';
      const buffer = Buffer.from(part.inlineData.data, 'base64');
      const extension = getExtensionFromMimeType(mimeType);
      const filename = `gemini_${Date.now()}_${index}.${extension}`;

      return {
        buffer,
        filename,
        size: buffer.length,
        mimeType
      };
    });

  if (images.length === 0) {
    throw new Error('No image returned from Gemini');
  }

  // usage 포함 반환 — 호출자가 cost 추정에 사용 (#367)
  return {
    images,
    videos: [],
    usage: response.data?.usageMetadata || null,
    model,
  };
};

// Gemini LLM (Chat) — generateContent 호출 후 첫 번째 candidate 의 텍스트 본문 반환.
// Phase 4/5 에서 Gemini Chat 워크보드 도입 시 호출되도록 마련해 둔 인터페이스.
const complete = async (serverUrl, apiKey, messages, options = {}) => {
  const resolvedServerUrl = (serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, '');
  const model = extractValue(options.model);
  if (!model) throw new Error('Gemini Chat: model is required');
  if (!apiKey) throw new Error('Gemini Chat: api key is required');

  const contents = (Array.isArray(messages) ? messages : []).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content || '' }],
  }));
  if (contents.length === 0) {
    throw new Error('Gemini Chat: messages is empty');
  }

  // Gemini 3+ 는 temperature 를 기본(1.0) 으로 두는 것을 공식 권장 (looping/성능 저하 방지).
  // maxOutputTokens 도 모델 기본값을 사용 — 두 옵션 모두 전송하지 않음.
  const generationConfig = {
    responseModalities: ['TEXT'],
  };

  const response = await axios.post(
    `${resolvedServerUrl}/v1beta/models/${model}:generateContent`,
    { contents, generationConfig },
    {
      params: { key: apiKey },
      headers: { 'Content-Type': 'application/json' },
      timeout: options.timeout || 60000,
    }
  );

  const parts = response.data?.candidates?.[0]?.content?.parts || [];
  const content = parts
    .map((p) => p.text || '')
    .filter(Boolean)
    .join('');

  if (!content) {
    throw new Error('Gemini Chat: 빈 응답이 반환되었습니다.');
  }

  const usage = {
    promptTokens: response.data?.usageMetadata?.promptTokenCount || 0,
    completionTokens: response.data?.usageMetadata?.candidatesTokenCount || 0,
    totalTokens: response.data?.usageMetadata?.totalTokenCount || 0,
  };

  return { content, usage, model };
};

module.exports = {
  generateImage,
  complete,
};
