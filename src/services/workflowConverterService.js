/**
 * ComfyUI 워크플로 → vcc 작업판 변환 (#609)
 *
 * P0 (#607): API 포맷 워크플로 파싱 + 링크/리터럴 분류 + 필요/빠진 커스텀 노드 감지.
 * 결정론적 — LLM / 플러그인 설치 불필요.
 *
 * 용어
 * - API 포맷: ComfyUI "Save (API Format)" 결과. `{ "<nodeId>": { class_type, inputs }, ... }`
 * - UI 포맷: ComfyUI "Save" 결과. `{ nodes: [...], links: [...] }` — 본 단계 미지원.
 * - 링크 입력:  `["6", 0]` 처럼 다른 노드 출력이 들어옴(내부 배선) → 변수 후보 아님.
 * - 리터럴 입력: 사용자가 박은 상수값 → 변수 후보.
 */

/**
 * 입력이 ComfyUI 링크(`[sourceNodeId, outputIndex]`)인지 판정.
 * sourceNodeId 가 실제 그래프에 존재해야 링크로 인정(리터럴 2-요소 배열 오인 방지).
 */
function isLinkInput(value, nodeIds) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    (typeof value[0] === 'string' || typeof value[0] === 'number') &&
    typeof value[1] === 'number' &&
    nodeIds.has(String(value[0]))
  );
}

/**
 * 워크플로 포맷 감지: 'api' | 'ui' | 'unknown'
 */
function detectFormat(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 'unknown';
  // UI 포맷: nodes 배열 + links
  if (Array.isArray(obj.nodes) && 'links' in obj) return 'ui';
  // API 포맷: 값들이 { class_type, inputs } 모양
  const values = Object.values(obj);
  if (values.length === 0) return 'unknown';
  const apiLike = values.filter(
    (v) => v && typeof v === 'object' && typeof v.class_type === 'string'
  ).length;
  if (apiLike >= Math.ceil(values.length * 0.5)) return 'api';
  return 'unknown';
}

/**
 * API 포맷 워크플로 파싱.
 * 반환: { format, nodes: [{id, classType, inputs:[{key, kind, value, source}]}], classTypes:[], literalInputs:[] }
 * 미지원/오류 시 throw.
 */
function parseWorkflow(input) {
  let obj = input;
  if (typeof input === 'string') {
    try {
      obj = JSON.parse(input);
    } catch (e) {
      throw new Error(`워크플로 JSON 파싱 실패: ${e.message}`);
    }
  }

  const format = detectFormat(obj);
  if (format === 'ui') {
    throw new Error('UI 포맷 워크플로입니다. ComfyUI 의 "Save (API Format)" 로 저장한 JSON 을 넣어주세요.');
  }
  if (format !== 'api') {
    throw new Error('인식할 수 없는 워크플로 형식입니다. ComfyUI API 포맷 JSON 이 필요합니다.');
  }

  const nodeIds = new Set(Object.keys(obj));
  const nodes = [];
  const classTypes = new Set();
  const literalInputs = [];

  for (const [id, node] of Object.entries(obj)) {
    if (!node || typeof node !== 'object' || typeof node.class_type !== 'string') continue;
    const classType = node.class_type;
    classTypes.add(classType);

    const inputs = [];
    const rawInputs = node.inputs && typeof node.inputs === 'object' ? node.inputs : {};
    for (const [key, value] of Object.entries(rawInputs)) {
      if (isLinkInput(value, nodeIds)) {
        inputs.push({ key, kind: 'link', source: { nodeId: String(value[0]), outputIndex: value[1] } });
      } else {
        inputs.push({ key, kind: 'literal', value });
        literalInputs.push({ nodeId: id, classType, key, value, valueType: typeof value });
      }
    }
    nodes.push({ id, classType, inputs });
  }

  return { format, nodes, classTypes: [...classTypes], literalInputs };
}

/**
 * 파싱된 워크플로 + ComfyUI /object_info 를 비교해 필요/빠진 노드 산출.
 * objectInfo 가 없으면(서버 미연결) missingNodes 는 null 로 둔다(판단 불가).
 */
function analyzeNodes(parsed, objectInfo) {
  const requiredNodes = [...parsed.classTypes].sort();
  if (!objectInfo || typeof objectInfo !== 'object') {
    return { requiredNodes, missingNodes: null, installedNodes: null };
  }
  const installed = new Set(Object.keys(objectInfo));
  const missingNodes = requiredNodes.filter((ct) => !installed.has(ct));
  const installedNodes = requiredNodes.filter((ct) => installed.has(ct));
  return { requiredNodes, missingNodes, installedNodes };
}

/**
 * 편의: 파싱 + 노드 분석을 한 번에.
 */
function analyzeWorkflow(input, objectInfo) {
  const parsed = parseWorkflow(input);
  const nodeAnalysis = analyzeNodes(parsed, objectInfo);
  return {
    format: parsed.format,
    nodeCount: parsed.nodes.length,
    literalInputCount: parsed.literalInputs.length,
    ...nodeAnalysis,
    literalInputs: parsed.literalInputs,
  };
}

module.exports = {
  isLinkInput,
  detectFormat,
  parseWorkflow,
  analyzeNodes,
  analyzeWorkflow,
};
