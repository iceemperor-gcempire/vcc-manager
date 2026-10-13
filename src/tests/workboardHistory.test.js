/**
 * 저장소 이력 기반 퇴역 작업판 판정 (#1049) — scripts/lib/workboardHistory.js
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { retiredBoards, planRetirement, boardName } = require('../../scripts/lib/workboardHistory');

const exportOf = (name) => JSON.stringify({ _exportVersion: 1, workboard: { name, workflowData: '{}' } });

function makeRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-hist-'));
  const g = (...a) => execFileSync('git', ['-C', repo, ...a], { stdio: 'pipe' });
  g('init', '-q'); g('config', 'user.email', 't@example.com'); g('config', 'user.name', 't');
  const dir = path.join(repo, 'workboards', 'comfyui');
  fs.mkdirSync(dir, { recursive: true });
  const write = (f, name) => fs.writeFileSync(path.join(dir, f), exportOf(name));
  write('a.json', 'Board A'); write('b.json', 'Board B'); write('c.json', 'Board C');
  fs.writeFileSync(path.join(repo, 'workboards', 'README.md'), '# 목록');
  g('add', '.'); g('commit', '-q', '-m', '1');
  // 파일 삭제(A) + 같은 파일에서 판 이름 변경(B → B (새 이름))
  fs.rmSync(path.join(dir, 'a.json'));
  write('b.json', 'Board B (새 이름)');
  g('add', '-A'); g('commit', '-q', '-m', '2');
  return repo;
}

describe('retiredBoards — 저장소 이력', () => {
  let repo;
  beforeAll(() => { repo = makeRepo(); });
  afterAll(() => fs.rmSync(repo, { recursive: true, force: true }));

  test('지운 파일의 판과, 이름이 바뀐 판의 옛 이름을 퇴역으로 잡는다', () => {
    const { current, retired } = retiredBoards(repo);
    expect([...current.keys()].sort()).toEqual(['Board B (새 이름)', 'Board C']);
    expect([...retired.keys()].sort()).toEqual(['Board A', 'Board B']);
    expect(retired.get('Board A').path).toBe('workboards/comfyui/a.json');
  });

  test('지운 판을 같은 이름으로 다시 넣으면 퇴역이 아니다', () => {
    fs.writeFileSync(path.join(repo, 'workboards', 'comfyui', 'a2.json'), exportOf('Board A'));
    const { retired } = retiredBoards(repo);
    expect(retired.has('Board A')).toBe(false);
    fs.rmSync(path.join(repo, 'workboards', 'comfyui', 'a2.json'));
  });

  test('git 저장소가 아니면 예외 — 동기화 스크립트는 이를 "판정 건너뜀" 으로 남긴다', () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-plain-'));
    fs.mkdirSync(path.join(plain, 'workboards'));
    expect(() => retiredBoards(plain)).toThrow();
    fs.rmSync(plain, { recursive: true, force: true });
  });
});

describe('planRetirement — 서버 판 대조', () => {
  const retired = new Map([['Old', { date: '2026-10-13', commit: 'abc1234', path: 'workboards/comfyui/old.json' }],
                           ['Old Off', { date: '2026-09-01', commit: 'def5678', path: 'x.json' }]]);
  const plan = planRetirement({
    serverBoards: [
      { _id: '1', name: 'Old', isActive: true },
      { _id: '2', name: 'Old Off', isActive: false },
      { _id: '3', name: 'Current', isActive: true },
      { _id: '4', name: 'Prod Only', isActive: true },
      { _id: '5', name: 'Prod Only Off', isActive: false },
    ],
    currentNames: new Set(['Current']),
    retired,
  });

  test('활성으로 남은 퇴역 판만 비활성화 대상', () => {
    expect(plan.toRetire.map((b) => b.name)).toEqual(['Old']);
    expect(plan.toRetire[0].lastSeen.commit).toBe('abc1234');
  });
  test('이미 비활성인 퇴역 판은 따로 센다', () => {
    expect(plan.alreadyInactive.map((b) => b.name)).toEqual(['Old Off']);
  });
  test('저장소에 한 번도 없던 활성 판은 표시만 (운영 전용)', () => {
    expect(plan.unmanaged.map((b) => b.name)).toEqual(['Prod Only']);
  });
});

test('boardName — 작업판 export 가 아니면 null', () => {
  expect(boardName('{"workboard":{"name":"X"}}')).toBe('X');
  expect(boardName('{"a":1}')).toBeNull();
  expect(boardName('not json')).toBeNull();
});
