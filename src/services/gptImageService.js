const axios = require('axios');

const DEFAULT_SERVER_URL = 'https://api.openai.com';

const extractValue = (input) => {
  if (input && typeof input === 'object' && input.value !== undefined) {
    return input.value;
  }
  return input;
};

// GPT-Image-2.5 (2026-09-08) 규격 (#943).
// 문서: 권장 3종 외에 W×H 커스텀 허용 — 각 변 16의 배수, 비율 1:3~3:1,
// 한 변 ≤ 3840, 총 픽셀 655,360 ~ 8,294,400 (= 4K 3840×2160 이 상한).
// 2560×1440 초과는 공식 문서상 experimental.
const SIZE_RULES = {
  edgeMultiple: 16,
  maxEdge: 3840,
  minPixels: 655360,
  maxPixels: 8294400,
  minRatio: 1 / 3,
  maxRatio: 3,
  experimentalAbovePixels: 2560 * 1440,
};
const QUALITY_VALUES = ['auto', 'low', 'medium', 'high', 'xhigh', 'max'];

/**
 * size 문자열 검증. 'auto' 와 W×H 커스텀을 허용하고, 규격 위반은 이유를 담아 던진다.
 * API 가 돌려주는 영문 오류는 어느 조건에 걸렸는지 알기 어려워 여기서 먼저 거른다.
 */
const validateSize = (size) => {
  if (!size || size === 'auto') return { size: 'auto', experimental: false };
  const m = /^(\d+)x(\d+)$/i.exec(String(size).trim());
  if (!m) throw new Error(`이미지 크기 형식이 잘못됐습니다: "${size}" (예: 1536x1024 또는 auto)`);
  const w = Number(m[1]); const h = Number(m[2]);
  const px = w * h;
  const ratio = w / h;
  const problems = [];
  if (w % SIZE_RULES.edgeMultiple || h % SIZE_RULES.edgeMultiple) {
    problems.push(`각 변이 ${SIZE_RULES.edgeMultiple}의 배수여야 합니다`);
  }
  if (w > SIZE_RULES.maxEdge || h > SIZE_RULES.maxEdge) {
    problems.push(`한 변이 ${SIZE_RULES.maxEdge}px 를 넘을 수 없습니다`);
  }
  if (px < SIZE_RULES.minPixels || px > SIZE_RULES.maxPixels) {
    problems.push(`총 픽셀이 ${SIZE_RULES.minPixels.toLocaleString()}~${SIZE_RULES.maxPixels.toLocaleString()} 범위여야 합니다 (현재 ${px.toLocaleString()})`);
  }
  if (ratio < SIZE_RULES.minRatio || ratio > SIZE_RULES.maxRatio) {
    problems.push('가로세로 비율이 1:3 ~ 3:1 범위여야 합니다');
  }
  if (problems.length) throw new Error(`이미지 크기 ${w}x${h} 를 쓸 수 없습니다 — ${problems.join(', ')}.`);
  return { size: `${w}x${h}`, experimental: px > SIZE_RULES.experimentalAbovePixels };
};

const generateImage = async (serverUrl, apiKey, prompt, options = {}) => {
  const resolvedServerUrl = (serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, '');
  const model = extractValue(options.model) || 'gpt-image-2.5-flare';
  const { size, experimental } = validateSize(extractValue(options.size) || '1024x1024');
  const rawQuality = extractValue(options.quality) || 'medium';
  if (!QUALITY_VALUES.includes(rawQuality)) {
    throw new Error(`지원하지 않는 품질입니다: "${rawQuality}" (${QUALITY_VALUES.join(' / ')})`);
  }
  const quality = rawQuality;
  if (experimental) {
    console.log(`[gptImage] ${size} 는 2560x1440 초과 — 공식 문서상 experimental 해상도 (model=${model})`);
  }
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
        timeout: options.timeout || 300000,
        signal: options.signal
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

  // usage 포함하여 반환 — 호출자가 cost 추정에 사용 (#364)
  return {
    images,
    videos: [],
    usage: response.data?.usage || null,
    model,
  };
};

module.exports = {
  generateImage,
  validateSize,
  QUALITY_VALUES,
  SIZE_RULES,
};
