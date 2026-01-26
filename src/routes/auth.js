const express = require('express');
const passport = require('passport');
const { generateJWT, requireAuth, verifyJWT, authRateLimit, signupRateLimit } = require('../middleware/auth');
const { validate, signupSchema, signinSchema } = require('../utils/validation');
const User = require('../models/User');
const router = express.Router();

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const user = req.user;
      
      // Update admin status
      await user.updateAdminStatus();
      
      // Check approval status
      if (user.approvalStatus !== 'approved') {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        if (user.approvalStatus === 'pending') {
          return res.redirect(`${frontendUrl}/login?error=pending`);
        } else if (user.approvalStatus === 'rejected') {
          return res.redirect(`${frontendUrl}/login?error=rejected`);
        }
      }
      
      const token = generateJWT(user);
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Google auth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }
);

router.get('/me', verifyJWT, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      nickname: req.user.nickname,
      avatar: req.user.avatar,
      isAdmin: req.user.isAdmin,
      authProvider: req.user.authProvider,
      preferences: req.user.preferences
    }
  });
});

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Session destruction failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });
});

// Email/Password Registration
router.post('/signup', signupRateLimit, validate(signupSchema), async (req, res) => {
  try {
    const { email, password, nickname, confirmPassword } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        message: '이미 등록된 이메일입니다'
      });
    }
    
    // Check if nickname is already taken
    const existingNickname = await User.findOne({ nickname: nickname.trim() });
    if (existingNickname) {
      return res.status(400).json({
        message: '이미 사용 중인 닉네임입니다'
      });
    }
    
    // Create new user
    const newUser = new User({
      email: email.toLowerCase(),
      password,
      nickname: nickname.trim(),
      authProvider: 'local',
      isEmailVerified: false // Email verification can be implemented later
    });
    
    await newUser.updateAdminStatus();
    await newUser.save();
    
    // Generate JWT token
    const token = generateJWT(newUser);
    
    // Log the user in
    req.login(newUser, (err) => {
      if (err) {
        return res.status(500).json({ message: '로그인 처리 중 오류가 발생했습니다' });
      }
      
      res.status(201).json({
        message: '회원가입이 완료되었습니다',
        user: {
          id: newUser._id,
          email: newUser.email,
          nickname: newUser.nickname,
          isAdmin: newUser.isAdmin,
          authProvider: newUser.authProvider,
          preferences: newUser.preferences
        },
        token
      });
    });
    
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: '회원가입 처리 중 오류가 발생했습니다' });
  }
});

// Email/Password Sign In
router.post('/signin', authRateLimit, validate(signinSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      authProvider: 'local'
    });
    
    if (!user) {
      return res.status(401).json({
        message: '이메일 또는 비밀번호가 올바르지 않습니다'
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        message: '비활성화된 계정입니다. 관리자에게 문의해주세요'
      });
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: '이메일 또는 비밀번호가 올바르지 않습니다'
      });
    }
    
    // Update admin status first
    await user.updateAdminStatus();
    
    // Check approval status after admin status update
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
    
    // Update last login
    await user.updateLastLogin();
    
    // Generate JWT token
    const token = generateJWT(user);
    
    // Log the user in
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ message: '로그인 처리 중 오류가 발생했습니다' });
      }
      
      res.json({
        message: '로그인되었습니다',
        user: {
          id: user._id,
          email: user.email,
          nickname: user.nickname,
          avatar: user.avatar,
          isAdmin: user.isAdmin,
          authProvider: user.authProvider,
          preferences: user.preferences
        },
        token
      });
    });
    
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ message: '로그인 처리 중 오류가 발생했습니다' });
  }
});

// Check email availability
router.get('/check-email/:email', async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    const user = await User.findOne({ email });
    
    res.json({
      available: !user,
      message: user ? '이미 등록된 이메일입니다' : '사용 가능한 이메일입니다'
    });
  } catch (error) {
    res.status(500).json({ message: '이메일 확인 중 오류가 발생했습니다' });
  }
});

// Check nickname availability
router.get('/check-nickname/:nickname', async (req, res) => {
  try {
    const nickname = req.params.nickname.trim();
    const user = await User.findOne({ nickname });
    
    res.json({
      available: !user,
      message: user ? '이미 사용 중인 닉네임입니다' : '사용 가능한 닉네임입니다'
    });
  } catch (error) {
    res.status(500).json({ message: '닉네임 확인 중 오류가 발생했습니다' });
  }
});

router.get('/status', (req, res) => {
  const isAuth = req.isAuthenticated && req.isAuthenticated();
  res.json({
    authenticated: isAuth,
    user: isAuth && req.user ? {
      id: req.user._id,
      email: req.user.email,
      nickname: req.user.nickname,
      isAdmin: req.user.isAdmin,
      authProvider: req.user.authProvider
    } : null
  });
});

module.exports = router;