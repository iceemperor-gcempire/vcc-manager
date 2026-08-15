/**
 * #745 — serverType mirror 동기화 회귀 테스트.
 *
 * frontend/mcp-server 는 모듈 시스템이 달라(ESM vs CJS) backend 단일 source 를
 * 직접 import 할 수 없어 생성된 mirror 를 쓴다. backend 상수만 바뀌고
 * `node scripts/sync-server-type-mirrors.js` 재실행을 잊은 회귀를 여기서 잡는다.
 * (builtinTagsMirror.test.js 와 같은 single-source-of-truth 정책)
 */
const fs = require('fs');
const path = require('path');
const {
  renderFrontendCapabilities,
  renderMcpConstants,
  FRONTEND_TARGET,
  MCP_TARGET,
} = require('../../scripts/sync-server-type-mirrors');
const { SERVER_TYPE_SPECS, SERVER_TYPES } = require('../constants/serverTypes');

describe('serverTypes mirror 동기화 (#745)', () => {
  test('frontend capabilities.js 가 생성 결과와 일치 (sync 스크립트 재실행 필요 여부)', () => {
    const onDisk = fs.readFileSync(FRONTEND_TARGET, 'utf8');
    expect(onDisk).toBe(renderFrontendCapabilities());
  });

  test('mcp-server 상수가 생성 결과와 일치', () => {
    const onDisk = fs.readFileSync(MCP_TARGET, 'utf8');
    expect(onDisk).toBe(renderMcpConstants());
  });

  // "스크립트 출력 == 파일" 만 보면 **스크립트 자신이 틀린 경우**를 못 잡는다.
  // 실제로 OUTPUT_FORMATS 가 ['image','video','text'] 로 하드코딩돼 있어, ComfyUI 에
  // audio 를 추가해도 MCP 미러에 반영되지 않았는데 위 두 테스트는 통과했다 (#805).
  // 그래서 원본(SERVER_TYPE_SPECS)과 직접 대조한다.
  test('mcp OUTPUT_FORMATS 가 원본 outputFormats 의 합집합과 일치', () => {
    const { SERVER_TYPES, SERVER_TYPE_SPECS } = require('../constants/serverTypes');
    const expected = [...new Set(SERVER_TYPES.flatMap((t) => SERVER_TYPE_SPECS[t].outputFormats))];

    const onDisk = fs.readFileSync(MCP_TARGET, 'utf8');
    const m = onDisk.match(/export const OUTPUT_FORMATS = (\[[\s\S]*?\]);/);
    expect(m).toBeTruthy();
    const actual = JSON.parse(m[1]);

    expect([...actual].sort()).toEqual([...expected].sort());
  });

  test('capability 조합마다 frontend 템플릿이 등록되어 있음', () => {
    // TEMPLATES 는 JSON import 라 codegen 대상이 아님 — 키 존재만 텍스트로 검증.
    const indexSrc = fs.readFileSync(
      path.join(__dirname, '../../frontend/src/templates/index.js'),
      'utf8'
    );
    for (const serverType of SERVER_TYPES) {
      for (const format of SERVER_TYPE_SPECS[serverType].outputFormats) {
        expect(indexSrc).toContain(`'${serverType}:${format}'`);
      }
    }
  });

  test('mcp workboards 도구가 mirror 상수를 사용 (하드코딩 enum 회귀 방지)', () => {
    const toolSrc = fs.readFileSync(
      path.join(__dirname, '../../mcp-server/src/tools/workboards.js'),
      'utf8'
    );
    expect(toolSrc).toContain("from '../constants/serverTypes.js'");
    expect(toolSrc).not.toMatch(/z\.enum\(\[\s*'ComfyUI'/);
  });
});
