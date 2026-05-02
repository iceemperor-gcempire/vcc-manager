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

  // max_tokens / max_completion_tokens / temperature 모두 모델 기본값 사용.
  // gpt-5+ 등 reasoning 모델은 비기본 temperature 를 거부하고, 그 외 모델도
  // 텍스트 워크보드에서는 사용자 미세조정 수요가 낮아 단순화함.
  const requestBody = {
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

module.exports = { complete };
