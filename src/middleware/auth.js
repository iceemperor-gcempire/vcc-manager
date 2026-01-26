const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');

const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated() && !req.user) {
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
  if (!req.isAuthenticated() && !req.user) {
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

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const signupRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 signup attempts per hour
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
    req.isAuthenticated = () => true;
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

module.exports = {
  requireAuth,
  requireAdmin,
  optionalAuth,
  generateJWT,
  verifyJWT,
  authRateLimit,
  signupRateLimit
};