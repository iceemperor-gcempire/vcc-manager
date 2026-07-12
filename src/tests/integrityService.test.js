/**
 * integrityService 테스트 (#662 P0/P1)
 *
 * 모델을 mock 해 orphan 탐지/정제(dry-run vs apply)와 파일↔DB 정합성의
 * 순수 로직을 검증한다. 실제 DB/디스크 대신 fixture 사용 (파일 검사는 임시 디렉토리).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

// 테스트용 mock 모델 팩토리 — distinct/countDocuments/find/deleteMany 만 흉내
function mockModel(name) {
  const m = {
    modelName: name,
    distinct: jest.fn().mockResolvedValue([]),
    countDocuments: jest.fn().mockResolvedValue(0),
    find: jest.fn(() => ({ limit: () => ({ lean: () => Promise.resolve([]) }), lean: () => Promise.resolve([]) })),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  };
  return m;
}

const MockUser = mockModel('User');
const MockJob = mockModel('ImageGenerationJob');
const MockGenImage = mockModel('GeneratedImage');
const MockGenVideo = mockModel('GeneratedVideo');
const MockUploadedImage = mockModel('UploadedImage');

jest.mock('../models/User', () => MockUser);
jest.mock('../models/ImageGenerationJob', () => MockJob);
jest.mock('../models/GeneratedImage', () => MockGenImage);
jest.mock('../models/GeneratedVideo', () => MockGenVideo);
jest.mock('../models/UploadedImage', () => MockUploadedImage);
jest.mock('../models/Project', () => mockModel('Project'));
jest.mock('../models/Tag', () => mockModel('Tag'));
jest.mock('../models/Workboard', () => mockModel('Workboard'));
jest.mock('../models/Pipeline', () => mockModel('Pipeline'));
jest.mock('../models/Server', () => mockModel('Server'));
jest.mock('../models/Group', () => mockModel('Group'));
jest.mock('../services/userDeletionService', () => ({
  USER_CONTENT_MODELS: [MockJob, MockGenImage],
}));

const {
  checkOwnerOrphans,
  cleanupOwnerOrphans,
  checkDanglingJobRefs,
  checkFileIntegrity,
  uploadUrlToDiskPath,
} = require('../services/integrityService');

function setUserIds(ids) {
  MockUser.find.mockReturnValue({ lean: () => Promise.resolve(ids.map((id) => ({ _id: id }))) });
}

function setFindSample(model, docs) {
  model.find.mockReturnValue({ limit: () => ({ lean: () => Promise.resolve(docs) }), lean: () => Promise.resolve(docs) });
}

beforeEach(() => {
  jest.clearAllMocks();
  setUserIds(['user-a', 'user-b']);
  for (const m of [MockJob, MockGenImage, MockGenVideo, MockUploadedImage]) {
    m.distinct.mockResolvedValue([]);
    m.countDocuments.mockResolvedValue(0);
    setFindSample(m, []);
    m.deleteMany.mockResolvedValue({ deletedCount: 0 });
  }
});

describe('checkOwnerOrphans', () => {
  test('현존 사용자만 있으면 orphan 0', async () => {
    MockJob.distinct.mockResolvedValue(['user-a']);
    MockGenImage.distinct.mockResolvedValue(['user-b']);

    const result = await checkOwnerOrphans();
    expect(result.totalOrphanDocs).toBe(0);
    expect(result.userContent.every((r) => r.count === 0)).toBe(true);
  });

  test('삭제된 사용자를 가리키는 문서를 orphan 으로 집계 (#660 사례)', async () => {
    MockJob.distinct.mockResolvedValue(['user-a', 'ghost-user']);
    MockJob.countDocuments.mockResolvedValue(17);
    setFindSample(MockJob, [{ _id: 'j1', userId: 'ghost-user' }]);
    MockGenImage.distinct.mockResolvedValue(['ghost-user']);
    MockGenImage.countDocuments.mockResolvedValue(10);

    const result = await checkOwnerOrphans();
    const jobRow = result.userContent.find((r) => r.collection === 'ImageGenerationJob');
    expect(jobRow.orphanOwners).toEqual(['ghost-user']);
    expect(jobRow.count).toBe(17);
    expect(result.totalOrphanDocs).toBe(27);
    // count 쿼리는 orphan 소유자만 대상으로
    expect(MockJob.countDocuments).toHaveBeenCalledWith({ userId: { $in: ['ghost-user'] } });
  });
});

describe('cleanupOwnerOrphans — dry-run 기본', () => {
  beforeEach(() => {
    MockJob.distinct.mockResolvedValue(['ghost-user']);
    MockJob.countDocuments.mockResolvedValue(17);
    MockJob.deleteMany.mockResolvedValue({ deletedCount: 17 });
  });

  test('apply 없이는 어떤 것도 삭제하지 않는다', async () => {
    const result = await cleanupOwnerOrphans();
    const jobRow = result.results.find((r) => r.collection === 'ImageGenerationJob');
    expect(jobRow.matched).toBe(17);
    expect(jobRow.deleted).toBe(0);
    expect(MockJob.deleteMany).not.toHaveBeenCalled();
  });

  test('apply:true 일 때만 orphan 소유자 대상 deleteMany 실행', async () => {
    const result = await cleanupOwnerOrphans({ apply: true });
    const jobRow = result.results.find((r) => r.collection === 'ImageGenerationJob');
    expect(jobRow.deleted).toBe(17);
    expect(MockJob.deleteMany).toHaveBeenCalledWith({ userId: { $in: ['ghost-user'] } });
  });
});

describe('checkDanglingJobRefs', () => {
  test('jobId 값이 있는데 Job 이 없으면 비정상으로 집계 (null 은 검사 제외)', async () => {
    MockJob.distinct.mockResolvedValue(['job-1']);
    MockGenImage.distinct.mockResolvedValue(['job-1', 'gone-job', null]);
    MockGenImage.countDocuments.mockResolvedValue(3);
    MockGenVideo.distinct.mockResolvedValue([null]);

    const result = await checkDanglingJobRefs();
    const imgRow = result.find((r) => r.collection === 'GeneratedImage');
    expect(imgRow.danglingJobIds).toEqual(['gone-job']);
    expect(imgRow.count).toBe(3);
    const vidRow = result.find((r) => r.collection === 'GeneratedVideo');
    expect(vidRow.count).toBe(0);
  });
});

describe('checkFileIntegrity (P1)', () => {
  test('uploadUrlToDiskPath — /uploads 경로만 변환, traversal 차단', () => {
    expect(uploadUrlToDiskPath('/uploads/generated/a.png', '/root')).toBe(path.join('/root', 'generated/a.png'));
    expect(uploadUrlToDiskPath('/uploads/videos/v.mp4?expires=1', '/root')).toBe(path.join('/root', 'videos/v.mp4'));
    expect(uploadUrlToDiskPath('/etc/passwd', '/root')).toBeNull();
    expect(uploadUrlToDiskPath('/uploads/../etc/x', '/root')).toBeNull();
    expect(uploadUrlToDiskPath(null, '/root')).toBeNull();
  });

  test('DB→디스크 누락과 디스크 고아 파일을 각각 집계', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcc-integrity-'));
    fs.mkdirSync(path.join(root, 'generated'), { recursive: true });
    fs.writeFileSync(path.join(root, 'generated/exists.png'), 'x');
    fs.writeFileSync(path.join(root, 'generated/orphan.png'), 'x');

    setFindSample(MockGenImage, [
      { _id: 'i1', url: '/uploads/generated/exists.png' },
      { _id: 'i2', url: '/uploads/generated/missing.png' },
    ]);
    setFindSample(MockGenVideo, []);
    setFindSample(MockUploadedImage, []);

    const result = await checkFileIntegrity({ uploadRoot: root });

    expect(result.missingCount).toBe(1);
    expect(result.missing[0]).toMatchObject({ collection: 'GeneratedImage', id: 'i2' });
    expect(result.orphanFileCount).toBe(1);
    expect(result.orphanFiles[0]).toContain('orphan.png');

    fs.rmSync(root, { recursive: true, force: true });
  });
});
