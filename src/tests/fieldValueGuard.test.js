/**
 * 작업판 칸이 허용하지 않는 값은 막는다 (#1163).
 *
 * 선택 칸은 선택지 안의 값만, 숫자 칸은 숫자와 판이 정한 범위만. 보내지 않은 칸과 빈 값은 보지 않는다.
 */
const fs = require('fs');
const path = require('path');
const { findFieldValueViolation } = require('../services/fieldValueGuard');

const wb = {
  additionalInputFields: [
    { name: 'length', label: '길이', type: 'select', defaultValue: '124', options: [{ key: '5초', value: '124' }] },
    { name: 'steps', label: '스텝', type: 'select', defaultValue: '2', options: [{ key: '2', value: '2' }, { key: '4', value: '4' }] },
    { name: 'image_size', label: '크기', type: 'select', options: [{ key: '1:1', value: '1024x1024' }] },
    { name: 'cfg', label: 'CFG', type: 'number', validation: { min: 1, max: 10 } },
    { name: 'shift', label: '시프트', type: 'number' },
    { name: 'free', label: '자유 선택', type: 'select', options: [] },
    { name: 'note', label: '메모', type: 'string' },
    { name: 'base_model', label: '모델', type: 'baseModel' },
  ],
};
const check = (additionalParams, top = {}) => findFieldValueViolation(wb, { ...top, additionalParams });

describe('선택 칸', () => {
  test('선택지 안의 값은 통과한다 — 글자 · 숫자 · {key, value} 모두', () => {
    expect(check({ length: '124', steps: '4' })).toBeNull();
    expect(check({ steps: 4 })).toBeNull();
    expect(check({ steps: { key: '4', value: '4' } })).toBeNull();
  });

  test('선택지 밖 값은 막고, 칸 이름과 값을 알려 준다', () => {
    expect(check({ length: '362' })).toBe('지원하지 않는 값입니다: 길이 = 362');
    expect(check({ steps: 12 })).toBe('지원하지 않는 값입니다: 스텝 = 12');
    expect(check({ steps: { key: '12', value: '12' } })).toContain('스텝 = 12');
  });

  test('표시 이름(key)은 값이 아니다', () => {
    expect(check({ length: '5초' })).toContain('길이');
  });

  test('보내지 않은 칸과 빈 값은 보지 않는다', () => {
    expect(check({})).toBeNull();
    expect(check({ length: '', steps: null })).toBeNull();
    expect(findFieldValueViolation(wb, undefined)).toBeNull();
  });

  test('선택지를 정하지 않은 선택 칸은 막지 않는다', () => {
    expect(check({ free: 'anything' })).toBeNull();
  });

  test('값으로 객체나 배열이 오면 막는다', () => {
    expect(check({ steps: ['2'] })).toContain('스텝');
    expect(check({ steps: { foo: 1 } })).toContain('스텝');
  });

  test('칸 값이 없으면 같은 이름의 top-level 값을 본다', () => {
    expect(check({}, { steps: '12' })).toContain('스텝 = 12');
    expect(check({ steps: '2' }, { steps: '12' })).toBeNull(); // 칸 값이 먼저다
  });

  test('크기 칸은 top-level imageSize 도 본다 (#1174)', () => {
    expect(check({}, { imageSize: '4096x4096' })).toContain('크기 = 4096x4096');
    expect(check({}, { imageSize: '1024x1024' })).toBeNull();
    expect(check({ image_size: '1024x1024' }, { imageSize: '4096x4096' })).toBeNull();
  });
});

