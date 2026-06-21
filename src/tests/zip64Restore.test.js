/**
 * #643 ZIP64/대용량 복원 — safeExtractPath(zip-slip 방어) + extractMetadata(Open.file) 테스트
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const archiver = require('archiver');

const { safeExtractPath, extractMetadata } = require('../services/restoreService');

describe('#643 safeExtractPath (zip-slip 방어)', () => {
  const base = '/tmp/restore-xyz';
  test('정상 entry → 기준 디렉토리 하위 절대경로', () => {
    expect(safeExtractPath(base, 'database/User.ndjson')).toBe(path.resolve(base, 'database/User.ndjson'));
    expect(safeExtractPath(base, 'metadata.json')).toBe(path.resolve(base, 'metadata.json'));
  });
  test('상위 탈출(../) 차단 → null', () => {
    expect(safeExtractPath(base, '../evil.sh')).toBeNull();
    expect(safeExtractPath(base, '../../etc/passwd')).toBeNull();
    expect(safeExtractPath(base, 'database/../../x')).toBeNull();
  });
  test('절대경로 entry 차단', () => {
    expect(safeExtractPath(base, '/etc/passwd')).toBeNull();
  });
});

describe('#643 extractMetadata (Open.file)', () => {
  let tmpZip;
  beforeAll(async () => {
    tmpZip = path.join(os.tmpdir(), `meta-test-${process.pid}.zip`);
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(tmpZip);
      const archive = archiver('zip', { zlib: { level: 0 } });
      out.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(out);
      archive.append(JSON.stringify({ version: '1.0', collections: { User: 3 } }), { name: 'metadata.json' });
      archive.append('{"_id":"1"}\n', { name: 'database/User.ndjson' });
      archive.finalize();
    });
  });
  afterAll(() => { try { fs.unlinkSync(tmpZip); } catch { /* noop */ } });

  test('metadata.json 을 읽어 파싱', async () => {
    const meta = await extractMetadata(tmpZip);
    expect(meta.version).toBe('1.0');
    expect(meta.collections.User).toBe(3);
  });

  test('metadata 없는 zip 은 throw', async () => {
    const noMeta = path.join(os.tmpdir(), `nometa-${process.pid}.zip`);
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(noMeta);
      const archive = archiver('zip');
      out.on('close', resolve); archive.on('error', reject);
      archive.pipe(out);
      archive.append('x', { name: 'other.txt' });
      archive.finalize();
    });
    await expect(extractMetadata(noMeta)).rejects.toThrow(/metadata/);
    fs.unlinkSync(noMeta);
  });
});
