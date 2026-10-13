/**
 * 저장소 이력에서 퇴역 작업판을 찾는다 (#1049).
 *
 * 퇴역 = 저장소 이력의 작업판 export 에 한 번이라도 있었던 판 이름 중, 지금 작업본에 없는 것.
 * 파일을 지운 경우와, 같은 파일에서 판 이름만 바꾼 경우(옛 이름이 서버에 남는다) 둘 다 잡힌다.
 * 기준은 동기화에 넘긴 파일이 아니라 저장소 전체 작업본 — 일부만 동기화해도 다른 판을 퇴역으로 오인하지 않는다.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const git = (repo, args, input) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', input, maxBuffer: 512 * 1024 * 1024 });

function boardName(text) {
  try {
    const d = JSON.parse(text);
    return d && d.workboard && typeof d.workboard.name === 'string' ? d.workboard.name : null;
  } catch {
    return null;
  }
}

/** 지금 작업본의 판 이름 → 파일 */
function currentBoards(repo, dir) {
  const out = new Map();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json')) {
        const n = boardName(fs.readFileSync(p, 'utf8'));
        if (n) out.set(n, path.relative(repo, p));
      }
    }
  };
  walk(path.join(repo, dir));
  return out;
}

/**
 * 이력의 판 이름 → 마지막으로 보인 { commit, date, path }.
 * 커밋마다 트리의 json blob 을 모으고, 같은 blob 은 한 번만 읽는다 (git cat-file --batch).
 */
function historicalBoards(repo, dir) {
  const commits = git(repo, ['log', '--format=%H %ad', '--date=short', '--', dir]).trim().split('\n').filter(Boolean).map((l) => l.split(' '));
  const blobAt = []; // [{ blob, commit, date, path }] — log 는 최신순
  const blobs = new Set();
  for (const [commit, date] of commits) {
    for (const line of git(repo, ['ls-tree', '-r', commit, '--', dir]).split('\n')) {
      const m = /^\d+ blob ([0-9a-f]+)\t(.+\.json)$/.exec(line);
      if (!m) continue;
      blobAt.push({ blob: m[1], commit: commit.slice(0, 7), date, path: m[2] });
      blobs.add(m[1]);
    }
  }
  const names = new Map();
  if (blobs.size > 0) {
    const raw = execFileSync('git', ['-C', repo, 'cat-file', '--batch'], { input: [...blobs].join('\n') + '\n', maxBuffer: 512 * 1024 * 1024 });
    let i = 0;
    while (i < raw.length) {
      const nl = raw.indexOf(10, i);
      const [sha, , size] = raw.slice(i, nl).toString().split(' ');
      const start = nl + 1;
      const end = start + Number(size);
      names.set(sha, boardName(raw.slice(start, end).toString('utf8')));
      i = end + 1;
    }
  }
  const out = new Map();
  for (const b of blobAt) {
    const n = names.get(b.blob);
    if (n && !out.has(n)) out.set(n, { commit: b.commit, date: b.date, path: b.path });
  }
  return out;
}

/** 저장소 이력 기준 퇴역 판 이름 → 마지막으로 보인 곳 */
function retiredBoards(repo, dir = 'workboards') {
  const now = currentBoards(repo, dir);
  const past = historicalBoards(repo, dir);
  const retired = new Map();
  for (const [name, where] of past) if (!now.has(name)) retired.set(name, where);
  return { current: now, retired };
}

/**
 * 서버 판 목록과 대조해 할 일을 정한다 (순수 함수).
 * @param {{ serverBoards: {_id:string,name:string,isActive:boolean}[], currentNames: Set<string>|string[], retired: Map<string,object>|Object }} args
 */
function planRetirement({ serverBoards, currentNames, retired }) {
  const cur = currentNames instanceof Set ? currentNames : new Set(currentNames);
  const ret = retired instanceof Map ? retired : new Map(Object.entries(retired || {}));
  const toRetire = [];
  const alreadyInactive = [];
  const unmanaged = [];
  for (const b of serverBoards) {
    if (ret.has(b.name)) (b.isActive === false ? alreadyInactive : toRetire).push({ ...b, lastSeen: ret.get(b.name) });
    else if (!cur.has(b.name) && b.isActive !== false) unmanaged.push(b);
  }
  return { toRetire, alreadyInactive, unmanaged };
}

module.exports = { boardName, currentBoards, historicalBoards, retiredBoards, planRetirement };
