/**
 * POST /api/workboards/import — mode: 'update' (#886)
 * 이름 기준 제자리 갱신 · dryRun · 위험 경고 시 409 승인 요구. nodeInstallRoute.test.js 와 같은 mock 세트.
 */
const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { _id: 'admin-1', isAdmin: true }; next(); },
  requireAdmin: (req, res, next) => { req.user = { _id: 'admin-1', isAdmin: true }; next(); },
  buildWorkboardAccessFilter: jest.fn(() => ({})),
  userHasWorkboardAccess: jest.fn().mockResolvedValue(true),
}));
jest.mock('../models/Workboard', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/Server', () => ({ findById: jest.fn(), findOne: jest.fn(), find: jest.fn() }));
jest.mock('../models/Group', () => ({ findDefault: jest.fn().mockResolvedValue(null) }));
jest.mock('../models/ServerLoraCache', () => ({}));
jest.mock('../services/loraMetadataService', () => ({}));
jest.mock('../services/openAIChatService', () => ({}));
jest.mock('../services/geminiService', () => ({}));
jest.mock('../services/comfyUIService', () => ({}));
jest.mock('../services/workflowConverterService', () => ({}));

const Workboard = require('../models/Workboard');
const { WORKBOARD_EXPORT_VERSION, APP_VERSION } = require('../utils/workboardExport');

function createApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/workboards', require('../routes/workboards'));
  return app;
}

const fields = (opts) => [
  { name: 'first_frame', label: '첫 프레임', type: 'image', required: true },
  { name: 'steps', label: '스텝', type: 'select', defaultValue: '8', options: opts },
];
const wfData = JSON.stringify({ 9: { class_type: 'BasicScheduler', inputs: { steps: '{{##steps##}}' } }, 201: { class_type: 'VHS_VideoCombine', inputs: { crf: 16 } } });

function existingDoc() {
  const doc = {
    _id: 'wb-1', name: 'MiniMax H3 - FL2V (Turbo)', version: 3, isActive: true, serverId: 'srv-1',
    allowedGroupIds: ['grp-1'], usageCount: 42, createdBy: 'user-9',
    description: 'd', workboardType: 'image', outputFormat: 'video',
    additionalInputFields: fields([{ key: '8', value: '8' }, { key: '4', value: '4' }]),
    workflowData: wfData,
    modelExposurePolicy: 'full', modelWhitelist: [], loraExposurePolicy: 'full', loraWhitelist: [], allowedModelTypes: [],
    save: jest.fn().mockResolvedValue(undefined),
  };
  doc.toObject = () => ({ ...doc });
  return doc;
}
const exportOf = (workboard) => ({ _exportVersion: WORKBOARD_EXPORT_VERSION, appVersion: APP_VERSION, workboard, server: { name: 'ComfyUI-Video', serverType: 'ComfyUI' } });
const incomingSafe = () => ({
  name: 'MiniMax H3 - FL2V (Turbo)', description: 'd2', workboardType: 'image', outputFormat: 'video',
  additionalInputFields: fields([{ key: '8', value: '8' }, { key: '4', value: '4' }, { key: '12', value: '12' }]),
  workflowData: JSON.stringify({ 9: { class_type: 'BasicScheduler', inputs: { steps: '{{##steps##}}' } }, 201: { class_type: 'VHS_VideoCombine', inputs: { crf: 14 } } }),
  modelExposurePolicy: 'full', modelWhitelist: [], loraExposurePolicy: 'full', loraWhitelist: [], allowedModelTypes: [], version: 9,
});

