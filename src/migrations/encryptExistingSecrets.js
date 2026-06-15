const Server = require('../models/Server');
const SystemSettings = require('../models/SystemSettings');
const { encryptSecret, isEncrypted } = require('../utils/secretCrypto');

// #594: 기존에 평문으로 저장된 provider API 키를 at-rest 암호화로 전환.
// 멱등 — 이미 enc: 접두사면 건너뜀. 암호화 키가 없으면 encryptSecret 가 평문을 그대로
// 반환하므로 사실상 no-op (기존 동작 유지). 부분 실패는 건너뛰고 계속.
async function encryptExistingSecrets() {
  try {
    // 1) Server.configuration.apiKey
    const servers = await Server.find({ 'configuration.apiKey': { $exists: true, $nin: [null, ''] } });
    let serverCount = 0;
    for (const server of servers) {
      const current = server.configuration?.apiKey;
      if (!current || isEncrypted(current)) continue;
      const encrypted = encryptSecret(current);
      if (encrypted === current) continue; // 키 없음 등으로 변화 없으면 skip
      server.configuration.apiKey = encrypted;
      server.markModified('configuration');
      await server.save();
      serverCount++;
    }

    // 2) SystemSettings.{external,lora}.civitaiApiKey
    let settingsChanged = false;
    const settings = await SystemSettings.findOne({ key: 'global' });
    if (settings) {
      for (const path of ['external', 'lora']) {
        const v = settings[path]?.civitaiApiKey;
        if (v && !isEncrypted(v)) {
          const enc = encryptSecret(v);
          if (enc !== v) {
            settings[path].civitaiApiKey = enc;
            settingsChanged = true;
          }
        }
      }
      if (settingsChanged) {
        settings.markModified('external');
        settings.markModified('lora');
        await settings.save();
      }
    }

    if (serverCount > 0 || settingsChanged) {
      console.log(`[Migration] provider 키 at-rest 암호화 완료 (서버 ${serverCount}건${settingsChanged ? ', SystemSettings' : ''})`);
    } else {
      console.log('[Migration] provider 키 at-rest 암호화 불필요 (이미 암호화됨 또는 대상 없음)');
    }
  } catch (error) {
    console.error('[Migration] provider 키 at-rest 암호화 실패:', error.message);
  }
}

module.exports = encryptExistingSecrets;
