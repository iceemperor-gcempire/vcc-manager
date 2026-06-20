/**
 * #631 복원 오류 관측성 — recordError 로직 테스트
 */
const { recordError } = require('../services/restoreService');

function freshStats() {
  return { errors: 0, dbErrors: 0, fileErrors: 0, errorDetails: [] };
}

test('db 오류는 dbErrors + errors 증가, 상세 기록', () => {
  const s = freshStats();
  recordError(s, { type: 'db', collection: 'Workboard', docId: 'abc', message: 'dup key' });
  expect(s.errors).toBe(1);
  expect(s.dbErrors).toBe(1);
  expect(s.fileErrors).toBe(0);
  expect(s.errorDetails[0]).toMatchObject({ type: 'db', collection: 'Workboard', docId: 'abc', message: 'dup key' });
});

test('file 오류는 fileErrors + errors 증가, 상세 기록', () => {
  const s = freshStats();
  recordError(s, { type: 'file', dir: 'generated', file: 'x.png', message: 'EISDIR' });
  expect(s.errors).toBe(1);
  expect(s.fileErrors).toBe(1);
  expect(s.dbErrors).toBe(0);
  expect(s.errorDetails[0]).toMatchObject({ type: 'file', dir: 'generated', file: 'x.png' });
});

test('db/file 혼합 카운트', () => {
  const s = freshStats();
  recordError(s, { type: 'db', collection: 'A', message: 'e' });
  recordError(s, { type: 'file', dir: 'reference', file: 'y', message: 'e' });
  recordError(s, { type: 'db', collection: 'B', message: 'e' });
  expect(s.errors).toBe(3);
  expect(s.dbErrors).toBe(2);
  expect(s.fileErrors).toBe(1);
  expect(s.errorDetails).toHaveLength(3);
});

test('errorDetails 는 100개 상한, 초과분은 카운트만', () => {
  const s = freshStats();
  for (let i = 0; i < 130; i++) recordError(s, { type: 'db', collection: 'C', docId: String(i), message: 'e' });
  expect(s.errors).toBe(130);      // 카운트는 전부
  expect(s.dbErrors).toBe(130);
  expect(s.errorDetails).toHaveLength(100); // 상세는 상한까지만
});