describe('POST /api/workboards/import mode=update (#886)', () => {
  let app;
  beforeAll(() => { app = createApp(); });
  beforeEach(() => jest.clearAllMocks());

  test('dryRun — 저장 없이 diff 반환', async () => {
    const doc = existingDoc(); Workboard.findOne.mockResolvedValue(doc);
    const res = await request(app).post('/api/workboards/import').send({ data: exportOf(incomingSafe()), mode: 'update', dryRun: true });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.action).toBe('update');
    expect(res.body.diff.changes.map((c) => c.kind)).toEqual(expect.arrayContaining(['description', 'field.options.added', 'node.inputs']));
    expect(res.body.diff.warnings).toEqual([]);
    expect(doc.save).not.toHaveBeenCalled();
  });

  test('경고 없는 변경 — 제자리 갱신, 소유·권한·통계 유지, version +1', async () => {
    const doc = existingDoc(); Workboard.findOne.mockResolvedValue(doc);
    const res = await request(app).post('/api/workboards/import').send({ data: exportOf(incomingSafe()), mode: 'update' });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(true);
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(doc.version).toBe(4);              // 3 → 4 (export 의 version 9 는 무시)
    expect(doc.description).toBe('d2');
    expect(JSON.parse(doc.workflowData)['201'].inputs.crf).toBe(14);
    expect(doc.serverId).toBe('srv-1');
    expect(doc.allowedGroupIds).toEqual(['grp-1']);
    expect(doc.usageCount).toBe(42);
    expect(doc.createdBy).toBe('user-9');
    expect(doc.isActive).toBe(true);
  });

  test('변경 없음 — 저장하지 않고 updated:false', async () => {
    const doc = existingDoc(); Workboard.findOne.mockResolvedValue(doc);
    const same = { ...incomingSafe(), description: 'd', additionalInputFields: doc.additionalInputFields, workflowData: doc.workflowData };
    const res = await request(app).post('/api/workboards/import').send({ data: exportOf(same), mode: 'update' });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(false);
    expect(doc.save).not.toHaveBeenCalled();
  });

  test('위험 변경(옵션 축소) — acknowledge 없으면 409, 저장 안 함', async () => {
    const doc = existingDoc(); Workboard.findOne.mockResolvedValue(doc);
    const risky = { ...incomingSafe(), additionalInputFields: fields([{ key: '4', value: '4' }]) };
    const res = await request(app).post('/api/workboards/import').send({ data: exportOf(risky), mode: 'update' });
    expect(res.status).toBe(409);
    expect(res.body.requiresAcknowledge).toBe(true);
    expect(res.body.diff.warnings.map((w) => w.code)).toContain('FIELD_OPTIONS_REMOVED');
    expect(doc.save).not.toHaveBeenCalled();
  });

  test('위험 변경 + acknowledge:true — 갱신', async () => {
    const doc = existingDoc(); Workboard.findOne.mockResolvedValue(doc);
    const risky = { ...incomingSafe(), additionalInputFields: fields([{ key: '4', value: '4' }]) };
    const res = await request(app).post('/api/workboards/import').send({ data: exportOf(risky), mode: 'update', acknowledge: true });
    expect(res.status).toBe(200);
    expect(res.body.acknowledged).toBe(true);
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  test('같은 이름이 없으면 dryRun 은 action:create (서버 매칭 후)', async () => {
    Workboard.findOne.mockResolvedValue(null);
    const Server = require('../models/Server');
    Server.findOne.mockResolvedValue({ _id: 'srv-1', name: 'ComfyUI-Video', serverType: 'ComfyUI' });
    const res = await request(app).post('/api/workboards/import').send({ data: exportOf({ ...incomingSafe(), name: '새 판' }), mode: 'update', dryRun: true });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('create');
    expect(res.body.dryRun).toBe(true);
  });

  test('mode 오타는 400', async () => {
    const res = await request(app).post('/api/workboards/import').send({ data: exportOf(incomingSafe()), mode: 'upsert' });
    expect(res.status).toBe(400);
  });

  test('mode 미지정은 기존 동작 (findOne 을 호출하지 않는다)', async () => {
    const Server = require('../models/Server');
    Server.findOne.mockResolvedValue(null); Server.find.mockReturnValue({ select: () => Promise.resolve([]) });
    const res = await request(app).post('/api/workboards/import').send({ data: exportOf(incomingSafe()) });
    expect(Workboard.findOne).not.toHaveBeenCalled();
    expect(res.status).toBe(200);           // 서버 미매칭 → needsServer 응답 (기존 동작)
    expect(res.body.needsServer).toBe(true);
  });
});
