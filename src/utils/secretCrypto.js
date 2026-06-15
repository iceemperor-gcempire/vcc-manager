/**
 * At-rest secret 암호화 유틸 (#594)
 *
 * 외부 provider API 키(Server.configuration.apiKey, SystemSettings.civitaiApiKey)를
 * DB 에 평문이 아닌 AES-256-GCM 암호문으로 저장하기 위한 헬퍼.
 *
 * 저장 형식(자기서술적): `enc:v1:<ivHex>:<authTagHex>:<ciphertextHex>`
 * - isEncrypted() 로 평문/암호문 구분 → 멱등 암호화 + 점진 마이그레이션 안전.
 * - 키 미설정 시 평문 그대로 둠(기존 동작 유지, 앱이 깨지지 않음) — 경고만 출력.
 *
 * 키: CONFIG_ENCRYPTION_KEY 우선, 없으면 BACKUP_ENCRYPTION_KEY 재사용 (64자리 hex = 32바이트).
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

function getKey() {
  const hex = process.env.CONFIG_ENCRYPTION_KEY || process.env.BACKUP_ENCRYPTION_KEY;
  if (!hex || !/^[a-fA-F0-9]{64}$/.test(hex)) return null;
  return Buffer.from(hex, 'hex'); // 32 bytes
}

let warned = false;
function warnNoKey() {
  if (!warned) {
    console.warn('[secretCrypto] CONFIG_ENCRYPTION_KEY/BACKUP_ENCRYPTION_KEY 미설정 — provider 키가 평문으로 저장/조회됩니다.');
    warned = true;
  }
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * 평문 → 암호문 문자열. 이미 암호문이거나 빈 값이면 그대로(멱등). 키 없으면 평문 유지.
 */
function encryptSecret(plain) {
  if (plain == null || plain === '') return plain;
  if (isEncrypted(plain)) return plain;
  const key = getKey();
  if (!key) { warnNoKey(); return plain; }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ct = cipher.update(String(plain), 'utf8', 'hex');
  ct += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${PREFIX}${iv.toString('hex')}:${tag}:${ct}`;
}

/**
 * 암호문 → 평문. 암호문이 아니면(평문/null/legacy) 그대로 반환.
 * 암호문인데 키가 없거나 복호화 실패하면 null (잘못된 키를 그대로 흘려보내 provider 호출을 망치지 않도록).
 */
function decryptSecret(value) {
  if (!isEncrypted(value)) return value;
  const key = getKey();
  if (!key) { warnNoKey(); return null; }
  try {
    const parts = value.split(':'); // ['enc','v1',iv,tag,ct]
    const iv = Buffer.from(parts[2], 'hex');
    const tag = Buffer.from(parts[3], 'hex');
    const ct = parts[4];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let pt = decipher.update(ct, 'hex', 'utf8');
    pt += decipher.final('utf8');
    return pt;
  } catch (error) {
    console.error('[secretCrypto] 복호화 실패:', error.message);
    return null;
  }
}

module.exports = { encryptSecret, decryptSecret, isEncrypted };
