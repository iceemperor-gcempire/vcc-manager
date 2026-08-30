#!/usr/bin/env node
/**
 * 저장소의 작업판 export(workboards/comfyui/*.json)를 VCC 인스턴스에 **제자리 갱신**한다 (#886).
 *
 *   node scripts/sync-workboards.js --base-url https://vcc.example --api-key $VCC_ADMIN_API_KEY \
 *        [--yes] [--apply] [--server-id <id>] workboards/comfyui/*.json
 *
 * 기본은 dry-run: 파일마다 `mode:'update', dryRun:true` 로 diff·경고만 받아 표로 보여준다.
 * `--apply` 를 붙여야 실제 갱신하며, 경고가 있는 판은 `--yes` 없이는 서버가 409 로 거부한다
 * (그 판만 건너뛰고 나머지는 진행). 같은 이름의 판이 없으면 새로 만든다 (서버 자동 매칭 실패 시
 * `--server-id` 필요).
 *
 * 환경변수 VCC_BASE_URL / VCC_API_KEY 로도 줄 수 있다. API 키는 관리자 계정의 것이어야 한다
 * (프로필 > 보안 설정). 키를 명령줄 인자로 넘기면 셸 히스토리에 남으니 환경변수를 권장.
 *
 * 종료 코드: 0 전부 처리 · 2 승인 필요/건너뜀 있음 · 1 오류
 */
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const o = { files: [], apply: false, yes: false, baseUrl: process.env.VCC_BASE_URL, apiKey: process.env.VCC_API_KEY, serverId: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') o.apply = true;
    else if (a === '--yes' || a === '-y') o.yes = true;
    else if (a === '--json') o.json = true;
    else if (a === '--base-url') o.baseUrl = argv[++i];
    else if (a === '--api-key') o.apiKey = argv[++i];
    else if (a === '--server-id') o.serverId = argv[++i];
    else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(0); }
    else o.files.push(a);
  }
  return o;
}

async function api(baseUrl, apiKey, method, p, body) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 비 JSON 응답 */ }
  return { status: res.status, json };
}

function fmtChange(c) {
  return `${c.kind} ${c.target}${c.detail ? ` (${c.detail})` : ''}`;
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (!opt.baseUrl || !opt.apiKey || opt.files.length === 0) {
    console.error('사용법: sync-workboards.js --base-url <url> --api-key <key> [--apply] [--yes] <export.json ...>');
    process.exit(1);
  }

  // 버전 가드 — 서버와 export 의 major.minor 가 다르면 멈춘다 (필드 스키마가 다를 수 있다)
  const health = await api(opt.baseUrl, opt.apiKey, 'GET', '/health');
  const serverVersion = health.json && health.json.version;
  if (!serverVersion) {
    console.error(`서버 버전을 확인할 수 없습니다 (${opt.baseUrl}/health → ${health.status}). v4.0.7+ 이어야 합니다.`);
    process.exit(1);
  }
  const [sMaj, sMin] = serverVersion.split('.').map(Number);

  const rows = [];
  let needAck = 0, failed = 0;
  for (const file of opt.files) {
    const name = path.basename(file);
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { rows.push({ file: name, result: 'error', note: `JSON 파싱 실패: ${e.message}` }); failed++; continue; }
    const av = data.appVersion || {};
    if (av.major !== sMaj || av.minor !== sMin) {
      rows.push({ file: name, board: data.workboard && data.workboard.name, result: 'skipped', note: `appVersion ${av.major}.${av.minor} ≠ 서버 ${sMaj}.${sMin}` });
      failed++; continue;
    }

    const body = { data, mode: 'update', dryRun: !opt.apply, acknowledge: opt.yes };
    if (opt.serverId) body.serverId = opt.serverId;
    const { status, json } = await api(opt.baseUrl, opt.apiKey, 'POST', '/api/workboards/import', body);
    const board = (json && json.workboard && json.workboard.name) || (data.workboard && data.workboard.name);
    const diff = json && json.diff;
    const summary = diff ? `+${diff.summary.fieldsAdded}/-${diff.summary.fieldsRemoved}/~${diff.summary.fieldsChanged} 필드 · +${diff.summary.nodesAdded}/-${diff.summary.nodesRemoved}/~${diff.summary.nodesChanged} 노드 · 경고 ${diff.summary.warnings}` : '';

    if (status === 200 && json.dryRun) {
      rows.push({ file: name, board, result: json.action === 'create' ? 'would-create' : (diff && diff.identical ? 'unchanged' : 'would-update'), note: summary || json.message, diff });
      if (diff && diff.warnings.length) needAck++;
    } else if (status === 200 && json.needsServer) {
      rows.push({ file: name, board, result: 'skipped', note: `서버 미매칭 (${(json.servers || []).map((s) => `${s.name}:${s._id}`).join(', ') || '활성 서버 없음'}) — --server-id 필요` }); failed++;
    } else if (status === 200 || status === 201) {
      rows.push({ file: name, board, result: json.action === 'create' ? 'created' : (json.updated ? `updated v${json.workboard.version}${json.acknowledged ? ' (승인)' : ''}` : 'unchanged'), note: summary || json.message, diff });
    } else if (status === 409) {
      rows.push({ file: name, board, result: 'needs-ack', note: summary, diff }); needAck++;
    } else {
      rows.push({ file: name, board, result: 'error', note: `${status} ${(json && json.message) || ''}` }); failed++;
    }
  }

  if (opt.json) { console.log(JSON.stringify({ serverVersion, apply: opt.apply, rows }, null, 2)); }
  else {
    console.log(`\n서버 ${opt.baseUrl} (v${serverVersion}) · ${opt.apply ? '적용' : 'dry-run'}${opt.yes ? ' · 경고 승인' : ''}\n`);
    for (const r of rows) {
      console.log(`${r.result.padEnd(14)} ${(r.board || r.file).padEnd(36)} ${r.note || ''}`);
      if (r.diff && !r.diff.identical) {
        for (const c of r.diff.changes.slice(0, 40)) console.log(`     · ${fmtChange(c)}`);
        if (r.diff.changes.length > 40) console.log(`     · … 외 ${r.diff.changes.length - 40}건`);
        for (const w of r.diff.warnings) console.log(`     ⚠ [${w.code}] ${w.message}`);
      }
    }
    console.log('');
    if (!opt.apply) console.log('dry-run 입니다. 실제 갱신은 --apply, 경고가 있는 판까지 갱신하려면 --apply --yes.');
    else if (needAck) console.log(`경고가 있어 갱신하지 않은 판 ${needAck}개 — 내용을 확인한 뒤 --yes 로 다시 실행하세요.`);
  }
  process.exit(failed ? 1 : needAck ? 2 : 0);
}

main().catch((e) => { console.error('sync-workboards 실패:', e.message); process.exit(1); });
