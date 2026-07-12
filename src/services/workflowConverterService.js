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
const ALLOWED_FIELD_TYPES = new Set(['string', 'number', 'boolean', 'select', 'image', 'baseModel', 'lora']);

/**
 * 결정론적 역할 후보 수집: [{nodeId, key, role}]. (표준 노드, class_type 기반)
 */
function collectDeterministicPicks(parsed) {
  const nodeMap = buildNodeMap(parsed);
  const positiveEncoders = new Set();
  const negativeEncoders = new Set();
  for (const node of parsed.nodes) {
    if (!SAMPLER_TYPES.has(node.classType)) continue;
    const pos = traceToTextEncoder(nodeMap, linkSource(node, 'positive'));
    const neg = traceToTextEncoder(nodeMap, linkSource(node, 'negative'));
    if (pos) positiveEncoders.add(pos);
    if (neg) negativeEncoders.add(neg);
  }

  const picks = [];
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
      else picks.push({ nodeId: node.id, key: 'text', role: 'prompt' });
    }
  }
  return picks;
}

/**
 * picks(결정론적 + LLM 보조 혼합) → 작업판 초안.
 * pick = { nodeId, key, role?, name?, type?, label?, source? }
 * role 이 ROLE_META 에 있으면 그 메타를 기본값으로, name/type/label 오버라이드 우선.
 */
function buildDraftFromPicks(parsed, rawWorkflow, picks) {
  const nodeMap = buildNodeMap(parsed);
  const notes = [];
  const workflowObj = typeof rawWorkflow === 'string' ? JSON.parse(rawWorkflow) : JSON.parse(JSON.stringify(rawWorkflow));
  const additionalInputFields = [];

  const usedNames = new Set();
  const uniqueName = (base) => {
    let name = base; let i = 2;
    while (usedNames.has(name)) { name = `${base}_${i}`; i += 1; }
    usedNames.add(name);
    return name;
  };

  const usedKeys = new Set();
  for (const pick of picks) {
    const dedupeKey = `${pick.nodeId}.${pick.key}`;
    if (usedKeys.has(dedupeKey)) continue; // 같은 입력 중복 방지(LLM 이 결정론과 겹칠 때)
    const meta = ROLE_META[pick.role];
    const type = pick.type || meta?.type;
    if (!type || !ALLOWED_FIELD_TYPES.has(type)) continue; // 타입 미상이면 건너뜀
    if (!workflowObj?.[pick.nodeId]?.inputs || !(pick.key in workflowObj[pick.nodeId].inputs)) continue; // 실재 입력만

    const baseName = pick.name || pick.role || pick.key;
    const name = uniqueName(baseName);
    const labelBase = pick.label || meta?.label || baseName;
    const label = name === baseName ? labelBase : `${labelBase} ${name.split('_').pop()}`;
    const currentValue = workflowObj[pick.nodeId].inputs[pick.key];
    const classType = nodeMap.get(pick.nodeId)?.classType || '';

    additionalInputFields.push({
      name,
      label,
      type,
      required: pick.role === 'prompt' && name === 'prompt',
      defaultValue: type === 'image' ? undefined : currentValue,
      formatString: `{{##${name}##}}`,
      description: `${classType} 노드(${pick.nodeId})의 ${pick.key} 에서 추출${pick.source === 'llm' ? ' (AI 제안)' : ''}`,
    });
    workflowObj[pick.nodeId].inputs[pick.key] = `{{##${name}##}}`;
    usedKeys.add(dedupeKey);
  }

  const exposedKeys = new Set([...usedKeys]);
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

  return { workflowData: JSON.stringify(workflowObj, null, 2), additionalInputFields, notes };
}

