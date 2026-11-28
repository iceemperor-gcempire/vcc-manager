/**
 * 일괄 삭제 시 디스크 파일 정리 (#806)
 *
 * 개별 콘텐츠 삭제는 파일을 지우는데 계정 삭제·orphan 정제는 문서만 지웠다.
 * 알파 기준 파일 110개 중 59개(54%)가 참조 없는 고아였고, 계정을 지워도 그 사람이
 * 만든 미디어가 디스크에 남았다.
 *
 * "파일을 먼저, 문서를 나중" 순서를 값으로 고정한다 — 뒤집히면 경로를 잃어 영구 고아가 된다.
 */
const fileUpload = require('../utils/fileUpload');

jest.mock('../utils/fileUpload', () => {
  const actual = jest.requireActual('../utils/fileUpload');
  return { ...actual, deleteFile: jest.fn() };
});

const { deleteMediaFilesFor, MEDIA_FILE_MODEL_NAMES } = require('../services/mediaFileCleanup');
const { GENERATED_MEDIA_MODELS, UPLOADED_MEDIA_MODELS } = require('../constants/mediaTypes');

const MODELS = {
  GeneratedImage: require('../models/GeneratedImage'),
  GeneratedVideo: require('../models/GeneratedVideo'),
  GeneratedAudio: require('../models/GeneratedAudio'),
  UploadedImage: require('../models/UploadedImage'),
  UploadedVideo: require('../models/UploadedVideo'),
  UploadedAudio: require('../models/UploadedAudio'),
};

/**
 * 각 모델의 find 를 대체한다.
 * - 대상 조회(정리할 문서): docsByModel
 * - 함께 쓰는 문서 조회(`{ path: { $in }, _id: { $nin } }`): sharersByModel 중 경로가 맞는 것
 */
function stubFinds(docsByModel, sharersByModel = {}) {
  return Object.entries(MODELS).map(([name, Model]) =>
    jest.spyOn(Model, 'find').mockImplementation((filter = {}) => {
      if (filter.thumbnailUrl && filter.thumbnailUrl.$in) {
        const excluded = ((filter._id && filter._id.$nin) || []).map(String);
        const hits = (sharersByModel[name] || []).filter((d) => filter.thumbnailUrl.$in.includes(d.thumbnailUrl) && !excluded.includes(String(d._id)));
        return { lean: () => Promise.resolve(hits) };
      }
      if (filter.path && filter.path.$in) {
        const excluded = ((filter._id && filter._id.$nin) || []).map(String);
        const hits = (sharersByModel[name] || []).filter((d) => filter.path.$in.includes(d.path) && !excluded.includes(String(d._id)));
        return { lean: () => Promise.resolve(hits) };
      }
      return { lean: () => Promise.resolve(docsByModel[name] || []) };
    })
  );
}

