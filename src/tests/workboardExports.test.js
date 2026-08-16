const fs = require('fs');
const path = require('path');

const { WORKFLOW_VARIABLE_KEYS } = require('../constants/workflowVariables');
const { ATTACHMENT_FIELD_TYPES } = require('../constants/mediaTypes');

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

    it('required 필드에 기본값이 있다', () => {
      const missing = fields
        .filter((f) => f.required && !ATTACHMENT_FIELD_TYPES.includes(f.type))
        .filter((f) => f.defaultValue === undefined || f.defaultValue === null || f.defaultValue === '')
        .map((f) => f.name);
      expect(missing).toEqual([]);
    });

    it('베이스 모델이 워크플로의 조건부 경로와 같은 계열이다', () => {
      // 같은 모델 제품군이라도 조건부 방식마다 체크포인트가 갈린다. 값이 서버 목록에 있으면
      // ComfyUI 검증은 통과하므로, 계열 불일치는 여기서만 잡힌다 (#825).
      const FAMILY_BY_NODE = {
        MiniMaxH3ImageToVideo: 'fl2v',
        MiniMaxH3ReferenceToVideo: 'ref2v',
      };
      const classTypes = new Set(Object.values(workflow).map((n) => n.class_type));
      const conditioning = Object.keys(FAMILY_BY_NODE).filter((n) => classTypes.has(n));
      if (conditioning.length === 0) return; // 계열 규칙이 정의되지 않은 워크플로

      expect(conditioning).toHaveLength(1);
      const family = FAMILY_BY_NODE[conditioning[0]];
      const baseModel = fields.find((f) => f.name === 'base_model');
      expect(baseModel).toBeDefined();

      // 파일명 표기는 fl2va / ref2va 처럼 접미가 붙는다 — 계열 토큰만 확인한다
      const filename = String(baseModel.defaultValue).split('\\').pop().toLowerCase();
      expect(filename).toContain(family);
    });
  });
});
