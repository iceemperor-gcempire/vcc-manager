const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  const user = req.user;
  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'User account is inactive' });
  }
  
  if (user.approvalStatus !== 'approved') {
    if (user.approvalStatus === 'pending') {
      return res.status(403).json({ 
        message: 'Account pending approval',
        approvalStatus: 'pending'
      });
    } else if (user.approvalStatus === 'rejected') {
      return res.status(403).json({ 
        message: 'Account access denied',
        approvalStatus: 'rejected'
      });
    }
  }
  
  return next();
};

const requireAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  const user = req.user;
  if (!user || !user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  return next();
};

const optionalAuth = (req, res, next) => {
  next();
};

// #198: 작업판 단위 접근 권한 평가.
//
// 정책:
// - admin (isAdmin: true) → 모든 작업판 implicit all-access. bypass.
// - 일반 사용자 → workboard.allowedGroupIds ∩ user.groupIds ≠ ∅ 이어야 통과 (UNION 규칙).
// - 작업판 미발견 시 404.

/**
 * 사용자가 특정 작업판에 접근 가능한지 검사.
 * @param {Object} user — req.user (User document)
 * @param {Object} workboard — Workboard document
 * @returns {boolean}
 */
function userHasWorkboardAccess(user, workboard) {
  if (!user || !workboard) return false;
  if (user.isAdmin) return true;
  const allowed = (workboard.allowedGroupIds || []).map(String);
  const mine = (user.groupIds || []).map(String);
  return mine.some((g) => allowed.includes(g));
}

/**
 * 사용자가 접근 가능한 작업판들을 추리는 Mongoose 쿼리 조건.
 * admin 은 빈 객체 (모든 작업판) 반환. 일반 사용자는 allowedGroupIds 가
 * user.groupIds 와 교집합이 있는 것만.
 * @param {Object} user — req.user
 * @returns {Object} mongo filter
 */
function buildWorkboardAccessFilter(user) {
  if (!user) return { _id: null };  // 차단
  if (user.isAdmin) return {};
  const groupIds = (user.groupIds || []).map((g) => g);
  if (groupIds.length === 0) return { _id: null };  // 어느 그룹에도 안 속함 → 차단
  return { allowedGroupIds: { $in: groupIds } };
}

/**
 * Express 미들웨어 — req.params.id 로 식별된 작업판에 대해 사용자 권한 검사.
 * 통과 시 req.workboard 에 작업판을 attach.
 * (라우트 내부에서 다시 findById 호출할 필요 없도록 캐시)
 */
const requireWorkboardAccess = async (req, res, next) => {
  try {
    const Workboard = require('../models/Workboard');
    const workboard = await Workboard.findById(req.params.id)
      .populate('createdBy', 'nickname email')
      .populate('serverId', 'name serverType serverUrl isActive');
    if (!workboard) {
      return res.status(404).json({ message: 'Workboard not found' });
    }
    if (!userHasWorkboardAccess(req.user, workboard)) {
      return res.status(403).json({ message: '이 작업판에 접근할 권한이 없습니다.' });
    }
    req.workboard = workboard;
    return next();
  } catch (error) {
    console.error('requireWorkboardAccess error:', error);
    return res.status(500).json({ message: error.message });
  }
};

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// signup rate limit — 기본 1시간당 3회. env SIGNUP_RATE_LIMIT_MAX 로 dev / e2e 환경 완화 가능 (#359).
const signupRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.SIGNUP_RATE_LIMIT_MAX, 10) || 3,
  message: {
    message: 'Too many signup attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generateJWT = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email,
      isAdmin: user.isAdmin,
      authProvider: user.authProvider
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: 'vcc-manager',
      audience: 'vcc-users'
    }
  );
};

const verifyJWT = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'vcc-manager',
      audience: 'vcc-users'
    });
    
    const user = await User.findById(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    
    if (user.approvalStatus !== 'approved') {
      if (user.approvalStatus === 'pending') {
        return res.status(403).json({ 
          message: 'Account pending approval',
          approvalStatus: 'pending'
        });
      } else if (user.approvalStatus === 'rejected') {
        return res.status(403).json({ 
          message: 'Account access denied',
          approvalStatus: 'rejected'
        });
      }
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token format' });
    }
    return res.status(401).json({ message: 'Token verification failed' });
  }
};

const verifyApiKey = async (req, res, next) => {
  const apiKey = req.header('X-API-Key');

  if (!apiKey) {
    return res.status(401).json({ message: 'No API key provided' });
  }

  try {
    const keyHash = ApiKey.hashKey(apiKey);
    const apiKeyDoc = await ApiKey.findOne({ keyHash, isRevoked: false });

    if (!apiKeyDoc) {
      return res.status(401).json({ message: 'Invalid or revoked API key' });
    }

    const user = await User.findById(apiKeyDoc.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User account is inactive' });
    }

    if (user.approvalStatus !== 'approved') {
      return res.status(403).json({
        message: user.approvalStatus === 'pending'
          ? 'Account pending approval'
          : 'Account access denied',
        approvalStatus: user.approvalStatus
      });
    }

    req.user = user;
    req.authMethod = 'apikey';

    // Fire-and-forget lastUsedAt update
    ApiKey.updateOne({ _id: apiKeyDoc._id }, { lastUsedAt: new Date() }).catch(() => {});

    next();
  } catch (error) {
    return res.status(401).json({ message: 'API key verification failed' });
  }
};

const requireNonApiKeyAuth = (req, res, next) => {
  if (req.authMethod === 'apikey') {
    return res.status(403).json({ message: 'API key management is not available via API key authentication' });
  }
  return next();
};

module.exports = {
  requireAuth,
  requireAdmin,
  optionalAuth,
  generateJWT,
  verifyJWT,
  verifyApiKey,
  requireNonApiKeyAuth,
  authRateLimit,
  signupRateLimit,
  requireWorkboardAccess,
  userHasWorkboardAccess,
  buildWorkboardAccessFilter
};