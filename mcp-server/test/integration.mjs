#!/usr/bin/env node
// MCP 통합 테스트 (#448, #1178) — 실제 MCP 서버에 Streamable HTTP 로 접속해 도구를 부른다.
//
// 실행:
//   MCP_TEST_URL=https://alpha-vccm-mcp.gcempire.net/mcp MCP_TEST_API_KEY=<vccm_ 키> node test/integration.mjs
//   (저장소 루트에서) pnpm --dir mcp-server test:integration
//
// 환경변수:
//   MCP_TEST_URL           MCP endpoint (기본 http://localhost:3100/mcp)
//   MCP_TEST_API_KEY       VCC API Key (필수) — Bearer 토큰으로 전달.
//                          MCP 용 키(vccm_)로 돌린다. 범용 키(vcc_)로 부르면 MCP 키 허용 목록을 거치지 않는다 (경고만 낸다)
//   MCP_TEST_RUN_GENERATE  1 이면 작업판 하나로 실제 생성 1건 → 완료 대기 → download_result (기본 skip).
//                          **프로덕션에는 켜지 않는다** — 시험 작업이 남는다
//   MCP_TEST_WORKBOARD     생성에 쓸 작업판 ID 또는 이름. 없으면 조건에 맞는 첫 이미지 판을 고른다 (빠른 판을 지정할 것)
//   MCP_TEST_PROMPT        생성 프롬프트
//   MCP_TEST_GENERATE_TIMEOUT_SEC  생성 완료 대기 상한 (기본 600)
//   MCP_TEST_RUN_PIPELINE  1 이면 run_pipeline 까지 실제 실행 (LLM/ComfyUI 호출 발생 — 기본 skip)
//   MCP_TEST_INITIAL_PROMPT  run_pipeline 시 사용할 prompt (기본 "통합 테스트 prompt")
//
// 검증 범위:
//   1) initialize + tools/list — 도구 15개 노출
//   2) 작업판 (#1178)
//      - list_workboards: 모든 쪽을 넘겨 판 전체를 본다. defaultModel·runWith 모양
//      - get_workboard: 판마다 baseModel 모양. list_workboards 의 defaultModel 과 같은지
//      - generate 실패 경로: 기본 모델도 목록도 없는 판에 aiModel 없이 보낸다 → 작업을 만들기 전에 막혀야 한다
//      - (MCP_TEST_RUN_GENERATE=1) generate 프롬프트만 → get_job_status 로 완료까지 → download_result
//   3) list_projects → list_pipelines → list_pipeline_runs → get_pipeline (데이터가 없으면 skip)
//   4) (MCP_TEST_RUN_PIPELINE=1) run_pipeline → get_pipeline_run 폴링
//
// 왜 작업판·생성 경로를 부르나 (#1178): MCP generate 가 배포 판에서 첫 호출에 막혀 있었는데 (#1088), 이 테스트는
// 프로젝트·파이프라인 도구만 불러서 몇 달 동안 잡지 못했다. 단위 테스트도 다 통과하고 있었다.
//
// 저장소가 공개라 작업판 ID·이름을 여기 적지 않는다 — 판은 응답에서 조건으로 고른다.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ATTACHMENT_FIELD_TYPES } from '../src/constants/serverTypes.js';

const MCP_URL = process.env.MCP_TEST_URL || 'http://localhost:3100/mcp';
const API_KEY = process.env.MCP_TEST_API_KEY;
const RUN_GENERATE = process.env.MCP_TEST_RUN_GENERATE === '1';
const GENERATE_WORKBOARD = process.env.MCP_TEST_WORKBOARD || '';
const GENERATE_PROMPT = process.env.MCP_TEST_PROMPT
  || 'MCP 통합 테스트: a small red cube on a white table, studio light';
const GENERATE_TIMEOUT_MS = (Number(process.env.MCP_TEST_GENERATE_TIMEOUT_SEC) || 600) * 1000;
const RUN_PIPELINE = process.env.MCP_TEST_RUN_PIPELINE === '1';
const INITIAL_PROMPT = process.env.MCP_TEST_INITIAL_PROMPT || '통합 테스트 prompt';

