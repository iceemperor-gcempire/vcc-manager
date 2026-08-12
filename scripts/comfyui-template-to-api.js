#!/usr/bin/env node
/**
 * ComfyUI 템플릿(UI 포맷, 서브그래프 포함) → API 포맷 변환 (#800)
 *
 * ComfyUI 가 배포하는 공식 워크플로 템플릿은 에디터용 UI 포맷이다. VCC 작업판은
 * API 포맷(`nodeId → {inputs, class_type}`)을 요구하므로 변환이 필요하다.
 *
 *   node scripts/comfyui-template-to-api.js <템플릿.json> <object_info.json> <출력.json>
 *
 * object_info 는 대상 ComfyUI 서버에서 받는다 — 위젯 이름·순서·타입의 유일한 근거다.
 *
 *   curl -s http://<comfyui>/object_info > object_info.json
 *
 * 템플릿 자체도 돌고 있는 ComfyUI 에서 바로 받을 수 있다.
 *
 *   curl -s http://<comfyui>/templates/index.json          # 목록
 *   curl -s http://<comfyui>/templates/video_ltx2_5_t2v.json
 *
 * ## 위젯 매핑이 어려운 이유
 *
 * `widgets_values` 는 **이름 없는 값 배열**이다. object_info 의 입력 순서대로 소비해야
 * 하는데, 소비 규칙이 세 군데서 어긋난다. 셋 다 **값을 조용히 한 칸씩 밀어놓고 구조
 * 검증은 통과**시킨 뒤 실행에서 터진다 — 전부 실제로 겪은 버그다.
 *
 *  1. `COMFY_DYNAMICCOMBO_V3` 는 고른 선택지의 하위 입력을 이어서 소비한다.
 *     API 포맷에서는 `부모.자식` 점 표기로 적는다 (`sampling_mode.temperature`).
 *     평탄한 형제 키로 적으면 검증기가 무시하고 required 누락으로 거부한다.
 *  2. 위젯 타입 판정은 **허용목록**이어야 한다. 차단목록이면 `COMFY_MATCHTYPE_V3`
 *     같은 신규 링크 타입을 위젯으로 오인한다.
 *  3. 허용목록은 **다중 타입을 분리 비교**해야 한다. `LTXVEmptyLatentAudio.frame_rate`
 *     의 타입은 `"FLOAT,INT"` 다. 통째로 비교하면 위젯이 아니라고 판정된다.
 *
 * 변환 후에는 `--verify` 로 원본 `widgets_values` 와 결과를 대조할 것.
 */
const fs = require('fs');

const LINK_TYPES = new Set(['MODEL','CLIP','VAE','LATENT','IMAGE','MASK','AUDIO','CONDITIONING',
  'SIGMAS','SAMPLER','GUIDER','NOISE','VIDEO','LATENT_UPSCALE_MODEL','UPSCALE_MODEL','CONTROL_NET','*']);

// 위젯 타입은 **허용목록**으로 판정한다. 차단목록으로 하면 COMFY_MATCHTYPE_V3 처럼
// 새로 생긴 링크 전용 타입을 위젯으로 오인해 widgets_values 소비가 한 칸씩 밀린다 (실측 버그).
const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO', 'COMFY_DYNAMICCOMBO_V3']);
const isWidgetSpec = (spec) => {
  if (!Array.isArray(spec)) return false;
  const t = spec[0];
  if (Array.isArray(t)) return true;           // legacy combo (옵션 배열이 직접 옴)
  if (typeof t !== 'string') return false;
  // 다중 타입 위젯이 있다 — LTXVEmptyLatentAudio.frame_rate 는 "FLOAT,INT" 다.
  // 통째로 비교하면 위젯이 아니라고 판정되어 widgets_values 소비가 밀린다 (실측 버그).
  return t.split(',').some((x) => WIDGET_TYPES.has(x.trim()));
};

