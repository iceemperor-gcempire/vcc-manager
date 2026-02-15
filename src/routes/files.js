const express = require('express');
const path = require('path');
const { verifySignature, generateSignedUrl } = require('../utils/signedUrl');
const { verifyJWT, verifyApiKey } = require('../middleware/auth');

const router = express.Router();
const UPLOAD_ROOT = process.env.UPLOAD_PATH || './uploads';

/**
 * GET /api/files/sign?path=/uploads/...
 *
 * Authenticated endpoint to generate a signed URL for a given upload path.
 * Used by MCP server in HTTP mode to get signed URLs for media files.
 */
router.get('/sign', (req, res, next) => {
  // This endpoint requires JWT or API Key auth
  const apiKey = req.header('X-API-Key');
  if (apiKey) {
    return verifyApiKey(req, res, next);
  }
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    return verifyJWT(req, res, next);
  }
  return res.status(401).json({ success: false, message: 'Authentication required' });
}, (req, res) => {
  const uploadPath = req.query.path;
  if (!uploadPath || !uploadPath.startsWith('/uploads/')) {
    return res.status(400).json({ success: false, message: 'Invalid path parameter' });
  }

  const signedUrl = generateSignedUrl(uploadPath);
  res.json({ success: true, data: { signedUrl } });
});

/**
 * GET /api/files/*
 *
 * Serve files from the uploads directory after verifying the signed URL.
 * No JWT/API Key auth required — the signature itself is the auth.
 */
router.get('/*', (req, res) => {
  const filePath = '/' + req.params[0]; // e.g. '/generated/uuid.png'
  const { expires, sig } = req.query;

  if (!expires || !sig) {
    return res.status(403).json({ success: false, message: 'Missing signature parameters' });
  }

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
