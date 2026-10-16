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
 * 퇴역 판 (#1049) — 저장소 이력에 있던 판 이름 중 지금 작업본에 없는 것(파일 삭제·판 이름 변경)이 서버에 활성으로 남아 있으면
 * dry-run 에 `would-retire` 로 보이고, `--apply` 때 **비활성화**한다 (되돌릴 수 있음. 완전 삭제는 로그인 화면이나 전체 제어 키로 — #1059).
 * 저장소에 한 번도 없던 판(운영에서만 만든 판)은 표시만 하고 건드리지 않는다. `--no-retire` 로 끈다.
 * 판정 기준은 넘긴 파일이 아니라 저장소 전체 작업본이라, 일부 파일만 동기화해도 다른 판을 퇴역으로 오인하지 않는다.
 *
 * 종료 코드: 0 전부 처리 · 2 승인 필요/건너뜀 있음 · 1 오류
 */
const fs = require('fs');
const path = require('path');
const { retiredBoards, planRetirement } = require('./lib/workboardHistory');

function parseArgs(argv) {
  const o = { files: [], apply: false, yes: false, baseUrl: process.env.VCC_BASE_URL, apiKey: process.env.VCC_API_KEY, serverId: null, json: false, retire: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') o.apply = true;
    else if (a === '--yes' || a === '-y') o.yes = true;
    else if (a === '--json') o.json = true;
    else if (a === '--no-retire') o.retire = false;
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

  // 버전 가드 (#934) — 서버 import 와 같은 기준: major 가 다르면 멈추고, minor 차이는 경고만 하고 진행한다.
  // (작업판 필드 스키마는 minor 릴리스에서 바뀌지 않는 것이 규칙이고, 바뀌면 major 를 올린다)
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
    if (av.major !== sMaj) {
      rows.push({ file: name, board: data.workboard && data.workboard.name, result: 'skipped', note: `appVersion ${av.major}.${av.minor} ≠ 서버 ${sMaj}.${sMin} (major 불일치)` });
      failed++; continue;
    }
    const minorNote = av.minor !== sMin ? ` · ⚠ appVersion ${av.major}.${av.minor} vs 서버 ${sMaj}.${sMin} (minor 차이 — 진행)` : '';

    const body = { data, mode: 'update', dryRun: !opt.apply, acknowledge: opt.yes };
    if (opt.serverId) body.serverId = opt.serverId;
    const { status, json } = await api(opt.baseUrl, opt.apiKey, 'POST', '/api/workboards/import', body);
    const board = (json && json.workboard && json.workboard.name) || (data.workboard && data.workboard.name);
    const diff = json && json.diff;
    const summary = diff ? `+${diff.summary.fieldsAdded}/-${diff.summary.fieldsRemoved}/~${diff.summary.fieldsChanged} 필드 · +${diff.summary.nodesAdded}/-${diff.summary.nodesRemoved}/~${diff.summary.nodesChanged} 노드 · 경고 ${diff.summary.warnings}` : '';

    if (status === 200 && json.dryRun) {
      rows.push({ file: name, board, result: json.action === 'create' ? 'would-create' : (diff && diff.identical ? 'unchanged' : 'would-update'), note: (summary || json.message || '') + minorNote, diff });
      if (diff && diff.warnings.length) needAck++;
    } else if (status === 200 && json.needsServer) {
      rows.push({ file: name, board, result: 'skipped', note: `서버 미매칭 (${(json.servers || []).map((s) => `${s.name}:${s._id}`).join(', ') || '활성 서버 없음'}) — --server-id 필요` }); failed++;
    } else if (status === 200 || status === 201) {
      rows.push({ file: name, board, result: json.action === 'create' ? 'created' : (json.updated ? `updated v${json.workboard.version}${json.acknowledged ? ' (승인)' : ''}` : 'unchanged'), note: (summary || json.message || '') + minorNote, diff });
    } else if (status === 409) {
      rows.push({ file: name, board, result: 'needs-ack', note: (summary || '') + minorNote, diff }); needAck++;
    } else {
      rows.push({ file: name, board, result: 'error', note: `${status} ${(json && json.message) || ''}` }); failed++;
    }
  }

  // 퇴역 판 (#1049)
  const retire = { skipped: null, toRetire: [], alreadyInactive: [], unmanaged: [], results: [] };
  if (!opt.retire) retire.skipped = '--no-retire';
  else {
    let hist = null;
    try { hist = retiredBoards(path.resolve(__dirname, '..')); } catch (e) { retire.skipped = `저장소 이력을 읽을 수 없음 (${e.message.split('\n')[0]})`; }
    if (hist) {
      const serverBoards = [];
      for (let page = 1; page <= 40; page++) {
        const r = await api(opt.baseUrl, opt.apiKey, 'GET', `/api/workboards?includeInactive=true&includeAll=true&limit=50&page=${page}`);
        const list = (r.json && (r.json.workboards || (r.json.data && r.json.data.workboards))) || [];
        if (r.status !== 200) { retire.skipped = `서버 판 목록 조회 실패 (${r.status})`; break; }
        serverBoards.push(...list.map((w) => ({ _id: w._id, name: w.name, isActive: w.isActive !== false })));
        const pages = (r.json.pagination && r.json.pagination.pages) || 1;
        if (page >= pages || list.length === 0) break;
      }
      if (!retire.skipped) {
        Object.assign(retire, planRetirement({ serverBoards, currentNames: new Set(hist.current.keys()), retired: hist.retired }));
        retire.historyRetired = hist.retired.size;
        for (const b of retire.toRetire) {
          if (!opt.apply) { retire.results.push({ board: b.name, result: 'would-retire', note: `저장소에서 ${b.lastSeen.date} ${b.lastSeen.commit} 이후 없음 (${b.lastSeen.path})` }); continue; }
          const r = await api(opt.baseUrl, opt.apiKey, 'PATCH', `/api/workboards/${b._id}/deactivate`);
          if (r.status === 200) retire.results.push({ board: b.name, result: 'retired', note: '비활성화 (되돌리려면 작업판 관리에서 활성화)' });
          else { retire.results.push({ board: b.name, result: 'error', note: `비활성화 실패 ${r.status} ${(r.json && r.json.message) || ''}` }); failed++; }
        }
      }
    }
  }

  if (opt.json) { console.log(JSON.stringify({ serverVersion, apply: opt.apply, rows, retire }, null, 2)); }
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
    // 퇴역 판 — 0건이어도 한 줄 남긴다 ("없었다" 와 "안 돌았다" 를 구분)
    if (retire.skipped) console.log(`\n퇴역 판 판정 건너뜀: ${retire.skipped}`);
    else {
      console.log(`\n퇴역 판 (저장소 이력 ${retire.historyRetired}개 중) — 서버에 활성 ${retire.toRetire.length} · 이미 비활성 ${retire.alreadyInactive.length}`);
      for (const r of retire.results) console.log(`${r.result.padEnd(14)} ${r.board.padEnd(36)} ${r.note}`);
      if (retire.unmanaged.length) console.log(`저장소에 없는 판 ${retire.unmanaged.length}개 (운영 전용 — 건드리지 않음): ${retire.unmanaged.map((b) => b.name).join(', ')}`);
    }
    console.log('');
    if (!opt.apply) console.log('dry-run 입니다. 실제 갱신은 --apply, 경고가 있는 판까지 갱신하려면 --apply --yes.');
    else if (needAck) console.log(`경고가 있어 갱신하지 않은 판 ${needAck}개 — 내용을 확인한 뒤 --yes 로 다시 실행하세요.`);
  }
  process.exit(failed ? 1 : needAck ? 2 : 0);
}

main().catch((e) => { console.error('sync-workboards 실패:', e.message); process.exit(1); });
