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

// GPT Image 2.6 (2026-10-28) 에서 생긴 것 (#1132).
// complexity 는 값이 있을 때만 보낸다 — 2.5 이하 판의 요청은 예전 그대로다.
// gif·svg 는 2.6 판에서만 고를 수 있다 (2.5 가 받는지는 문서에 없다).
const COMPLEXITY_VALUES = ['low', 'medium', 'high'];
const OUTPUT_FORMATS = ['png', 'jpeg', 'webp', 'gif', 'svg'];
// 레퍼런스는 frame_duration_ms 최소값만 적는다 (가이드의 2000ms 상한은 판 설명에만 둔다).
const GIF_RULES = { minFrames: 2, maxFrames: 16, minFrameDurationMs: 20 };
const MIME_BY_FORMAT = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

/**
 * size 문자열 검증. 'auto' 와 W×H 커스텀을 허용하고, 규격 위반은 이유를 담아 던진다.
 * API 가 돌려주는 영문 오류는 어느 조건에 걸렸는지 알기 어려워 여기서 먼저 거른다.
 * gif 의 size 는 프레임 하나의 크기라 16 배수만 본다 — 픽셀 하한·상한은 래스터 규칙이고,
 * 프레임 수×크기의 예산은 문서에 수치가 없어 API 오류에 맡긴다 (#1132).
 */
