// 워크플로 `_vcc` 지시자 처리 — 조건부 입력 생략(#771) + 조건부 노드 우회(#789).
//
// 두 지시자는 목적이 다르다:
//   omitInputsUnless — "없어도 되는 입력" 을 지운다 (미첨부 참조 슬롯)
//   bypassUnless     — "체인 중간 노드" 를 빼고 상류로 재연결한다 (가속 패치 등)
//
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
 * 같은 패스에서 `bypassUnless` (#789) 도 처리한다 — 조건이 falsy 인 노드를 제거하고,
 * 그 노드의 출력을 참조하던 곳을 `passthrough` 가 가리키는 상류로 재연결한다.
 *
 *   "200": {
 *     "class_type": "SolAttnPatch",
 *     "inputs": { "model": ["6", 0], "tau": 1.3 },
 *     "_vcc": { "bypassUnless": { "condition": "{{##use_sol_attn##}}",
 *                                 "passthrough": { "0": "model" } } }
 *   }
 *
 * 조건이 꺼지면 `["200",0]` 을 보던 참조가 전부 `["6",0]` 이 되고 노드 200 은 사라진다.
 *
 * @param {Object} workflowObj — 치환 완료된 워크플로 (API 포맷: nodeId → {inputs, class_type, ...})
 * @returns {{ workflow: Object, omitted: Array<{node,input}>, bypassed: Array<{node,classType}> }}
 */
function applyOmitDirectives(workflowObj) {
  const omitted = [];
  const bypassed = [];
  if (!workflowObj || typeof workflowObj !== 'object') {
    return { workflow: workflowObj, omitted, bypassed };
  }

  // 우회 대상 수집 — 실제 제거는 입력 생략을 마친 뒤 한 번에 한다.
  // `["200",0] → ["6",0]` 형태의 재연결 표를 만든다.
  const rewire = new Map(); // "nodeId:outputIndex" → [sourceNodeId, sourceIndex]
  const toRemove = new Set();

  for (const [nodeId, node] of Object.entries(workflowObj)) {
    if (!node || typeof node !== 'object') continue;

    const directive = node._vcc;
    // 지시자가 없어도 _vcc 자체는 항상 제거 대상 (ComfyUI 로 넘기지 않는다)
    if (directive === undefined) continue;
    delete node._vcc;

    const rules = directive && directive.omitInputsUnless;
    if (rules && typeof rules === 'object' && node.inputs && typeof node.inputs === 'object') {
      for (const [inputKey, condition] of Object.entries(rules)) {
        if (!Object.prototype.hasOwnProperty.call(node.inputs, inputKey)) continue;
        if (!isFalsy(condition)) continue;
        delete node.inputs[inputKey];
        omitted.push({ node: nodeId, input: inputKey });
      }
    }

    // 조건부 노드 우회 (#789) — ComfyUI 에디터의 ctrl+B 와 같은 의미.
    const bypass = directive && directive.bypassUnless;
    if (!bypass || typeof bypass !== 'object') continue;
    if (!isFalsy(bypass.condition)) continue; // 조건이 truthy 면 노드를 그대로 둔다

    const passthrough = bypass.passthrough;
    if (!passthrough || typeof passthrough !== 'object') continue;

    // 선언한 통과 경로가 하나라도 링크가 아니면(리터럴이면) 우회하지 않는다.
    // 일부만 재연결하면 나머지 소비자가 사라진 노드를 가리켜 워크플로가 깨진다 —
    // 안전한 실패는 "가속을 끄지 못함" 이지 "워크플로 파손" 이 아니다.
    const entries = [];
    let resolvable = true;
    for (const [outputIndex, inputName] of Object.entries(passthrough)) {
      const source = node.inputs && node.inputs[inputName];
      if (!Array.isArray(source) || typeof source[0] !== 'string') {
        resolvable = false;
        break;
      }
      entries.push([`${nodeId}:${outputIndex}`, source]);
    }
    if (!resolvable || entries.length === 0) {
      console.warn(`⚠️ bypassUnless 무시 — #${nodeId} ${node.class_type}: passthrough 입력이 링크가 아닙니다`);
      continue;
    }

    entries.forEach(([key, source]) => rewire.set(key, source));
    toRemove.add(nodeId);
    bypassed.push({ node: nodeId, classType: node.class_type });
  }

  if (toRemove.size === 0) {
    return { workflow: workflowObj, omitted, bypassed };
  }

  // 연쇄 우회 해소 — A → B → C 에서 B·C 를 동시에 우회하면 A 로 직결돼야 한다.
  // 재연결 대상이 또 다른 우회 노드를 가리키면 더는 안 가리킬 때까지 따라간다.
  const resolve = (link) => {
    const seen = new Set();
    let cur = link;
    while (Array.isArray(cur) && rewire.has(`${cur[0]}:${cur[1]}`)) {
      const key = `${cur[0]}:${cur[1]}`;
      if (seen.has(key)) break; // 순환 방어 — 정상 워크플로에는 없지만 무한루프는 막는다
      seen.add(key);
      cur = rewire.get(key);
    }
    return cur;
  };

  for (const [nodeId, node] of Object.entries(workflowObj)) {
    if (toRemove.has(nodeId)) continue;
    if (!node || !node.inputs || typeof node.inputs !== 'object') continue;
    for (const [inputKey, value] of Object.entries(node.inputs)) {
      if (!Array.isArray(value) || typeof value[0] !== 'string') continue;
      if (!rewire.has(`${value[0]}:${value[1]}`)) continue;
      node.inputs[inputKey] = resolve(value);
    }
  }

  for (const nodeId of toRemove) {
    delete workflowObj[nodeId];
  }

  return { workflow: workflowObj, omitted, bypassed };
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

/**
 * 이 워크플로가 LoRA 를 실제로 쓰는가 (#816).
 *
 * 생성 화면의 LoRA 영역은 그동안 "ComfyUI 작업판이면 무조건" 표시됐다. 그래서 LoRA 슬롯이
 * 없는 워크플로(MiniMax H3 · Music 3 등)에서도 뜨고, 추가해도 아무 효과가 없었다.
 *
 * 판정 근거는 둘 중 하나다 — LoRA 로더 노드가 있거나, lora 타입 필드가 정의돼 있거나.
 *
 * @param {string} workflowData — 작업판 워크플로 JSON 문자열
 * @param {Array} additionalInputFields
 */
function workflowSupportsLora(workflowData, additionalInputFields = []) {
  if ((additionalInputFields || []).some((f) => f && f.type === 'lora')) return true;
  if (!workflowData || typeof workflowData !== 'string') return false;
  try {
    const parsed = JSON.parse(workflowData);
    return Object.values(parsed).some((n) => /lora/i.test(n?.class_type || ''));
  } catch {
    // 따옴표 없는 플레이스홀더로 파싱이 안 되는 경우 — 문자열 검사로 대체
    return /"class_type"\s*:\s*"[^"]*[Ll]ora/.test(workflowData);
  }
}

module.exports = { applyOmitDirectives, isFalsy, getOmitConditionedFieldNames, workflowSupportsLora };
