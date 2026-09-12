/**
 * 작업 절차 문서 로더 (#952) — 소유자 없는 SequenceDoc 을 읽고, 비전 이미지는 실행자 것만.
 */
jest.mock('../models/UploadedText', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/SequenceDoc', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../utils/visionImages', () => ({ loadVisionImages: jest.fn().mockResolvedValue([]) }));
jest.mock('../middleware/auth', () => ({
  userHasProjectAccess: (user, project) => {
    if (!user || !project) return false;
    if (user.isAdmin) return true;
    if (String(project.userId) === String(user._id)) return true;
    const allowed = (project.allowedGroupIds || []).map(String);
    return (user.groupIds || []).map(String).some((g) => allowed.includes(g));
  },
}));

const UploadedText = require('../models/UploadedText');
const SequenceDoc = require('../models/SequenceDoc');
const { loadVisionImages } = require('../utils/visionImages');
const {
  loadSequenceContextDocs, loadSequenceSystemPromptDoc, createSequenceDocSource, createProjectDocSource,
} = require('../services/containerDocAccess');

function chainable(result) {
  const chain = {};
  chain.select = () => chain;
  chain.sort = () => chain;
  chain.lean = () => chain;
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

const runner = { _id: 'runner1', groupIds: ['g1'] };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => console.log.mockRestore());

describe('loadSequenceContextDocs', () => {
  test('소유자 필터 없이 id 로만 조회하고, 빠진 id 는 not_found 로 기록', async () => {
    SequenceDoc.find.mockReturnValue(chainable([{ _id: 'd1', title: 'A', content: 'a' }]));
    const docs = await loadSequenceContextDocs({ docIds: ['d1', 'd2'], label: 't' });
    expect(docs).toHaveLength(1);
    expect(SequenceDoc.find).toHaveBeenCalledWith({ _id: { $in: ['d1', 'd2'] } });
    expect(console.log).toHaveBeenCalledWith('[containerDocAccess] t: asked=2 found=1 skipped=[{"id":"d2","reason":"not_found"}]');
    expect(UploadedText.find).not.toHaveBeenCalled();
  });

  test('빈 입력은 조회하지 않는다', async () => {
    expect(await loadSequenceContextDocs({ docIds: [] })).toEqual([]);
    expect(SequenceDoc.find).not.toHaveBeenCalled();
  });
});

describe('loadSequenceSystemPromptDoc', () => {
  test('없으면 null + 0건 로그', async () => {
    SequenceDoc.findOne.mockReturnValue(chainable(null));
    expect(await loadSequenceSystemPromptDoc({ docId: 'x', label: 'sp' })).toBeNull();
    expect(console.log).toHaveBeenCalledWith('[containerDocAccess] sp: asked=1 found=0 skipped=[{"id":"x","reason":"not_found"}]');
  });
});

describe('로더 묶음', () => {
  test('작업 절차 묶음 — 문서는 SequenceDoc, 비전 이미지는 실행자 소유만', async () => {
    SequenceDoc.findOne.mockReturnValue(chainable({ _id: 'sp', content: '지침' }));
    SequenceDoc.find.mockReturnValue(chainable([]));
    const source = createSequenceDocSource({ viewer: runner });
    expect(await source.loadSystemPrompt({ docId: 'sp' })).toEqual({ _id: 'sp', content: '지침' });
    await source.loadContext({ docIds: ['c1'] });
    await source.loadVisionImages({ imageIds: ['img1'] });
    expect(loadVisionImages).toHaveBeenCalledWith(['img1'], ['runner1']);
    expect(UploadedText.find).not.toHaveBeenCalled();
    expect(UploadedText.findOne).not.toHaveBeenCalled();
  });

  test('프로젝트 묶음 — UploadedText 를 컨테이너 기준으로 (실행자 + 프로젝트 소유자)', async () => {
    UploadedText.findOne.mockReturnValue(chainable({ _id: 'sp' }));
    const project = { _id: 'p1', userId: 'owner1', allowedGroupIds: ['g1'] };
    const source = createProjectDocSource({ viewer: runner, project });
    await source.loadSystemPrompt({ docId: 'sp' });
    expect(UploadedText.findOne).toHaveBeenCalledWith({ _id: 'sp', userId: { $in: ['runner1', 'owner1'] } });
    await source.loadVisionImages({ imageIds: ['img1'] });
    expect(loadVisionImages).toHaveBeenCalledWith(['img1'], ['runner1', 'owner1']);
    expect(SequenceDoc.findOne).not.toHaveBeenCalled();
  });
});
