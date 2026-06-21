/**
 * #646 복원 충실도 — timestamps 보존 + 완전 복제(clean) 모드
 *  - restoreOneDoc 이 mongoose timestamps 자동 갱신을 끄는지 (원본 createdAt/updatedAt 보존)
 *  - restoreCollection 이 cleanRestore 시 백업에 있는 컬렉션만 비우는지
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { restoreOneDoc, restoreCollection } = require('../services/restoreService');

// new Model(doc) 생성자 + 정적 메서드를 흉내내는 mock 모델
function makeModel() {
  const saveMock = jest.fn().mockResolvedValue(undefined);
  const Model = jest.fn().mockImplementation(function (doc) {
    this._input = doc;
    this.save = saveMock;
  });
  Model.findById = jest.fn();
  Model.findByIdAndUpdate = jest.fn().mockResolvedValue({});
  Model.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
  Model._saveMock = saveMock;
  return Model;
}

function freshStats() {
  return { errors: 0, dbErrors: 0, fileErrors: 0, errorDetails: [], skipped: 0 };
}

describe('#646 restoreOneDoc — timestamps 보존', () => {
  test('신규 문서: new Model(doc) + save({ timestamps:false }) — 원본 _id/createdAt 유지', async () => {
    const Model = makeModel();
    Model.findById.mockResolvedValue(null);
    const stats = freshStats();

    const doc = { _id: 'id-1', title: 'x', createdAt: '2020-01-02T03:04:05.000Z' };
    const ok = await restoreOneDoc(doc, { name: 'GeneratedImage', model: Model }, { overwriteExisting: false }, stats);

    expect(ok).toBe(true);
    // 생성자에 _id 포함한 원본 doc 그대로 전달 (캐스팅은 mongoose 가 수행)
    expect(Model).toHaveBeenCalledWith(expect.objectContaining({ _id: 'id-1', createdAt: '2020-01-02T03:04:05.000Z' }));
    // 핵심: timestamps:false 로 저장 → 복원 시점으로 덮어쓰지 않음
    expect(Model._saveMock).toHaveBeenCalledWith({ timestamps: false });
  });

  test('overwriteExisting: findByIdAndUpdate 에 timestamps:false, _id 제외', async () => {
    const Model = makeModel();
    const stats = freshStats();

    const doc = { _id: 'id-2', title: 'y', updatedAt: '2021-05-05T00:00:00.000Z' };
    await restoreOneDoc(doc, { name: 'Workboard', model: Model }, { overwriteExisting: true }, stats);

    expect(Model.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    const [id, update, opts] = Model.findByIdAndUpdate.mock.calls[0];
    expect(id).toBe('id-2');
    expect(update).not.toHaveProperty('_id'); // _id 는 update 본문에서 제외
    expect(update).toMatchObject({ title: 'y', updatedAt: '2021-05-05T00:00:00.000Z' });
    expect(opts).toMatchObject({ upsert: true, timestamps: false });
    expect(Model._saveMock).not.toHaveBeenCalled();
  });

  test('overwriteExisting=false 이고 이미 존재하면 skip', async () => {
    const Model = makeModel();
    Model.findById.mockResolvedValue({ _id: 'id-3' });
    const stats = freshStats();

    await restoreOneDoc({ _id: 'id-3' }, { name: 'User', model: Model }, { overwriteExisting: false }, stats);

    expect(stats.skipped).toBe(1);
    expect(Model._saveMock).not.toHaveBeenCalled();
    expect(Model).not.toHaveBeenCalled(); // 생성자 미호출
  });
});

describe('#646 restoreCollection — 완전 복제(clean) 모드', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-'));
    fs.mkdirSync(path.join(tmpDir, 'database'), { recursive: true });
  });
  afterEach(() => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* noop */ } });

  test('cleanRestore: 백업에 파일이 있는 컬렉션은 deleteMany({}) 후 복원', async () => {
    fs.writeFileSync(path.join(tmpDir, 'database', 'GeneratedImage.ndjson'), JSON.stringify({ _id: 'a' }) + '\n');
    const Model = makeModel();
    Model.findById.mockResolvedValue(null);
    const stats = freshStats();

    const count = await restoreCollection({ name: 'GeneratedImage', model: Model }, tmpDir, { cleanRestore: true, overwriteExisting: false }, stats);

    expect(Model.deleteMany).toHaveBeenCalledWith({});
    expect(count).toBe(1);
    expect(Model._saveMock).toHaveBeenCalledTimes(1);
  });

  test('cleanRestore: 백업에 파일이 없는 컬렉션은 비우지 않고 null 반환 (구버전 백업 손실 방지)', async () => {
    const Model = makeModel();
    const stats = freshStats();

    const count = await restoreCollection({ name: 'Missing', model: Model }, tmpDir, { cleanRestore: true }, stats);

    expect(count).toBeNull();
    expect(Model.deleteMany).not.toHaveBeenCalled();
  });

  test('cleanRestore 미설정 시 deleteMany 호출 안 함', async () => {
    fs.writeFileSync(path.join(tmpDir, 'database', 'Tag.ndjson'), JSON.stringify({ _id: 'a' }) + '\n');
    const Model = makeModel();
    Model.findById.mockResolvedValue(null);
    const stats = freshStats();

    await restoreCollection({ name: 'Tag', model: Model }, tmpDir, { overwriteExisting: false }, stats);

    expect(Model.deleteMany).not.toHaveBeenCalled();
  });
});