const EXPECTED_TOOLS = [
  'list_workboards',
  'get_workboard',
  'generate',
  'generate_text',
  'continue_job',
  'get_job_status',
  'list_jobs',
  'download_result',
  'upload_image',
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (s, n = 240) => (s.length > n ? `${s.slice(0, n)}…` : s);

// tool 응답에서 JSON 텍스트를 파싱.
function parseToolJson(result) {
  const text = result?.content?.find((c) => c.type === 'text')?.text;
  if (!text) throw new Error('tool 응답에 text content 없음');
  return JSON.parse(text);
}

// 도구 오류(isError)도 결과로 받아 판정한다. JSON 이 아니면 json 은 null
async function call(client, name, args) {
  const r = await client.callTool({ name, arguments: args });
  const text = r?.content?.find((c) => c.type === 'text')?.text ?? '';
  let json = null;
  try { json = JSON.parse(text); } catch { /* 오류 문구는 JSON 이 아닐 수 있다 */ }
  return { isError: Boolean(r.isError), text, json, content: r?.content || [] };
}

async function main() {
  if (!API_KEY) {
    console.error('Error: MCP_TEST_API_KEY 환경변수가 필요합니다.');
    process.exit(2);
  }

  log(`\n▶ MCP 통합 테스트 — ${MCP_URL}\n`);
  if (!API_KEY.startsWith('vccm_')) {
    log('⚠ MCP 용 키(vccm_)가 아니다 — 이번 실행은 MCP 키 허용 목록(apiKeyScopes)을 거치지 않는다\n');
  }

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } },
  });
  const client = new Client({ name: 'vcc-mcp-integration-test', version: '1.0.0' });

  await client.connect(transport);
  log('① 연결 + initialize 완료');

  // ── tools/list ───────────────────────────────────────────────────
  log('\n② tools/list');
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const t of EXPECTED_TOOLS) {
    check(`tool '${t}' 등록됨`, names.includes(t), `등록된 도구: ${names.join(', ')}`);
  }
  const extra = names.filter((n) => !EXPECTED_TOOLS.includes(n));
  if (extra.length > 0) log(`     → 목록에 없는 도구 ${extra.length}개: ${extra.join(', ')} (EXPECTED_TOOLS 갱신 필요)`);
  const generateTool = tools.find((t) => t.name === 'generate');
  const required = generateTool?.inputSchema?.required || [];
  check('generate 필수 인자는 workboardId·prompt 둘', required.length === 2
    && required.includes('workboardId') && required.includes('prompt'), `required: ${JSON.stringify(required)}`);

  await workboardSection(client);
  await pipelineSection(client);
  return finish(client);
}