function generateDraft(parsed, rawWorkflow) {
  return buildDraftFromPicks(parsed, rawWorkflow, collectDeterministicPicks(parsed));
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

// ─────────────────────────────────────────────────────────────
// P1: LLM 보조 변수 제안 (애매/커스텀 노드)
// ─────────────────────────────────────────────────────────────

/** content 에서 JSON 배열만 안전하게 추출 (LLM 이 prose/```json 로 감쌀 수 있음) */
function extractJsonArray(content) {
  if (typeof content !== 'string') return null;
  const start = content.indexOf('[');
  const end = content.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  try {
    const arr = JSON.parse(content.slice(start, end + 1));
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

/**
 * 결정론으로 못 잡은 리터럴 후보를 LLM 에 태워 추가 변수 제안.
 * llmComplete(messages) → string(content) 를 주입(테스트/서비스 분리).
 * 반환: 검증된 추가 picks [{nodeId, key, name, type, label, role?, source:'llm'}]
 */
async function proposeLlmPicks({ parsed, existingPicks = [], llmComplete, maxCandidates = 60 }) {
  if (typeof llmComplete !== 'function') return [];
  const existing = new Set(existingPicks.map((p) => `${p.nodeId}.${p.key}`));
  const candidates = parsed.literalInputs
    .filter((l) => !existing.has(`${l.nodeId}.${l.key}`))
    .slice(0, maxCandidates);
  if (candidates.length === 0) return [];

  const candidateView = candidates.map((c) => ({
    nodeId: c.nodeId, classType: c.classType, key: c.key, valueType: c.valueType,
    sample: typeof c.value === 'string' ? c.value.slice(0, 80) : c.value,
  }));

  const messages = [
    {
      role: 'system',
      content: [
        'You convert ComfyUI workflow inputs into user-facing workboard variables.',
        'From the given LITERAL input candidates, pick ONLY the ones a user would meaningfully want to control.',
        'Skip fixed/internal constants unless clearly meaningful.',
        'Allowed types: string, number, boolean, select, image, baseModel, lora.',
        'Reply with ONLY a JSON array, each item: {"nodeId","key","name","type","label"}.',
        'name: snake_case ascii. Reference ONLY the given nodeId+key pairs.',
      ].join(' '),
    },
    { role: 'user', content: `Candidates:\n${JSON.stringify(candidateView, null, 2)}` },
  ];

  let content;
  try {
    content = await llmComplete(messages);
  } catch {
    return [];
  }
  const proposals = extractJsonArray(content);
  if (!proposals) return [];

  const candKey = new Set(candidates.map((c) => `${c.nodeId}.${c.key}`));
  const seen = new Set();
  const picks = [];
  for (const p of proposals) {
    if (!p || typeof p !== 'object') continue;
    const nodeId = String(p.nodeId);
    const key = String(p.key);
    const dk = `${nodeId}.${key}`;
    if (!candKey.has(dk) || seen.has(dk)) continue; // 실재 후보 + 중복 제거
    const name = typeof p.name === 'string' ? p.name.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '') : '';
    if (!name) continue;
    const type = ALLOWED_FIELD_TYPES.has(p.type) ? p.type : 'string';
    seen.add(dk);
    picks.push({ nodeId, key, name, type, label: typeof p.label === 'string' ? p.label : name, source: 'llm' });
  }
  return picks;
}


// ── UI 포맷 → API 포맷 변환 (#609 P3) ─────────────────────────────
// ComfyUI 일반 저장(UI 포맷: nodes/links 그래프 + definitions.subgraphs)을 실행용
// API 포맷으로 변환. 서브그래프는 API export 와 동일한 "인스턴스ID:내부ID" 규칙으로
// 재귀 확장한다. widgets_values → 입력명 매핑에 /object_info 스키마(순서)가 필요.

const WIDGET_PRIMITIVES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN']);
const CONTROL_AFTER_GENERATE_VALUES = new Set(['fixed', 'increment', 'decrement', 'randomize']);
// LiteGraph mode: 0=normal, 2=muted(never), 4=bypass
const VIRTUAL_NODE_TYPES = new Set(['Note', 'MarkdownNote', 'Reroute', 'PrimitiveNode']);
const SUBGRAPH_INPUT_NODE_ID = '-10';
const SUBGRAPH_OUTPUT_NODE_ID = '-20';

function isWidgetSpec(spec) {
  if (!Array.isArray(spec)) return false;
  const t = spec[0];
  if (Array.isArray(t)) return true; // combo (선택지 배열)
  if (typeof t === 'string' && (WIDGET_PRIMITIVES.has(t) || t === 'COMBO')) return true;
  return false;
}

// 서브그래프 입력 정의가 위젯으로 승격되는 타입인지 (인스턴스 widgets_values 소비 순서 결정)
function isWidgetPromotedInput(inputDef) {
  const t = String(inputDef.type || '');
  return t.split(',').some((part) => WIDGET_PRIMITIVES.has(part.trim()));
}

function convertUiToApi(uiObj, objectInfo) {
  if (!objectInfo || typeof objectInfo !== 'object') {
    throw new Error('UI 포맷 변환에는 ComfyUI 서버의 노드 정보(/object_info)가 필요합니다. 서버를 선택해주세요.');
  }
  const warnings = [];
  const subgraphById = new Map((uiObj.definitions?.subgraphs || []).map((sg) => [sg.id, sg]));
  const apiWorkflow = {};

  // 그래프(top-level 또는 서브그래프 내부) 하나의 실행 컨텍스트
  function makeCtx(graph, prefix, boundary) {
    const nodesById = new Map((graph.nodes || []).map((n) => [String(n.id), n]));
    const linksById = new Map();
    for (const l of graph.links || []) {
      if (Array.isArray(l) && l.length >= 5) {
        linksById.set(l[0], { originId: String(l[1]), originSlot: l[2] });
      } else if (l && typeof l === 'object' && l.id !== undefined) {
        linksById.set(l.id, { originId: String(l.origin_id), originSlot: l.origin_slot });
      }
    }
    return { graph, prefix, boundary, nodesById, linksById };
  }

  const isSkipped = (node) => node.mode === 2 || node.mode === 4;

  // 인스턴스의 k번째 서브그래프 입력값 해석 — 외부 링크 우선, 아니면 승격 위젯 값
  function resolveInstanceInput(instCtx, instNode, sgDef, inputIndex, depth) {
    const instInput = (instNode.inputs || [])[inputIndex];
    if (instInput && instInput.link !== null && instInput.link !== undefined) {
      return resolveOrigin(instCtx, instInput.link, depth + 1);
    }
    // 승격 위젯: sg.inputs 중 위젯형만 순서대로 instNode.widgets_values 를 소비
    const widgetOrder = (sgDef.inputs || []).filter(isWidgetPromotedInput);
    const pos = widgetOrder.indexOf((sgDef.inputs || [])[inputIndex]);
    if (pos !== -1 && Array.isArray(instNode.widgets_values) && pos < instNode.widgets_values.length) {
      return { kind: 'literal', value: instNode.widgets_values[pos] };
    }
    return { kind: 'broken' };
  }

  // 컨텍스트 내 링크의 최종 출처 해석 (Reroute/Primitive/서브그래프 경계 통과)
  function resolveOrigin(ctx, linkId, depth = 0) {
    if (depth > 64) return { kind: 'broken' };
    const link = ctx.linksById.get(linkId);
    if (!link) return { kind: 'broken' };

    // 서브그래프 입력 노드(-10)에서 온 링크 → 인스턴스 입력으로 상향 탈출
    if (link.originId === SUBGRAPH_INPUT_NODE_ID) {
      const b = ctx.boundary;
      if (!b) return { kind: 'broken' };
      return resolveInstanceInput(b.parentCtx, b.instNode, b.sgDef, link.originSlot, depth);
    }

    const origin = ctx.nodesById.get(link.originId);
    if (!origin) return { kind: 'broken' };

    if (origin.mode === 4) {
      // bypass — 첫 연결 입력을 그대로 통과
      const passthrough = (origin.inputs || []).find((inp) => inp.link !== null && inp.link !== undefined);
      if (passthrough) return resolveOrigin(ctx, passthrough.link, depth + 1);
      return { kind: 'muted' };
    }
    if (origin.mode === 2) return { kind: 'muted' };

    if (origin.type === 'Reroute') {
      const upstream = (origin.inputs || []).find((inp) => inp.link !== null && inp.link !== undefined);
      if (!upstream) return { kind: 'broken' };
      return resolveOrigin(ctx, upstream.link, depth + 1);
    }
    if (origin.type === 'PrimitiveNode') {
      const wv = Array.isArray(origin.widgets_values) ? origin.widgets_values[0] : undefined;
      return { kind: 'literal', value: wv };
    }

    // 서브그래프 인스턴스의 출력 → 내부 그래프로 하강
    const sgDef = subgraphById.get(origin.type);
    if (sgDef) {
      const outDef = (sgDef.outputs || [])[link.originSlot];
      const innerCtx = makeCtx(sgDef, `${ctx.prefix}${origin.id}:`, { parentCtx: ctx, instNode: origin, sgDef });
      const innerLinkId = (outDef?.linkIds || [])[0];
      if (innerLinkId === undefined) return { kind: 'broken' };
      return resolveOrigin(innerCtx, innerLinkId, depth + 1);
    }

    return { kind: 'link', nodeId: `${ctx.prefix}${origin.id}`, slot: link.originSlot };
  }

  function processGraph(ctx) {
    for (const node of ctx.graph.nodes || []) {
      const rawId = String(node.id);
      const type = node.type;
      if (VIRTUAL_NODE_TYPES.has(type)) continue;
      if (isSkipped(node)) {
        warnings.push(`비활성(mute/bypass) 노드 제외: ${node.title || type} (#${ctx.prefix}${rawId})`);
        continue;
      }

      // 서브그래프 인스턴스 → 내부 그래프 재귀 확장 (API export 의 "인스턴스:내부" id 규칙)
      const sgDef = subgraphById.get(type);
      if (sgDef) {
        const innerCtx = makeCtx(sgDef, `${ctx.prefix}${rawId}:`, { parentCtx: ctx, instNode: node, sgDef });
        processGraph(innerCtx);
        continue;
      }

      const apiId = `${ctx.prefix}${rawId}`;
      const spec = objectInfo[type];
      if (!spec) {
        warnings.push(`서버에 없는 노드 타입: ${type} (#${apiId}) — 입력 매핑이 부정확할 수 있습니다.`);
      }

      const linkByInputName = new Map();
      for (const inp of node.inputs || []) {
        if (inp.link !== null && inp.link !== undefined) linkByInputName.set(inp.name, inp.link);
      }

      const inputs = {};
      const wv = node.widgets_values;
      const widgetQueue = Array.isArray(wv) ? [...wv] : null;
      const widgetDict = wv && !Array.isArray(wv) && typeof wv === 'object' ? wv : null;
      const inputSpecs = spec
        ? { ...(spec.input?.required || {}), ...(spec.input?.optional || {}) }
        : null;

      const applyOrigin = (name, origin, fallbackWidget, widgetValue) => {
        if (origin.kind === 'link') { inputs[name] = [origin.nodeId, origin.slot]; return; }
        if (origin.kind === 'literal') { inputs[name] = origin.value; return; }
        warnings.push(`${type} (#${apiId}) 의 입력 "${name}" 연결이 끊겨 있어 제외했습니다.`);
        if (fallbackWidget) inputs[name] = widgetValue;
      };

      if (inputSpecs) {
        for (const [name, inputSpec] of Object.entries(inputSpecs)) {
          const widget = isWidgetSpec(inputSpec);
          let widgetValue;
          let hasWidgetValue = false;
          if (widget) {
            if (widgetDict) {
              if (name in widgetDict) { widgetValue = widgetDict[name]; hasWidgetValue = true; }
            } else if (widgetQueue && widgetQueue.length > 0) {
              widgetValue = widgetQueue.shift();
              hasWidgetValue = true;
              // seed 류는 UI 전용 control_after_generate 값이 뒤따름 — 큐에서 소거
              const controlFlagged = inputSpec[1] && inputSpec[1].control_after_generate;
              const looksLikeSeed = (name === 'seed' || name === 'noise_seed');
              if ((controlFlagged || looksLikeSeed) && widgetQueue.length > 0 && CONTROL_AFTER_GENERATE_VALUES.has(widgetQueue[0])) {
                widgetQueue.shift();
              }
            }
          }
          const linkId = linkByInputName.get(name);
          if (linkId !== undefined) {
            applyOrigin(name, resolveOrigin(ctx, linkId), hasWidgetValue, widgetValue);
            continue;
          }
          if (widget && hasWidgetValue) inputs[name] = widgetValue;
          // 링크도 위젯 값도 없는 optional 입력은 생략 (API 포맷 관례)
        }
      } else {
        for (const [name, linkId] of linkByInputName.entries()) {
          applyOrigin(name, resolveOrigin(ctx, linkId), false);
        }
        if (Array.isArray(wv) && wv.length > 0) {
          warnings.push(`${type} (#${apiId}) 의 위젯 값 ${wv.length}개를 매핑하지 못했습니다 (노드 스키마 없음).`);
        }
      }

      apiWorkflow[apiId] = {
        inputs,
        class_type: type,
        _meta: { title: node.title || type },
      };
    }
  }

  processGraph(makeCtx(uiObj, '', null));

  if (Object.keys(apiWorkflow).length === 0) {
    throw new Error('변환 결과가 비어 있습니다 — 워크플로에 실행 가능한 노드가 없습니다.');
  }
  return { apiWorkflow, warnings };
}

module.exports = {
  convertUiToApi,
  isLinkInput,
  detectFormat,
  parseWorkflow,
  analyzeNodes,
  analyzeWorkflow,
  traceToTextEncoder,
  collectDeterministicPicks,
  buildDraftFromPicks,
  generateDraft,
  proposeLlmPicks,
  normalizeManagerMap,
  resolveMissingNodes,
};
