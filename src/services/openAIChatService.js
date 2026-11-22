const axios = require('axios');

const extractValue = (input) => {
  if (input && typeof input === 'object' && input.value !== undefined) {
    return input.value;
  }
  return input;
};

// 비전 첨부(#517) 직렬화 — 메시지에 images([{base64, mimeType}]) 가 있으면 OpenAI vision 포맷으로.
// content 를 텍스트 + image_url(data URL) 배열로 구성. 이미지 없으면 기존 문자열 content 그대로.
// images 같은 내부 필드는 제거하고 OpenAI 가 받는 {role, content} 만 남긴다.
//
// 툴 콜 (#769) — 내부 형식은 provider 중립이다:
//   assistant: { role, content, toolCalls: [{ id, name, arguments(JSON 문자열) }] }
//   tool:      { role: 'tool', toolCallId, content }
// 여기서 OpenAI 의 tool_calls / tool_call_id 로 옮긴다.
const toOpenAIMessages = (messages) => (messages || []).map((m) => {
  if (m.role === 'tool') {
    return { role: 'tool', tool_call_id: m.toolCallId, content: m.content || '' };
  }
  if (m.role === 'assistant' && Array.isArray(m.toolCalls) && m.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: m.content || '',
      tool_calls: m.toolCalls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: c.arguments || '{}' },
      })),
    };
  }
  if (Array.isArray(m.images) && m.images.length > 0) {
    return {
      role: m.role,
      content: [
        ...(m.content ? [{ type: 'text', text: m.content }] : []),
        ...m.images.map((img) => ({
          type: 'image_url',
          image_url: { url: `data:${img.mimeType || 'image/jpeg'};base64,${img.base64}` },
        })),
      ],
    };
  }
  return { role: m.role, content: m.content || '' };
});

// 도구 정의 (#769) — 내부 형식 [{ name, description, parameters(JSON Schema) }] 를 OpenAI tools 로.
// 도구가 없으면 키 자체를 넣지 않는다 — 빈 tools 배열을 거부하는 호환 서버가 있다.
const toOpenAITools = (tools) => (Array.isArray(tools) && tools.length > 0
  ? {
      tools: tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description || '',
          parameters: t.parameters || { type: 'object', properties: {} },
        },
      })),
    }
  : {});

// 응답의 tool_calls 를 내부 형식으로. id 가 없는 호환 서버가 있어 순번으로 채운다 —
// 도구 결과 메시지가 가리킬 id 가 반드시 있어야 다음 호출이 성립한다.
const fromOpenAIToolCalls = (toolCalls) => (Array.isArray(toolCalls) ? toolCalls : [])
  .filter((c) => c && c.function && c.function.name)
  .map((c, i) => ({
    id: c.id || `call_${i}`,
    name: c.function.name,
    arguments: typeof c.function.arguments === 'string'
      ? c.function.arguments
      : JSON.stringify(c.function.arguments || {}),
  }));


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
  // tools 도 extraParams 뒤에 둔다 — 작업판 extraParams 가 도구 정의를 바꿔치지 못하게 (#769)
  const requestBody = {
    ...(options.extraParams || {}),
    model,
    messages: toOpenAIMessages(messages),
    ...toOpenAITools(options.tools),
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
  // 도구를 부르는 응답은 content 가 비는 게 정상이다 (#769). 도구를 준 호출에서만 받는다 —
  // 작업판 extraParams 에 tools 가 들어 있어도 호출자가 도구를 안 줬으면 받아줄 루프가 없으니
  // 예전처럼 빈 응답 오류로 드러낸다.
  const toolCalls = Array.isArray(options.tools) && options.tools.length > 0
    ? fromOpenAIToolCalls(choices[0]?.message?.tool_calls)
    : [];
  if (!content && toolCalls.length === 0) {
    throw new Error('LLM 서버에서 빈 응답을 반환했습니다.');
  }

  const usage = {
    promptTokens: response.data?.usage?.prompt_tokens || 0,
    completionTokens: response.data?.usage?.completion_tokens || 0,
    totalTokens: response.data?.usage?.total_tokens || 0,
  };

  return { content, toolCalls, usage, model };
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
    messages: toOpenAIMessages(messages),
    ...toOpenAITools(options.tools),
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
  // 스트림의 tool_calls 는 index 별 조각으로 온다 (#769) — id·name 은 첫 조각에, arguments 는 나뉘어서.
  // 모은 순서(slot)대로 둔다. 도구를 안 준 호출에서는 모으지 않는다 (complete 와 같은 이유).
  const toolCallParts = new Map();
  const slotOfIndex = new Map();
  const wantsTools = Array.isArray(options.tools) && options.tools.length > 0;

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
        for (const part of (wantsTools ? (json.choices?.[0]?.delta?.tool_calls || []) : [])) {
          // index 를 빼거나 전부 0 으로 주는 호환 서버가 있다 — 같은 자리에 다른 id 가 오면 새 호출이다
          const idx = Number.isInteger(part.index) ? part.index : 0;
          let slot = slotOfIndex.get(idx);
          const current = slot !== undefined ? toolCallParts.get(slot) : null;
          if (!current || (part.id && current.id && part.id !== current.id)) {
            slot = toolCallParts.size;
            slotOfIndex.set(idx, slot);
            toolCallParts.set(slot, { id: '', name: '', arguments: '' });
          }
          const acc = toolCallParts.get(slot);
          if (part.id) acc.id = part.id;
          if (part.function?.name) acc.name += part.function.name;
          if (typeof part.function?.arguments === 'string') acc.arguments += part.function.arguments;
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

  const toolCalls = [...toolCallParts.entries()]
    .sort((a, b) => a[0] - b[0])
    .filter(([, c]) => c.name)
    .map(([idx, c]) => ({ id: c.id || `call_${idx}`, name: c.name, arguments: c.arguments || '{}' }));

  return { content, toolCalls, usage: normalizedUsage };
};

module.exports = { complete, completeStream };
