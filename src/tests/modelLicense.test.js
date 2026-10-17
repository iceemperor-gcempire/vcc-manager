/**
 * 모델 라이선스 (#1073) — 붙일 경로 정규화, 모델 파일의 라이선스 판정, 프런트 mirror, 백업 대상.
 */
const fs = require('fs');
const path = require('path');
const {
  COMMERCIAL_USE, MODEL_LICENSE_LIMITS, normalizeLicenseTarget, resolveModelLicense,
} = require('../constants/modelLicense');

describe('normalizeLicenseTarget', () => {
  test('Windows 구분자는 / 로, 끝의 / 는 폴더 표시로 남긴다', () => {
    expect(normalizeLicenseTarget('minimax\\')).toEqual({ match: 'minimax/', error: null });
    expect(normalizeLicenseTarget('  Krea2\\krea2_raw.safetensors ')).toEqual({ match: 'Krea2/krea2_raw.safetensors', error: null });
    expect(normalizeLicenseTarget('./qwen//sub/')).toEqual({ match: 'qwen/sub/', error: null });
  });

  test.each([
    ['', '빈'],
    ['/', '빈'],
    ['/abs/model.safetensors', '절대'],
    ['G:\\AI\\models\\x.safetensors', '절대'],
    ['minimax/../secret', '..'],
    [42, '문자열'],
  ])('%p 은 받지 않는다', (raw, word) => {
    const r = normalizeLicenseTarget(raw);
    expect(r.match).toBeNull();
    expect(r.error).toContain(word);
  });

  test('길이 상한', () => {
    expect(normalizeLicenseTarget('a'.repeat(MODEL_LICENSE_LIMITS.target + 1)).error).toContain('자 이내');
  });
});

describe('resolveModelLicense', () => {
  const H3 = { _id: 'l1', name: 'MiniMax H3 Community License', url: 'https://example.com/h3', commercialUse: 'conditional', note: '', targets: [{ match: 'minimax/' }] };
  const KREA = { _id: 'l2', name: 'Krea 2 Community License', commercialUse: 'prohibited', targets: [{ match: 'Krea2/' }, { match: 'krea2_turbo.safetensors' }] };
  const SPECIAL = { _id: 'l3', name: '별도 계약', commercialUse: 'allowed', targets: [{ match: 'minimax/minimax_h3_fl2va_int8_convrot.safetensors' }] };
  const DEEP = { _id: 'l4', name: '하위 폴더', commercialUse: 'allowed', targets: [{ match: 'minimax/experimental/' }] };
  const all = [H3, KREA, SPECIAL, DEEP];

  test('폴더에 붙인 라이선스는 그 아래 파일 전부 — Windows 구분자·대소문자를 가리지 않는다', () => {
    const r = resolveModelLicense('MiniMax\\minimax_h3_ref2va_int8_convrot.safetensors', all);
    expect(r).toEqual({ licenseId: 'l1', name: 'MiniMax H3 Community License', url: 'https://example.com/h3', commercialUse: 'conditional', note: '', matchedBy: 'folder', target: 'minimax/' });
  });

  test('파일로 붙인 것이 폴더보다 우선한다', () => {
    expect(resolveModelLicense('minimax\\minimax_h3_fl2va_int8_convrot.safetensors', all)).toMatchObject({ licenseId: 'l3', matchedBy: 'file' });
  });

  test('깊은 폴더가 얕은 폴더보다 우선한다', () => {
    expect(resolveModelLicense('minimax/experimental/x.safetensors', all)).toMatchObject({ licenseId: 'l4', matchedBy: 'folder' });
  });

  test('폴더 밖 파일은 하나씩 붙인 것만', () => {
    expect(resolveModelLicense('krea2_turbo.safetensors', all)).toMatchObject({ licenseId: 'l2', matchedBy: 'file' });
    expect(resolveModelLicense('krea2_raw.safetensors', all)).toBeNull();
  });

  test('폴더 이름이 앞부분만 같으면 붙지 않는다 (minimax/ 는 minimax2/ 가 아니다)', () => {
    expect(resolveModelLicense('minimax2/model.safetensors', all)).toBeNull();
  });

  test('파일 대상은 접두사로 쓰지 않는다', () => {
    expect(resolveModelLicense('krea2_turbo.safetensors.bak', all)).toBeNull();
  });

  test('붙은 게 없거나 입력이 비면 null', () => {
    expect(resolveModelLicense('sdxl/model.safetensors', all)).toBeNull();
    expect(resolveModelLicense('', all)).toBeNull();
    expect(resolveModelLicense('x.safetensors', undefined)).toBeNull();
  });
});

describe('프런트 mirror (frontend/src/constants/modelLicense.js)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../frontend/src/constants/modelLicense.js'), 'utf8');

  test('상업적 이용 값 목록이 같다', () => {
    const m = src.match(/COMMERCIAL_USE\s*=\s*\[([^\]]*)\]/);
    expect(m).toBeTruthy();
    expect(m[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1))).toEqual(COMMERCIAL_USE);
  });

  test('값마다 화면 문구가 있다', () => {
    for (const v of COMMERCIAL_USE) expect(src).toMatch(new RegExp(`\\b${v}: '[^']+'`));
  });

  test.each(Object.entries(MODEL_LICENSE_LIMITS))('길이 상한 %s 가 같다', (key, value) => {
    expect(src).toMatch(new RegExp(`\\b${key}: ${value},`));
  });
});

test('백업 대상이다 — 모델 목록 캐시와 달리 동기화로 다시 만들 수 없다', () => {
  const { BACKUP_COLLECTIONS, CACHE_COLLECTIONS } = require('../services/backupCollections'); // eslint-disable-line global-require
  expect(BACKUP_COLLECTIONS.map((c) => c.name)).toContain('ModelLicense');
  expect(CACHE_COLLECTIONS.map((c) => c.name)).not.toContain('ModelLicense');
});
