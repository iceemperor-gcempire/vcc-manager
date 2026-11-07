/**
 * #1142 — OpenAI 이미지 작업이 빠뜨린 칸을 판의 기본값으로 채우는지.
 *
 * 웹 화면은 모든 칸을 보내지만 API·MCP 호출은 빠뜨릴 수 있다. 예전에는 빠진 칸이 서비스 기본값
 * (png · 1024x1024)으로 가서, GIF 판을 API 로 부르면 png 가 나가거나 프레임 크기가 1024 로 거절됐다.
 */
jest.mock('../services/gptImageService', () => ({
  generateImage: jest.fn(async () => ({ images: [], videos: [], usage: null, svgUsage: null, model: 'gpt-image-2.6-flare' })),
}));

const gptImageService = require('../services/gptImageService');
const { SERVICE_MAP } = require('../services/queueService');

const handle = SERVICE_MAP['OpenAI:image'];

const gifBoard = {
  serverUrl: 'https://api.openai.com',
  apiKey: 'test',
  additionalInputFields: [
    { name: 'base_model', type: 'baseModel', defaultValue: 'gpt-image-2.6-flare' },
    { name: 'image_size', type: 'select', defaultValue: '512x512' },
    { name: 'quality', type: 'select', defaultValue: 'medium' },
    { name: 'complexity', type: 'select', defaultValue: 'high' },
    { name: 'output_format', type: 'select', defaultValue: 'gif' },
    { name: 'frame_count', type: 'number', defaultValue: null },
    { name: 'svg_model', type: 'select', defaultValue: 'gpt-6.1-sol' },
  ],
};

async function optionsFor(additionalParams) {
  gptImageService.generateImage.mockClear();
  await handle({
    workboardData: gifBoard,
    inputData: { prompt: 'fox waving', additionalParams },
    job: { progress: jest.fn() },
  });
  return gptImageService.generateImage.mock.calls[0][3];
}

describe('OpenAI 이미지 — 빠진 칸은 판 기본값 (#1142)', () => {
  test('출력 포맷·크기·복잡도를 빠뜨리면 판 기본값으로 보낸다', async () => {
    const opts = await optionsFor({ base_model: 'gpt-image-2.6-flare' });
    expect(opts.outputFormat).toBe('gif');
    expect(opts.size).toBe('512x512');
    expect(opts.complexity).toBe('high');
    expect(opts.quality).toBe('medium');
  });

  test('보낸 값은 그대로 쓴다 (선택지 객체도)', async () => {
    const opts = await optionsFor({
      output_format: { key: 'GIF', value: 'gif' },
      image_size: '720x720',
      complexity: 'low',
      frame_count: 16,
    });
    expect(opts.size).toBe('720x720');
    expect(opts.complexity).toBe('low');
    expect(opts.frameCount).toBe(16);
  });

  test('기본값이 없는 칸은 비운 채로 둔다', async () => {
    const opts = await optionsFor({});
    expect(opts.frameCount == null).toBe(true);
    expect(opts.background).toBeUndefined();
  });

  test('빈 문자열은 일부러 비운 것으로 보고 채우지 않는다 (SVG 작성 모델 끄기)', async () => {
    const opts = await optionsFor({ svg_model: '' });
    expect(opts.svgModel).toBe('');
  });

  test('판에 칸이 없으면 예전처럼 서비스 기본값에 맡긴다', async () => {
    gptImageService.generateImage.mockClear();
    await handle({
      workboardData: { serverUrl: 'x', apiKey: 'k', additionalInputFields: [] },
      inputData: { prompt: 'p', additionalParams: {} },
      job: { progress: jest.fn() },
    });
    const opts = gptImageService.generateImage.mock.calls[0][3];
    expect(opts.outputFormat).toBe('png');
    expect(opts.size).toBeUndefined();
  });
});
