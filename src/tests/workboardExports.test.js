const fs = require('fs');
const path = require('path');

const { WORKFLOW_VARIABLE_KEYS } = require('../constants/workflowVariables');
const { ATTACHMENT_FIELD_TYPES } = require('../constants/mediaTypes');
const { normalizeModelFolders, isInModelFolders } = require('../utils/modelFolders');

// `workboards/` 배포 산출물 가드 (#825).
//
// 여기 있는 JSON 은 사용자가 그대로 import 하는 완성품이다. 잘못 나가면 받아간 모든 인스턴스가
// 같은 방식으로 깨지고, import 한 쪽에서는 원인을 찾을 방법이 없다. 실제로 두 번 새어나갔다:
//
//  - R2V 작업판의 base_model 이 FL2V 체크포인트를 가리키고 있었다 (#825) — 워크플로는 참조
//    경로인데 가중치만 다른 모델이라, 값 자체는 서버에 존재해 검증도 통과했다
//  - T2V 가 `{{##video_vae##}}` 를 선언 필드 없이 남겨 ComfyUI 가 치환 안 된 문자열을 그대로
//    받았다 (`value_not_in_list`)
//
// 둘 다 "실행해 봐야 아는" 게 아니라 파일만 보면 알 수 있는 것이었다.

const EXPORT_DIR = path.join(__dirname, '../../workboards/comfyui');

/** 첨부형 필드가 자동으로 얻는 파생 placeholder (#758, #772) */
const attachedKey = (fieldName) => `${fieldName}_attached`;

function loadExports() {
  return fs.readdirSync(EXPORT_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((file) => {
      const parsed = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, file), 'utf8'));
      return { file, workboard: parsed.workboard, raw: parsed };
    });
}

const EXPORTS = loadExports();

// 조건화 노드별 베이스 모델 계열 토큰 (#825). FastH3 Omni 는 ref2va 증류본이고 파일명에 'omniref' 를 쓴다 (#1093)
const FAMILY_BY_NODE = {
  MiniMaxH3ImageToVideo: ['fl2v'],
  MiniMaxH3ReferenceToVideo: ['ref2v', 'omniref'],
};

// 이름에 계열 토큰이 없는 모델을 판의 기본·허용 모델로 둘 때, 파일 헤더가 밝힌 원본 계열을 여기 적는다.
// 지금은 없다 — 커뮤니티 병합 모델용 판은 모델을 고정하지 않는다 (#1252)
const FAMILY_BY_FILE = {};

const baseName = (model) => String(model).split('\\').pop().toLowerCase();
/** 계열 판정용 이름 — 병합본은 헤더의 원본 계열, 나머지는 파일명 그대로 */
const familyOf = (model) => FAMILY_BY_FILE[baseName(model)] || baseName(model);

// 다른 계열 모델을 시험한 뒤 그 판에만 들인 경우 — 계열 규칙의 예외는 판 파일마다 여기 적는다.
// 지금은 없다 (#1252 — 모델을 고정하지 않는 판은 계열 검사 대상이 아니다)
const CROSS_FAMILY_TESTED = {};
const crossFamilyTested = (file, model) => (CROSS_FAMILY_TESTED[file] || []).includes(baseName(model));

// 가속이 이미 들어 있는 모델 (#1245). 이 모델에 터보·Pika LoRA 를 더하면 가속이 두 번 걸린다 —
// 11-20 8스텝 병합 모델을 FL2V Turbo 판에서 돌려 줄무늬 울림, R2V Pika 판에서 돌려 Pika 가 두 번 걸렸다.
// 파일 이름으로는 가릴 수 없어(공식 접두가 없는 원본형 파인튜닝도 있다) 하나씩 적는다.
const BAKED_ACCELERATION = new Set([
  'fasth3_omniref_8step_pruned_int8_convrot.safetensors',              // FastH3 Omni 8스텝 증류 (#1093)
]);

