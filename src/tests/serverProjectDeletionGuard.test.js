/**
 * 공용 프로젝트 소유자는 삭제할 수 없다 (#924) — 파이프라인·문서가 같이 사라지므로.
 */
jest.mock('../services/mediaFileCleanup', () => ({
  deleteMediaFilesFor: jest.fn().mockResolvedValue({ deleted: 0, absent: 0, byCollection: [] }),
  MEDIA_FILE_MODEL_NAMES: [],
}));
jest.mock('../models/Project', () => ({ find: jest.fn() }));

const Project = require('../models/Project');
const User = require('../models/User');
const svc = require('../services/userDeletionService');
const mediaFileCleanup = require('../services/mediaFileCleanup');

function chainable(result) {
  const chain = {}; chain.select = () => chain; chain.lean = () => chain;
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject); return chain;
}

describe('#924 공용 프로젝트 소유자 삭제 가드', () => {
  let spies;
  beforeEach(() => {
    jest.clearAllMocks();
    spies = svc.USER_CONTENT_MODELS.map((M) => jest.spyOn(M, 'deleteMany').mockResolvedValue({}));
    jest.spyOn(User, 'findByIdAndDelete').mockResolvedValue({});
  });
  afterEach(() => { spies.forEach((s) => s.mockRestore()); User.findByIdAndDelete.mockRestore(); });

  test('공용 프로젝트를 소유하면 409 로 거부하고 아무것도 지우지 않는다', async () => {
    Project.find.mockReturnValue(chainable([{ name: '공용 절차 모음' }]));
    await expect(svc.deleteUserAndContent('adm')).rejects.toMatchObject({ status: 409, code: 'SERVER_PROJECT_OWNER' });
    expect(mediaFileCleanup.deleteMediaFilesFor).not.toHaveBeenCalled();
    spies.forEach((s) => expect(s).not.toHaveBeenCalled());
    expect(User.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('공용 프로젝트가 없으면 기존대로 진행', async () => {
    Project.find.mockReturnValue(chainable([]));
    await svc.deleteUserAndContent('u1');
    expect(mediaFileCleanup.deleteMediaFilesFor).toHaveBeenCalledWith({ userId: 'u1' });
    expect(User.findByIdAndDelete).toHaveBeenCalledWith('u1');
  });
});
