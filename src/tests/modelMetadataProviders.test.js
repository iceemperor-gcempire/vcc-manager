/**
 * modelMetadataService provider 로직 테스트 (#691)
 *
 * axios / 모델 mock 으로 provider 모델 목록 파싱 + outputFormat 추론(#354),
 * OpenAI Compatible 미분류 노출 회귀(#487)를 검증한다.
 */

jest.mock('axios');
jest.mock('../models/ServerModelCache', () => ({ findOne: jest.fn() }));
jest.mock('../models/SystemSettings', () => ({ findOne: jest.fn() }));

const axios = require('axios');
const ServerModelCache = require('../models/ServerModelCache');
const modelMetadataService = require('../services/modelMetadataService');

describe('getOpenAIProviderModels — 파싱 + outputFormat 추론', () => {
  beforeEach(() => jest.clearAllMocks());

  test('모델 종류별 outputFormats 추론 (#354)', async () => {
    axios.get.mockResolvedValue({
      data: {
        data: [
          { id: 'gpt-4o', owned_by: 'openai' },
          { id: 'dall-e-3' },
          { id: 'gpt-image-1.5' },
          { id: 'o3-mini' },
          { id: 'whisper-1' },
          { id: 'text-embedding-3-small' },
        ],
      },
    });

    const models = await modelMetadataService.getOpenAIProviderModels('http://api', 'k');
    const byId = Object.fromEntries(models.map((m) => [m.id, m.outputFormats]));

    expect(byId['gpt-4o']).toEqual(['text']);
    expect(byId['dall-e-3']).toEqual(['image']);
    expect(byId['gpt-image-1.5']).toEqual(['image']);
    expect(byId['o3-mini']).toEqual(['text']);
    // whisper / embedding 은 워크플로 미지원 — 미분류(빈 배열)
    expect(byId['whisper-1']).toEqual([]);
    expect(byId['text-embedding-3-small']).toEqual([]);
  });

  test('로컬 LLM 임의 모델명(llama 등)은 미분류로 파싱된다', async () => {
    axios.get.mockResolvedValue({
      data: { data: [{ id: 'llama-3.3-70b-instruct' }, { id: 'qwen3-32b' }] },
    });

    const models = await modelMetadataService.getOpenAIProviderModels('http://local:1234');
    expect(models.every((m) => m.outputFormats.length === 0)).toBe(true);
    // apiKey 미전달 시 Authorization 헤더 없음 (로컬 서버)
    expect(axios.get.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  test('요청 실패는 컨텍스트 있는 에러로 래핑', async () => {
    axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      modelMetadataService.getOpenAIProviderModels('http://api', 'k')
    ).rejects.toThrow('Failed to fetch OpenAI models: ECONNREFUSED');
  });
});

describe('getGeminiProviderModels — 파싱 + outputFormat 추론', () => {
  beforeEach(() => jest.clearAllMocks());

  test('generateContent=text, predict=image, image 키워드+generateContent=image, embed=미분류', async () => {
    axios.get.mockResolvedValue({
      data: {
        models: [
          {
            name: 'models/gemini-2.5-pro',
            displayName: 'Gemini 2.5 Pro',
            supportedGenerationMethods: ['generateContent'],
            inputTokenLimit: 1000000,
          },
          {
            name: 'models/imagen-4.0',
            supportedGenerationMethods: ['predict'],
          },
          {
            // multimodal image 모델은 이름만으로는 판별 불가 — 실제 API 처럼
            // displayName/description 의 image 키워드로 판별된다 (#354)
            name: 'models/gemini-2.5-flash-image',
            displayName: 'Nano Banana',
            description: 'State-of-the-art image generation model',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/text-embedding-004',
            supportedGenerationMethods: ['embedContent'],
          },
        ],
      },
    });

    const models = await modelMetadataService.getGeminiProviderModels('http://gem', 'k');
    const byId = Object.fromEntries(models.map((m) => [m.id, m]));

    // 'models/' prefix 제거 확인
    expect(byId['gemini-2.5-pro']).toBeDefined();
    expect(byId['gemini-2.5-pro'].outputFormats).toEqual(['text']);
    expect(byId['gemini-2.5-pro'].name).toBe('Gemini 2.5 Pro');
    expect(byId['gemini-2.5-pro'].contextWindow).toBe(1000000);
    expect(byId['imagen-4.0'].outputFormats).toEqual(['image']);
    expect(byId['gemini-2.5-flash-image'].outputFormats).toEqual(['image']);
    expect(byId['text-embedding-004'].outputFormats).toEqual([]);
  });
});

describe('searchServerModels — outputFormat 필터의 미분류 처리 (#487 회귀)', () => {
  beforeEach(() => jest.clearAllMocks());

  const cacheWith = (models) => ({ status: 'ready', lastFetched: null, lastMetadataSync: null, hashNodeAvailable: false, models });

  const providerModels = [
    { filename: 'gpt-4o', provider: { found: true, outputFormats: ['text'] } },
    { filename: 'dall-e-3', provider: { found: true, outputFormats: ['image'] } },
    { filename: 'llama-3.3-70b', provider: { found: true, outputFormats: [] } }, // 미분류 (로컬)
  ];

  test('OpenAI Compatible 서버는 미분류 모델을 text 필터에서도 노출한다', async () => {
    ServerModelCache.findOne.mockResolvedValue(cacheWith(providerModels));

    const result = await modelMetadataService.searchServerModels('srv1', {
      outputFormat: 'text',
      serverType: 'OpenAI Compatible',
    });

    const names = result.models.map((m) => m.filename).sort();
    expect(names).toEqual(['gpt-4o', 'llama-3.3-70b']);
  });

  test('OpenAI 공식 서버는 미분류 모델을 숨긴다 (whisper 류 클러터 방지)', async () => {
    ServerModelCache.findOne.mockResolvedValue(cacheWith(providerModels));

    const result = await modelMetadataService.searchServerModels('srv1', {
      outputFormat: 'text',
      serverType: 'OpenAI',
    });

    expect(result.models.map((m) => m.filename)).toEqual(['gpt-4o']);
  });

  test('캐시가 없으면 빈 결과', async () => {
    ServerModelCache.findOne.mockResolvedValue(null);

    const result = await modelMetadataService.searchServerModels('srv-none', {});
    expect(result.models).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });
});
