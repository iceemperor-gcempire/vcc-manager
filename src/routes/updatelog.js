const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { requireAuth } = require('../middleware/auth');
const { version: APP_VERSION } = require('../../package.json');
const { parseVersion, extractSections, pickNoticeSections } = require('../utils/updateNotice');
const router = express.Router();

const UPDATELOG_DIR = path.join(__dirname, '../../docs/updatelogs');

async function loadSections(fromMajor, toMajor) {
  const sections = [];
  for (let major = fromMajor; major <= toMajor; major += 1) {
    try {
      sections.push(...extractSections(await fs.readFile(path.join(UPDATELOG_DIR, `v${major}.md`), 'utf-8')));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  return sections;
}

// 버전 업데이트 공지 (#999) — 이 사용자에게 보여줄 섹션. /:majorVersion 보다 먼저 둔다
router.get('/notice', requireAuth, async (req, res) => {
  const lastSeen = req.user.preferences?.lastSeenVersion;
  const current = parseVersion(APP_VERSION);
  const last = parseVersion(lastSeen);
  const sections = await loadSections(last ? last[0] : current[0], current[0]);
  const result = pickNoticeSections({ current: APP_VERSION, lastSeen, sections });
  res.json({ success: true, data: { currentVersion: APP_VERSION, ...result } });
});

// 공지를 닫으면 현재 버전까지 봤다고 기록한다 — 계정 단위라 다른 기기에서도 다시 안 뜬다
router.post('/notice/seen', requireAuth, async (req, res) => {
  req.user.preferences.lastSeenVersion = APP_VERSION;
  await req.user.save();
  res.json({ success: true, data: { lastSeenVersion: APP_VERSION } });
});

router.get('/:majorVersion', requireAuth, async (req, res) => {
  try {
    const { majorVersion } = req.params;

    // majorVersion은 숫자만 허용
    if (!/^\d+$/.test(majorVersion)) {
      return res.status(400).json({
        success: false,
        message: '잘못된 버전 형식입니다.'
      });
    }

    const filePath = path.join(__dirname, '../../docs/updatelogs', `v${majorVersion}.md`);
    const content = await fs.readFile(filePath, 'utf-8');

    res.json({
      success: true,
      data: { content }
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        message: '해당 버전의 업데이트 내역을 찾을 수 없습니다.'
      });
    }
    throw err;
  }
});

module.exports = router;
