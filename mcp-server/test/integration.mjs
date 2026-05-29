#!/usr/bin/env node
// MCP 통합 테스트 (#448) — 실제 MCP 서버에 Streamable HTTP 로 접속해 프로젝트 / 파이프라인
// 도구의 핸드셰이크 ~ 호출 흐름을 검증.
//
// 실행:
//   MCP_TEST_API_KEY=<VCC API Key> node test/integration.mjs
//   MCP_TEST_URL=https://alpha-vccm-mcp.gcempire.net/mcp MCP_TEST_API_KEY=... node test/integration.mjs
//
// 환경변수:
//   MCP_TEST_URL          MCP endpoint (기본 http://localhost:3100/mcp)
//   MCP_TEST_API_KEY      VCC API Key (필수) — Bearer 토큰으로 전달
//   MCP_TEST_RUN_PIPELINE 1 이면 run_pipeline 까지 실제 실행 (LLM/ComfyUI 호출 발생 — 기본 skip)
//   MCP_TEST_INITIAL_PROMPT  run_pipeline 시 사용할 prompt (기본 "통합 테스트 prompt")
//
// 검증 범위:
//   1) initialize + tools/list — 신규 6개 도구 노출 확인
//   2) list_projects — 응답 shape 검증
//   3) 프로젝트가 있으면: list_pipelines → get_pipeline → list_pipeline_runs
//   4) MCP_TEST_RUN_PIPELINE=1 + 파이프라인 존재 시: run_pipeline → get_pipeline_run 폴링
//
// 파이프라인 / 프로젝트 데이터가 없으면 해당 단계는 skip (read-only 라 안전).

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_URL = process.env.MCP_TEST_URL || 'http://localhost:3100/mcp';
const API_KEY = process.env.MCP_TEST_API_KEY;
const RUN_PIPELINE = process.env.MCP_TEST_RUN_PIPELINE === '1';
const INITIAL_PROMPT = process.env.MCP_TEST_INITIAL_PROMPT || '통합 테스트 prompt';

const EXPECTED_TOOLS = [
  'list_projects',
  'list_pipelines',
  'get_pipeline',
  'run_pipeline',
  'get_pipeline_run',
  'list_pipeline_runs',
];

let passed = 0;
let failed = 0;
const log = (...a) => console.log(...a);
function check(label, cond, detail = '') {
  if (cond) { passed++; log(`  ✓ ${label}`); }
  else { failed++; log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); }
}

// tool 응답에서 JSON 텍스트를 파싱.
function parseToolJson(result) {
  const text = result?.content?.find((c) => c.type === 'text')?.text;
  if (!text) throw new Error('tool 응답에 text content 없음');
  return JSON.parse(text);
}