// COMFY_DYNAMICCOMBO_V3 는 고른 선택지에 따라 하위 입력이 딸려 나온다.
// widgets_values 에서는 [선택지키, ...하위 위젯값들] 이 평탄하게 이어진다.
// 선택지의 하위 입력도 dynamic combo 일 수 있어 재귀로 센다.
const isDynCombo = (spec) => Array.isArray(spec) && spec[0] === 'COMFY_DYNAMICCOMBO_V3';

function dynComboChildren(spec, selectedKey) {
  const opts = (spec[1] && spec[1].options) || [];
  const opt = opts.find((o) => o.key === selectedKey);
  if (!opt) return [];
  const out = [];
  for (const sec of ['required', 'optional']) {
    for (const [name, childSpec] of Object.entries(opt.inputs?.[sec] || {})) {
      if (!isWidgetSpec(childSpec) && !isDynCombo(childSpec)) continue;
      out.push({ name, spec: childSpec });
    }
  }
  return out;
}

// widgets_values 를 순서대로 소비하며 {이름: 값} 을 만든다.
function readWidgets(objInfo, classType, wv) {
  const info = objInfo[classType];
  if (!info) throw new Error('object_info 없음: ' + classType);

  const values = {};
  let i = 0;

  const consume = (name, spec) => {
    const v = wv[i];
    i += 1;
    if (v !== undefined) values[name] = v;
    if (isDynCombo(spec)) {
      // 하위 입력은 `부모.자식` 점 표기로 기록한다 — COMFY_AUTOGROW_V3 의
      // `ref_images.ref_image_0` 와 같은 규약이다. 평탄한 형제 키는 검증기가 무시하고
      // "required input missing (sampling_mode.temperature)" 로 거부한다 (실측).
      for (const child of dynComboChildren(spec, v)) consume(`${name}.${child.name}`, child.spec);
      return;
    }
    if (spec[1] && spec[1].control_after_generate) i += 1; // seed 뒤의 control 값
  };

  for (const sec of ['required', 'optional']) {
    for (const [name, spec] of Object.entries(info.input?.[sec] || {})) {
      if (!isWidgetSpec(spec)) continue;
      consume(name, spec);
    }
  }
  return { values, consumed: i };
}

function flatten(templatePath, objInfoPath) {
  const tpl = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const objInfo = JSON.parse(fs.readFileSync(objInfoPath, 'utf8'));
  const sg = tpl.definitions.subgraphs[0];
  const linkById = new Map((sg.links || []).map((l) => [l.id, l]));

  // 서브그래프 입력(호스트에서 주입되는 값) — 링크 id → 입력 정의
  const sgInputByLink = new Map();
  (sg.inputs || []).forEach((inp) => (inp.linkIds || []).forEach((id) => sgInputByLink.set(id, inp)));

  const api = {};
  const hostFed = [];      // 서브그래프 입력으로 들어오던 자리 (수동 채움 필요)
  const widgetAudit = [];  // --verify 용: 노드별 원본 배열 ↔ 이름 매핑

  for (const node of sg.nodes) {
    if (/^(MarkdownNote|Note|PreviewAny)$/.test(node.type)) continue;
    const inputs = {};
    const linkedNames = new Set();

    for (const inp of node.inputs || []) {
      if (inp.link == null) continue;
      const link = linkById.get(inp.link);
      if (link) {
        inputs[inp.name] = [String(link.origin_id), link.origin_slot];
        linkedNames.add(inp.name);
      } else if (sgInputByLink.has(inp.link)) {
        const sgi = sgInputByLink.get(inp.link);
        inputs[inp.name] = `__HOST__${sgi.label || sgi.name}`;
        linkedNames.add(inp.name);
        hostFed.push({ node: node.id, type: node.type, input: inp.name, host: sgi.label || sgi.name });
      }
    }

    // 위젯 값 — object_info 순서대로 소비 (dynamic combo 는 하위까지 재귀).
    // 링크로 대체된 이름은 링크가 이긴다.
    const { values: widgets, consumed } = readWidgets(objInfo, node.type, node.widgets_values || []);
    widgetAudit.push({ id: node.id, type: node.type, raw: node.widgets_values || [], consumed, mapped: widgets });
    for (const [name, value] of Object.entries(widgets)) {
      if (linkedNames.has(name)) continue;
      inputs[name] = value;
    }

    api[String(node.id)] = { inputs, class_type: node.type, _meta: { title: node.title || node.type } };
  }
  return { api, hostFed, widgetAudit };
}

