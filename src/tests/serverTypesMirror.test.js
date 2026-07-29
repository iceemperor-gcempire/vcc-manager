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