async function main() {
  if (!API_KEY) {
    console.error('Error: MCP_TEST_API_KEY 환경변수가 필요합니다.');
    process.exit(2);
  }

  log(`\n▶ MCP 통합 테스트 — ${MCP_URL}\n`);

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } },
  });
  const client = new Client({ name: 'vcc-mcp-integration-test', version: '1.0.0' });

  await client.connect(transport);
  log('① 연결 + initialize 완료');

  // ── 1) tools/list ────────────────────────────────────────────────
  log('\n② tools/list — 신규 도구 노출 확인');
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const t of EXPECTED_TOOLS) {
    check(`tool '${t}' 등록됨`, names.includes(t), `등록된 도구: ${names.join(', ')}`);
  }

  // ── 2) list_projects ─────────────────────────────────────────────
  log('\n③ list_projects');
  const projRes = await client.callTool({ name: 'list_projects', arguments: {} });
  const projData = parseToolJson(projRes);
  check('projects 배열 반환', Array.isArray(projData.projects), `received: ${typeof projData.projects}`);
  const projects = projData.projects || [];
  log(`     → ${projects.length}개 프로젝트`);

  if (projects.length === 0) {
    log('\n⚠ 프로젝트가 없어 파이프라인 단계는 skip (read-only 검증만 완료)');
    return finish(client);
  }

  const project = projects[0];
  check('project.id 존재', !!project.id);
  check('project.name 존재', typeof project.name === 'string');

  // ── 3) list_pipelines ────────────────────────────────────────────
  log(`\n④ list_pipelines (project: ${project.name})`);
  const plRes = await client.callTool({ name: 'list_pipelines', arguments: { projectId: project.id } });
  const plData = parseToolJson(plRes);
  check('pipelines 배열 반환', Array.isArray(plData.pipelines));
  const pipelines = plData.pipelines || [];
  log(`     → ${pipelines.length}개 파이프라인`);

  // ── list_pipeline_runs (프로젝트 단위, 파이프라인 없어도 호출 가능) ──
  log('\n⑤ list_pipeline_runs');
  const runsRes = await client.callTool({ name: 'list_pipeline_runs', arguments: { projectId: project.id, limit: 5 } });
  const runsData = parseToolJson(runsRes);
  check('runs 배열 반환', Array.isArray(runsData.runs));
  log(`     → 최근 ${runsData.runs.length}개 run`);

  if (pipelines.length === 0) {
    log('\n⚠ 파이프라인이 없어 get_pipeline / run_pipeline 은 skip');
    return finish(client);
  }

  const pipeline = pipelines[0];

  // ── get_pipeline ─────────────────────────────────────────────────
  log(`\n⑥ get_pipeline (${pipeline.name})`);
  const gpRes = await client.callTool({ name: 'get_pipeline', arguments: { projectId: project.id, pipelineId: pipeline.id } });
  const gpData = parseToolJson(gpRes);
  check('pipeline.id 일치', gpData.id === pipeline.id);
  check('steps 배열 반환', Array.isArray(gpData.steps));
  log(`     → ${gpData.steps?.length || 0} 단계`);

  // ── run_pipeline (gated) ─────────────────────────────────────────
  if (!RUN_PIPELINE) {
    log('\n⚠ run_pipeline 은 MCP_TEST_RUN_PIPELINE=1 일 때만 실행 (실제 생성 호출 발생). 현재 skip.');
    return finish(client);
  }

  log(`\n⑦ run_pipeline (initialPrompt: "${INITIAL_PROMPT}")`);
  const runRes = await client.callTool({
    name: 'run_pipeline',
    arguments: { projectId: project.id, pipelineId: pipeline.id, initialPrompt: INITIAL_PROMPT },
  });
  const runData = parseToolJson(runRes);
  check('runId 반환', !!runData.runId, JSON.stringify(runData));
  check('초기 status 존재', !!runData.status);
  log(`     → runId: ${runData.runId}, status: ${runData.status}`);

  if (!runData.runId) return finish(client);

  // ── get_pipeline_run 폴링 (최대 2분, 완료/실패 또는 timeout 까지) ──
  log('\n⑧ get_pipeline_run 폴링 (최대 2분)');
  const start = Date.now();
  const MAX = 2 * 60 * 1000;
  let last = null;
  while (Date.now() - start < MAX) {
    const grRes = await client.callTool({ name: 'get_pipeline_run', arguments: { projectId: project.id, runId: runData.runId } });
    last = parseToolJson(grRes);
    log(`     status=${last.status}`);
    if (last.status === 'completed' || last.status === 'failed') break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  check('run 상태 조회 성공', !!last?.status);
  check('steps 배열 반환', Array.isArray(last?.steps));
  // 완료까지 못 가도 (timeout) 도구 자체는 정상 동작한 것으로 간주 — LLM/ComfyUI 가용성 별개.
  log(`     → 최종 status: ${last?.status}`);

  return finish(client);
}

async function finish(client) {
  await client.close().catch(() => {});
  log(`\n━━━ 결과: ${passed} passed, ${failed} failed ━━━\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n✗ 테스트 실행 오류:', err?.message || err);
  process.exit(1);
});
