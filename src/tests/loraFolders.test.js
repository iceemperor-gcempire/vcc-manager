/**
 * 작업판 LoRA 폴더 제한 (#1099)
 *
 * 태그 → 파일 풀이(LoRA 태그 로더와 같은 규칙), 실행 거절, LoRA 선택 목록 거름, 스키마 저장 형태,
 * 가져오기 비교·내보내기를 본다. 폴더 판정은 모델 폴더 제한(#1086)과 같은 함수(isInModelFolders)다 —
 * 목록과 실행 거절이 갈라지면 목록에 나온 LoRA 로 실행이 막히거나, 목록에 없는 LoRA 가 실행된다.
 */

jest.mock('../models/ServerLoraCache', () => ({ findOne: jest.fn() }));
jest.mock('../models/SystemSettings', () => ({ findOne: jest.fn() }));

const ServerLoraCache = require('../models/ServerLoraCache');
const loraMetadataService = require('../services/loraMetadataService');
const Workboard = require('../models/Workboard');
const { extractLoraTagNames, resolveLoraTag } = require('../utils/loraTags');
const { findLoraFolderViolation } = require('../services/loraFolderGuard');
const { normalizeModelFolders } = require('../utils/modelFolders');
const { diffWorkboard, UPDATABLE_FIELDS } = require('../utils/workboardDiff');
const { buildWorkboardExportEntry } = require('../utils/workboardExport');

// 이미지 서버 LoRA 목록 모양 — Windows ComfyUI 는 `\` 로 주고, 정렬된 목록이다
const FILES = [
  'optimizer\\qwen\\Qwen-Image-Lightning-4steps-V1.0.safetensors',
  'style\\IXL\\_style\\illustrious_flat_color_v2.safetensors',
  'style\\Krea2\\krea2_darkbrush.safetensors',
  'style\\ZImage\\AnimeLora3.safetensors',
  'style\\openmoss\\MOSS-Image-Anime-LoRA-ComfyUI.safetensors',
];

describe('extractLoraTagNames — 로더가 읽는 태그', () => {
  test('가중치·clip 가중치가 있어도 이름만', () => {
    expect(extractLoraTagNames('a cat <lora:MOSS-Image-Anime-LoRA-ComfyUI:1> and <lora:AnimeLora3:0.7:0>'))
      .toEqual(['MOSS-Image-Anime-LoRA-ComfyUI', 'AnimeLora3']);
  });

  test('lora 가 아닌 태그·이름이 빈 태그는 빼고, 가중치 없는 태그는 넣는다', () => {
    expect(extractLoraTagNames('<Picture 1> <hypernet:x:1> <lora::1> <lora:only>')).toEqual(['only']);
  });

  test('로더 태그 모양에 맞지 않는 문자(한글 등)가 든 것은 로더도 못 읽는다', () => {
    expect(extractLoraTagNames('<lora:고양이:1> <lora:a+b:1>')).toEqual([]);
  });

  test('경로가 든 이름도 그대로', () => {
    expect(extractLoraTagNames('<lora:style\\openmoss\\MOSS:1>')).toEqual(['style\\openmoss\\MOSS']);
  });

  test('비었거나 문자열이 아니면 빈 목록', () => {
    expect(extractLoraTagNames('')).toEqual([]);
    expect(extractLoraTagNames(undefined)).toEqual([]);
  });
});

describe('resolveLoraTag — 로더가 고를 파일', () => {
  test('파일 이름이 태그 이름으로 시작하는 파일 (Windows 경로)', () => {
    expect(resolveLoraTag('MOSS-Image-Anime-LoRA-ComfyUI', FILES)).toBe('style\\openmoss\\MOSS-Image-Anime-LoRA-ComfyUI.safetensors');
  });

  test('앞부분만 같아도 고른다 — 정렬 순서에서 첫 파일', () => {
    const files = ['b\\Anime_v2.safetensors', 'a\\Anime.safetensors'];
    expect(resolveLoraTag('Anime', files)).toBe('a\\Anime.safetensors');
  });

  test('경로로 적은 이름도 찾는다', () => {
    expect(resolveLoraTag('style\\Krea2\\krea2', FILES)).toBe('style\\Krea2\\krea2_darkbrush.safetensors');
  });

  test('대소문자를 가린다 — 로더와 같게', () => {
    expect(resolveLoraTag('moss-image-anime', FILES)).toBeNull();
  });

  test('없으면 null', () => {
    expect(resolveLoraTag('nothing', FILES)).toBeNull();
    expect(resolveLoraTag('', FILES)).toBeNull();
  });
});

