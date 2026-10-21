/**
 * 작업판 모델 폴더 제한 (#1086)
 *
 * 폴더 정규화·판정, 스키마 저장 형태, 모델 선택 목록 거름, 실행 거절, 가져오기 비교를 본다.
 * 선택 목록과 실행 거절이 같은 판정(isInModelFolders)을 쓰는지가 핵심이다 — 갈라지면 목록에
 * 나온 모델로 실행이 막히거나, 목록에 없는 모델이 실행된다.
 */

jest.mock('../models/ServerModelCache', () => ({ findOne: jest.fn() }));
jest.mock('../models/SystemSettings', () => ({ findOne: jest.fn() }));

const ServerModelCache = require('../models/ServerModelCache');
const modelMetadataService = require('../services/modelMetadataService');
const Workboard = require('../models/Workboard');
const {
  normalizeModelFolder, normalizeModelFolders, isInModelFolders, foldersOfModels, MODEL_FOLDER_LIMITS,
} = require('../utils/modelFolders');
const { findModelFolderViolation } = require('../services/modelFolderGuard');
const { diffWorkboard, UPDATABLE_FIELDS } = require('../utils/workboardDiff');
const { buildWorkboardExportEntry } = require('../utils/workboardExport');

describe('normalizeModelFolder', () => {
  test.each([
    ['qwen', 'qwen/'],
    ['qwen\\', 'qwen/'],
    ['  Krea2/ ', 'Krea2/'],
    ['./minimax//h3', 'minimax/h3/'],
  ])('%p → %p', (raw, folder) => {
    expect(normalizeModelFolder(raw)).toEqual({ folder, error: null });
  });

  test.each([
    ['', '빈'],
    ['/', '빈'],
    ['/abs/models', '절대'],
    ['G:\\AI\\models', '절대'],
    ['qwen/../secret', '..'],
    [42, '문자열'],
  ])('%p 은 받지 않는다', (raw, word) => {
    const r = normalizeModelFolder(raw);
    expect(r.folder).toBeNull();
    expect(r.error).toContain(word);
  });

  test('목록 — 대소문자·구분자만 다른 폴더는 하나로', () => {
    expect(normalizeModelFolders(['qwen\\', 'Qwen/', 'openmoss'])).toEqual({ folders: ['qwen/', 'openmoss/'], errors: [] });
    expect(normalizeModelFolders(undefined)).toEqual({ folders: [], errors: [] });
    expect(normalizeModelFolders('qwen').errors).toHaveLength(1);
    const many = Array.from({ length: MODEL_FOLDER_LIMITS.count + 1 }, (_, i) => `f${i}`);
    expect(normalizeModelFolders(many).errors[0]).toContain(`${MODEL_FOLDER_LIMITS.count}개`);
  });
});

describe('isInModelFolders', () => {
  test('Windows 경로·대소문자를 가리지 않고, 하위 폴더도 포함한다', () => {
    expect(isInModelFolders('qwen\\qwen_image_2.1_int8_convrot.safetensors', ['qwen/'])).toBe(true);
    expect(isInModelFolders('QWEN/sub/x.safetensors', ['qwen/'])).toBe(true);
    expect(isInModelFolders('Z-Image\\z_image_turbo_bf16.safetensors', ['qwen/'])).toBe(false);
  });

  test('폴더 이름이 앞부분만 같은 다른 폴더는 밖이다', () => {
    expect(isInModelFolders('qwen2\\x.safetensors', ['qwen/'])).toBe(false);
    expect(isInModelFolders('qwen2\\x.safetensors', ['qwen'])).toBe(false); // 끝 `/` 없이 저장된 옛 값
  });

  test('목록이 비면 제약 없음, 파일이 비면 밖', () => {
    expect(isInModelFolders('anything.safetensors', [])).toBe(true);
    expect(isInModelFolders('anything.safetensors', undefined)).toBe(true);
    expect(isInModelFolders('', ['qwen/'])).toBe(false);
  });

  test('foldersOfModels — 하위 폴더도 후보, 루트 파일은 후보 없음', () => {
    expect(foldersOfModels(['qwen\\a.safetensors', 'Krea2\\b.safetensors', 'minimax\\h3\\c.safetensors', 'root.safetensors']))
      .toEqual(['Krea2/', 'minimax/', 'minimax/h3/', 'qwen/']);
  });
});