beforeEach(() => {
  fileUpload.deleteFile.mockReset();
  fileUpload.deleteFile.mockResolvedValue(true);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('삭제 대상 모델 목록 (#806)', () => {
  test('파일을 가진 미디어 모델 전부 — mediaTypes 단일 소스와 일치', () => {
    // 축이 늘 때 여기만 어긋나면 그 종류의 파일이 조용히 남는다
    expect(MEDIA_FILE_MODEL_NAMES).toEqual([...GENERATED_MEDIA_MODELS, ...UPLOADED_MEDIA_MODELS]);
    expect(MEDIA_FILE_MODEL_NAMES).toHaveLength(6);
  });
});

describe('deleteMediaFilesFor (#806)', () => {
  test('모든 미디어 모델의 path 를 지운다', async () => {
    const spies = stubFinds({
      GeneratedImage: [{ path: '/up/generated/a.png' }],
      GeneratedAudio: [{ path: '/up/audios/s.flac' }],
      UploadedImage: [{ path: '/up/reference/r.jpg' }],
    });

    const res = await deleteMediaFilesFor({ userId: 'u1' });

    expect(fileUpload.deleteFile.mock.calls.map((c) => c[0]).sort()).toEqual([
      '/up/audios/s.flac',
      '/up/generated/a.png',
      '/up/reference/r.jpg',
    ]);
    expect(res.deleted).toBe(3);
    spies.forEach((s) => s.mockRestore());
  });

  test('필터가 각 모델의 find 로 그대로 전달된다', async () => {
    const spies = stubFinds({});
    const filter = { userId: { $in: ['u1', 'u2'] } };

    await deleteMediaFilesFor(filter);

    for (const s of spies) expect(s).toHaveBeenCalledWith(filter, expect.any(Object));
    spies.forEach((s) => s.mockRestore());
  });

  test('비디오는 썸네일도 함께 지운다 (thumbnailUrl 에서 환산)', async () => {
    const spies = stubFinds({
      GeneratedVideo: [{ path: '/up/videos/v.mp4', thumbnailUrl: '/uploads/videos/v_thumb.jpg' }],
    });

    await deleteMediaFilesFor({ userId: 'u1' }, { uploadRoot: '/up' });

    const called = fileUpload.deleteFile.mock.calls.map((c) => c[0]);
    expect(called).toContain('/up/videos/v.mp4');
    expect(called).toContain(require('path').join('/up', 'videos/v_thumb.jpg'));
    spies.forEach((s) => s.mockRestore());
  });

  test('오디오·이미지는 썸네일 조회를 시도하지 않는다', async () => {
    const spies = stubFinds({});
    await deleteMediaFilesFor({ userId: 'u1' });

    const projectionOf = (name) =>
      MODELS[name].find.mock.calls[0][1];
    expect(projectionOf('GeneratedVideo')).toHaveProperty('thumbnailUrl');
    expect(projectionOf('GeneratedAudio')).not.toHaveProperty('thumbnailUrl');
    expect(projectionOf('GeneratedImage')).not.toHaveProperty('thumbnailUrl');
    spies.forEach((s) => s.mockRestore());
  });

  test('이미 없는 파일은 실패가 아니라 absent 로 센다', async () => {
    const spies = stubFinds({
      GeneratedImage: [{ path: '/up/generated/gone.png' }, { path: '/up/generated/here.png' }],
    });
    fileUpload.deleteFile.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const res = await deleteMediaFilesFor({ userId: 'u1' });

    expect(res.deleted).toBe(1);
    expect(res.absent).toBe(1);
    spies.forEach((s) => s.mockRestore());
  });

  test('대상이 0건이어도 로그를 남긴다', async () => {
    // 0건 침묵은 "대상이 없었다" 와 "이 단계가 안 돌았다" 를 구분 불가능하게 만든다
    const spies = stubFinds({});
    const res = await deleteMediaFilesFor({ userId: 'u1' });

    expect(res.deleted).toBe(0);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('미디어 파일 정리'));
    spies.forEach((s) => s.mockRestore());
  });
});

describe('다른 문서와 함께 쓰는 파일은 남긴다 (#1325)', () => {
  test('지우지 않는 문서가 같은 경로를 쓰면 그 파일은 지우지 않는다', async () => {
    stubFinds(
      { GeneratedImage: [{ _id: 'a', path: '/u/shared.png' }, { _id: 'b', path: '/u/own.png' }] },
      { GeneratedImage: [{ _id: 'other', path: '/u/shared.png' }] },
    );
    const result = await deleteMediaFilesFor({ userId: 'gone' });
    expect(fileUpload.deleteFile.mock.calls.map(([p]) => p)).toEqual(['/u/own.png']);
    expect(result).toMatchObject({ deleted: 1, kept: 1 });
  });

  test('함께 쓰는 문서를 찾는 조건에서 지우는 문서 자신은 뺀다', async () => {
    const spies = stubFinds({ GeneratedVideo: [{ _id: 'a', path: '/u/v.mp4' }] });
    await deleteMediaFilesFor({ userId: 'gone' });
    const videoSpy = spies[Object.keys(MODELS).indexOf('GeneratedVideo')];
    const sharerQuery = videoSpy.mock.calls.map(([f]) => f).find((f) => f.path);
    expect(sharerQuery).toEqual({ path: { $in: ['/u/v.mp4'] }, _id: { $nin: ['a'] } });
  });

  test('지우는 문서끼리만 같은 파일을 쓰면 파일을 지운다 — 한 번만', async () => {
    stubFinds({ UploadedImage: [{ _id: 'a', path: '/u/same.png' }, { _id: 'b', path: '/u/same.png' }] });
    const result = await deleteMediaFilesFor({ userId: 'gone' });
    expect(fileUpload.deleteFile.mock.calls).toEqual([['/u/same.png']]);
    expect(result.kept).toBe(0);
  });

  test('다른 종류의 문서가 같은 경로를 쓰는 것은 보지 않는다 (종류마다 폴더가 다르다)', async () => {
    stubFinds(
      { GeneratedImage: [{ _id: 'a', path: '/u/x.png' }] },
      { GeneratedVideo: [{ _id: 'v', path: '/u/x.png' }] },
    );
    await deleteMediaFilesFor({ userId: 'gone' });
    expect(fileUpload.deleteFile.mock.calls).toEqual([['/u/x.png']]);
  });

  test('영상: 남는 문서가 같은 본체와 썸네일을 쓰면 둘 다 남긴다', async () => {
    const shared = { path: '/u/v.mp4', thumbnailUrl: '/uploads/videos/v_thumb.jpg' };
    stubFinds(
      { GeneratedVideo: [{ _id: 'a', ...shared }] },
      { GeneratedVideo: [{ _id: 'other', ...shared }] },
    );
    await deleteMediaFilesFor({ userId: 'gone' }, { uploadRoot: '/u' });
    expect(fileUpload.deleteFile).not.toHaveBeenCalled();
  });

  test('함께 쓰는 문서를 찾다가 실패하면 그 종류의 파일은 지우지 않고 던진다', async () => {
    jest.spyOn(MODELS.GeneratedImage, 'find').mockImplementation((filter = {}) => {
      if (filter.path) return { lean: () => Promise.reject(new Error('db down')) };
      return { lean: () => Promise.resolve([{ _id: 'a', path: '/u/a.png' }]) };
    });
    await expect(deleteMediaFilesFor({ userId: 'gone' })).rejects.toThrow('db down');
    expect(fileUpload.deleteFile).not.toHaveBeenCalled();
  });
});