// ── 작업판·생성 (#1178) ───────────────────────────────────────────────
async function workboardSection(client) {
  log('\n③ list_workboards — 모든 쪽');
  const workboards = [];
  let total = null;
  for (let page = 1; page <= 20; page++) {
    const res = await call(client, 'list_workboards', { page, limit: 50 });
    if (res.isError || !Array.isArray(res.json?.workboards)) {
      check(`list_workboards page ${page}`, false, short(res.text));
      return;
    }
    workboards.push(...res.json.workboards);
    total = res.json.pagination?.total ?? null;
    if (page >= (res.json.pagination?.pages || 1)) break;
  }
  check('판 목록 전체를 받음', total === null || workboards.length === total, `받음 ${workboards.length} / total ${total}`);
  check('모든 판에 defaultModel 키', workboards.every((w) => 'defaultModel' in w),
    workboards.filter((w) => !('defaultModel' in w)).map((w) => w.name).join(', '));
  check('모든 판에 runWith (generate|generate_text)', workboards.every((w) => ['generate', 'generate_text'].includes(w.runWith)));
  const withDefault = workboards.filter((w) => w.defaultModel);
  log(`     → ${workboards.length}개 판, defaultModel 있는 판 ${withDefault.length}개`);
  if (workboards.length === 0) {
    log('⚠ 이 키로 볼 수 있는 작업판이 0개 — get_workboard·generate 단계 skip');
    return;
  }

  log('\n④ get_workboard — 판마다 baseModel');
  const details = [];
  let shapeBad = [];
  let mismatch = [];
  for (const w of workboards) {
    const res = await call(client, 'get_workboard', { workboardId: w.id });
    if (res.isError || !res.json) {
      shapeBad.push(`${w.name}: ${short(res.text, 120)}`);
      continue;
    }
    const d = res.json;
    details.push({ summary: w, detail: d });
    const bm = d.baseModel;
    const okShape = bm === null || (bm && typeof bm.field === 'string' && typeof bm.required === 'boolean'
      && 'default' in bm && Array.isArray(bm.allowedFolders) && Array.isArray(bm.allowedModelTypes)
      && (bm.options === undefined || Array.isArray(bm.options)));
    if (!okShape || !Array.isArray(d.additionalFields)) shapeBad.push(w.name);
    if ((bm?.default ?? null) !== (w.defaultModel ?? null)) mismatch.push(w.name);
  }
  check('get_workboard 응답 모양 (baseModel·additionalFields)', shapeBad.length === 0, shapeBad.join(' | '));
  check('get_workboard baseModel.default = list_workboards defaultModel', mismatch.length === 0, mismatch.join(', '));

  const generateBoards = details.filter(({ detail }) => detail.runWith === 'generate');
  const noField = generateBoards.filter(({ detail }) => detail.baseModel === null);
  const withOptions = generateBoards.filter(({ detail }) => !detail.baseModel?.default && detail.baseModel?.options?.length);
  // 기본값도 목록도 없는 판 — MCP 만으로는 고를 모델을 알 수 없다 (#1088 의 남은 문제)
  const unresolved = generateBoards.filter(({ detail }) => detail.baseModel
    && !detail.baseModel.default && !(detail.baseModel.options?.length));
  log(`     → generate 판 ${generateBoards.length}개: 모델 칸 없음 ${noField.length} · 기본값 있음 ${generateBoards.filter(({ detail }) => detail.baseModel?.default).length} · 목록에서 고름 ${withOptions.length} · 기본값·목록 없음 ${unresolved.length}`);
  if (unresolved.length > 0) log(`       기본값·목록 없는 판: ${unresolved.map(({ detail }) => detail.name).join(', ')}`);

  // ── generate 실패 경로 — 작업을 만들기 전에 막혀야 한다 ─────────────
  log('\n⑤ generate 실패 경로 — 기본 모델도 목록도 없는 판, aiModel 없이');
  const target = unresolved.find(({ detail }) => detail.baseModel.required);
  if (!target) {
    log(`     ⚠ 대상 판 0개 (기본값·목록 없는 판 ${unresolved.length}개 중 모델 칸이 필수인 판 없음) — skip`);
  } else {
    const res = await call(client, 'generate', {
      workboardId: target.detail.id,
      prompt: 'MCP 통합 테스트 — 작업이 만들어지면 안 되는 호출',
    });
    check(`"${target.detail.name}" 이 작업 생성 전에 오류`, res.isError, `통과해 버림: ${short(res.text)}`);
    check('오류가 aiModel 을 넣으라고 안내', /no default base model/i.test(res.text), short(res.text));
    if (!res.isError && res.json?.jobId) {
      log(`  !!! 시험 작업이 만들어졌다 — 정리 대상 jobId=${res.json.jobId}`);
    }
  }

  // ── generate 성공 경로 (gated) ──────────────────────────────────────
  if (!RUN_GENERATE) {
    log('\n⚠ generate 실행은 MCP_TEST_RUN_GENERATE=1 일 때만 (실제 생성 발생). 현재 skip.');
    return;
  }
  const hasRequiredAttachment = (d) => d.additionalFields.some((f) => f.required
    && ATTACHMENT_FIELD_TYPES.includes(f.type));
  const picked = GENERATE_WORKBOARD
    ? details.find(({ detail }) => detail.id === GENERATE_WORKBOARD || detail.name === GENERATE_WORKBOARD)
    : generateBoards.find(({ detail }) => detail.outputFormat === 'image' && detail.baseModel?.default
      && !hasRequiredAttachment(detail));
  log(`\n⑥ generate — 프롬프트만 (${picked ? picked.detail.name : '판 없음'})`);
  if (!picked) {
    check('생성에 쓸 판을 찾음', false, GENERATE_WORKBOARD
      ? `MCP_TEST_WORKBOARD "${GENERATE_WORKBOARD}" 가 목록에 없다`
      : '기본 모델이 있고 필수 첨부 칸이 없는 이미지 판이 없다 — MCP_TEST_WORKBOARD 로 지정');
    return;
  }
  const gen = await call(client, 'generate', { workboardId: picked.detail.id, prompt: GENERATE_PROMPT });
  check('jobId 반환', !gen.isError && !!gen.json?.jobId, short(gen.text));
  if (gen.isError || !gen.json?.jobId) return;
  const jobId = gen.json.jobId;
  log(`     → jobId ${jobId} (시험 작업 — 정리 대상), defaultsUsed: ${(gen.json.defaultsUsed || []).join(', ') || '없음'}`);
  if (picked.detail.baseModel) {
    check('defaultsUsed 에 모델 칸', (gen.json.defaultsUsed || []).includes(picked.detail.baseModel.field),
      JSON.stringify(gen.json.defaultsUsed));
  }

  log(`\n⑦ get_job_status 폴링 (최대 ${GENERATE_TIMEOUT_MS / 1000}초)`);
  const start = Date.now();
  let job = null;
  while (Date.now() - start < GENERATE_TIMEOUT_MS) {
    const st = await call(client, 'get_job_status', { jobId });
    job = st.json;
    if (st.isError || !job) break;
    if (job.status === 'completed' || job.status === 'failed') break;
    await sleep(5000);
  }
  log(`     → status=${job?.status} (${Math.round((Date.now() - start) / 1000)}초)`);
  check('작업 완료', job?.status === 'completed', job?.error ? JSON.stringify(job.error) : `마지막 status: ${job?.status}`);
  if (job?.status !== 'completed') return;
  const media = [
    ...(job.resultImages || []).map((m) => ({ ...m, mediaType: 'image' })),
    ...(job.resultVideos || []).map((m) => ({ ...m, mediaType: 'video' })),
    ...(job.resultAudios || []).map((m) => ({ ...m, mediaType: 'audio' })),
  ];
  check('결과물 1개 이상', media.length > 0);
  if (media.length === 0) return;

  log('\n⑧ download_result');
  const dl = await call(client, 'download_result', { mediaId: media[0].id, mediaType: media[0].mediaType });
  const meta = dl.json || dl.content.map((c) => {
    try { return c.type === 'text' ? JSON.parse(c.text) : null; } catch { return null; }
  }).find(Boolean);
  check('download_result 응답', !dl.isError && ['signedUrl', 'base64', 'metadata'].includes(meta?.responseType),
    short(dl.text));
  log(`     → responseType=${meta?.responseType}, size=${meta?.size}`);
}

