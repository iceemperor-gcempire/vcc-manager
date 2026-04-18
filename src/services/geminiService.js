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

  return { images, videos: [] };
};

module.exports = {
  generateImage
};