const validateSize = (size, { perFrame = false } = {}) => {
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
  if (perFrame) {
    if (problems.length) throw new Error(`GIF 프레임 크기 ${w}x${h} 를 쓸 수 없습니다 — ${problems.join(', ')}.`);
    return { size: `${w}x${h}`, experimental: false };
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
  const outputFormat = extractValue(options.outputFormat) || 'png';
  if (!OUTPUT_FORMATS.includes(outputFormat)) {
    throw new Error(`지원하지 않는 출력 포맷입니다: "${outputFormat}" (${OUTPUT_FORMATS.join(' / ')})`);
  }
  const isGif = outputFormat === 'gif';
  const isSvg = outputFormat === 'svg';
  const { size, experimental } = validateSize(extractValue(options.size) || '1024x1024', { perFrame: isGif });
  const rawQuality = extractValue(options.quality) || 'medium';
  if (!QUALITY_VALUES.includes(rawQuality)) {
    throw new Error(`지원하지 않는 품질입니다: "${rawQuality}" (${QUALITY_VALUES.join(' / ')})`);
  }
  const quality = rawQuality;
  if (experimental) {
    console.log(`[gptImage] ${size} 는 2560x1440 초과 — 공식 문서상 experimental 해상도 (model=${model})`);
  }
  const n = options.n || 1;
  if (isSvg && Number(n) !== 1) {
    throw new Error('SVG 출력은 한 번에 1장만 만들 수 있습니다 (n=1).');
  }
  const background = extractValue(options.background);
  const outputCompression = extractValue(options.outputCompression);
  const complexity = extractValue(options.complexity);
  if (complexity && !COMPLEXITY_VALUES.includes(complexity)) {
    throw new Error(`지원하지 않는 복잡도입니다: "${complexity}" (${COMPLEXITY_VALUES.join(' / ')})`);
  }

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
  if (complexity) requestBody.complexity = complexity;
  // SVG 는 래스터 참조를 그린 뒤 텍스트 모델이 벡터를 쓴다. 계정에 작성 모델 선택이 켜져 있으면
  // svg.model 이 필수고, 꺼져 있으면 svg 객체를 빼야 한다 — 값이 있을 때만 보낸다 (#1132)
  const svgModel = extractValue(options.svgModel);
  if (isSvg && svgModel) requestBody.svg = { model: svgModel };
  // gif·svg 는 압축률을 받지 않는다. 판에 값이 남아 있어도 형식을 바꿔 고른 경우라 조용히 뺀다
  if (!isGif && !isSvg && outputCompression !== undefined && outputCompression !== null && outputCompression !== '') {
    const compression = Number(outputCompression);
    if (Number.isFinite(compression)) requestBody.output_compression = compression;
  }
  // 프레임 설정은 gif 일 때만 보낸다 (다른 형식에 보내면 API 가 거절한다)
  if (isGif) {
    const frameCount = parseOptionalInt(extractValue(options.frameCount), 'GIF 프레임 수');
    if (frameCount !== null) {
      if (frameCount < GIF_RULES.minFrames || frameCount > GIF_RULES.maxFrames) {
        throw new Error(`GIF 프레임 수는 ${GIF_RULES.minFrames}~${GIF_RULES.maxFrames} 여야 합니다 (현재 ${frameCount}).`);
      }
      requestBody.frame_count = frameCount;
    }
    const frameDurationMs = parseOptionalInt(extractValue(options.frameDurationMs), 'GIF 프레임 길이');
    if (frameDurationMs !== null) {
      if (frameDurationMs < GIF_RULES.minFrameDurationMs) {
        throw new Error(`GIF 프레임 길이는 ${GIF_RULES.minFrameDurationMs}ms 이상이어야 합니다 (현재 ${frameDurationMs}).`);
      }
      requestBody.frame_duration_ms = frameDurationMs;
    }
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
    // 2.6 의 GIF·SVG 오류는 무엇을 바꿔야 하는지 한국어로 덧붙인다 (#1132, 실호출 2026-11-07)
    if (apiMessage && /No supported sheet fits/i.test(apiMessage)) {
      throw new Error(
        `GIF 프레임이 너무 큽니다 — 프레임 여러 장을 긴 변 3840 이하의 시트 한 장에 그려 만드는데, 이 크기로는 들어가지 않습니다. 512x512 처럼 작게 고르세요. (OpenAI: ${apiMessage})`
      );
    }
    if (apiMessage && /requires 'svg\.model'/i.test(apiMessage)) {
      throw new Error(`이 계정은 SVG 작성 모델을 정해야 합니다 — 판의 "SVG 작성 모델" 을 고르세요. (OpenAI: ${apiMessage})`);
    }
    if (apiMessage) throw new Error(`OpenAI: ${apiMessage}`);
    throw err;
  }

  // 응답의 size 는 저장 때 크기 보충용 — SVG 는 sharp 가 크기를 못 읽는 환경이 있다 (#1132)
  const responseSize = /^(\d+)x(\d+)$/.exec(String(response.data?.size || ''));
  const images = (response.data?.data || [])
    .filter((entry) => entry?.b64_json)
    .map((entry, index) => {
      const buffer = Buffer.from(entry.b64_json, 'base64');
      const filename = `gpt_image_${Date.now()}_${index}.${outputFormat}`;

      const image = {
        buffer,
        filename,
        mimeType: MIME_BY_FORMAT[outputFormat],
        size: buffer.length
      };
      if (responseSize) {
        image.width = Number(responseSize[1]);
        image.height = Number(responseSize[2]);
      }
      return image;
    });

  if (images.length === 0) {
    throw new Error('No image returned from GPT Image');
  }

  // usage 포함하여 반환 — 호출자가 cost 추정에 사용 (#364).
  // svg_usage 는 SVG 를 쓰는 작성 모델의 토큰으로 이미지 usage 와 따로 온다 (#1132)
  return {
    images,
    videos: [],
    usage: response.data?.usage || null,
    svgUsage: response.data?.svg_usage || null,
    model,
  };
};

// 비어 있으면 null, 정수가 아니면 이유와 함께 던진다
function parseOptionalInt(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num)) throw new Error(`${label}는 정수여야 합니다: "${value}"`);
  return num;
}

module.exports = {
  generateImage,
  validateSize,
  QUALITY_VALUES,
  COMPLEXITY_VALUES,
  OUTPUT_FORMATS,
  GIF_RULES,
  SIZE_RULES,
};
