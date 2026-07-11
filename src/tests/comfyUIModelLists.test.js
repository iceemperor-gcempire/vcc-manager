/**
 * comfyUIService 모델 목록 조회 순수 로직 테스트 (#691)
 *
 * axios mock 으로 object_info 응답 파싱(중첩 경로 · 정렬 · 빈/이상 응답)을 검증한다.
 */

jest.mock('axios');
jest.mock('ws', () => jest.fn()); // comfyUIService 가 require 하는 WebSocket — 이 테스트에서 미사용

const axios = require('axios');
const comfyUIService = require('../services/comfyUIService');

describe('comfyUIService.getLoraModels', () => {
  beforeEach(() => jest.clearAllMocks());

  test('object_info 의 lora_name 목록을 대소문자 무시 정렬로 반환', async () => {
    axios.get.mockResolvedValue({
      data: {
        LoraLoader: {
          input: { required: { lora_name: [['zeta.safetensors', 'Alpha.safetensors', 'beta.safetensors']] } },
        },
      },
    });

    const models = await comfyUIService.getLoraModels('http://comfy');

    expect(models).toEqual(['Alpha.safetensors', 'beta.safetensors', 'zeta.safetensors']);
    expect(axios.get).toHaveBeenCalledWith('http://comfy/object_info/LoraLoader');
  });

  test('구조가 다르거나 목록이 없으면 빈 배열', async () => {
    axios.get.mockResolvedValue({ data: { LoraLoader: { input: { required: {} } } } });
    expect(await comfyUIService.getLoraModels('http://comfy')).toEqual([]);

    axios.get.mockResolvedValue({ data: {} });
    expect(await comfyUIService.getLoraModels('http://comfy')).toEqual([]);
  });

  test('요청 실패는 컨텍스트 있는 에러로 래핑', async () => {
    axios.get.mockRejectedValue(new Error('timeout'));
    await expect(comfyUIService.getLoraModels('http://comfy')).rejects.toThrow(
      'Failed to get LoRA models: timeout'
    );
  });
});

describe('comfyUIService.getCheckpointModels', () => {
  beforeEach(() => jest.clearAllMocks());

  test('CheckpointLoaderSimple 의 ckpt_name 목록을 정렬해 반환', async () => {
    axios.get.mockResolvedValue({
      data: {
        CheckpointLoaderSimple: {
          input: { required: { ckpt_name: [['sdxl.safetensors', 'anima.safetensors']] } },
        },
      },
    });

    const models = await comfyUIService.getCheckpointModels('http://comfy');

    expect(models).toEqual(['anima.safetensors', 'sdxl.safetensors']);
    expect(axios.get).toHaveBeenCalledWith('http://comfy/object_info/CheckpointLoaderSimple');
  });

  test('요청 실패는 컨텍스트 있는 에러로 래핑', async () => {
    axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(comfyUIService.getCheckpointModels('http://comfy')).rejects.toThrow(
      'Failed to get checkpoint models: ECONNREFUSED'
    );
  });
});