describe('Workboard 스키마', () => {
  test('저장 형태로 정규화한다', () => {
    const wb = new Workboard({ name: 't', allowedModelFolders: ['qwen\\', 'Qwen/', 'Krea2'] });
    expect([...wb.allowedModelFolders]).toEqual(['qwen/', 'Krea2/']);
  });

  test('기본값은 빈 목록', () => {
    expect([...new Workboard({ name: 't' }).allowedModelFolders]).toEqual([]);
  });
});

describe('searchServerModels — allowedFolders', () => {
  beforeEach(() => jest.clearAllMocks());

  const cache = {
    status: 'ready', lastFetched: null, lastMetadataSync: null, hashNodeAvailable: false,
    models: [
      { filename: 'qwen\\qwen_image_2.1_int8_convrot.safetensors', source: 'diffusion_models', civitai: { found: false } },
      { filename: 'Z-Image\\z_image_turbo_bf16.safetensors', source: 'diffusion_models', civitai: { found: true, baseModel: 'ZImageTurbo' } },
      { filename: 'Krea2\\krea2_turbo_int8_convrot.safetensors', source: 'diffusion_models', civitai: { found: false } },
      { filename: 'Krea2\\moodyKrea2Mix_v70.safetensors', source: 'diffusion_models', civitai: { found: true, baseModel: 'Krea 2' } },
      { filename: 'IXL\\wai.safetensors', source: 'checkpoints', civitai: { found: true, baseModel: 'Illustrious' } },
    ],
  };

  test('폴더 안의 모델만 — Civitai 정보가 없는 파일도 남는다', async () => {
    ServerModelCache.findOne.mockResolvedValue(cache);
    const r = await modelMetadataService.searchServerModels('srv', { allowedFolders: ['qwen/'] });
    expect(r.models.map((m) => m.filename)).toEqual(['qwen\\qwen_image_2.1_int8_convrot.safetensors']);
  });

  test('모델 종류 제한과 겹쳐 적용된다 (AND)', async () => {
    ServerModelCache.findOne.mockResolvedValue(cache);
    const r = await modelMetadataService.searchServerModels('srv', { allowedFolders: ['Krea2/'], allowedBaseModels: ['Krea 2'] });
    expect(r.models.map((m) => m.filename)).toEqual(['Krea2\\moodyKrea2Mix_v70.safetensors']);
  });

  test('폴더 후보는 로더 폴더로 좁힌 뒤, 다른 거름 전에 뽑는다', async () => {
    ServerModelCache.findOne.mockResolvedValue(cache);
    const r = await modelMetadataService.searchServerModels('srv', { source: 'diffusion_models', allowedFolders: ['qwen/'] });
    expect(r.availableFolders).toEqual(['Krea2/', 'qwen/', 'Z-Image/']);
  });

  test('캐시가 없으면 폴더 후보도 비어 있다', async () => {
    ServerModelCache.findOne.mockResolvedValue(null);
    const r = await modelMetadataService.searchServerModels('srv', { allowedFolders: ['qwen/'] });
    expect(r.availableFolders).toEqual([]);
  });
});

