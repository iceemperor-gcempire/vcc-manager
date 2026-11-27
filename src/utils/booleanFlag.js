/**
 * 삭제 요청에 딸린 켜고 끄는 값 읽기 (#1323).
 *
 * 느슨하게 읽으면(`!!value`, `=== 'true'`) 끄려고 보낸 값이 켜짐으로 읽히거나, 틀린 값이 조용히 지나간다.
 * 휴지통이 없어 되돌릴 수 없으므로, 유효하지 않은 값은 읽지 않고 거절한다.
 *
 * @returns {{ ok: true, value: boolean } | { ok: false, message: string }}
 */

/** 요청 본문(JSON)의 값 — 불리언만. 없으면 꺼짐 */
function readBodyFlag(value, name) {
  if (value === undefined) return { ok: true, value: false };
  if (typeof value === 'boolean') return { ok: true, value };
  return { ok: false, message: `${name} 은 true 또는 false 여야 합니다` };
}

/** 쿼리 문자열의 값 — `true` · `false` 만. 없으면 꺼짐. 같은 이름을 여러 번 보낸 것(배열)도 거절 */
function readQueryFlag(value, name) {
  if (value === undefined) return { ok: true, value: false };
  if (value === 'true') return { ok: true, value: true };
  if (value === 'false') return { ok: true, value: false };
  return { ok: false, message: `${name} 은 true 또는 false 여야 합니다` };
}

/**
 * 값이 읽지 않는 자리에 실려 왔는가 — 쿼리로 받는 값을 본문에 넣었거나 그 반대.
 * 그대로 두면 "값 없음 = 꺼짐"으로 읽고 지나가므로, 보낸 쪽이 뜻한 것과 다르게 지워질 수 있다.
 * @param {object} elsewhere 이 값을 읽지 않는 쪽 (req.body 또는 req.query)
 * @returns {string|null} 실려 왔으면 사유
 */
function misplacedFlag(elsewhere, name, where) {
  if (elsewhere && typeof elsewhere === 'object' && elsewhere[name] !== undefined) {
    return `${name} 은 ${where} 로 보내야 합니다`;
  }
  return null;
}

module.exports = { readBodyFlag, readQueryFlag, misplacedFlag };
