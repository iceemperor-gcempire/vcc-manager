/**
 * #650 복원 완료 후 정리 — 캐시 컬렉션 구성 + 큐 정리 안전성
 */
const { BACKUP_COLLECTIONS, CACHE_COLLECTIONS } = require('../services/backupCollections');
const queueService = require('../services/queueService');
const pipelineRunService = require('../services/pipelineRunService');

describe('#650 CACHE_COLLECTIONS', () => {
  test('3개 캐시 모델(LoraCache/ServerLoraCache/ServerModelCache), name/model 보유', () => {
    expect(CACHE_COLLECTIONS.map((c) => c.name).sort()).toEqual(['LoraCache', 'ServerLoraCache', 'ServerModelCache']);
    CACHE_COLLECTIONS.forEach((c) => {
      expect(c.model).toBeTruthy();
      expect(typeof c.model.deleteMany).toBe('function');
    });
  });

  test('백업 대상(BACKUP_COLLECTIONS)과 겹치지 않음 (캐시는 백업 비대상)', () => {
    const backupNames = new Set(BACKUP_COLLECTIONS.map((c) => c.name));
    CACHE_COLLECTIONS.forEach((c) => expect(backupNames.has(c.name)).toBe(false));
  });
});

describe('#650 복원 후 큐 정리 (미초기화 시 안전)', () => {
  test('clearImageGenerationQueue 는 큐 미초기화 상태에서 던지지 않고 cleared:false', async () => {
    const r = await queueService.clearImageGenerationQueue();
    expect(r.cleared).toBe(false);
  });

  test('clearPipelineRunQueue 는 큐 미초기화 상태에서 던지지 않고 cleared:false', async () => {
    const r = await pipelineRunService.clearPipelineRunQueue();
    expect(r.cleared).toBe(false);
  });
});
