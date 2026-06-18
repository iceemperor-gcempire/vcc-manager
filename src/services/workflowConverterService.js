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

// ─────────────────────────────────────────────────────────────
// P0 (#608): 결정론적 역할 매핑 → 작업판 초안 생성
// ─────────────────────────────────────────────────────────────

const SAMPLER_TYPES = new Set([
  'KSampler', 'KSamplerAdvanced', 'SamplerCustom', 'SamplerCustomAdvanced',
]);
// 텍스트 인코더(프롬프트) 노드 판정 — CLIPTextEncode / CLIPTextEncodeSDXL 등
const isTextEncoder = (ct) => /CLIPTextEncode/i.test(ct);

// 역할 메타: 변수 기본 이름 + vcc 필드 타입 + 한국어 라벨
const ROLE_META = {
  base_model: { type: 'baseModel', label: '베이스 모델' },
  prompt: { type: 'string', label: '프롬프트' },
  negative_prompt: { type: 'string', label: '네거티브 프롬프트' },
  seed: { type: 'number', label: '시드' },
  width: { type: 'number', label: '가로' },
  height: { type: 'number', label: '세로' },
  lora: { type: 'lora', label: 'LoRA' },
  image: { type: 'image', label: '이미지' },
};

/** nodeId → 원본 노드 객체 맵 (파싱 전 raw 기준으로 다시 만들기 위해 parsed.nodes 사용) */
function buildNodeMap(parsed) {
  const map = new Map();
  for (const n of parsed.nodes) map.set(n.id, n);
  return map;
}

/** 노드의 특정 입력(link)의 소스 nodeId 반환 (없으면 null) */
function linkSource(node, inputKey) {
  const inp = node?.inputs.find((i) => i.key === inputKey && i.kind === 'link');
  return inp ? inp.source.nodeId : null;
}

/**
 * 샘플러의 positive/negative 입력에서 거꾸로 추적해 CLIPTextEncode 노드 id 를 찾는다.
 * conditioning 체인(ControlNet 등)을 몇 홉 통과 — 못 찾으면 null (LLM/관리자 영역).
 */
