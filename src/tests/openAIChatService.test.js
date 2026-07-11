/**
 * openAIChatService 순수 로직 테스트 (#691)
 *
 * axios mock 으로 요청 조립(vision 직렬화 · extraParams 덮어쓰기 방지)과
 * 응답/에러 처리, SSE 스트림 파싱(청크 경계 · usage · [DONE])을 검증한다.
 */

jest.mock('axios');
const { EventEmitter } = require('events');
const axios = require('axios');
const openAIChatService = require('../services/openAIChatService');

const okResponse = (content, usage) => ({
  data: {
    choices: [{ message: { content } }],
    usage,
  },
});

describe('openAIChatService.complete', () => {
  beforeEach(() => jest.clearAllMocks());

  test('serverUrl / model 필수 검증', async () => {
    await expect(openAIChatService.complete('', 'k', [], { model: 'm' })).rejects.toThrow(
      'serverUrl is required'
    );
    await expect(openAIChatService.complete('http://llm', 'k', [], {})).rejects.toThrow(
      'model is required'
    );
  });

  test('이미지 없는 메시지는 문자열 content 유지, 이미지는 data URL 로 직렬화 (#517)', async () => {
    axios.post.mockResolvedValue(okResponse('ok'));

    await openAIChatService.complete(
      'http://llm',
      'k',
      [
        { role: 'system', content: 'be nice' },
        { role: 'user', content: 'what is this', images: [{ base64: 'aWs=', mimeType: 'image/png' }] },
      ],
      { model: 'gpt-x' }
    );

    const body = axios.post.mock.calls[0][1];
    expect(body.messages[0]).toEqual({ role: 'system', content: 'be nice' });
    expect(body.messages[1].content).toEqual([
      { type: 'text', text: 'what is this' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,aWs=' } },
    ]);
  });

  test('extraParams 는 passthrough 되지만 model/messages 는 덮어쓸 수 없다 (#493)', async () => {
    axios.post.mockResolvedValue(okResponse('ok'));

    await openAIChatService.complete(
      'http://llm',
      'k',
      [{ role: 'user', content: 'hi' }],
      { model: 'real-model', extraParams: { max_tokens: 8, model: 'evil-model', messages: [] } }
    );

    const body = axios.post.mock.calls[0][1];
    expect(body.max_tokens).toBe(8);
    expect(body.model).toBe('real-model');
    expect(body.messages).toHaveLength(1);
  });

  test('apiKey 있으면 Bearer 헤더, 없으면 미포함 (로컬 LLM)', async () => {
    axios.post.mockResolvedValue(okResponse('ok'));

    await openAIChatService.complete('http://llm', 'secret', [{ role: 'user', content: 'a' }], { model: 'm' });
    expect(axios.post.mock.calls[0][2].headers.Authorization).toBe('Bearer secret');

    await openAIChatService.complete('http://llm', '', [{ role: 'user', content: 'a' }], { model: 'm' });
    expect(axios.post.mock.calls[1][2].headers.Authorization).toBeUndefined();
  });

  test('API 에러 메시지 매핑: 조직 인증 필요 안내 / 일반 메시지 / 빈 choices / 빈 content', async () => {
    axios.post.mockRejectedValue({
      response: { data: { error: { message: 'Your organization must be verified to use this model' } } },
    });
    await expect(
      openAIChatService.complete('http://llm', 'k', [{ role: 'user', content: 'a' }], { model: 'gpt-9' })
    ).rejects.toThrow(/조직 인증/);

    axios.post.mockRejectedValue({ response: { data: { error: { message: 'rate limited' } } } });
    await expect(
      openAIChatService.complete('http://llm', 'k', [{ role: 'user', content: 'a' }], { model: 'm' })
    ).rejects.toThrow('OpenAI: rate limited');

    axios.post.mockResolvedValue({ data: { choices: [] } });
    await expect(
      openAIChatService.complete('http://llm', 'k', [{ role: 'user', content: 'a' }], { model: 'm' })
    ).rejects.toThrow('유효한 응답');

    axios.post.mockResolvedValue(okResponse(''));
    await expect(
      openAIChatService.complete('http://llm', 'k', [{ role: 'user', content: 'a' }], { model: 'm' })
    ).rejects.toThrow('빈 응답');
  });

  test('usage 정규화 (미제공 시 0)', async () => {
    axios.post.mockResolvedValue(
      okResponse('hi', { prompt_tokens: 2, completion_tokens: 4, total_tokens: 6 })
    );
    let result = await openAIChatService.complete(
      'http://llm', 'k', [{ role: 'user', content: 'a' }], { model: 'm' }
    );
    expect(result.usage).toEqual({ promptTokens: 2, completionTokens: 4, totalTokens: 6 });

    axios.post.mockResolvedValue(okResponse('hi'));
    result = await openAIChatService.complete(
      'http://llm', 'k', [{ role: 'user', content: 'a' }], { model: 'm' }
    );
    expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });
});

describe('openAIChatService.completeStream — SSE 파싱 (#490)', () => {
  beforeEach(() => jest.clearAllMocks());

  const sseChunk = (delta) =>
    `data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n`;

  const streamWith = (emitFn) => {
    const stream = new EventEmitter();
    axios.post.mockResolvedValue({ data: stream });
    // completeStream 이 리스너를 등록한 다음 틱에 이벤트를 흘려보낸다
    setImmediate(() => emitFn(stream));
    return stream;
  };

  test('토큰 delta 누적 + onToken 콜백 + 마지막 청크 usage', async () => {
    streamWith((s) => {
      s.emit('data', Buffer.from(sseChunk('Hel') + sseChunk('lo')));
      s.emit(
        'data',
        Buffer.from(
          `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } })}\n` +
            'data: [DONE]\n'
        )
      );
      s.emit('end');
    });

    const tokens = [];
    const result = await openAIChatService.completeStream(
      'http://llm', 'k', [{ role: 'user', content: 'a' }], { model: 'm' },
      (t) => tokens.push(t)
    );

    expect(result.content).toBe('Hello');
    expect(tokens).toEqual(['Hel', 'lo']);
    expect(result.usage).toEqual({ promptTokens: 1, completionTokens: 2, totalTokens: 3 });
  });

  test('청크 경계에서 잘린 SSE 줄을 이어 붙여 파싱한다', async () => {
    const line = sseChunk('whole-token');
    streamWith((s) => {
      s.emit('data', Buffer.from(line.slice(0, 20)));
      s.emit('data', Buffer.from(line.slice(20)));
      s.emit('end');
    });

    const result = await openAIChatService.completeStream(
      'http://llm', 'k', [{ role: 'user', content: 'a' }], { model: 'm' }
    );

    expect(result.content).toBe('whole-token');
  });

  test('usage 미제공 서버는 0 으로 degrade, 요청에 stream 옵션 포함', async () => {
    streamWith((s) => {
      s.emit('data', Buffer.from(sseChunk('x') + 'data: [DONE]\n'));
      s.emit('end');
    });

    const result = await openAIChatService.completeStream(
      'http://llm', 'k', [{ role: 'user', content: 'a' }], { model: 'm' }
    );

    expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    const body = axios.post.mock.calls[0][1];
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  test('스트림 error 이벤트는 reject 로 전파', async () => {
    streamWith((s) => {
      s.emit('error', new Error('socket hang up'));
    });

    await expect(
      openAIChatService.completeStream('http://llm', 'k', [{ role: 'user', content: 'a' }], { model: 'm' })
    ).rejects.toThrow('socket hang up');
  });
});
