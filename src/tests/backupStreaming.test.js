/**
 * #591 백업/복원 스트리밍 회귀 테스트
 * - writeCollectionNdjson: cursor → NDJSON 파일 (한 줄=문서 1개)
 * - restoreCollection: NDJSON 라인 스트리밍 + 구버전 .json 배열 fallback
 * DB 연결 없이 fake 모델로 검증.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { processDoc, writeCollectionNdjson } = require('../services/backupService');
const { restoreCollection } = require('../services/restoreService');

// fake mongoose cursor (async iterable + close)
function makeCursor(docs) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const d of docs) yield d;
    },
    close: async () => {}
  };
}

function makeBackupModel(docs) {
  return {
    find: () => ({ lean: () => ({ cursor: () => makeCursor(docs) }) })
  };
}

function makeRestoreModel() {
  const created = [];
  return {
    created,
    create: jest.fn(async (d) => { created.push(d); return d; }),
    findById: jest.fn(async () => null),
    findByIdAndUpdate: jest.fn(async () => ({}))
  };
}

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vcc-backup-test-'));
  fs.mkdirSync(path.join(tmpDir, 'database'), { recursive: true });
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('#591 processDoc', () => {
  test('sensitiveFields 는 제거된다', () => {
    const out = processDoc({ _id: '1', name: 'a', googleId: 'secret' }, { sensitiveFields: ['googleId'] });
    expect(out.googleId).toBeUndefined();
    expect(out.name).toBe('a');
  });

  test('규칙 없으면 그대로', () => {
    const doc = { _id: '1', x: 1 };
    expect(processDoc(doc, {})).toEqual(doc);
  });
});

describe('#591 writeCollectionNdjson', () => {
  test('cursor 의 모든 문서를 한 줄씩 기록하고 개수를 반환', async () => {
    const docs = [{ _id: '1', v: 'a' }, { _id: '2', v: 'b' }, { _id: '3', v: 'c' }];
    const outPath = path.join(tmpDir, 'database', 'Coll.ndjson');
    const count = await writeCollectionNdjson({ name: 'Coll', model: makeBackupModel(docs) }, outPath);

    expect(count).toBe(3);
    const lines = fs.readFileSync(outPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0])).toEqual(docs[0]);
    expect(JSON.parse(lines[2]).v).toBe('c');
  });

  test('빈 컬렉션은 0개, 빈 파일', async () => {
    const outPath = path.join(tmpDir, 'database', 'Empty.ndjson');
    const count = await writeCollectionNdjson({ name: 'Empty', model: makeBackupModel([]) }, outPath);
    expect(count).toBe(0);
    expect(fs.readFileSync(outPath, 'utf8')).toBe('');
  });

  test('sensitiveFields 가 기록물에서 빠진다', async () => {
    const outPath = path.join(tmpDir, 'database', 'User.ndjson');
    await writeCollectionNdjson(
      { name: 'User', model: makeBackupModel([{ _id: '1', email: 'a@b.c', googleId: 'g' }]), sensitiveFields: ['googleId'] },
      outPath
    );
    const doc = JSON.parse(fs.readFileSync(outPath, 'utf8').trim());
    expect(doc.googleId).toBeUndefined();
    expect(doc.email).toBe('a@b.c');
  });
});

describe('#591 restoreCollection', () => {
  const writeNdjson = (name, docs) =>
    fs.writeFileSync(path.join(tmpDir, 'database', `${name}.ndjson`), docs.map((d) => JSON.stringify(d)).join('\n') + '\n');

  test('NDJSON 라인을 스트리밍해 문서별로 복구', async () => {
    writeNdjson('Coll', [{ _id: '1', v: 'a' }, { _id: '2', v: 'b' }]);
    const model = makeRestoreModel();
    const stats = { collectionsRestored: {}, skipped: 0, errors: 0 };
    const count = await restoreCollection({ name: 'Coll', model }, tmpDir, {}, stats);

    expect(count).toBe(2);
    expect(model.create).toHaveBeenCalledTimes(2);
    expect(stats.errors).toBe(0);
    // _id 보존
    expect(model.created[0]._id).toBe('1');
  });

  test('빈 줄은 건너뛴다', async () => {
    fs.writeFileSync(path.join(tmpDir, 'database', 'Coll.ndjson'), `${JSON.stringify({ _id: '1' })}\n\n${JSON.stringify({ _id: '2' })}\n`);
    const model = makeRestoreModel();
    const stats = { collectionsRestored: {}, skipped: 0, errors: 0 };
    const count = await restoreCollection({ name: 'Coll', model }, tmpDir, {}, stats);
    expect(count).toBe(2);
    expect(model.create).toHaveBeenCalledTimes(2);
  });

  test('구버전 .json 배열도 복구된다 (하위호환)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'database', 'Legacy.json'), JSON.stringify([{ _id: '1' }, { _id: '2' }, { _id: '3' }]));
    const model = makeRestoreModel();
    const stats = { collectionsRestored: {}, skipped: 0, errors: 0 };
    const count = await restoreCollection({ name: 'Legacy', model }, tmpDir, {}, stats);
    expect(count).toBe(3);
    expect(model.create).toHaveBeenCalledTimes(3);
  });

  test('파일 없으면 null', async () => {
    const stats = { collectionsRestored: {}, skipped: 0, errors: 0 };
    const result = await restoreCollection({ name: 'Missing', model: makeRestoreModel() }, tmpDir, {}, stats);
    expect(result).toBeNull();
  });

  test('overwrite=false 에서 기존 문서는 skip', async () => {
    writeNdjson('Coll', [{ _id: '1' }]);
    const model = makeRestoreModel();
    model.findById = jest.fn(async () => ({ _id: '1' })); // 이미 존재
    const stats = { collectionsRestored: {}, skipped: 0, errors: 0 };
    await restoreCollection({ name: 'Coll', model }, tmpDir, { overwriteExisting: false }, stats);
    expect(model.create).not.toHaveBeenCalled();
    expect(stats.skipped).toBe(1);
  });

  test('깨진 JSON 라인은 errors 로 집계하고 계속', async () => {
    fs.writeFileSync(path.join(tmpDir, 'database', 'Coll.ndjson'), `${JSON.stringify({ _id: '1' })}\n{ broken json\n${JSON.stringify({ _id: '2' })}\n`);
    const model = makeRestoreModel();
    const stats = { collectionsRestored: {}, skipped: 0, errors: 0 };
    await restoreCollection({ name: 'Coll', model }, tmpDir, {}, stats);
    expect(model.create).toHaveBeenCalledTimes(2);
    expect(stats.errors).toBe(1);
  });
});
