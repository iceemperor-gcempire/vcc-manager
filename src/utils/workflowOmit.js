// 워크플로 조건부 입력 생략 (#771).
//
// ComfyUI 의 optional 입력은 "키를 넣지 않는 것" 이 곧 미사용이다. 그런데 VCC 는 워크플로
// JSON 을 고정 템플릿으로 두고 플레이스홀더만 치환하므로, 요청마다 키를 넣었다 뺐다 할
// 수단이 없었다.
//
// 이 결핍이 특히 아픈 곳은 autogrow 입력이다. MiniMaxH3ReferenceToVideo 의
// `ref_images.ref_image_0..8` 처럼 슬롯 개수가 요청마다 달라지는 경우, 미첨부 슬롯에
// 흰 PNG(#230) 를 넣으면 모델이 그걸 참조 이미지로 인식해버린다. 전 슬롯 필수화도
// 답이 아니다 — 참조 1장만 필요한 요청에 3장을 강요하게 된다.
//
// 노드에 `_vcc.omitInputsUnless` 를 두면 치환 결과가 falsy 인 입력 키를 제거한다:
//
//   "136": {
//     "class_type": "MiniMaxH3ReferenceToVideo",
//     "inputs": {
//       "ref_images.ref_image_0": ["137", 0],
//       "ref_images.ref_image_1": ["139", 0]
//     },
//     "_vcc": {
//       "omitInputsUnless": { "ref_images.ref_image_1": "{{##ref_image_2_attached##}}" }
//     }
//   }
//
// 키가 사라지면 상류 LoadImage 는 자동으로 고아가 되고, ComfyUI 는 출력 노드에서
// 도달 불가능한 노드를 검증도 실행도 하지 않는다 (실측 확인). 즉 노드를 지울 필요가 없다.
//
// `_vcc` 는 조건 유무와 무관하게 항상 제거한다 — ComfyUI 로 넘기지 않는다.

// falsy 판정 — 플레이스홀더 치환 결과는 number(1/0) 또는 string 일 수 있다.
// `_attached` 는 number 로 치환되지만, 사용자가 select 값 등을 조건으로 쓸 수도 있어
// 문자열 "0" / "false" / "" 도 falsy 로 본다.
function isFalsy(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return value === 0 || Number.isNaN(value);
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    return s === '' || s === '0' || s === 'false' || s === 'null' || s === 'undefined';
  }
  return false;
}

/**
 * 워크플로 객체에서 `_vcc.omitInputsUnless` 지시자를 적용한다.
 *
 * 플레이스홀더 치환이 **끝난 뒤** 호출해야 한다 (조건식이 이미 값으로 바뀐 상태여야 함).
 * 입력 키는 점이 포함돼도 (`ref_images.ref_image_1`) 경로가 아닌 **리터럴 키**로 취급한다 —
 * ComfyUI autogrow 입력명이 원래 점 표기다.
 *
 * @param {Object} workflowObj — 치환 완료된 워크플로 (API 포맷: nodeId → {inputs, class_type, ...})
 * @returns {{ workflow: Object, omitted: Array<{node: string, input: string}> }}
 */
function applyOmitDirectives(workflowObj) {
  const omitted = [];
  if (!workflowObj || typeof workflowObj !== 'object') {
    return { workflow: workflowObj, omitted };
  }

  for (const [nodeId, node] of Object.entries(workflowObj)) {
    if (!node || typeof node !== 'object') continue;

    const directive = node._vcc;
    // 지시자가 없어도 _vcc 자체는 항상 제거 대상 (ComfyUI 로 넘기지 않는다)
    if (directive === undefined) continue;
    delete node._vcc;

    const rules = directive && directive.omitInputsUnless;
    if (!rules || typeof rules !== 'object') continue;
    if (!node.inputs || typeof node.inputs !== 'object') continue;

    for (const [inputKey, condition] of Object.entries(rules)) {
      if (!Object.prototype.hasOwnProperty.call(node.inputs, inputKey)) continue;
      if (!isFalsy(condition)) continue;
      delete node.inputs[inputKey];
      omitted.push({ node: nodeId, input: inputKey });
    }
  }

  return { workflow: workflowObj, omitted };
}

/**
 * 워크플로에서 "미첨부 시 슬롯이 생략되는" 필드 이름을 추출한다 (#774).
 *
 * 생성 화면은 image 필드에 "미첨부 시 흰색 이미지가 자동으로 사용됩니다" 를 안내하는데,
 * `_vcc.omitInputsUnless` 로 조건이 걸린 필드는 그게 사실이 아니다 — 입력 키가 제거되어
 * 상류 LoadImage 가 고아가 되고 흰 이미지는 모델에 도달하지 않는다. 안내 문구를 바꾸려면
 * 프론트가 "이 필드가 조건부인가" 를 알아야 한다.
 *
 * 프론트에서 workflowData 를 파싱하게 만들 이유가 없어 백엔드가 계산해 내려준다.
 *
 * 조건식이 `{{##필드명_attached##}}` 형태일 때만 해당 필드로 인식한다. 다른 플레이스홀더를
 * 조건으로 쓴 경우(select 값 등)는 어떤 필드의 첨부 여부와 직결되지 않으므로 제외한다.
 *
 * @param {string} workflowData — 작업판의 워크플로 JSON 문자열 (치환 전)
 * @returns {string[]} 조건부 생략 대상 필드 이름 (중복 제거)
 */
function getOmitConditionedFieldNames(workflowData) {
  if (!workflowData || typeof workflowData !== 'string') return [];

  let parsed;
  try {
    parsed = JSON.parse(workflowData);
  } catch {
    // 따옴표 없는 플레이스홀더를 쓴 워크플로는 파싱되지 않는다. 그런 워크플로는
    // 애초에 _vcc 가 동작하지 않으므로 (문자열 치환 fallback 경로) 빈 배열이 맞다.
    return [];
  }
  if (!parsed || typeof parsed !== 'object') return [];

  const names = new Set();
  const ATTACHED = /^\{\{##([A-Za-z0-9_]+)_attached##\}\}$/;

  for (const node of Object.values(parsed)) {
    const rules = node && node._vcc && node._vcc.omitInputsUnless;
    if (!rules || typeof rules !== 'object') continue;
    for (const condition of Object.values(rules)) {
      if (typeof condition !== 'string') continue;
      const m = condition.trim().match(ATTACHED);
      if (m) names.add(m[1]);
    }
  }
  return [...names];
}

module.exports = { applyOmitDirectives, isFalsy, getOmitConditionedFieldNames };