describe('숫자 칸', () => {
  test('범위 안의 숫자는 통과한다 — 글자로 와도', () => {
    expect(check({ cfg: 1 })).toBeNull();
    expect(check({ cfg: '7.5' })).toBeNull();
    expect(check({ shift: -3 })).toBeNull(); // 범위를 정하지 않은 칸
  });

  test('범위 밖이면 막는다', () => {
    expect(check({ cfg: 0.5 })).toBe('지원하지 않는 값입니다: CFG = 0.5');
    expect(check({ cfg: '11' })).toContain('CFG = 11');
  });

  test('숫자가 아니면 막는다', () => {
    expect(check({ shift: 'abc' })).toContain('시프트 = abc');
    expect(check({ shift: true })).toContain('시프트');
    expect(check({ shift: ' ' })).toContain('시프트');
  });

  test('실행기(parseFloat)와 다르게 읽히는 글자는 받지 않는다', () => {
    expect(check({ cfg: '0x2' })).toContain('CFG = 0x2');
    expect(check({ cfg: '3abc' })).toContain('CFG = 3abc');
    expect(check({ cfg: ' 2 ' })).toBeNull();
    expect(check({ cfg: '1e0' })).toBeNull();
  });

  test('0 은 값이다', () => {
    expect(check({ shift: 0 })).toBeNull();
    expect(check({ cfg: 0 })).toContain('CFG = 0');
  });
});

describe('판 기본값 · 옛 이름', () => {
  const edited = {
    additionalInputFields: [
      // 판을 고치며 선택지에서 기본값(362)을 뺐는데 기본값은 그대로 둔 상태
      { name: 'length', label: '길이', type: 'select', defaultValue: '362', options: [{ key: '5초', value: '124' }] },
      { name: 'output_format', label: '출력 형식', type: 'select', defaultValue: 'gif', options: [{ key: 'GIF', value: 'gif' }] },
    ],
  };

  test('칸을 보내지 않으면 판 기본값을 본다 — 기본값이 선택지 밖이면 막는다', () => {
    expect(findFieldValueViolation(edited, { additionalParams: {} })).toBe('지원하지 않는 값입니다: 길이 = 362');
    expect(findFieldValueViolation(edited, { additionalParams: { length: '124' } })).toBeNull();
  });

  test('실행기가 읽는 옛 이름(outputFormat)으로 보낸 값도 본다 (#943)', () => {
    const ok = { length: '124' };
    expect(findFieldValueViolation(edited, { additionalParams: { ...ok, outputFormat: 'png' } })).toContain('출력 형식 = png');
    expect(findFieldValueViolation(edited, { outputFormat: 'png', additionalParams: ok })).toContain('출력 형식 = png');
    expect(findFieldValueViolation(edited, { additionalParams: { ...ok, output_format: 'gif', outputFormat: 'png' } })).toBeNull(); // 칸 값이 먼저다
    expect(findFieldValueViolation(edited, { additionalParams: { ...ok, outputFormat: 'gif' } })).toBeNull();
  });
});

describe('다루지 않는 칸', () => {
  test('글자 · 모델 칸은 이 검사에서 보지 않는다', () => {
    expect(check({ note: 'x'.repeat(500), base_model: 'any/where.safetensors' })).toBeNull();
  });

  test('칸이 없는 판은 통과한다', () => {
    expect(findFieldValueViolation({}, { additionalParams: { steps: 99 } })).toBeNull();
    expect(findFieldValueViolation(null, {})).toBeNull();
  });
});

describe('저장소의 작업판', () => {
  const dir = path.join(__dirname, '../../workboards');
  const files = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.json')) files.push(p);
  });
  walk(dir);
  const boards = files
    .map((p) => { const d = JSON.parse(fs.readFileSync(p, 'utf8')); return { p, wb: d.workboard || d }; })
    .filter(({ wb: b }) => Array.isArray(b.additionalInputFields));

  test('판마다 기본값을 그대로 보내면 통과한다 — 기본값이 자기 선택지 밖인 판이 없다', () => {
    expect(boards.length).toBeGreaterThan(10);
    const failures = [];
    for (const { p, wb: board } of boards) {
      const params = {};
      for (const f of board.additionalInputFields) {
        if ((f.type === 'select' || f.type === 'number') && f.defaultValue !== undefined && f.defaultValue !== null) {
          params[f.name] = f.defaultValue;
        }
      }
      const v = findFieldValueViolation(board, { additionalParams: params });
      if (v) failures.push(`${path.basename(p)}: ${v}`);
    }
    expect(failures).toEqual([]);
  });
});
