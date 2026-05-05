const express = require('express');
const path = require('path');
const { verifySignature, verifyBackupSignature } = require('../utils/signedUrl');
const backupService = require('../services/backupService');

const router = express.Router();
const UPLOAD_ROOT = process.env.UPLOAD_PATH || './uploads';
const ALLOWED_SUBDIRS = ['/generated/', '/reference/', '/videos/'];

/**
 * GET /api/files/backup/:id
 *
 * 백업 ZIP 다운로드. 서명이 곧 인증 — admin 토큰 없이 navigate 가능 (#241).
 * 글로벌 /api JWT 미들웨어가 /files 를 우회시키므로 본 라우트로 도달.
 */
router.get('/backup/:id', async (req, res) => {
  const { id } = req.params;
  const { expires, sig } = req.query;

  if (!expires || !sig) {
    return res.status(403).json({ success: false, message: 'Missing signature parameters' });
  }

  const { valid, expired } = verifyBackupSignature(id, expires, sig);
  if (expired) return res.status(403).json({ success: false, message: 'URL has expired' });
  if (!valid) return res.status(403).json({ success: false, message: 'Invalid signature' });

  try {
    const { filePath, fileName } = await backupService.getBackupFilePath(id);
    res.download(filePath, fileName, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ success: false, message: '파일 다운로드 중 오류가 발생했습니다.' });
      }
    });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/files/*
 *
 * Serve files from the uploads directory after verifying the signed URL.
 * No JWT/API Key auth required — the signature itself is the auth.
 */
router.get('/*', (req, res) => {
  const rawPath = '/' + req.params[0]; // e.g. '/generated/uuid.png'
  const { expires, sig } = req.query;

  if (!expires || !sig) {
    return res.status(403).json({ success: false, message: 'Missing signature parameters' });
  }

  // Block null bytes and path traversal sequences before any processing
  if (rawPath.includes('\0') || rawPath.includes('..')) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const filePath = path.normalize(rawPath);

  // Subdirectory allowlist — only serve files from known upload directories
  if (!ALLOWED_SUBDIRS.some((dir) => filePath.startsWith(dir))) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  // Verify signature using the normalized path
  const { valid, expired } = verifySignature(filePath, expires, sig);

  if (expired) {
    return res.status(403).json({ success: false, message: 'URL has expired' });
  }

  if (!valid) {
    return res.status(403).json({ success: false, message: 'Invalid signature' });
  }

  // Resolve absolute path and prevent directory traversal
  const absolutePath = path.resolve(UPLOAD_ROOT, '.' + filePath);
  const resolvedRoot = path.resolve(UPLOAD_ROOT);

  if (!absolutePath.startsWith(resolvedRoot)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  res.set('Cache-Control', 'private, max-age=3600');
  res.sendFile(absolutePath, (err) => {
    if (err) {
      if (!res.headersSent) {
        res.status(404).json({ success: false, message: 'File not found' });
      }
    }
  });
});

module.exports = router;
