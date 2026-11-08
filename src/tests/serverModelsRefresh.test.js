/**
 * 모델 목록 가벼운 재조회 (#1150) — GET /api/servers/:id/models?refresh=true.
 * 예전에는 체크포인트 이름만 읽어 캐시 목록을 덮어써서 diffusion 모델(H3 등)이 캐시에서 빠졌고,
 * 그 모델을 쓰는 판의 베이스 모델 선택 목록이 비었다. 두 폴더를 다 읽고 기존 메타데이터를 지키는지 본다.
 */
const express = require('express');
const request = require('supertest');

jest.mock('axios');
jest.mock('../middleware/auth', () => ({
  requireNonApiKeyAuth: jest.requireActual('../middleware/auth').requireNonApiKeyAuth,
  requireAuth: (req, res, next) => { req.user = { _id: 'u1', isAdmin: false }; next(); },
  requireAdmin: (req, res) => res.status(403).json({ success: false }),
  userHasWorkboardAccess: jest.fn().mockReturnValue(true),
}));
jest.mock('../models/Server', () => ({ findById: jest.fn() }));
jest.mock('../models/ServerLoraCache', () => ({ findOne: jest.fn() }));
jest.mock('../models/ServerModelCache', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../models/SystemSettings', () => ({ findOne: jest.fn() }));
jest.mock('../models/Workboard', () => ({ findById: jest.fn() }));
jest.mock('../models/ModelLicense', () => ({ find: jest.fn() }));
jest.mock('../services/loraMetadataService', () => ({}));
jest.mock('../services/comfyUIService', () => ({}));

const axios = require('axios');
const Server = require('../models/Server');
const ServerModelCache = require('../models/ServerModelCache');
const { getModelFileEntries, mergeModelFileEntries } = require('../services/modelMetadataService');

const SERVER = 'a'.repeat(24);
const H3 = 'minimax\\minimax_h3_ref2va_int8_convrot.safetensors';
const PRISM = 'minimax\\PRISM_DMAD_PDMD_int8.safetensors';
const SDXL = 'SDXL\\juggernaut.safetensors';
const GONE = 'SDXL\\deleted.safetensors';

// ComfyUI object_info — 로더 노드마다 고를 수 있는 파일 이름
function mockObjectInfo({ checkpoints, unets, unetStatus }) {
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith('/object_info/CheckpointLoaderSimple')) {
      return { data: { CheckpointLoaderSimple: { input: { required: { ckpt_name: [checkpoints] } } } } };
    }
    if (url.endsWith('/object_info/UNETLoader')) {
      if (unetStatus) throw Object.assign(new Error('not found'), { response: { status: unetStatus } });
      return { data: { UNETLoader: { input: { required: { unet_name: [unets] } } } } };
    }
    throw new Error(`unexpected ${url}`);
  });
}

beforeEach(() => jest.clearAllMocks());

describe('getModelFileEntries — 두 폴더를 source 와 함께', () => {
  test('체크포인트와 diffusion 모델을 모두 읽는다', async () => {
    mockObjectInfo({ checkpoints: [SDXL], unets: [H3, PRISM] });
    await expect(getModelFileEntries('http://comfy')).resolves.toEqual([
      { filename: SDXL, source: 'checkpoints' },
      { filename: H3, source: 'diffusion_models' },
      { filename: PRISM, source: 'diffusion_models' },
    ]);
  });

  test('UNETLoader 가 없는 옛 ComfyUI 는 체크포인트만', async () => {
    mockObjectInfo({ checkpoints: [SDXL], unetStatus: 404 });
    await expect(getModelFileEntries('http://comfy')).resolves.toEqual([{ filename: SDXL, source: 'checkpoints' }]);
  });
});

describe('mergeModelFileEntries — 기존 메타데이터를 지킨다', () => {
  test('같은 (source, filename) 은 해시·Civitai 를 그대로, 새 파일은 빈 메타데이터, 사라진 파일은 뺀다', () => {
    const existing = [
      { filename: H3, source: 'diffusion_models', hash: 'h3hash', civitai: { found: true, name: 'H3' } },
      { filename: SDXL, hash: 'sdxlhash', civitai: { found: false } }, // source 없는 옛 항목 = checkpoints
      { filename: GONE, source: 'checkpoints', hash: 'x', civitai: { found: false } },
    ];
    const merged = mergeModelFileEntries(existing, [
      { filename: SDXL, source: 'checkpoints' },
      { filename: H3, source: 'diffusion_models' },
      { filename: PRISM, source: 'diffusion_models' },
    ]);
    expect(merged).toEqual([
      { filename: SDXL, hash: 'sdxlhash', civitai: { found: false } },
      { filename: H3, source: 'diffusion_models', hash: 'h3hash', civitai: { found: true, name: 'H3' } },
      { filename: PRISM, source: 'diffusion_models', hash: null, hashError: null, civitai: { found: false } },
    ]);
  });

  test('같은 이름이 두 폴더에 있으면 따로 다룬다', () => {
    const merged = mergeModelFileEntries(
      [{ filename: 'x.safetensors', source: 'diffusion_models', hash: 'unet' }],
      [{ filename: 'x.safetensors', source: 'checkpoints' }, { filename: 'x.safetensors', source: 'diffusion_models' }],
    );
    expect(merged.map((m) => [m.source, m.hash])).toEqual([['checkpoints', null], ['diffusion_models', 'unet']]);
  });

  test('Mongoose 하위 문서는 toObject 로 꺼낸다', () => {
    const subdoc = { toObject: () => ({ filename: H3, source: 'diffusion_models', hash: 'h3hash' }) };
    expect(mergeModelFileEntries([subdoc], [{ filename: H3, source: 'diffusion_models' }]))
      .toEqual([{ filename: H3, source: 'diffusion_models', hash: 'h3hash' }]);
  });
});

test('GET ?refresh=true — 재조회 뒤에도 diffusion 모델이 캐시에 남는다 (#1150)', async () => {
  Server.findById.mockResolvedValue({ _id: SERVER, serverType: 'ComfyUI', serverUrl: 'http://comfy' });
  ServerModelCache.findOne.mockResolvedValue({
    models: [
      { filename: H3, source: 'diffusion_models', hash: 'h3hash', civitai: { found: false } },
      { filename: SDXL, source: 'checkpoints', hash: 'sdxlhash', civitai: { found: false } },
    ],
  });
  ServerModelCache.findOneAndUpdate.mockImplementation(async (filter, update) => ({ ...update }));
  mockObjectInfo({ checkpoints: [SDXL], unets: [H3, PRISM] });

  const app = express();
  app.use('/api/servers', require('../routes/servers')); // eslint-disable-line global-require
  const res = await request(app).get(`/api/servers/${SERVER}/models`).query({ refresh: 'true' });

  expect(res.status).toBe(200);
  const saved = ServerModelCache.findOneAndUpdate.mock.calls[0][1].models;
  expect(saved.map((m) => [m.source, m.filename, m.hash])).toEqual([
    ['checkpoints', SDXL, 'sdxlhash'],
    ['diffusion_models', H3, 'h3hash'],
    ['diffusion_models', PRISM, null],
  ]);
  expect(res.body.data.checkpointModels).toEqual([SDXL, H3, PRISM]);
});