function traceToTextEncoder(nodeMap, startId, depth = 0, seen = new Set()) {
  if (!startId || depth > 4 || seen.has(startId)) return null;
  seen.add(startId);
  const node = nodeMap.get(startId);
  if (!node) return null;
  if (isTextEncoder(node.classType)) return startId;
  // 링크 입력들을 따라 한 홉씩 (conditioning 계열 우선이 이상적이나 단순화: 모든 link 추적)
  for (const inp of node.inputs) {
    if (inp.kind === 'link') {
      const found = traceToTextEncoder(nodeMap, inp.source.nodeId, depth + 1, seen);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 파싱된 워크플로 → 작업판 초안.
 * 반환: { workflowData(string), additionalInputFields[], notes[] }
 * 표준 노드만 보수적으로 변수화(LLM 없음). 모르는/애매한 건 노출하지 않고 note 로 남긴다.
 */
function generateDraft(parsed, rawWorkflow) {
  const nodeMap = buildNodeMap(parsed);
  const notes = [];

  // 1) positive/negative 프롬프트 인코더 식별 (샘플러 추적)
  const positiveEncoders = new Set();
  const negativeEncoders = new Set();
  for (const node of parsed.nodes) {
    if (!SAMPLER_TYPES.has(node.classType)) continue;
    const pos = traceToTextEncoder(nodeMap, linkSource(node, 'positive'));
    const neg = traceToTextEncoder(nodeMap, linkSource(node, 'negative'));
    if (pos) positiveEncoders.add(pos);
    if (neg) negativeEncoders.add(neg);
  }

  // 2) 역할 후보 수집: [{nodeId, key, role}]
  const picks = [];
  const promptCounter = { n: 0 };
  for (const node of parsed.nodes) {
    const has = (k) => node.inputs.some((i) => i.key === k && i.kind === 'literal');
    const ct = node.classType;

    if (ct === 'CheckpointLoaderSimple' && has('ckpt_name')) picks.push({ nodeId: node.id, key: 'ckpt_name', role: 'base_model' });
    else if (/^LoraLoader/.test(ct) && has('lora_name')) picks.push({ nodeId: node.id, key: 'lora_name', role: 'lora' });
    else if (ct === 'LoadImage' && has('image')) picks.push({ nodeId: node.id, key: 'image', role: 'image' });
    else if (ct === 'EmptyLatentImage') {
      if (has('width')) picks.push({ nodeId: node.id, key: 'width', role: 'width' });
      if (has('height')) picks.push({ nodeId: node.id, key: 'height', role: 'height' });
    } else if (SAMPLER_TYPES.has(ct) && has('seed')) {
      picks.push({ nodeId: node.id, key: 'seed', role: 'seed' });
    } else if (isTextEncoder(ct) && has('text')) {
      if (positiveEncoders.has(node.id)) picks.push({ nodeId: node.id, key: 'text', role: 'prompt' });
      else if (negativeEncoders.has(node.id)) picks.push({ nodeId: node.id, key: 'text', role: 'negative_prompt' });
      else { promptCounter.n += 1; picks.push({ nodeId: node.id, key: 'text', role: 'prompt', extra: true }); }
    }
  }

  // 3) 이름 유일화 + 필드/치환 생성
  const usedNames = new Set();
  const uniqueName = (base) => {
    let name = base; let i = 2;
    while (usedNames.has(name)) { name = `${base}_${i}`; i += 1; }
    usedNames.add(name);
    return name;
  };

  // 원본 raw 워크플로 복제 후 placeholder 주입
  const workflowObj = typeof rawWorkflow === 'string' ? JSON.parse(rawWorkflow) : JSON.parse(JSON.stringify(rawWorkflow));
  const additionalInputFields = [];

  for (const pick of picks) {
    const meta = ROLE_META[pick.role];
    if (!meta) continue;
    // prompt 가 여러 개면 prompt, prompt_2 … / 라벨도 맞춤
    const name = uniqueName(pick.role);
    const currentValue = workflowObj?.[pick.nodeId]?.inputs?.[pick.key];
    const classType = nodeMap.get(pick.nodeId)?.classType || '';

    additionalInputFields.push({
      name,
      label: name === pick.role ? meta.label : `${meta.label} ${name.split('_').pop()}`,
      type: meta.type,
      required: pick.role === 'prompt' && name === 'prompt',
      defaultValue: meta.type === 'image' ? undefined : currentValue,
      formatString: `{{##${name}##}}`,
      description: `${classType} 노드(${pick.nodeId})의 ${pick.key} 에서 추출`,
    });

    // 워크플로 값 자리에 placeholder 주입
    if (workflowObj[pick.nodeId] && workflowObj[pick.nodeId].inputs) {
      workflowObj[pick.nodeId].inputs[pick.key] = `{{##${name}##}}`;
    }
  }

  // 4) note: 노출 안 한 흔한 튜닝 리터럴 안내(steps/cfg/sampler 등) — 편집기에서 추가 가능
  const exposedKeys = new Set(picks.map((p) => `${p.nodeId}.${p.key}`));
  const tunables = parsed.literalInputs.filter(
    (l) => !exposedKeys.has(`${l.nodeId}.${l.key}`) &&
      ['steps', 'cfg', 'denoise', 'sampler_name', 'scheduler', 'batch_size'].includes(l.key)
  );
  if (tunables.length) {
    notes.push(`노출하지 않은 튜닝 값 ${tunables.length}개(steps/cfg/sampler 등) — 필요하면 편집기에서 변수로 추가하세요.`);
  }
  if (!additionalInputFields.length) {
    notes.push('표준 노드에서 변수를 찾지 못했습니다. 커스텀 노드 위주 워크플로일 수 있어 편집기에서 수동 지정이 필요합니다.');
  }

  return {
    workflowData: JSON.stringify(workflowObj, null, 2),
    additionalInputFields,
    notes,
  };
}

// ─────────────────────────────────────────────────────────────
// P2 (#614): 빠진 커스텀 노드 → repo 해석
// ─────────────────────────────────────────────────────────────

/**
 * ComfyUI-Manager 의 node→repo 매핑 응답을 className→repo 로 정규화.
 * Manager 버전별 shape 차를 흡수한다. 알 수 없는 형태면 {} 반환.
 *
 * 지원 형태:
 *  A) getmappings: { "<git_url>": [ [nodeNames...], { title, ... } ], ... }
 *  B) flat:        { "<NodeClassName>": { url|reference|files[], title }, ... }
 */
function normalizeManagerMap(raw) {
  const map = {}; // className -> { title, url }
  if (!raw || typeof raw !== 'object') return map;

  const addEntry = (className, repo) => {
    if (!className || !repo || !repo.url) return;
    if (!map[className]) map[className] = repo;
  };

  for (const [key, val] of Object.entries(raw)) {
    // 형태 A: key=url, val=[nodeNames, meta]
    if (Array.isArray(val) && Array.isArray(val[0])) {
      const meta = (val[1] && typeof val[1] === 'object') ? val[1] : {};
      const url = meta.url || meta.reference || (/^https?:\/\//.test(key) ? key : null);
      const title = meta.title || meta.title_aux || null;
      if (url) for (const node of val[0]) addEntry(node, { title, url });
      continue;
    }
    // 형태 B: key=className, val={url|reference|files, title}
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const url = val.url || val.reference || (Array.isArray(val.files) ? val.files[0] : null);
      if (url) addEntry(key, { title: val.title || null, url });
    }
  }
  return map;
}

/**
 * 빠진 노드(class_type) 들을 repo 로 해석.
 * 반환: { resolutions: [{node, repos:[{title,url}]}], unresolved: [node...] }
 */
function resolveMissingNodes(missingNodes, nodeRepoMap) {
  const resolutions = [];
  const unresolved = [];
  const map = nodeRepoMap || {};
  for (const node of missingNodes || []) {
    const repo = map[node];
    if (repo && repo.url) resolutions.push({ node, repos: [repo] });
    else unresolved.push(node);
  }
  return { resolutions, unresolved };
}

module.exports = {
  isLinkInput,
  detectFormat,
  parseWorkflow,
  analyzeNodes,
  analyzeWorkflow,
  traceToTextEncoder,
  generateDraft,
  normalizeManagerMap,
  resolveMissingNodes,
};