// ── 프로젝트·파이프라인 (#448) ────────────────────────────────────────
async function pipelineSection(client) {
  log('\n⑨ list_projects');
  const projRes = await client.callTool({ name: 'list_projects', arguments: {} });
  const projData = parseToolJson(projRes);
  check('projects 배열 반환', Array.isArray(projData.projects), `received: ${typeof projData.projects}`);
  const projects = projData.projects || [];
  log(`     → ${projects.length}개 프로젝트`);

  if (projects.length === 0) {
    log('\n⚠ 프로젝트가 없어 파이프라인 단계는 skip');
    return;
  }

  const project = projects[0];
  check('project.id 존재', !!project.id);
  check('project.name 존재', typeof project.name === 'string');

  log(`\n⑩ list_pipelines (project: ${project.name})`);
  const plRes = await client.callTool({ name: 'list_pipelines', arguments: { projectId: project.id } });
  const plData = parseToolJson(plRes);
  check('pipelines 배열 반환', Array.isArray(plData.pipelines));
  const pipelines = plData.pipelines || [];
  log(`     → ${pipelines.length}개 파이프라인`);

  // list_pipeline_runs (프로젝트 단위, 파이프라인 없어도 호출 가능)
  log('\n⑪ list_pipeline_runs');
  const runsRes = await client.callTool({ name: 'list_pipeline_runs', arguments: { projectId: project.id, limit: 5 } });
  const runsData = parseToolJson(runsRes);
  check('runs 배열 반환', Array.isArray(runsData.runs));
  log(`     → 최근 ${runsData.runs.length}개 run`);

  if (pipelines.length === 0) {
    log('\n⚠ 파이프라인이 없어 get_pipeline / run_pipeline 은 skip');
    return;
  }

  const pipeline = pipelines[0];

  log(`\n⑫ get_pipeline (${pipeline.name})`);
  const gpRes = await client.callTool({ name: 'get_pipeline', arguments: { projectId: project.id, pipelineId: pipeline.id } });
  const gpData = parseToolJson(gpRes);
  check('pipeline.id 일치', gpData.id === pipeline.id);
  check('steps 배열 반환', Array.isArray(gpData.steps));
  log(`     → ${gpData.steps?.length || 0} 단계`);

  if (!RUN_PIPELINE) {
    log('\n⚠ run_pipeline 은 MCP_TEST_RUN_PIPELINE=1 일 때만 실행 (실제 생성 호출 발생). 현재 skip.');
    return;
  }

  log(`\n⑬ run_pipeline (initialPrompt: "${INITIAL_PROMPT}")`);
  const runRes = await client.callTool({
    name: 'run_pipeline',
    arguments: { projectId: project.id, pipelineId: pipeline.id, initialPrompt: INITIAL_PROMPT },
  });
  const runData = parseToolJson(runRes);
  check('runId 반환', !!runData.runId, JSON.stringify(runData));
  check('초기 status 존재', !!runData.status);
  log(`     → runId: ${runData.runId}, status: ${runData.status}`);

  if (!runData.runId) return;

  // get_pipeline_run 폴링 (최대 2분, 완료/실패 또는 timeout 까지)
  log('\n⑭ get_pipeline_run 폴링 (최대 2분)');
  const start = Date.now();
  const MAX = 2 * 60 * 1000;
  let last = null;
  while (Date.now() - start < MAX) {
    const grRes = await client.callTool({ name: 'get_pipeline_run', arguments: { projectId: project.id, runId: runData.runId } });
    last = parseToolJson(grRes);
    log(`     status=${last.status}`);
    if (last.status === 'completed' || last.status === 'failed') break;
    await sleep(5000);
  }
  check('run 상태 조회 성공', !!last?.status);
  check('steps 배열 반환', Array.isArray(last?.steps));
  // 완료까지 못 가도 (timeout) 도구 자체는 정상 동작한 것으로 간주 — LLM/ComfyUI 가용성 별개.
  log(`     → 최종 status: ${last?.status}`);
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
