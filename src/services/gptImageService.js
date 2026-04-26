const axios = require('axios');

const DEFAULT_SERVER_URL = 'https://api.openai.com';

const extractValue = (input) => {
  if (input && typeof input === 'object' && input.value !== undefined) {
    return input.value;
  }
  return input;
};

const generateImage = async (serverUrl, apiKey, prompt, options = {}) => {
  const resolvedServerUrl = (serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, '');
  const model = extractValue(options.model) || 'gpt-image-1.5';
  const size = extractValue(options.size) || '1024x1024';
  const quality = extractValue(options.quality) || 'medium';
  const outputFormat = extractValue(options.outputFormat) || 'png';
  const n = options.n || 1;
  const background = extractValue(options.background);
  const outputCompression = extractValue(options.outputCompression);

  if (!apiKey) {
    throw new Error('GPT Image API key is required');
  }

  const requestBody = {
    model,
    prompt,
    n,
    size,
    quality,
    output_format: outputFormat,
  };
  if (background) requestBody.background = background;
  if (outputCompression !== undefined && outputCompression !== null && outputCompression !== '') {
    const compression = Number(outputCompression);
    if (Number.isFinite(compression)) requestBody.output_compression = compression;
  }

  let response;
  try {
    response = await axios.post(
      `${resolvedServerUrl}/v1/images/generations`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: options.timeout || 300000
      }
    );
  } catch (err) {
    const apiMessage = err.response?.data?.error?.message;
    if (apiMessage && /organization must be verified/i.test(apiMessage)) {
      throw new Error(
        `${model} 모델 사용에는 OpenAI 조직 인증(Verify Organization)이 필요합니다. https://platform.openai.com/settings/organization/general 에서 인증 후 약 15분 대기하세요.`
      );
    }
    if (apiMessage) throw new Error(`OpenAI: ${apiMessage}`);
    throw err;
  }

  const images = (response.data?.data || [])
    .filter((entry) => entry?.b64_json)
    .map((entry, index) => {
      const buffer = Buffer.from(entry.b64_json, 'base64');
      const filename = `gpt_image_${Date.now()}_${index}.${outputFormat}`;

      return {
        buffer,
        filename,
        size: buffer.length
      };
    });

  if (images.length === 0) {
    throw new Error('No image returned from GPT Image');
  }

  return { images, videos: [] };
};

module.exports = {
  generateImage
};
