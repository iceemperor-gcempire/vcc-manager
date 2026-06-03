const axios = require('axios');

const extractValue = (input) => {
  if (input && typeof input === 'object' && input.value !== undefined) {
    return input.value;
  }
  return input;
};


// OpenAI 호환 `/v1/chat/completions` 호출 — OpenAI 공식 / Local LLM (Ollama, LiteLLM, vLLM 등) 공통.
// 응답에서 첫 번째 choice 의 메시지 본문 + usage 를 추출해 반환.
const complete = async (serverUrl, apiKey, messages, options = {}) => {
  const resolvedServerUrl = (serverUrl || '').replace(/\/+$/, '');
  if (!resolvedServerUrl) {
    throw new Error('OpenAI Chat: serverUrl is required');
  }

  const model = extractValue(options.model);
  if (!model) {
    throw new Error('OpenAI Chat: model is required');
  }

  // max_tokens / max_completion_tokens / temperature 모두 기본은 모델 기본값 사용.
  // gpt-5+ 등 reasoning 모델은 비기본 temperature 를 거부하므로 전역 전송은 안 함.
  // 작업판별로 필요한 값(temperature/top_p/chat_template_kwargs 등)은 extraParams 로 passthrough (#493).
  // extraParams 를 먼저 펼치고 필수 키(model/messages)를 뒤에 둬 덮어쓰기 방지.
  const requestBody = {
    ...(options.extraParams || {}),
    model,
    messages,
  };

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let response;
  try {
    response = await axios.post(
      `${resolvedServerUrl}/v1/chat/completions`,
      requestBody,
      { headers, timeout: options.timeout || 60000 }
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

  const choices = response.data?.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('LLM 서버에서 유효한 응답을 받지 못했습니다. 서버 URL과 설정을 확인해주세요.');
  }

  const content = choices[0]?.message?.content || '';
  if (!content) {
    throw new Error('LLM 서버에서 빈 응답을 반환했습니다.');
  }

  const usage = {
    promptTokens: response.data?.usage?.prompt_tokens || 0,
    completionTokens: response.data?.usage?.completion_tokens || 0,
    totalTokens: response.data?.usage?.total_tokens || 0,
  };

  return { content, usage, model };
};

// 스트리밍 버전 — `stream: true` 로 /v1/chat/completions 호출 후 토큰 delta 를 onToken 으로 흘려보낸다.
// 첫 토큰이 즉시 나가므로 Cloudflare 등 앞단 프록시의 TTFB 타임아웃(예: 100초)을 회피한다 (#490).
// 반환값은 비스트리밍 complete() 와 동일한 { content, usage } — 호출자가 누적/비용 계산에 사용.
const completeStream = async (serverUrl, apiKey, messages, options = {}, onToken) => {
  const resolvedServerUrl = (serverUrl || '').replace(/\/+$/, '');
  if (!resolvedServerUrl) {
    throw new Error('OpenAI Chat: serverUrl is required');
  }

  const model = extractValue(options.model);
  if (!model) {
    throw new Error('OpenAI Chat: model is required');
  }

  const requestBody = {
    // 작업판별 추가 파라미터 passthrough (#493) — 필수/스트림 키가 뒤에서 항상 이김
    ...(options.extraParams || {}),
    model,
    messages,
    stream: true,
    // usage 를 마지막 청크에 포함하도록 요청 (지원하는 서버 한정 — 미지원 시 usage 0 으로 degrade)
    stream_options: { include_usage: true },
  };

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let response;
  try {
    response = await axios.post(
      `${resolvedServerUrl}/v1/chat/completions`,
      requestBody,
      { headers, timeout: options.timeout || 60000, responseType: 'stream' }
    );
  } catch (err) {
    // 스트림 요청 실패 시 에러 본문이 stream 으로 올 수 있어 한 번 모아 파싱 시도
    const apiMessage = err.response?.data?.error?.message;
    if (apiMessage && /organization must be verified/i.test(apiMessage)) {
      throw new Error(
        `${model} 모델 사용에는 OpenAI 조직 인증(Verify Organization)이 필요합니다. https://platform.openai.com/settings/organization/general 에서 인증 후 약 15분 대기하세요.`
      );
    }
    if (apiMessage) throw new Error(`OpenAI: ${apiMessage}`);
    throw err;
  }

  let content = '';
  let usage = null;
  let buffer = '';

  await new Promise((resolve, reject) => {
    response.data.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let nl;
      // SSE 는 줄 단위(`data: {...}`) — 청크 경계에서 잘린 줄은 buffer 에 남겨 다음 청크와 합친다.
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line || !line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        let json;
        try { json = JSON.parse(data); } catch { continue; }
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          if (typeof onToken === 'function') onToken(delta);
        }
        if (json.usage) usage = json.usage;
      }
    });
    response.data.on('end', resolve);
    response.data.on('error', reject);
  });

  const normalizedUsage = usage
    ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      }
    : { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  return { content, usage: normalizedUsage };
};

module.exports = { complete, completeStream };