describe('findLoraFolderViolation — 실행 거절', () => {
  beforeEach(() => jest.clearAllMocks());
  const wb = { serverId: 'srv', allowedLoraFolders: ['style/openmoss/'] };

  test('폴더 밖 LoRA 태그면 허용 폴더와 받은 파일을 알려 준다', async () => {
    const msg = await findLoraFolderViolation(wb, 'x <lora:AnimeLora3:1>', { loraFilenames: FILES });
    expect(msg).toContain('style/openmoss/');
    expect(msg).toContain('style\\ZImage\\AnimeLora3.safetensors');
  });

  test('폴더 안이면 통과', async () => {
    expect(await findLoraFolderViolation(wb, '<lora:MOSS-Image-Anime-LoRA-ComfyUI:1>', { loraFilenames: FILES })).toBeNull();
  });

  test('밖의 파일이 여럿이면 모두, 같은 파일은 한 번만', async () => {
    const msg = await findLoraFolderViolation(wb, '<lora:AnimeLora3:1> <lora:krea2:1> <lora:AnimeLora3:0.5>', { loraFilenames: FILES });
    expect(msg.match(/AnimeLora3/g)).toHaveLength(1);
    expect(msg).toContain('krea2_darkbrush');
  });

  test('목록에 없는 이름은 판단할 파일이 없어 막지 않는다', async () => {
    expect(await findLoraFolderViolation(wb, '<lora:not-synced-yet:1>', { loraFilenames: FILES })).toBeNull();
  });

  test('제한이 없거나 태그가 없으면 서버 LoRA 목록을 읽지도 않는다', async () => {
    expect(await findLoraFolderViolation({ ...wb, allowedLoraFolders: [] }, '<lora:AnimeLora3:1>')).toBeNull();
    expect(await findLoraFolderViolation(wb, '태그 없는 프롬프트')).toBeNull();
    expect(ServerLoraCache.findOne).not.toHaveBeenCalled();
  });

  test('목록을 안 주면 판의 서버 LoRA 캐시에서 읽는다 (populate 된 serverId 도)', async () => {
    const lean = jest.fn(async () => ({ loraModels: FILES.map((filename) => ({ filename })) }));
    ServerLoraCache.findOne.mockReturnValue({ select: () => ({ lean }) });
    const msg = await findLoraFolderViolation({ ...wb, serverId: { _id: 'srv-2' } }, '<lora:AnimeLora3:1>');
    expect(ServerLoraCache.findOne).toHaveBeenCalledWith({ serverId: 'srv-2' });
    expect(msg).toContain('AnimeLora3');
  });

  test('목록 거름과 같은 판정을 쓴다', async () => {
    ServerLoraCache.findOne.mockResolvedValue({ status: 'ready', loraModels: FILES.map((filename) => ({ filename, civitai: {} })) });
    const r = await loraMetadataService.searchServerLoras('srv', { allowedFolders: ['style/openmoss/'] });
    for (const lora of r.loraModels) {
      const name = lora.filename.split('\\').pop().replace(/\.safetensors$/, '');
      // eslint-disable-next-line no-await-in-loop
      expect(await findLoraFolderViolation(wb, `<lora:${name}:1>`, { loraFilenames: FILES })).toBeNull();
    }
  });
});