describe('findModelFolderViolation — 실행 거절', () => {
  const wb = {
    allowedModelFolders: ['qwen/'],
    additionalInputFields: [{ name: 'base_model', type: 'baseModel' }],
  };

  test('폴더 밖이면 허용 폴더와 받은 값을 알려 준다', () => {
    const msg = findModelFolderViolation(wb, { additionalParams: { base_model: 'Z-Image\\pornmasterZImage_turboV01.safetensors' } });
    expect(msg).toContain('qwen/');
    expect(msg).toContain('Z-Image\\pornmasterZImage_turboV01.safetensors');
  });

  test('폴더 안이면 통과 — {key,value} 객체 값도', () => {
    expect(findModelFolderViolation(wb, { additionalParams: { base_model: 'qwen\\qwen_image_2.1_int8_convrot.safetensors' } })).toBeNull();
    expect(findModelFolderViolation(wb, { additionalParams: { base_model: { key: 'q', value: 'qwen/x.safetensors' } } })).toBeNull();
  });

  test('워크플로에 들어갈 필드 값을 본다 — aiModel 만 맞고 필드 값이 밖이면 막는다', () => {
    const input = { aiModel: 'qwen\\ok.safetensors', additionalParams: { base_model: 'Z-Image\\bad.safetensors' } };
    expect(findModelFolderViolation(wb, input)).toContain('Z-Image\\bad.safetensors');
  });

  test('제한이 없거나, 베이스 모델 필드가 없거나, 값이 비면 여기서 막지 않는다', () => {
    expect(findModelFolderViolation({ ...wb, allowedModelFolders: [] }, { additionalParams: { base_model: 'x/y' } })).toBeNull();
    expect(findModelFolderViolation({ ...wb, additionalInputFields: [] }, { additionalParams: { base_model: 'x/y' } })).toBeNull();
    expect(findModelFolderViolation(wb, { additionalParams: {} })).toBeNull();
  });

  test('목록 거름과 같은 판정을 쓴다', async () => {
    ServerModelCache.findOne.mockResolvedValue({
      status: 'ready',
      models: [{ filename: 'qwen\\a.safetensors' }, { filename: 'qwen2\\b.safetensors' }, { filename: 'QWEN/sub/c.safetensors' }],
    });
    const listed = (await modelMetadataService.searchServerModels('srv', { allowedFolders: wb.allowedModelFolders })).models.map((m) => m.filename);
    for (const filename of ['qwen\\a.safetensors', 'qwen2\\b.safetensors', 'QWEN/sub/c.safetensors']) {
      const accepted = findModelFolderViolation(wb, { additionalParams: { base_model: filename } }) === null;
      expect(accepted).toBe(listed.includes(filename));
    }
  });
});

describe('가져오기 비교·내보내기', () => {
  const base = { description: '', outputFormat: 'image', workboardType: 'image', additionalInputFields: [], workflowData: '{}' };

  test('정규화하면 같은 값은 바뀐 것으로 보지 않는다', () => {
    const d = diffWorkboard({ ...base, allowedModelFolders: ['qwen/'] }, { ...base, allowedModelFolders: ['qwen\\'] });
    expect(d.changes.filter((c) => c.target === 'allowedModelFolders')).toEqual([]);
  });

  test('바뀌면 policy 변경으로, 경고 없이 기록한다', () => {
    const d = diffWorkboard({ ...base, allowedModelFolders: [] }, { ...base, allowedModelFolders: ['qwen/'] });
    expect(d.changes).toContainEqual({ kind: 'policy', target: 'allowedModelFolders', detail: '(없음) → qwen/' });
    expect(d.warnings).toEqual([]);
  });

  test('설정이 없는 옛 export 는 비교하지 않는다 — 갱신 때도 덮어쓰지 않으므로', () => {
    const d = diffWorkboard({ ...base, allowedModelFolders: ['qwen/'] }, { ...base });
    expect(d.changes.filter((c) => c.target === 'allowedModelFolders')).toEqual([]);
  });

  test('갱신 모드가 덮어쓰고, 내보내기에 들어간다', () => {
    expect(UPDATABLE_FIELDS).toContain('allowedModelFolders');
    const entry = buildWorkboardExportEntry({ ...base, name: 'n', allowedModelFolders: ['qwen/'] }, null);
    expect(entry.workboard.allowedModelFolders).toEqual(['qwen/']);
  });
});
