/**
 * #646/#655 복원 충실도 — 원본 보존(시각/비밀번호) + 완전 복제(clean) 모드
 *  - restoreOneDoc 신규 삽입은 native insert(collection.insertOne)로 저장 훅 우회
 *    → User 비밀번호(이미 bcrypt 해시) 재해싱 방지(이중해싱), createdAt 원본 보존
 *  - overwriteExisting 은 findByIdAndUpdate(timestamps:false)
 *  - restoreCollection cleanRestore 는 백업에 있는 컬렉션만 비움
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { restoreOneDoc, restoreCollection } = require('../services/restoreService');

// new Model(doc).toObject() + 정적 메서드 + native collection.insertOne 을 흉내내는 mock 모델
function makeModel() {
  const insertOneMock = jest.fn().mockResolvedValue({ acknowledged: true });
  const Model = jest.fn().mockImplementation(function (doc) {
    this._input = doc;
    // 실제 mongoose 는 캐스팅하지만 테스트에선 입력을 그대로 POJO 로 반환
    this.toObject = () => ({ ...doc });
  });
  Model.collection = { insertOne: insertOneMock };
  Model.findById = jest.fn();
  Model.findByIdAndUpdate = jest.fn().mockResolvedValue({});
  Model.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
  Model._insertOne = insertOneMock;
  return Model;
}

function freshStats() {
  return { errors: 0, dbErrors: 0, fileErrors: 0, errorDetails: [], skipped: 0 };
}

describe('#655 restoreOneDoc — native insert 로 저장 훅 우회(이중해싱 방지) + 원본 보존', () => {
  test('신규 문서: collection.insertOne 으로 저장, _id/createdAt/해시 비밀번호 원본 그대로', async () => {
    const Model = makeModel();
    Model.findById.mockResolvedValue(null);
    const stats = freshStats();

    const doc = {
      _id: 'id-1',
      title: 'x',
      createdAt: '2020-01-02T03:04:05.000Z',
      password: '$2b$10$AlreadyHashedValueeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    };
    const ok = await restoreOneDoc(doc, { name: 'User', model: Model }, { overwriteExisting: false }, stats);

    expect(ok).toBe(true);
    // native insert 사용 — mongoose save() 훅 미실행
    expect(Model._insertOne).toHaveBeenCalledTimes(1);
    const inserted = Model._insertOne.mock.calls[0][0];
    expect(inserted).toMatchObject({
      _id: 'id-1',
      createdAt: '2020-01-02T03:04:05.000Z',
      // 이미 해시된 비밀번호가 그대로 — 재해싱(이중해싱) 안 됨
      password: '$2b$10$AlreadyHashedValueeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    });
  });

  test('overwriteExisting: findByIdAndUpdate 에 timestamps:false, _id 제외', async () => {
    const Model = makeModel();
    const stats = freshStats();

    const doc = { _id: 'id-2', title: 'y', updatedAt: '2021-05-05T00:00:00.000Z' };
    await restoreOneDoc(doc, { name: 'Workboard', model: Model }, { overwriteExisting: true }, stats);

    expect(Model.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    const [id, update, opts] = Model.findByIdAndUpdate.mock.calls[0];
    expect(id).toBe('id-2');
    expect(update).not.toHaveProperty('_id');
    expect(update).toMatchObject({ title: 'y', updatedAt: '2021-05-05T00:00:00.000Z' });
    expect(opts).toMatchObject({ upsert: true, timestamps: false });
    expect(Model._insertOne).not.toHaveBeenCalled();
  });

  test('overwriteExisting=false 이고 이미 존재하면 skip (insert 안 함)', async () => {
    const Model = makeModel();
    Model.findById.mockResolvedValue({ _id: 'id-3' });
    const stats = freshStats();

    await restoreOneDoc({ _id: 'id-3' }, { name: 'User', model: Model }, { overwriteExisting: false }, stats);

    expect(stats.skipped).toBe(1);
    expect(Model._insertOne).not.toHaveBeenCalled();
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
    expect(Model._insertOne).toHaveBeenCalledTimes(1);
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
