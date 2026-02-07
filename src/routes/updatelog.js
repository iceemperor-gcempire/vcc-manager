const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

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
