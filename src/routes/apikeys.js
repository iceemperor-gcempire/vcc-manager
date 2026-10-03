const express = require('express');
const { requireAuth, requireNonApiKeyAuth } = require('../middleware/auth');
const ApiKey = require('../models/ApiKey');
const { API_KEY_SCOPES, DEFAULT_API_KEY_SCOPE } = require('../constants/apiKeyScopes');
const router = express.Router();

const MAX_ACTIVE_KEYS = 10;

// All routes require non-API-key auth
router.use(requireAuth);
router.use(requireNonApiKeyAuth);

// GET /api/apikeys — List all API keys for current user
router.get('/', async (req, res) => {
  try {
    const apiKeys = await ApiKey.find({ userId: req.user._id })
      .select('name prefix scope lastUsedAt isRevoked revokedAt createdAt')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: apiKeys });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/apikeys — Create a new API key
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const scope = req.body.scope || DEFAULT_API_KEY_SCOPE;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'API key name is required' });
    }
    if (!API_KEY_SCOPES.includes(scope)) {
      return res.status(400).json({ success: false, message: `scope must be one of: ${API_KEY_SCOPES.join(', ')}` });
    }

    // Check active key count
    const activeCount = await ApiKey.countDocuments({
      userId: req.user._id,
      isRevoked: false
    });

    if (activeCount >= MAX_ACTIVE_KEYS) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_ACTIVE_KEYS} active API keys allowed`
      });
    }

    const { fullKey, prefix, keyHash } = ApiKey.generateKey(scope);

    const apiKey = await ApiKey.create({
      userId: req.user._id,
      name: name.trim(),
      prefix,
      keyHash,
      scope
    });

    res.status(201).json({
      success: true,
      data: {
        id: apiKey._id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        scope: apiKey.scope,
        key: fullKey,
        createdAt: apiKey.createdAt
      },
      message: 'API key created. Please save the key now — it cannot be shown again.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/apikeys/:id — Revoke an API key (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const apiKey = await ApiKey.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!apiKey) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }

    if (apiKey.isRevoked) {
      return res.status(400).json({ success: false, message: 'API key is already revoked' });
    }

    apiKey.isRevoked = true;
    apiKey.revokedAt = new Date();
    await apiKey.save();

    res.json({ success: true, message: 'API key revoked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
