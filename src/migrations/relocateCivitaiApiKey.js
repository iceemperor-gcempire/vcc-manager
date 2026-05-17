const SystemSettings = require('../models/SystemSettings');

// #293 Phase B: settings.lora.civitaiApiKey → settings.external.civitaiApiKey 이전.
// 멱등 — external.civitaiApiKey 가 비어있고 lora.civitaiApiKey 가 설정돼 있을 때만 복사.
// 이후엔 lora 위치는 fallback 으로만 읽힘 (SystemSettings.getCivitaiApiKey 참고).
async function relocateCivitaiApiKey() {
  try {
    const settings = await SystemSettings.findOne({ key: 'global' });
    if (!settings) {
      console.log('[Migration] SystemSettings 없음 — Civitai API 키 이전 불필요');
      return;
    }
    const legacy = settings.lora?.civitaiApiKey;
    const current = settings.external?.civitaiApiKey;
    if (!legacy) {
      console.log('[Migration] Civitai API 키 이전 불필요 (legacy 없음)');
      return;
    }
    if (current) {
      console.log('[Migration] Civitai API 키 이전 불필요 (external 이미 설정됨)');
      return;
    }
    if (!settings.external) settings.external = {};
    settings.external.civitaiApiKey = legacy;
    await settings.save();
    console.log('[Migration] Civitai API 키 이전 완료 (lora → external)');
  } catch (error) {
    console.error('[Migration] Civitai API 키 이전 실패:', error.message);
  }
}

module.exports = relocateCivitaiApiKey;
