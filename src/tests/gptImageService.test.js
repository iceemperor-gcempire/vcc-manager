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
      model: 'gpt-image-2.5-flare',
      prompt: 'a cat',
      n: 1,
      size: '1024x1024',
      quality: 'medium',
      output_format: 'png',
    });
  });

  // GPT-Image-2.5 규격 (#943) — 커스텀 크기·신규 품질 티어
  describe('2.5 규격 검증 (#943)', () => {
    const { validateSize } = gptImageService;

    test('권장 크기와 auto 는 통과', () => {
      expect(validateSize('auto')).toEqual({ size: 'auto', experimental: false });
      expect(validateSize('1536x1024')).toEqual({ size: '1536x1024', experimental: false });
      expect(validateSize(undefined)).toEqual({ size: 'auto', experimental: false });
    });

    test('4K 는 통과하되 experimental 로 표시 (2560x1440 초과)', () => {
      expect(validateSize('3840x2160')).toEqual({ size: '3840x2160', experimental: true });
      expect(validateSize('2560x1440')).toEqual({ size: '2560x1440', experimental: false });
    });

    test('16 배수 위반 / 변 상한 / 픽셀 예산 / 비율 은 이유와 함께 거부', () => {
      expect(() => validateSize('1000x1000')).toThrow(/16의 배수/);
      expect(() => validateSize('4096x1024')).toThrow(/3840px/);
      expect(() => validateSize('512x512')).toThrow(/총 픽셀/);
      expect(() => validateSize('3840x1024')).toThrow(/비율/);
      expect(() => validateSize('big')).toThrow(/형식/);
    });

    test('xhigh · max 는 허용, 없는 품질은 거부', async () => {
      axios.post.mockResolvedValue(okResponse([{ b64_json: 'aGk=' }]));
      await gptImageService.generateImage(null, 'key', 'p', { model: 'gpt-image-2.5-sunburst', quality: 'max', size: '2048x2048' });
      const body = axios.post.mock.calls[0][1];
      expect(body).toMatchObject({ model: 'gpt-image-2.5-sunburst', quality: 'max', size: '2048x2048' });
      await expect(gptImageService.generateImage(null, 'key', 'p', { quality: 'ultra' })).rejects.toThrow(/지원하지 않는 품질/);
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
