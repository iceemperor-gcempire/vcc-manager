const axios = require('axios');

// d-ice-all 게이트웨이 이미지 생성 (#747).
//
// d-ice-all 은 OpenAI Images 호환 `/v1/images/generations` 을 제공하는 로컬 LLM
// 게이트웨이로, 내부적으로 Codex CLI(ImageGen) 를 스폰해 구독 과금으로 이미지를
// 생성한다 (건당 ~1분, 종량 API 비용 없음). 인증은 `x-api-key` 헤더 (미설정 게이트웨이는 생략).
// aiModel 필드 값은 게이트웨이의 provider 이름으로 전달된다 (기본 'codex').

const extractValue = (input) => {
  if (input && typeof input === 'object' && input.value !== undefined) {
    return input.value;
  }
  return input;
};

const generateImage = async (serverUrl, apiKey, prompt, options = {}) => {
  if (!serverUrl) {
    throw new Error('d-ice-all server URL is required');
  }
  const resolvedServerUrl = serverUrl.replace(/\/+$/, '');
  const provider = extractValue(options.model) || 'codex';
  const size = extractValue(options.size);
  const n = Number(extractValue(options.n)) || 1;

  const requestBody = {
    provider,
    prompt,
    n,
    response_format: 'b64_json',
  };
  if (size && size !== 'auto') requestBody.size = size;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  let response;
  try {
    response = await axios.post(
      `${resolvedServerUrl}/v1/images/generations`,
      requestBody,
      {
        headers,
        // codex exec 에이전트 세션은 건당 수십 초~수 분 — 서버 timeout 설정을 그대로 쓰되 기본은 넉넉히
        timeout: options.timeout || 600000,
        signal: options.signal,
      }
    );
  } catch (err) {
    const apiMessage = err.response?.data?.error?.message;
    if (err.response?.status === 401) {
      throw new Error('d-ice-all: API key 인증 실패 — 서버 설정의 apiKey 를 확인하세요.');
    }
    if (apiMessage) throw new Error(`d-ice-all: ${apiMessage}`);
    throw err;
  }

  const images = (response.data?.data || [])
    .filter((entry) => entry?.b64_json)
    .map((entry, index) => {
      const buffer = Buffer.from(entry.b64_json, 'base64');
      return {
        buffer,
        filename: `d_ice_all_${Date.now()}_${index}.png`,
        size: buffer.length,
        mimeType: 'image/png',
      };
    });

  if (images.length === 0) {
    throw new Error('No image returned from d-ice-all');
  }

  // 구독 과금 경로 — usage/비용 추정 없음 (#747)
  return {
    images,
    videos: [],
    usage: null,
    model: provider,
  };
};

module.exports = {
  generateImage,
};