/** 가속 LoRA(터보·Pika, `optimizer/minimax/`)를 거는 판인가 — 값이 칸에서 오면 그 칸의 선택지로 본다 */
function addsAcceleration(workflow, fields) {
  const isAccel = (name) => /^optimizer\\minimax\\/i.test(String(name));
  return Object.values(workflow).some((n) => {
    if (n.class_type !== 'LoraLoaderModelOnly') return false;
    const v = n.inputs && n.inputs.lora_name;
    const m = typeof v === 'string' && v.match(/^\{\{##(.+?)##\}\}$/);
    if (!m) return isAccel(v);
    const field = fields.find((f) => f.name === m[1]);
    return !!field && (field.options || []).some((o) => isAccel(o.value));
  });
}

describe('workboards/ 배포 산출물', () => {
  it('검사 대상이 실제로 존재한다', () => {
    // 0건이면 위 테스트들이 전부 조용히 통과한다 — 디렉토리가 비거나 옮겨진 것을 이 한 줄로 잡는다
    expect(EXPORTS.length).toBeGreaterThan(0);
  });

  describe.each(EXPORTS.map((e) => [e.file, e]))('%s', (_file, exported) => {
    const wb = exported.workboard;
    const workflow = JSON.parse(wb.workflowData);
    const fields = wb.additionalInputFields || [];

    it('workflowData 가 API 포맷으로 파싱된다', () => {
      const nodes = Object.values(workflow);
      expect(nodes.length).toBeGreaterThan(0);
      nodes.forEach((node) => {
        expect(typeof node.class_type).toBe('string');
        expect(node.class_type.length).toBeGreaterThan(0);
      });
    });

    it('모든 placeholder 가 builtin 이거나 선언된 필드에서 나온다', () => {
      const used = new Set(
        [...wb.workflowData.matchAll(/\{\{##(.+?)##\}\}/g)].map((m) => m[1])
      );

      const known = new Set(WORKFLOW_VARIABLE_KEYS.map((k) => k.replace(/^\{\{##|##\}\}$/g, '')));
      fields.forEach((f) => {
        known.add(f.name);
        // 첨부형 필드는 `_attached` 를 백엔드가 1/0 으로 자동 제공한다
        if (ATTACHMENT_FIELD_TYPES.includes(f.type)) known.add(attachedKey(f.name));
      });

      const unresolved = [...used].filter((name) => !known.has(name)).sort();
      // 치환되지 않은 placeholder 는 ComfyUI 에 문자열 그대로 도달해 value_not_in_list 로 죽는다
      expect(unresolved).toEqual([]);
    });

    it('베이스 모델 기본값이 판의 모델 폴더 제한 안에 있다 (#1086)', () => {
      // 밖에 있으면 판을 열자마자 실행이 거절된다. 폴더 제한은 저장 형태(`qwen/`)여야 한다 —
      // 아니면 가져온 서버에 정규화된 값이 저장돼 dry-run 이 영원히 would-update 로 남는다.
      const folders = wb.allowedModelFolders || [];
      expect(normalizeModelFolders(folders)).toEqual({ folders, errors: [] });
      const baseModel = fields.find((f) => f.type === 'baseModel');
      if (folders.length === 0 || !baseModel || !baseModel.defaultValue) return;
      expect(isInModelFolders(baseModel.defaultValue, folders)).toBe(true);
    });

    it('프롬프트·부정 프롬프트 자리표시자에 글자를 덧붙여 두지 않는다 (#1262)', () => {
      // 품질 태그·부정 태그를 워크플로 문자열에 박으면 사용자가 무엇이 붙는지 볼 수도 뺄 수도 없다.
      // 판의 기본 프롬프트·기본 부정 프롬프트(defaultPrompt · defaultNegativePrompt)에 둔다 — 실행 화면 칸에 채워져 나온다.
      // 프롬프트를 다른 값과 조합하는 판(LoRA 태그 자리 등)이 생기면 그 판을 여기 예외로 적는다.
      let nodes;
      try { nodes = Object.values(workflow); } catch { return; }
      const baked = nodes.flatMap((n) => Object.values(n.inputs || {}))
        .filter((v) => typeof v === 'string' && /\{\{##(prompt|negative_prompt)##\}\}/.test(v))
        .filter((v) => v !== '{{##prompt##}}' && v !== '{{##negative_prompt##}}');
      expect(baked).toEqual([]);
      expect(typeof (wb.defaultPrompt ?? '')).toBe('string');
      expect(typeof (wb.defaultNegativePrompt ?? '')).toBe('string');
    });

    it('required 필드에 기본값이 있다', () => {
      const missing = fields
        .filter((f) => f.required && !ATTACHMENT_FIELD_TYPES.includes(f.type))
        // 모델을 고정하지 않는 판은 베이스 모델을 비워 둔다 — 설치자 서버의 모델에서 직접 고른다 (#1252)
        .filter((f) => !(f.type === 'baseModel' && wb.modelExposurePolicy === 'full'))
        .filter((f) => f.defaultValue === undefined || f.defaultValue === null || f.defaultValue === '')
        .map((f) => f.name);
      expect(missing).toEqual([]);
    });

    it('베이스 모델이 워크플로의 조건부 경로와 같은 계열이다', () => {
      // 같은 모델 제품군이라도 조건부 방식마다 체크포인트가 갈린다. 값이 서버 목록에 있으면
      // ComfyUI 검증은 통과하므로, 계열 불일치는 여기서만 잡힌다 (#825).
      const classTypes = new Set(Object.values(workflow).map((n) => n.class_type));
      const conditioning = Object.keys(FAMILY_BY_NODE).filter((n) => classTypes.has(n));
      if (conditioning.length === 0) return; // 계열 규칙이 정의되지 않은 워크플로

      // T2VA 전용 증류 체크포인트(FastH3 등)는 fl2v/ref2v 계열 토큰이 없다 (#928, #976).
      // v1 은 t8star 4step 셋업 노드의 task_family 't2va_only' 로 드러난다.
      // V2 는 코어 노드만 쓰므로 그 표식이 없다 — 조건화 노드에 첫·끝 프레임 입력이 아예 없고
      // 베이스 모델이 FastH3 증류본인 것으로 판별한다 (조건부 입력을 쓰면 계열 검사가 다시 걸린다).
      const baseModelName = String(
        fields.find((f) => f.name === 'base_model')?.defaultValue || ''
      ).toLowerCase();
      const t2vOnly = Object.values(workflow).some((n) =>
        (n.class_type === 'MiniMaxH3FastH34StepSetupT8Advanced' && n.inputs?.task_family === 't2va_only')
        || (n.class_type === 'MiniMaxH3ImageToVideo'
            && n.inputs?.first_frame === undefined && n.inputs?.last_frame === undefined
            && /fasth3|fastvideo/.test(baseModelName)));
      if (t2vOnly) return;

      expect(conditioning).toHaveLength(1);
      const tokens = FAMILY_BY_NODE[conditioning[0]];
      const baseModel = fields.find((f) => f.name === 'base_model');
      expect(baseModel).toBeDefined();

      // 파일명 표기는 fl2va / ref2va 처럼 접미가 붙는다 — 계열 토큰만 확인한다
      if (!baseModel.defaultValue) return; // 모델을 고정하지 않는 판 (#1252)
      if (crossFamilyTested(exported.file, baseModel.defaultValue)) return;
      expect(familyOf(baseModel.defaultValue)).toMatch(new RegExp(tokens.join('|')));
    });

    it('AI 프롬프트 생성 지침의 정렬 초가 길이 선택지와 맞는다 (#1111)', () => {
      // H3 FL2V 판 지침은 끝 프레임 정렬 문장에 영상 길이를 초로 적게 하고, 그 값을 표로 준다.
      // 길이는 프레임 수 ÷ 24 (ComfyUI nodes_minimax_h3.py 의 FPS). 길이 선택지만 바꾸고 지침을 그대로 두면
      // 생성기가 판에 없는 길이의 초를 쓰고, 이건 생성해 봐야만 드러난다.
      const text = wb.promptGeneratorInstructions || '';
      if (!text.includes('aligns with the T-second mark')) return;
      const length = fields.find((f) => f.name === 'length');
      expect(length).toBeDefined();
      const missing = (length.options || [])
        .map((o) => (Number(o.value) / 24).toFixed(2))
        .filter((sec) => !text.includes(sec));
      expect(missing).toEqual([]);
    });

    it('시프트 노드를 쓰는 판은 시그마를 직접 넣지 않는다 (#1095)', () => {
      // 시프트는 모델의 시그마 표에 걸리고, 스케줄러(BasicScheduler 등)가 그 표에서 시그마를 뽑는다.
      // ManualSigmas 값은 그대로 샘플러로 가서 시프트를 건너뛴다. FastH3 V2 판이 학습 계단(시프트 전 값)을
      // 이렇게 넣어 학습과 다른 스케줄로 돌았다. LTX 증류판처럼 시프트 노드 없이 확정 시그마를 쓰는 판은 대상이 아니다.
      // 시프트 1.0 은 항등이라 시그마 표를 바꾸지 않는다 — P-H3-Image 공식 워크플로처럼 시프트를 1.0 으로 고정하고
      // 확정 시그마를 넣는 판도 대상이 아니다 (#1121). 값이 자리표시자면 사용자가 바꿀 수 있으니 시프트로 본다.
      const classTypes = Object.values(workflow).map((n) => n.class_type);
      const isIdentityShift = (n) => {
        const shifts = Object.entries(n.inputs || {}).filter(([k]) => /shift/i.test(k)).map(([, v]) => v);
        return shifts.length > 0 && shifts.every((v) => v === 1);
      };
      const shifted = Object.values(workflow)
        .some((n) => /SigmaShift|^ModelSampling/.test(n.class_type) && !isIdentityShift(n));
      if (!shifted) return;
      expect(classTypes).not.toContain('ManualSigmas');
    });

    it('MiniMax H3 를 쓰는 판은 설명에 "Powered by MiniMax H3" 고지가 있다 (#1124)', () => {
      // H3 커뮤니티 라이선스 3-a 의 고지. H3 노드(MiniMaxH3*·PH3*)나 H3 가중치(minimax_h3*)를 쓰면 대상이다 —
      // 업샘플러 판처럼 H3 노드 없이 H3 가중치만 쓰는 판도 있어 둘 다 본다. MiniMax Music 은 H3 가 아니다.
      const source = wb.workflowData + JSON.stringify(fields);
      const usesH3 = /"class_type":\s*"(MiniMaxH3|PH3)|minimax_h3/i.test(source);
      if (!usesH3) return;
      expect(wb.description).toContain('Powered by MiniMax H3');
    });

    it('MiniMax H3 영상 판은 맞게 도는 모델만 허용 목록으로 둔다 (#1245)', () => {
      // 폴더 전체를 열면 다른 계열(fl2va↔ref2va)·병합본·이미지·음악 모델까지 선택지에 뜬다.
      // 규칙 1: 가속 LoRA 를 거는 판에는 가속 든 모델이 없다. 가속 든 모델이 기본인 판은 가속 든 모델만 둔다.
      // 규칙 2: 허용 모델이 모두 판의 조건화 계열이다.
      const classTypes = new Set(Object.values(workflow).map((n) => n.class_type));
      const conditioning = Object.keys(FAMILY_BY_NODE).filter((n) => classTypes.has(n));
      const baseModel = fields.find((f) => f.name === 'base_model');
      if (conditioning.length !== 1 || !baseModel) return;

      // 예외: 모델을 고정하지 않는 범용 판 (#1252). 가속이 병합된 커뮤니티 모델은 설치자마다 달라 이름으로 적을 수 없다.
      // 기본 모델을 비우고 폴더 전체를 열되, 가속 LoRA 를 더 걸지는 않아야 한다 (병합 모델에 가속이 두 번 걸린다).
      if (!baseModel.defaultValue) {
        expect(wb.modelExposurePolicy).toBe('full');
        expect(wb.modelWhitelist || []).toEqual([]);
        expect(addsAcceleration(workflow, fields)).toBe(false);
        return;
      }
      expect(wb.modelExposurePolicy).toBe('whitelist');
      const list = wb.modelWhitelist || [];
      expect(list.length).toBeGreaterThan(0);
      expect(list).toContain(baseModel.defaultValue);

      const tokens = new RegExp(FAMILY_BY_NODE[conditioning[0]].join('|'));
      expect(list.filter((m) => !tokens.test(familyOf(m)) && !crossFamilyTested(exported.file, m))).toEqual([]);

      const baked = list.filter((m) => BAKED_ACCELERATION.has(baseName(m)));
      if (addsAcceleration(workflow, fields)) expect(baked).toEqual([]);
      if (BAKED_ACCELERATION.has(baseName(baseModel.defaultValue))) expect(baked).toEqual(list);
    });

    it('샘플링 선택 칸은 샘플러와 스케줄러를 함께 바꾼다 (#1252)', () => {
      // 샘플러만 바꾸고 스케줄러를 그대로 두면 모델 배포처가 권한 조합(euler · beta57 / lcm · simple)이 깨진다.
      const sampling = fields.find((f) => f.name === 'sampling');
      if (!sampling) return;
      expect((sampling.options || []).map((o) => o.value).sort()).toEqual(['euler', 'lcm']);
      const nodes = Object.entries(workflow);
      const select = nodes.filter(([, n]) => n.class_type === 'KSamplerSelect');
      expect(select.map(([, n]) => n.inputs.sampler_name)).toEqual(['{{##sampling##}}']);
      const [cmpId, cmp] = nodes.find(([, n]) => n.class_type === 'StringCompare' && n.inputs.string_a === '{{##sampling##}}');
      expect(cmp.inputs).toMatchObject({ string_b: 'lcm', mode: 'Equal' });
      const [swId, sw] = nodes.find(([, n]) => n.class_type === 'ComfySwitchNode' && JSON.stringify(n.inputs.switch) === JSON.stringify([cmpId, 0]));
      const onTrue = workflow[sw.inputs.on_true[0]];
      const onFalse = workflow[sw.inputs.on_false[0]];
      expect(onTrue).toMatchObject({ class_type: 'BasicScheduler', inputs: { scheduler: 'simple' } });
      expect(onFalse).toMatchObject({ class_type: 'BetaSamplingScheduler', inputs: { alpha: 0.5, beta: 0.7 } });
      expect(onTrue.inputs.steps).toEqual(onFalse.inputs.steps);
      expect(onTrue.inputs.model).toEqual(onFalse.inputs.model);
      const advanced = nodes.filter(([, n]) => n.class_type === 'SamplerCustomAdvanced');
      expect(advanced.map(([, n]) => n.inputs.sigmas)).toEqual([[swId, 0]]);
    });

    it('계열 예외 목록의 판이 실제로 있고 그 모델을 쓴다 (#1242)', () => {
      // 판 이름을 바꾸거나 모델을 갈았는데 예외만 남으면, 다른 판이 그 이름으로 예외를 물려받을 수 있다
      const allowed = CROSS_FAMILY_TESTED[exported.file];
      if (!allowed) return;
      expect(allowed).toContain(baseName(fields.find((f) => f.name === 'base_model').defaultValue));
    });

    it('Turbo 시프트 자동 — 시프트 12 목록이 터보 LoRA 선택지와 맞고 시프트 노드에 연결된다 (#1245)', () => {
      // 목록 항목이 선택지 값과 한 글자라도 다르면 자동이 조용히 6 을 고른다 (v1.2 는 6 에서 배경색이 흔들린다, #1236)
      const list = Object.entries(workflow).find(([, n]) =>
        n.class_type === 'StringContains' && n.inputs && n.inputs.substring === ';{{##turbo_lora##}};');
      if (!list) return;
      const [listId, listNode] = list;
      const turbo = fields.find((f) => f.name === 'turbo_lora');
      const values = (turbo.options || []).map((o) => o.value);
      const entries = listNode.inputs.string.split(';').filter(Boolean);
      expect(entries.filter((e) => !values.includes(e))).toEqual([]);
      // LightX2V 8스텝 설정이 v1.2 에서 video_flow_shift 12 (ModelTC/LightX2V#1706)
      expect(entries).toEqual(values.filter((v) => /8step_v1\.2/.test(v)));

      const calc = Object.entries(workflow).find(([, n]) =>
        n.class_type === 'ComfyMathExpression' && JSON.stringify(n.inputs['values.a']) === JSON.stringify([listId, 0]));
      expect(calc).toBeDefined();
      const shiftNodes = Object.values(workflow).filter((n) => n.class_type === 'MiniMaxH3SigmaShift');
      expect(shiftNodes.map((n) => n.inputs.shift_video)).toEqual([[calc[0], 0]]);

      const shift = fields.find((f) => f.name === 'shift_video');
      expect(shift.defaultValue).toBe('0');
      expect((shift.options || []).map((o) => o.value)).toEqual(expect.arrayContaining(['0', '6', '12']));

      // 기본 터보 LoRA 는 8step v1.2 (11-20 사용자 결정, #1236) — 첫 선택지가 기본값과 같아야 목록 맨 위가 기본이다
      expect(turbo.defaultValue).toMatch(/8step_v1\.2/);
      expect(turbo.options[0].value).toBe(turbo.defaultValue);
    });
  });
});
