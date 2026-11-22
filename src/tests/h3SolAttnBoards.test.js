const fs = require('fs');
const path = require('path');

// Sol-Attn(BlockSparseAttention) 을 쓰는 판의 토큰 보강은 0 이다 (#1248).
// ComfyUI 기본값 256 은 같은 시드로 다시 돌려도 결과가 달라진다 (comfy-kitchen 의 원자 연산 순서 문제).
// 새 판을 다른 워크플로에서 옮겨 오면 256 이 딸려 오기 쉽다.
const DIR = path.join(__dirname, '../../workboards/comfyui');
const boards = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((file) => {
  const { workboard } = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  let wf = {};
  try { wf = JSON.parse(workboard.workflowData); } catch { /* 워크플로가 없는 판 */ }
  return { file, nodes: Object.values(wf).filter((n) => n && n.class_type === 'BlockSparseAttention') };
}).filter((b) => b.nodes.length > 0);

test('Sol-Attn 을 쓰는 판이 있다', () => {
  expect(boards.length).toBeGreaterThanOrEqual(13);
});

test.each(boards.map((b) => [b.file, b]))('%s — extra_tokens 0', (_file, b) => {
  for (const n of b.nodes) expect(n.inputs.extra_tokens).toBe(0);
});
