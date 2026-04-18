const axios = require('axios');

const DEFAULT_SERVER_URL = 'https://generativelanguage.googleapis.com';

const extractValue = (input) => {
  if (input && typeof input === 'object' && input.value !== undefined) {
    return input.value;
  }
  return input;
};

const buildPromptText = (prompt, options = {}) => {
  const lines = [prompt];

  if (options.aspectRatio) {
    lines.push(`Aspect ratio: ${options.aspectRatio}`);
  }

  if (options.imageSize) {
    lines.push(`Target image size: ${options.imageSize}`);
  }

  return lines.filter(Boolean).join('\n');
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

  parts.push({
    text: buildPromptText(prompt, {
      aspectRatio: options.aspectRatio,
      imageSize: options.imageSize
    })
  });

  const response = await axios.post(
    `${resolvedServerUrl}/v1beta/models/${model}:generateContent`,
    {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
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
