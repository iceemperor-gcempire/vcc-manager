const mongoose = require('mongoose');

/**
 * 시스템 전역 설정 모델
 * 단일 문서로 관리 (key: 'global')
 */
const systemSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'global'
  },
  lora: {
    // NSFW 이미지 필터링 설정
    nsfwFilter: {
      type: Boolean,
      default: true
    },
    // NSFW 모델 (베이스 모델 / LoRA) 필터링 설정 (#339)
    // 이전 이름: nsfwLoraFilter (legacy fallback 으로 읽음)
    nsfwModelFilter: {
      type: Boolean,
      default: true
    },
    // legacy field — #339 이전. nsfwModelFilter 로 마이그레이션 후 제거 예정
    nsfwLoraFilter: {
      type: Boolean,
      default: true
    },
    // legacy field — #293 Phase B 에서 settings.external.civitaiApiKey 로 이전.
    // 마이그레이션 후에도 fallback 으로 유지하다가 후속 cleanup 에서 제거.
    civitaiApiKey: {
      type: String,
      default: null
    }
  },
  // 외부 서비스 통합 설정 (#293 Phase B) — Civitai 등 외부 API.
  // 베이스 모델 / LoRA 양쪽 서비스가 공유 사용.
  external: {
    civitaiApiKey: {
      type: String,
      default: null
    }
  }
}, {
  timestamps: true
});

/**
 * 전역 설정 조회 또는 생성
 */
systemSettingsSchema.statics.getGlobal = async function() {
  let settings = await this.findOne({ key: 'global' });
  if (!settings) {
    settings = new this({ key: 'global' });
    await settings.save();
  }
  return settings;
};

/**
 * LoRA 설정 업데이트
 */
systemSettingsSchema.statics.updateLoraSettings = async function(updates) {
  const settings = await this.getGlobal();

  if (updates.nsfwFilter !== undefined) {
    settings.lora.nsfwFilter = updates.nsfwFilter;
  }
  if (updates.nsfwModelFilter !== undefined) {
    settings.lora.nsfwModelFilter = updates.nsfwModelFilter;
    // legacy 필드도 동시 갱신 (다른 곳에서 아직 읽을 가능성 대비)
    settings.lora.nsfwLoraFilter = updates.nsfwModelFilter;
  }
  if (updates.nsfwLoraFilter !== undefined) {
    settings.lora.nsfwLoraFilter = updates.nsfwLoraFilter;
  }
  if (updates.civitaiApiKey !== undefined) {
    // #293 Phase B — 새 위치 우선, legacy 도 동기 갱신 (다른 코드 fallback 대비)
    const v = updates.civitaiApiKey || null;
    settings.external.civitaiApiKey = v;
    settings.lora.civitaiApiKey = v;
  }

  await settings.save();
  return settings;
};

/**
 * Civitai API 키 조회 — settings.external.civitaiApiKey 우선, legacy settings.lora.civitaiApiKey
 * fallback, 마지막으로 환경변수 (#293 Phase B)
 */
systemSettingsSchema.statics.getCivitaiApiKey = async function() {
  const settings = await this.getGlobal();
  return (
    settings.external?.civitaiApiKey ||
    settings.lora?.civitaiApiKey ||
    process.env.CIVITAI_API_KEY ||
    null
  );
};

/**
 * NSFW 필터 설정 조회
 */
systemSettingsSchema.statics.getNsfwFilter = async function() {
  const settings = await this.getGlobal();
  return settings.lora.nsfwFilter;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