// 위젯 소비 정합성 검사.
//
// 핵심 신호는 **소비한 개수 == 원본 배열 길이** 다. 소비 규칙이 하나라도 어긋나면
// 개수가 안 맞고, 그 시점부터 이후 값이 통째로 밀린다. 실제 버그 세 건이 모두
// 이 검사로 잡혔을 것이다 (예: frame_rate 를 위젯이 아니라고 판정 → 3개 중 2개만 소비).
//
// 링크로 대체된 위젯의 값이 결과에 안 보이는 것은 **정상**이므로 신호로 쓰지 않는다.
function verifyWidgets(audit) {
  const problems = [];
  for (const a of audit) {
    if (a.raw.length === 0) continue;
    if (a.consumed !== a.raw.length) {
      problems.push({
        label: `#${a.id} ${a.type}`,
        detail: `원본 ${a.raw.length}개 중 ${a.consumed}개만 소비  ${JSON.stringify(a.raw)}`,
        mapped: a.mapped,
      });
    }
  }
  return problems;
}

const args = process.argv.slice(2);
const doVerify = args.includes('--verify');
const [tplPath, objPath, outPath] = args.filter((a) => !a.startsWith('--'));

if (!tplPath || !objPath || !outPath) {
  console.error('사용법: node scripts/comfyui-template-to-api.js <템플릿.json> <object_info.json> <출력.json> [--verify]');
  process.exit(1);
}

const { api, hostFed, widgetAudit } = flatten(tplPath, objPath);
fs.writeFileSync(outPath, JSON.stringify(api, null, 2));
console.log('노드', Object.keys(api).length, '개 →', outPath);

if (hostFed.length > 0) {
  console.log('\n서브그래프 입력으로 주입되던 자리 (수동 지정 필요):');
  hostFed.forEach((h) => console.log(`  #${h.node} ${h.type}.${h.input}  ← ${h.host}`));
}

// 서브그래프 입력은 `["-10", n]` 으로 남는다 — n 은 subgraph inputs 배열의 인덱스다.
const sgInputs = JSON.parse(fs.readFileSync(tplPath, 'utf8')).definitions.subgraphs[0].inputs || [];
const pending = [];
for (const [id, node] of Object.entries(api)) {
  for (const [k, v] of Object.entries(node.inputs)) {
    if (Array.isArray(v) && v[0] === '-10') {
      const def = sgInputs[v[1]];
      pending.push(`  #${id} ${node.class_type}.${k}  ← [${v[1]}] ${def ? (def.label || def.name) : '?'}`);
    }
  }
}
if (pending.length > 0) {
  console.log('\n치환해야 할 서브그래프 입력 (플레이스홀더 또는 고정값):');
  pending.forEach((p) => console.log(p));
}

if (doVerify) {
  const problems = verifyWidgets(widgetAudit);
  console.log('\n=== 위젯 소비 정합성 ===');
  if (problems.length === 0) {
    console.log(`${widgetAudit.filter((a) => a.raw.length).length}개 노드 모두 원본 widgets_values 를 남김없이 소비`);
  } else {
    console.log(`불일치 ${problems.length}건 — 값이 밀렸을 가능성이 높다:`);
    for (const p of problems) {
      console.log(`  ${p.label}`);
      console.log(`     ${p.detail}`);
      console.log(`     매핑: ${JSON.stringify(p.mapped)}`);
    }
    process.exitCode = 1;
  }
}
