/**
 * 컨테이너(프로젝트) 기준 문서 주입 로더 (#923).
 *
 * 공유 프로젝트의 독자가 실행할 때 소유자 문서가 주입되는지, 비회원에게는 막히는지,
 * 빠진 문서의 사유가 분류되는지를 검증한다.
 */

jest.mock('../models/UploadedText', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../utils/visionImages', () => ({ loadVisionImages: jest.fn().mockResolvedValue([]) }));
// auth 는 jwt·rateLimit 을 물고 있어 접근 판정 함수만 동일 로직으로 대체
jest.mock('../middleware/auth', () => ({
  userHasProjectAccess: (user, project) => {
    if (!user || !project) return false;
    if (user.isAdmin) return true;
    if (String(project.userId) === String(user._id)) return true;
    const allowed = (project.allowedGroupIds || []).map(String);
    if (allowed.length === 0) return false;
    return (user.groupIds || []).map(String).some((g) => allowed.includes(g));
  },
}));

const UploadedText = require('../models/UploadedText');
const { loadVisionImages } = require('../utils/visionImages');
const {
  allowedOwnerIds, loadContextDocs, loadSystemPromptDoc, loadVisionImagesForContainer, resolveProjectTag,
} = require('../services/containerDocAccess');

function chainable(result) {
  const chain = {};
  chain.select = () => chain;
  chain.sort = () => chain;
  chain.lean = () => chain;
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

const owner = { _id: 'owner1', groupIds: [] };
const reader = { _id: 'reader1', groupIds: ['g1'] };
const outsider = { _id: 'out1', groupIds: ['g9'] };
const admin = { _id: 'adm', isAdmin: true, groupIds: [] };
const sharedProject = { _id: 'p1', userId: 'owner1', allowedGroupIds: ['g1'], tagId: 'tagP' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('allowedOwnerIds', () => {
  test('소유자 본인 → 본인만', () => {
    expect(allowedOwnerIds({ viewer: owner, project: sharedProject })).toEqual(['owner1']);
  });
  test('공유 그룹 독자 → 본인 + 프로젝트 소유자', () => {
    expect(allowedOwnerIds({ viewer: reader, project: sharedProject })).toEqual(['reader1', 'owner1']);
  });
  test('비회원 → 본인만 (소유자 문서 차단)', () => {
    expect(allowedOwnerIds({ viewer: outsider, project: sharedProject })).toEqual(['out1']);
  });
  test('admin → 본인 + 소유자', () => {
    expect(allowedOwnerIds({ viewer: admin, project: sharedProject })).toEqual(['adm', 'owner1']);
  });
  test('프로젝트 없음 → 본인만', () => {
    expect(allowedOwnerIds({ viewer: reader, project: null })).toEqual(['reader1']);
  });
});

describe('loadContextDocs', () => {
  test('독자 실행: 소유자 범위로 조회하고 전부 찾으면 skipped 없음', async () => {
    UploadedText.find.mockReturnValue(chainable([{ _id: 'd1', userId: 'owner1' }, { _id: 'd2', userId: 'owner1' }]));
    const docs = await loadContextDocs({ docIds: ['d1', 'd2'], viewer: reader, project: sharedProject });
    expect(docs).toHaveLength(2);
    expect(UploadedText.find).toHaveBeenCalledTimes(1);
    expect(UploadedText.find.mock.calls[0][0]).toEqual({ _id: { $in: ['d1', 'd2'] }, userId: { $in: ['reader1', 'owner1'] } });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('asked=2 found=2'));
  });

  test('비회원 실행: 소유자 문서는 owner_not_allowed 로 분류돼 로그에 남는다', async () => {
    UploadedText.find
      .mockReturnValueOnce(chainable([]))                                   // 본 조회 — 없음
      .mockReturnValueOnce(chainable([{ _id: 'd1', userId: 'owner1' }])); // 사유 분류
    const docs = await loadContextDocs({ docIds: ['d1'], viewer: outsider, project: sharedProject });
    expect(docs).toEqual([]);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"reason":"owner_not_allowed"'));
  });

  test('삭제된 문서는 not_found', async () => {
    UploadedText.find.mockReturnValueOnce(chainable([])).mockReturnValueOnce(chainable([]));
    await loadContextDocs({ docIds: ['gone'], viewer: owner, project: sharedProject });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"reason":"not_found"'));
  });

  test('빈 입력 → 조회 없이 []', async () => {
    expect(await loadContextDocs({ docIds: [], viewer: owner, project: sharedProject })).toEqual([]);
    expect(await loadContextDocs({ docIds: null, viewer: owner, project: null })).toEqual([]);
    expect(UploadedText.find).not.toHaveBeenCalled();
  });
});

describe('loadSystemPromptDoc', () => {
  test('독자에게 소유자의 시스템 프롬프트 문서가 주입된다', async () => {
    UploadedText.findOne.mockReturnValue(chainable({ _id: 's1', userId: 'owner1', title: 'T', content: 'C' }));
    const doc = await loadSystemPromptDoc({ docId: 's1', viewer: reader, project: sharedProject });
    expect(doc.title).toBe('T');
    expect(UploadedText.findOne.mock.calls[0][0]).toEqual({ _id: 's1', userId: { $in: ['reader1', 'owner1'] } });
  });
  test('docId 없음 → null, 조회 없음', async () => {
    expect(await loadSystemPromptDoc({ docId: undefined, viewer: reader, project: sharedProject })).toBeNull();
    expect(UploadedText.findOne).not.toHaveBeenCalled();
  });
  test('못 찾으면 사유 로그', async () => {
    UploadedText.findOne.mockReturnValue(chainable(null));
    UploadedText.find.mockReturnValue(chainable([]));
    expect(await loadSystemPromptDoc({ docId: 'x', viewer: reader, project: sharedProject })).toBeNull();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('found=0'));
  });
});

describe('loadVisionImagesForContainer', () => {
  test('소유자 범위(배열)를 loadVisionImages 에 넘긴다', async () => {
    loadVisionImages.mockResolvedValue([{ imageId: 'i1' }]);
    const out = await loadVisionImagesForContainer({ imageIds: ['i1'], viewer: reader, project: sharedProject });
    expect(out).toHaveLength(1);
    expect(loadVisionImages).toHaveBeenCalledWith(['i1'], ['reader1', 'owner1']);
  });
});

describe('resolveProjectTag', () => {
  test('읽을 수 있는 프로젝트 → tagId (독자 포함)', () => {
    expect(resolveProjectTag({ viewer: reader, project: sharedProject })).toBe('tagP');
    expect(resolveProjectTag({ viewer: owner, project: sharedProject })).toBe('tagP');
  });
  test('비회원 / 프로젝트 없음 → null', () => {
    expect(resolveProjectTag({ viewer: outsider, project: sharedProject })).toBeNull();
    expect(resolveProjectTag({ viewer: reader, project: null })).toBeNull();
  });
});
