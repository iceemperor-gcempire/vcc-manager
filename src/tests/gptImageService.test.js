/**
 * gptImageService 순수 로직 테스트 (#691)
 *
 * axios mock 으로 요청 조립(기본값 · 선택 필드 조건부 포함)과
 * 응답 파싱(b64_json → buffer) · 에러 매핑을 검증한다.
 */

jest.mock('axios');
const axios = require('axios');
const gptImageService = require('../services/gptImageService');

const okResponse = (entries, usage = null) => ({ data: { data: entries, usage } });

describe('gptImageService.generateImage', () => {
  beforeEach(() => jest.clearAllMocks());

  test('apiKey 없으면 throw', async () => {
    await expect(gptImageService.generateImage(null, '', 'a cat')).rejects.toThrow(
      'GPT Image API key is required'
    );
  });

  test('기본값: 모델/사이즈/품질/포맷 + 기본 OpenAI 엔드포인트', async () => {
    axios.post.mockResolvedValue(okResponse([{ b64_json: 'aGk=' }]));

    await gptImageService.generateImage(null, 'key', 'a cat');

    const [url, body] = axios.post.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    expect(body).toEqual({
      model: 'gpt-image-1.5',
      prompt: 'a cat',
      n: 1,
      size: '1024x1024',
      quality: 'medium',
      output_format: 'png',
    });
  });

  test('background / output_compression 은 유효할 때만 포함 (숫자 변환)', async () => {
    axios.post.mockResolvedValue(okResponse([{ b64_json: 'aGk=' }]));

    await gptImageService.generateImage(null, 'key', 'p', {
      background: 'transparent',
      outputCompression: '80',
    });
    let body = axios.post.mock.calls[0][1];
    expect(body.background).toBe('transparent');
    expect(body.output_compression).toBe(80);

    await gptImageService.generateImage(null, 'key', 'p', { outputCompression: 'abc' });
    body = axios.post.mock.calls[1][1];
    expect(body.output_compression).toBeUndefined();
    expect(body.background).toBeUndefined();
  });

  test('b64_json 파싱 — 유효 항목만 buffer 로, 없으면 throw', async () => {
    axios.post.mockResolvedValue(
      okResponse([{ b64_json: Buffer.from('img').toString('base64') }, { url: 'http://x' }], { total_tokens: 5 })
    );
    const result = await gptImageService.generateImage(null, 'key', 'p');
    expect(result.images).toHaveLength(1);
    expect(result.images[0].buffer.toString()).toBe('img');
    expect(result.usage).toEqual({ total_tokens: 5 });

    axios.post.mockResolvedValue(okResponse([]));
    await expect(gptImageService.generateImage(null, 'key', 'p')).rejects.toThrow(
      'No image returned from GPT Image'
    );
  });

  test('에러 매핑: 조직 인증 안내 / 일반 API 메시지', async () => {
    axios.post.mockRejectedValue({
      response: { data: { error: { message: 'Your organization must be verified.' } } },
    });
    await expect(gptImageService.generateImage(null, 'key', 'p')).rejects.toThrow(/조직 인증/);

    axios.post.mockRejectedValue({ response: { data: { error: { message: 'billing issue' } } } });
    await expect(gptImageService.generateImage(null, 'key', 'p')).rejects.toThrow(
      'OpenAI: billing issue'
    );
  });
});
