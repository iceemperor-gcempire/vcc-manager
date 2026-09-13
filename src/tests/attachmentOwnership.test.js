/**
 * 작업 첨부 참조 검증 (#959).
 */
jest.mock('../models/mediaModels', () => {
  const owners = {}; // id → userId (없으면 문서 없음)
  const makeModel = (kind) => ({
    kind,
    findById: jest.fn((id) => ({
      select: () => ({
        lean: async () => {
          const entry = owners[`${kind}:${id}`];
          return entry ? { _id: id, userId: entry } : null;
        },
      }),
    })),
  });
  const models = {
    UPLOADED_MEDIA_MODELS_BY_TYPE: { image: makeModel('uploaded'), video: makeModel('uploaded'), audio: makeModel('uploaded') },
    GENERATED_MEDIA_MODELS_BY_TYPE: { image: makeModel('generated'), video: makeModel('generated'), audio: makeModel('generated') },
    __owners: owners,
  };
  return models;
});

const mediaModels = require('../models/mediaModels');
const {
  collectAttachmentRefs, findUnusableAttachments, describeUnusableAttachments,
} = require('../services/attachmentOwnership');

const MINE_UP = 'a'.repeat(24);
const MINE_GEN = 'b'.repeat(24);
const OTHERS = 'c'.repeat(24);
const MISSING = 'd'.repeat(24);
const PROJECT_OWNER_IMG = 'e'.repeat(24);

const workboard = {
  additionalInputFields: [
    { name: 'start_image', label: '시작 이미지', type: 'image' },
    { name: 'ref_video', label: '참조 영상', type: 'video' },
    { name: 'voice', type: 'audio' },
    { name: 'steps', type: 'number' },
  ],
};

beforeAll(() => {
  Object.assign(mediaModels.__owners, {
    [`uploaded:${MINE_UP}`]: 'me',
    [`generated:${MINE_GEN}`]: 'me',
    [`uploaded:${OTHERS}`]: 'someone',
    [`uploaded:${PROJECT_OWNER_IMG}`]: 'owner',
  });
});

let logSpy;
beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => logSpy.mockRestore());

describe('collectAttachmentRefs', () => {
  test('참조 이미지 + 첨부 필드, additionalParams 우선·최상위 대체, 모든 값 모양', () => {
    const refs = collectAttachmentRefs(workboard, {
      referenceImages: [{ imageId: MINE_UP }],
      additionalParams: { start_image: [{ imageId: MINE_GEN, image: {} }, OTHERS], ref_video: { videoId: MISSING } },
      voice: [{ audioId: MINE_UP }],
      steps: 8,
    });
    expect(refs.map((r) => [r.field, r.type, r.id])).toEqual([
      ['referenceImages', 'image', MINE_UP],
      ['start_image', 'image', MINE_GEN],
      ['start_image', 'image', OTHERS],
      ['ref_video', 'video', MISSING],
      ['voice', 'audio', MINE_UP],
    ]);
  });

  test('첨부가 없으면 빈 배열', () => {
    expect(collectAttachmentRefs(workboard, { additionalParams: { start_image: [] } })).toEqual([]);
    expect(collectAttachmentRefs(null, {})).toEqual([]);
  });
});

describe('findUnusableAttachments', () => {
  test('내 업로드·생성물은 통과, 로그는 0건도 남긴다', async () => {
    const out = await findUnusableAttachments({
      workboard, inputData: { additionalParams: { start_image: [MINE_UP, MINE_GEN] } }, ownerIds: ['me'], label: 't',
    });
    expect(out).toEqual([]);
    expect(logSpy).toHaveBeenCalledWith('[attachmentOwnership] t: asked=2 unusable=0');
  });

  test('남의 것·없는 것·형식 오류는 각각 사유와 함께', async () => {
    const out = await findUnusableAttachments({
      workboard,
      inputData: { additionalParams: { start_image: [OTHERS], ref_video: [MISSING] }, referenceImages: [{ imageId: '../x' }] },
      ownerIds: ['me'],
    });
    expect(out.map((u) => [u.field, u.reason])).toEqual([
      ['referenceImages', 'invalid'],
      ['start_image', 'not_owned'],
      ['ref_video', 'not_found'],
    ]);
  });

  test('허용 소유자가 여럿이면 그중 하나면 통과 — 공유 프로젝트 소유자 첨부 (#923)', async () => {
    const out = await findUnusableAttachments({
      workboard, inputData: { start_image: [PROJECT_OWNER_IMG] }, ownerIds: ['me', 'owner'],
    });
    expect(out).toEqual([]);
  });

  test('허용 소유자가 없으면 전부 거절', async () => {
    const out = await findUnusableAttachments({ workboard, inputData: { start_image: [MINE_UP] }, ownerIds: [] });
    expect(out).toHaveLength(1);
  });
});

describe('describeUnusableAttachments', () => {
  test('라벨만, 중복 없이 — 사유는 싣지 않는다', () => {
    const message = describeUnusableAttachments([
      { label: '시작 이미지', reason: 'not_owned' },
      { label: '시작 이미지', reason: 'not_found' },
      { label: '참조 영상', reason: 'invalid' },
    ]);
    expect(message).toBe('쓸 수 없는 첨부가 있습니다: 시작 이미지, 참조 영상');
    expect(message).not.toMatch(/not_|invalid|존재|소유|남의/);
  });
});
