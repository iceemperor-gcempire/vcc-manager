const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'default-secret';
const DEFAULT_EXPIRY = parseInt(process.env.SIGNED_URL_EXPIRY, 10) || 3600; // 1 hour
const ROUND_SECONDS = parseInt(process.env.SIGNED_URL_ROUND_SECONDS, 10) || 1440; // 24 min

/**
 * Generate HMAC-SHA256 signature for a file path + expiry.
 */
function createSignature(filePath, expires) {
  return crypto
    .createHmac('sha256', SECRET)
    .update(`${filePath}:${expires}`)
    .digest('hex');
}

/**
 * Convert an /uploads/... path to a signed /api/files/... URL.
 *
 * @param {string} uploadPath - e.g. '/uploads/generated/uuid.png'
 * @param {number} [expirySeconds] - seconds until expiry (default: SIGNED_URL_EXPIRY or 3600)
 * @returns {string} e.g. '/api/files/generated/uuid.png?expires=1700000000&sig=abc123'
 */
function generateSignedUrl(uploadPath, expirySeconds = DEFAULT_EXPIRY) {
  // Strip '/uploads' prefix to get relative file path
  const filePath = uploadPath.replace(/^\/uploads/, '');
  // 만료 시간을 라운딩하여 동일 구간 내에서는 같은 URL 생성
  // → 빈번한 API refetch 시에도 URL이 바뀌지 않아 <video>/<img> 재로드 방지
  const now = Math.floor(Date.now() / 1000);
  const expires = Math.ceil((now + expirySeconds) / ROUND_SECONDS) * ROUND_SECONDS;
  const sig = createSignature(filePath, expires);
  return `/api/files${filePath}?expires=${expires}&sig=${sig}`;
}

/**
 * Verify a signed URL's signature and expiry.
 *
 * @param {string} filePath - e.g. '/generated/uuid.png' (without /uploads or /api/files prefix)
 * @param {string|number} expires - Unix timestamp (seconds)
 * @param {string} signature - hex HMAC signature
 * @returns {{ valid: boolean, expired: boolean }}
 */
function verifySignature(filePath, expires, signature) {
  const now = Math.floor(Date.now() / 1000);
  if (now > Number(expires)) {
    return { valid: false, expired: true };
  }
  const expected = createSignature(filePath, expires);
  // Reject if signature length doesn't match (timingSafeEqual requires same length)
  if (expected.length !== signature.length) {
    return { valid: false, expired: false };
  }
  const valid = crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  );
  return { valid, expired: false };
}

/**
 * Recursively walk an object/array and replace all '/uploads/...' strings
 * with signed '/api/files/...' URLs.
 *
 * @param {any} obj
 * @returns {any} transformed copy
 */
function transformUploadUrls(obj) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    if (obj.startsWith('/uploads/')) {
      return generateSignedUrl(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(transformUploadUrls);
  }

  if (typeof obj === 'object') {
    // Handle Date, ObjectId, etc. — don't recurse into non-plain objects
    if (obj.constructor && obj.constructor !== Object) {
      return obj;
    }
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = transformUploadUrls(value);
    }
    return result;
  }

  return obj;
}

/**
 * Reverse a signed URL back to the original /uploads/... path.
 * If the URL is not a signed URL, return as-is.
 *
 * @param {string} url
 * @returns {string}
 */
function reverseSignedUrl(url) {
  if (!url || typeof url !== 'string') return url;

  // Match /api/files/... pattern (with or without query params)
  const match = url.match(/^\/api\/files(\/[^?]+)/);
  if (match) {
    return `/uploads${match[1]}`;
  }

  return url;
}

module.exports = {
  generateSignedUrl,
  verifySignature,
  transformUploadUrls,
  reverseSignedUrl,
};
