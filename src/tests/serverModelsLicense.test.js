/**
 * 모델 목록에 라이선스를 붙인다 (#1073) — GET /api/servers/:id/models?detailed=true.
 * 모델 선택기가 이름 옆에 보이는 값이다. 캐시 항목은 Mongoose 하위 문서라 toObject 뒤에 붙여야 응답에 실린다.
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
jest.mock('../services/loraMetadataService', () => ({}));
jest.mock('../services/modelMetadataService', () => ({ searchServerModels: jest.fn() }));
jest.mock('../services/comfyUIService', () => ({}));

const Server = require('../models/Server');
const ModelLicense = require('../models/ModelLicense');
const modelMetadataService = require('../services/modelMetadataService');

const SERVER = 'a'.repeat(24);

test('모델마다 붙은 라이선스, 없으면 null', async () => {
  Server.findById.mockResolvedValue({ _id: SERVER, serverType: 'ComfyUI' });
  const subdoc = { filename: 'minimax\\minimax_h3_fl2va_int8_convrot.safetensors', toObject() { return { filename: this.filename, source: 'diffusion_models' }; } };
  modelMetadataService.searchServerModels.mockResolvedValue({
    models: [subdoc, { filename: 'sdxl\\juggernaut.safetensors' }],
    pagination: { current: 1, pages: 1, total: 2 },
  });
  ModelLicense.find.mockReturnValue({ lean: async () => [
    { _id: 'l1', name: 'MiniMax H3 Community License', commercialUse: 'conditional', targets: [{ match: 'minimax/' }] },
  ] });

  const app = express();
  app.use('/api/servers', require('../routes/servers')); // eslint-disable-line global-require
  const res = await request(app).get(`/api/servers/${SERVER}/models`).query({ detailed: 'true' });

  expect(res.status).toBe(200);
  const [h3, sdxl] = res.body.data.models;
  expect(h3).toMatchObject({ source: 'diffusion_models', license: { licenseId: 'l1', name: 'MiniMax H3 Community License', matchedBy: 'folder' } });
  expect(sdxl.license).toBeNull();
});
