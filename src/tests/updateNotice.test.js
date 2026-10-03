/**
 * 버전 업데이트 공지 (#999).
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const {
  compareVersions, extractSections, hasActionItems, pickNoticeSections, MAX_SECTIONS,
} = require('../utils/updateNotice');
const { version: APP_VERSION } = require('../../package.json');

let mockUser;
jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = mockUser; next(); },
}));

const SAMPLE = `# v4 업데이트 내역

## v4.6.0

### 기존 사용자가 할 일
- MCP 키를 새로 발급하세요

### 새 기능
- 무언가

## v4.5.1

- 고친 것

## v4.5.0

### 새 작업판
- 둘

## 참고

버전이 아닌 h2 는 섹션이 아니다
`;

describe('compareVersions', () => {
  test.each([
    ['4.5.0', '4.6.0', -1],
    ['4.10.0', '4.9.9', 1],
    ['v4.6.0', '4.6.0', 0],
    ['5.0.0', '4.99.99', 1],
    [undefined, '4.0.0', -1],
  ])('%s vs %s', (a, b, sign) => {
    expect(Math.sign(compareVersions(a, b))).toBe(sign);
  });
});

describe('extractSections', () => {
  const sections = extractSections(SAMPLE);

  test('"## vX.Y.Z" 단위로 자르고, 버전이 아닌 h2 에서 닫는다', () => {
    expect(sections.map((s) => s.version)).toEqual(['4.6.0', '4.5.1', '4.5.0']);
    expect(sections[2].markdown).not.toMatch(/참고/);
  });

  test('h3 소제목은 섹션 안에 남는다', () => {
    expect(sections[0].markdown).toMatch(/### 기존 사용자가 할 일/);
    expect(hasActionItems(sections[0].markdown)).toBe(true);
    expect(hasActionItems(sections[1].markdown)).toBe(false);
  });

  test('실제 v4 업데이트 로그를 읽을 수 있고 최신이 위에 있다', () => {
    const real = extractSections(fs.readFileSync(path.join(__dirname, '../../docs/updatelogs/v4.md'), 'utf8'));
    expect(real.length).toBeGreaterThan(3);
    for (let i = 1; i < real.length; i += 1) {
      expect(compareVersions(real[i - 1].version, real[i].version)).toBeGreaterThan(0);
    }
  });
});

describe('pickNoticeSections', () => {
  const sections = extractSections(SAMPLE);

  test('이미 현재 버전까지 봤으면 안 띄운다', () => {
    expect(pickNoticeSections({ current: '4.6.0', lastSeen: '4.6.0', sections }).show).toBe(false);
    expect(pickNoticeSections({ current: '4.6.0', lastSeen: '4.7.0', sections }).show).toBe(false);
  });

  test('기록이 없는 기존 계정은 현재 버전 섹션만', () => {
    const r = pickNoticeSections({ current: '4.6.0', lastSeen: undefined, sections });
    expect(r.sections.map((s) => s.version)).toEqual(['4.6.0']);
    expect(r.sections[0].hasActionItems).toBe(true);
  });

  test('건너뛴 버전은 이어서 최신순으로', () => {
    const r = pickNoticeSections({ current: '4.6.0', lastSeen: '4.5.0', sections });
    expect(r.sections.map((s) => s.version)).toEqual(['4.6.0', '4.5.1']);
    expect(r.truncated).toBe(false);
  });

  test('현재 버전보다 새 섹션은 보이지 않는다 (배포 전 로그)', () => {
    const r = pickNoticeSections({ current: '4.5.1', lastSeen: '4.5.0', sections });
    expect(r.sections.map((s) => s.version)).toEqual(['4.5.1']);
  });

  test('너무 많이 건너뛰면 잘라내고 표시한다', () => {
    const many = Array.from({ length: MAX_SECTIONS + 3 }, (_, i) => ({ version: `4.${i}.0`, markdown: `## v4.${i}.0` }));
    const r = pickNoticeSections({ current: `4.${MAX_SECTIONS + 2}.0`, lastSeen: '3.0.0', sections: many });
    expect(r.sections).toHaveLength(MAX_SECTIONS);
    expect(r.truncated).toBe(true);
  });

  test('현재 버전 섹션이 없으면 (로그 없는 패치) 기록 없는 계정에도 안 띄운다', () => {
    expect(pickNoticeSections({ current: '4.6.1', lastSeen: undefined, sections }).show).toBe(false);
  });
});

describe('User — lastSeenVersion', () => {
  const User = require('../models/User');

  test('새 계정은 현재 버전으로 시작한다 (지난 공지를 안 받음)', async () => {
    const u = new User({ email: 'new@example.com', nickname: 'new_user' });
    await u.validate().catch(() => {}); // 다른 필수 필드 검증 실패와 무관하게 훅은 돈다
    expect(u.preferences.lastSeenVersion).toBe(APP_VERSION);
  });

  test('기존 계정은 비어 있다 — 그래야 첫 공지를 받는다', async () => {
    const u = User.hydrate({ _id: '507f1f77bcf86cd799439011', email: 'old@example.com', preferences: {} });
    await u.validate().catch(() => {});
    expect(u.preferences.lastSeenVersion).toBeUndefined();
  });
});

describe('라우트', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/updatelog', require('../routes/updatelog'));

  test('GET /notice — 오래된 기록이면 보여줄 섹션이 있다', async () => {
    mockUser = { preferences: { lastSeenVersion: '0.0.1' }, save: jest.fn() };
    const res = await request(app).get('/api/updatelog/notice');
    expect(res.status).toBe(200);
    expect(res.body.data.currentVersion).toBe(APP_VERSION);
    expect(res.body.data.show).toBe(true);
  });

  test('GET /notice — 현재 버전까지 봤으면 show=false', async () => {
    mockUser = { preferences: { lastSeenVersion: APP_VERSION }, save: jest.fn() };
    const res = await request(app).get('/api/updatelog/notice');
    expect(res.body.data.show).toBe(false);
  });

  test('POST /notice/seen — 현재 버전으로 기록하고 저장한다', async () => {
    mockUser = { preferences: {}, save: jest.fn().mockResolvedValue() };
    const res = await request(app).post('/api/updatelog/notice/seen');
    expect(res.status).toBe(200);
    expect(mockUser.preferences.lastSeenVersion).toBe(APP_VERSION);
    expect(mockUser.save).toHaveBeenCalled();
  });

  test('GET /:majorVersion 기존 동작 유지', async () => {
    mockUser = { preferences: {}, save: jest.fn() };
    const res = await request(app).get('/api/updatelog/4');
    expect(res.status).toBe(200);
    expect(res.body.data.content).toMatch(/## v4\./);
  });
});