describe('searchServerLoras — allowedFolders', () => {
  beforeEach(() => jest.clearAllMocks());

  const cache = {
    status: 'ready',
    loraModels: [
      { filename: 'style\\IXL\\_style\\illustrious_flat_color_v2.safetensors', civitai: { found: true, baseModel: 'Illustrious' } },
      { filename: 'style\\ZImage\\AnimeLora3.safetensors', civitai: { found: true, baseModel: 'ZImageTurbo' } },
      { filename: 'style\\openmoss\\MOSS-Image-Anime-LoRA-ComfyUI.safetensors', civitai: { found: false } },
    ],
  };

  test('폴더 안의 LoRA 만 — Civitai 정보가 없는 파일도 남는다', async () => {
    ServerLoraCache.findOne.mockResolvedValue(cache);
    const r = await loraMetadataService.searchServerLoras('srv', { allowedFolders: ['style/openmoss/'] });
    expect(r.loraModels.map((l) => l.filename)).toEqual(['style\\openmoss\\MOSS-Image-Anime-LoRA-ComfyUI.safetensors']);
  });

  test('노출 목록과 겹쳐 적용된다 (AND)', async () => {
    ServerLoraCache.findOne.mockResolvedValue(cache);
    const r = await loraMetadataService.searchServerLoras('srv', {
      allowedFolders: ['style/'], whitelist: ['style\\ZImage\\AnimeLora3.safetensors'],
    });
    expect(r.loraModels.map((l) => l.filename)).toEqual(['style\\ZImage\\AnimeLora3.safetensors']);
  });

  test('폴더 후보는 거름 전 전체에서, 기본 모델 드롭다운은 폴더 거름 뒤에서 뽑는다', async () => {
    ServerLoraCache.findOne.mockResolvedValue(cache);
    const r = await loraMetadataService.searchServerLoras('srv', { allowedFolders: ['style/ZImage/'] });
    expect(r.availableFolders).toEqual(['style/', 'style/IXL/', 'style/IXL/_style/', 'style/openmoss/', 'style/ZImage/']);
    expect(r.availableBaseModels).toEqual(['ZImageTurbo']);
  });

  test('제한이 없으면 예전과 같다', async () => {
    ServerLoraCache.findOne.mockResolvedValue(cache);
    const r = await loraMetadataService.searchServerLoras('srv', {});
    expect(r.loraModels).toHaveLength(3);
    expect(r.availableBaseModels).toEqual(['Illustrious', 'ZImageTurbo']);
  });

  test('캐시가 없으면 폴더 후보도 비어 있다', async () => {
    ServerLoraCache.findOne.mockResolvedValue(null);
    const r = await loraMetadataService.searchServerLoras('srv', { allowedFolders: ['style/openmoss/'] });
    expect(r.availableFolders).toEqual([]);
  });
});

describe('Workboard 스키마', () => {
  test('모델 폴더와 같은 저장 형태로 정규화한다', () => {
    const wb = new Workboard({ name: 't', allowedLoraFolders: ['style\\openmoss', 'Style/OpenMOSS/', 'optimizer/openmoss'] });
    expect([...wb.allowedLoraFolders]).toEqual(['style/openmoss/', 'optimizer/openmoss/']);
  });

  test('기본값은 빈 목록', () => {
    expect([...new Workboard({ name: 't' }).allowedLoraFolders]).toEqual([]);
  });

  test('오류 문구는 LoRA 폴더로', () => {
    expect(normalizeModelFolders('style/', { label: 'LoRA 폴더' }).errors).toEqual(['LoRA 폴더는 목록이어야 합니다.']);
    expect(normalizeModelFolders('qwen/').errors).toEqual(['모델 폴더는 목록이어야 합니다.']);
  });
});

describe('가져오기 비교·내보내기', () => {
  const base = { description: '', outputFormat: 'image', workboardType: 'image', additionalInputFields: [], workflowData: '{}' };

  test('정규화하면 같은 값은 바뀐 것으로 보지 않는다', () => {
    const d = diffWorkboard({ ...base, allowedLoraFolders: ['style/openmoss/'] }, { ...base, allowedLoraFolders: ['style\\openmoss'] });
    expect(d.changes.filter((c) => c.target === 'allowedLoraFolders')).toEqual([]);
  });

  test('바뀌면 policy 변경으로, 경고 없이 기록한다', () => {
    const d = diffWorkboard({ ...base, allowedLoraFolders: [] }, { ...base, allowedLoraFolders: ['style/openmoss/'] });
    expect(d.changes).toContainEqual({ kind: 'policy', target: 'allowedLoraFolders', detail: '(없음) → style/openmoss/' });
    expect(d.warnings).toEqual([]);
  });

  test('설정이 없는 옛 export 는 비교하지 않는다 — 갱신 때도 덮어쓰지 않으므로', () => {
    const d = diffWorkboard({ ...base, allowedLoraFolders: ['style/openmoss/'] }, { ...base });
    expect(d.changes.filter((c) => c.target === 'allowedLoraFolders')).toEqual([]);
  });

  test('갱신 모드가 덮어쓰고, 내보내기에 들어간다', () => {
    expect(UPDATABLE_FIELDS).toContain('allowedLoraFolders');
    const entry = buildWorkboardExportEntry({ ...base, name: 'n', allowedLoraFolders: ['style/openmoss/'] }, null);
    expect(entry.workboard.allowedLoraFolders).toEqual(['style/openmoss/']);
  });
});
