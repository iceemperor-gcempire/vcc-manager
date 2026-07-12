// 메타데이터(베이스 모델 / LoRA) kind 별 API 어댑터 — 단일 소스 (#697).
// MetadataPickerModal(사용자 picker)과 MetadataManagementBody(admin 관리 화면)가
// 각자 들고 있던 KIND_ADAPTERS / ADAPTERS 를 통합한 슈퍼셋.
// - picker 전용: fetch 의 workboardId fallback / nsfwItemPreference / listLabel
// - admin 전용: resetSync / clearCache / extractTotal / extractMetaCount /
//   extractLastSync / cacheDialog* / emptyMessage / searchPlaceholder
import { serverAPI, workboardAPI } from '../services/api';
import { normalizeLora, normalizeModel } from './metadataItem';

export const METADATA_ADAPTERS = {
  lora: {
    // serverId 있으면 서버 경유 (workboardId 전달 시 backend 가 작업판의
    // loraExposurePolicy / loraWhitelist 적용, #198 Phase D).
    // serverId 없는 사용자 컨텍스트는 workboardAPI fallback.
    fetch: ({ serverId, workboardId, search, baseModel, page, limit }) => {
      if (serverId) {
        const params = { search, baseModel, page, limit };
        if (workboardId) params.workboardId = workboardId;
        return serverAPI.getLoras(serverId, params);
      }
      return workboardAPI.getLoraModels(workboardId);
    },
    // 동기화 버튼은 항상 forceRefresh — 기존 hash 는 재사용되고 civitai 메타만 새로 받음 (#335)
    sync: (serverId) => serverAPI.syncLoras(serverId, { forceRefresh: true }),
    getStatus: (serverId) => serverAPI.getLorasSyncStatus(serverId),
    resetSync: (serverId) => serverAPI.resetLorasSync(serverId),
    clearCache: (serverId) => serverAPI.clearLoraCache(serverId),
    extractList: (data) => data?.loraModels || [],
    extractPagination: (data) => data?.pagination || { current: 1, pages: 0, total: 0 },
    // fallback=true 는 workboardAPI 응답(캐시 정보가 최상위 필드) 경로 (picker 전용)
    extractCacheInfo: (data, fallback = false) => {
      if (fallback) {
        return {
          lastFetched: data?.lastFetched,
          lastCivitaiSync: data?.lastCivitaiSync,
          hashNodeAvailable: data?.loraInfoNodeAvailable,
        };
      }
      return data?.cacheInfo || null;
    },
    extractAvailableBaseModels: (data) => data?.availableBaseModels || null,
    extractTotal: (status, pagination) => status?.totalLoras || pagination?.total || 0,
    extractMetaCount: (status) => status?.lorasWithMetadata,
    extractLastSync: (info, status) => info?.lastCivitaiSync || status?.lastCivitaiSync,
    normalize: (raw) => normalizeLora(raw),
    label: 'LoRA',
    listLabel: 'LoRA',
    nsfwItemPreference: 'nsfwModelFilter', // 사용자 preferences key — NSFW 모델 (LoRA 포함) 숨김 (#346)
    nsfwItemLabel: 'NSFW 모델 숨기기',
    searchPlaceholder: 'LoRA 검색...',
    cacheDialogTitle: 'LoRA 캐시 완전 삭제',
    cacheDialogBody: '선택한 서버의 LoRA 캐시를 모두 비웁니다. 다음 동기화부터 hash 부터 재계산됩니다.',
    emptyMessage: 'LoRA 가 없습니다.',
  },
  model: {
    fetch: ({ serverId, workboardId, search, baseModel, allowedBaseModels, outputFormat, page, limit }) => {
      const params = { search, baseModel, page, limit };
      if (allowedBaseModels && allowedBaseModels.length > 0) {
        params.allowedBaseModels = allowedBaseModels;
      }
      // workboardId 전달 시 backend 가 작업판의 modelExposurePolicy / modelWhitelist 적용 (#198 Phase D)
      // 추가로 workboard.outputFormat 으로 provider outputFormats 자동 필터 (#354)
      if (workboardId) params.workboardId = workboardId;
      // outputFormat 명시 전달 — workboardId 없이 admin 페이지에서 작업판 폼의 값으로 호출하는 경우 (#354)
      if (outputFormat) params.outputFormat = outputFormat;
      return serverAPI.getDetailedModels(serverId, params);
    },
    sync: (serverId) => serverAPI.syncModels(serverId, { forceRefresh: true }),
    getStatus: (serverId) => serverAPI.getModelsSyncStatus(serverId),
    resetSync: (serverId) => serverAPI.resetModelsSync(serverId),
    clearCache: (serverId) => serverAPI.clearModelCache(serverId),
    extractList: (data) => data?.models || [],
    extractPagination: (data) => data?.pagination || { current: 1, pages: 0, total: 0 },
    extractCacheInfo: (data) => data?.cacheInfo || null,
    extractAvailableBaseModels: (data) => data?.availableBaseModels || null,
    extractTotal: (status, pagination) => status?.totalModels || pagination?.total || 0,
    extractMetaCount: (status) => status?.modelsWithMetadata,
    extractLastSync: (info, status) => info?.lastMetadataSync || status?.lastMetadataSync,
    normalize: (raw, serverType) => normalizeModel(raw, { serverType }),
    label: '베이스 모델',
    listLabel: '베이스 모델',
    nsfwItemPreference: 'nsfwModelFilter', // 베이스 모델에도 NSFW 모델 숨김 적용 (#346)
    nsfwItemLabel: 'NSFW 모델 숨기기',
    searchPlaceholder: '모델 검색...',
    cacheDialogTitle: '베이스 모델 캐시 완전 삭제',
    cacheDialogBody: '선택한 서버의 모델 캐시를 모두 비웁니다. 다음 동기화부터 hash 부터 재계산됩니다.',
    emptyMessage: '베이스 모델이 없습니다.',
  },
};
