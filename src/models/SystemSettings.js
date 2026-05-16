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
    // Civitai API 키 (암호화 저장 권장)
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
    settings.lora.civitaiApiKey = updates.civitaiApiKey || null;
  }

  await settings.save();
  return settings;
};

/**
 * Civitai API 키 조회
 */
systemSettingsSchema.statics.getCivitaiApiKey = async function() {
  const settings = await this.getGlobal();
  return settings.lora.civitaiApiKey || process.env.CIVITAI_API_KEY || null;
};

/**
 * NSFW 필터 설정 조회
 */
systemSettingsSchema.statics.getNsfwFilter = async function() {
  const settings = await this.getGlobal();
  return settings.lora.nsfwFilter;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
