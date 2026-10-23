/**
 * 모델 선택 목록의 판 제한 (#1086) — GET /api/servers/:id/models?detailed=true&workboardId=…
 *
 * 판이 주어지면 서버가 판의 폴더·모델 종류 제한을 직접 읽는다. 파이프라인·대화 패널의 선택기는
 * allowedBaseModels 를 보내지 않아 거름이 빠져 있었다. 적용한 제한은 응답에 실어 선택기가 보여 준다.
 */
const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
  requireNonApiKeyAuth: jest.requireActual('../middleware/auth').requireNonApiKeyAuth,
  requireAuth: (req, res, next) => { req.user = { _id: 'u1', isAdmin: false }; next(); },
  requireAdmin: (req, res) => res.status(403).json({ success: false }),
  userHasWorkboardAccess: jest.fn().mockReturnValue(true),
}));
jest.mock('../models/Server', () => ({ findById: jest.fn() }));
jest.mock('../models/ServerLoraCache', () => ({ findOne: jest.fn() }));
jest.mock('../models/ServerModelCache', () => ({ findOne: jest.fn() }));
jest.mock('../models/Workboard', () => ({ findById: jest.fn() }));
jest.mock('../models/ModelLicense', () => ({ find: jest.fn() }));
jest.mock('../services/loraMetadataService', () => ({ searchServerLoras: jest.fn() }));
jest.mock('../services/modelMetadataService', () => ({ searchServerModels: jest.fn() }));
jest.mock('../services/comfyUIService', () => ({}));

const Server = require('../models/Server');
const Workboard = require('../models/Workboard');
const ModelLicense = require('../models/ModelLicense');
const modelMetadataService = require('../services/modelMetadataService');
const loraMetadataService = require('../services/loraMetadataService');

const SERVER = 'a'.repeat(24);
const WB = 'b'.repeat(24);

function app() {
  const a = express();
  a.use('/api/servers', require('../routes/servers')); // eslint-disable-line global-require
  return a;
}

beforeEach(() => {
  jest.clearAllMocks();
  Server.findById.mockResolvedValue({ _id: SERVER, serverType: 'ComfyUI' });
  ModelLicense.find.mockReturnValue({ lean: async () => [] });
  modelMetadataService.searchServerModels.mockResolvedValue({ models: [], pagination: { current: 1, pages: 0, total: 0 } });
  loraMetadataService.searchServerLoras.mockResolvedValue({ loraModels: [], pagination: { current: 1, pages: 0, total: 0 } });
});

test('판이 주어지면 판의 폴더·종류 제한을 쓰고, 클라이언트가 보낸 종류는 무시한다', async () => {
  Workboard.findById.mockResolvedValue({
    _id: WB, outputFormat: 'image', workflowData: '{}', additionalInputFields: [],
    allowedModelTypes: ['Krea 2'], allowedModelFolders: ['Krea2/'], modelExposurePolicy: 'full',
  });
  const res = await request(app()).get(`/api/servers/${SERVER}/models`)
    .query({ detailed: 'true', workboardId: WB, allowedBaseModels: 'ZImageTurbo' });

  expect(res.status).toBe(200);
  const opts = modelMetadataService.searchServerModels.mock.calls[0][1];
  expect(opts.allowedFolders).toEqual(['Krea2/']);
  expect(opts.allowedBaseModels).toEqual(['Krea 2']);
  expect(res.body.data.restrictions).toEqual({ folders: ['Krea2/'], modelTypes: ['Krea 2'], whitelist: false });
});

test('판의 종류 제한이 비면 클라이언트 값이 있어도 종류로 거르지 않는다', async () => {
  Workboard.findById.mockResolvedValue({
    _id: WB, outputFormat: 'image', workflowData: '{}', additionalInputFields: [],
    allowedModelTypes: [], allowedModelFolders: ['qwen/'], modelExposurePolicy: 'full',
  });
  await request(app()).get(`/api/servers/${SERVER}/models`)
    .query({ detailed: 'true', workboardId: WB, allowedBaseModels: 'ZImageTurbo' });
  expect(modelMetadataService.searchServerModels.mock.calls[0][1].allowedBaseModels).toEqual([]);
});

test('판이 없으면 예전처럼 쿼리의 종류 제한을 쓰고, 폴더 제한은 없다', async () => {
  const res = await request(app()).get(`/api/servers/${SERVER}/models`)
    .query({ detailed: 'true', allowedBaseModels: 'Illustrious' });
  const opts = modelMetadataService.searchServerModels.mock.calls[0][1];
  expect(opts.allowedBaseModels).toEqual(['Illustrious']);
  expect(opts.allowedFolders).toBeUndefined();
  expect(res.body.data.restrictions).toEqual({ folders: [], modelTypes: ['Illustrious'], whitelist: false });
});

// LoRA 선택 목록의 판 제한 (#1099) — GET /api/servers/:id/loras?workboardId=…
test('LoRA 목록: 판이 주어지면 판의 LoRA 폴더 제한을 적용하고 응답에 싣는다', async () => {
  Workboard.findById.mockResolvedValue({
    _id: WB, allowedLoraFolders: ['style/openmoss/'], loraExposurePolicy: 'full',
  });
  const res = await request(app()).get(`/api/servers/${SERVER}/loras`).query({ workboardId: WB });
  expect(res.status).toBe(200);
  const opts = loraMetadataService.searchServerLoras.mock.calls[0][1];
  expect(opts.allowedFolders).toEqual(['style/openmoss/']);
  expect(opts.whitelist).toBeUndefined();
  expect(res.body.data.restrictions).toEqual({ folders: ['style/openmoss/'], whitelist: false });
});

test('LoRA 목록: 노출 목록과 함께 넘기고, 제한이 없는 판은 빈 폴더 목록', async () => {
  Workboard.findById.mockResolvedValue({
    _id: WB, loraExposurePolicy: 'whitelist', loraWhitelist: ['style\\openmoss\\a.safetensors'],
  });
  const res = await request(app()).get(`/api/servers/${SERVER}/loras`).query({ workboardId: WB });
  const opts = loraMetadataService.searchServerLoras.mock.calls[0][1];
  expect(opts.allowedFolders).toEqual([]);
  expect(opts.whitelist).toEqual(['style\\openmoss\\a.safetensors']);
  expect(res.body.data.restrictions).toEqual({ folders: [], whitelist: true });
});
