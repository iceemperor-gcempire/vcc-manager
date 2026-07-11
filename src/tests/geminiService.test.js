/**
 * geminiService 순수 로직 테스트 (#691)
 *
 * axios 를 mock 해 실 API 호출 없이 요청 조립(파트 구성 · imageConfig 필터링 ·
 * extraParams merge)과 응답 파싱(inlineData → buffer, usage 정규화)을 검증한다.
 */

jest.mock('axios');
const axios = require('axios');
const geminiService = require('../services/geminiService');

const imageResponse = (parts) => ({
  data: { candidates: [{ content: { parts } }], usageMetadata: { totalTokenCount: 10 } },
});

describe('geminiService.generateImage', () => {
  beforeEach(() => jest.clearAllMocks());

  test('apiKey 없으면 throw', async () => {
    await expect(geminiService.generateImage(null, '', 'a cat')).rejects.toThrow(
      'Gemini API key is required'
    );
  });

  test('inlineData 파트를 이미지 buffer 로 파싱한다', async () => {
    const pngBase64 = Buffer.from('fake-png').toString('base64');
    axios.post.mockResolvedValue(
      imageResponse([
        { text: 'here is your image' },
        { inlineData: { data: pngBase64, mimeType: 'image/png' } },
      ])
    );

    const result = await geminiService.generateImage(null, 'key', 'a cat');

    expect(result.images).toHaveLength(1);
    expect(result.images[0].buffer.toString()).toBe('fake-png');
    expect(result.images[0].filename).toMatch(/\.png$/);
    expect(result.usage).toEqual({ totalTokenCount: 10 });
  });

  test('이미지 파트가 없으면 throw', async () => {
    axios.post.mockResolvedValue(imageResponse([{ text: 'no image, sorry' }]));

    await expect(geminiService.generateImage(null, 'key', 'a cat')).rejects.toThrow(
      'No image returned from Gemini'
    );
  });

  test('요청 파트: 첨부 이미지는 inline_data, 프롬프트 텍스트는 마지막', async () => {
    axios.post.mockResolvedValue(
      imageResponse([{ inlineData: { data: 'aGk=', mimeType: 'image/png' } }])
    );

    await geminiService.generateImage(null, 'key', 'edit this', {
      images: [
        { buffer: Buffer.from('img1'), mimeType: 'image/jpeg' },
        { buffer: null }, // buffer 없는 항목은 skip
      ],
    });

    const body = axios.post.mock.calls[0][1];
    const parts = body.contents[0].parts;
    expect(parts).toHaveLength(2);
    expect(parts[0].inline_data.mime_type).toBe('image/jpeg');
    expect(parts[1]).toEqual({ text: 'edit this' });
  });

  test('imageConfig: 지원 목록의 비율/해상도만 전송, 미지원 값은 제외', async () => {
    axios.post.mockResolvedValue(
      imageResponse([{ inlineData: { data: 'aGk=' } }])
    );

    await geminiService.generateImage(null, 'key', 'p', {
      aspectRatio: '16:9',
      resolution: '8K', // 미지원 — 제외돼야 함
    });

    const body = axios.post.mock.calls[0][1];
    expect(body.generationConfig.imageConfig).toEqual({ aspectRatio: '16:9' });
  });

  test('serverUrl 미지정 시 기본 Google 엔드포인트 + 모델 경로', async () => {
    axios.post.mockResolvedValue(
      imageResponse([{ inlineData: { data: 'aGk=' } }])
    );

    await geminiService.generateImage(null, 'key', 'p', { model: { value: 'my-model' } });

    const url = axios.post.mock.calls[0][0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/my-model:generateContent'
    );
  });
});

describe('geminiService.complete (Chat)', () => {
  beforeEach(() => jest.clearAllMocks());

  const chatResponse = (text) => ({
    data: {
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 5, totalTokenCount: 8 },
    },
  });

  test('model / apiKey / messages 필수 검증', async () => {
    await expect(geminiService.complete(null, 'k', [], {})).rejects.toThrow('model is required');
    await expect(
      geminiService.complete(null, '', [{ role: 'user', content: 'hi' }], { model: 'm' })
    ).rejects.toThrow('api key is required');
    await expect(geminiService.complete(null, 'k', [], { model: 'm' })).rejects.toThrow(
      'messages is empty'
    );
  });

  test('assistant 역할은 model 로 매핑, 이미지는 inline_data 파트로', async () => {
    axios.post.mockResolvedValue(chatResponse('ok'));

    await geminiService.complete(
      null,
      'k',
      [
        { role: 'user', content: 'look', images: [{ base64: 'aWs=', mimeType: 'image/png' }] },
        { role: 'assistant', content: 'I see' },
      ],
      { model: 'gemini-x' }
    );

    const body = axios.post.mock.calls[0][1];
    expect(body.contents[0].role).toBe('user');
    expect(body.contents[0].parts).toEqual([
      { text: 'look' },
      { inline_data: { mime_type: 'image/png', data: 'aWs=' } },
    ]);
    expect(body.contents[1].role).toBe('model');
  });

  test('extraParams 는 generationConfig 에 merge 된다 (#493)', async () => {
    axios.post.mockResolvedValue(chatResponse('ok'));

    await geminiService.complete(null, 'k', [{ role: 'user', content: 'hi' }], {
      model: 'm',
      extraParams: { temperature: 0.2 },
    });

    const body = axios.post.mock.calls[0][1];
    expect(body.generationConfig.temperature).toBe(0.2);
    expect(body.generationConfig.responseModalities).toEqual(['TEXT']);
  });

  test('빈 응답이면 throw, 정상 응답은 usage 정규화', async () => {
    axios.post.mockResolvedValue({ data: { candidates: [{ content: { parts: [] } }] } });
    await expect(
      geminiService.complete(null, 'k', [{ role: 'user', content: 'hi' }], { model: 'm' })
    ).rejects.toThrow('빈 응답');

    axios.post.mockResolvedValue(chatResponse('answer'));
    const result = await geminiService.complete(null, 'k', [{ role: 'user', content: 'hi' }], {
      model: 'm',
    });
    expect(result.content).toBe('answer');
    expect(result.usage).toEqual({ promptTokens: 3, completionTokens: 5, totalTokens: 8 });
  });
});
