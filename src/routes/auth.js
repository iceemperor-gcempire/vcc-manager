const express = require('express');
const passport = require('passport');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { generateJWT, requireAuth, verifyJWT, authRateLimit, signupRateLimit } = require('../middleware/auth');
const { validate, signupSchema, signinSchema } = require('../utils/validation');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../services/emailService');
const router = express.Router();

// Rate limit for forgot password - 3 requests per hour per IP
const forgotPasswordRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    message: '비밀번호 재설정 요청이 너무 많습니다. 1시간 후에 다시 시도해주세요.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/google',
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
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
  res.json({ message: 'Logged out successfully' });
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
  const isAuth = !!req.user;
  res.json({
    authenticated: isAuth,
    user: isAuth ? {
      id: req.user._id,
      email: req.user.email,
      nickname: req.user.nickname,
      isAdmin: req.user.isAdmin,
      authProvider: req.user.authProvider
    } : null
  });
});

// Request password reset
router.post('/forgot-password', forgotPasswordRateLimit, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: '이메일을 입력해주세요'
      });
    }

    // Find user by email (only local auth users can reset password)
    const user = await User.findOne({
      email: email.toLowerCase(),
      authProvider: 'local'
    });

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // Generate reset token
      const resetToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      // Build reset URL
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (emailError) {
        // If email fails, clear the token
        user.clearPasswordResetToken();
        await user.save({ validateBeforeSave: false });
        console.error('Failed to send password reset email:', emailError);
        return res.status(500).json({
          message: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.'
        });
      }
    }

    // Always return success message (for security)
    res.json({
      message: '입력하신 이메일로 비밀번호 재설정 링크를 발송했습니다. 이메일을 확인해주세요.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      message: '비밀번호 재설정 요청 처리 중 오류가 발생했습니다'
    });
  }
});

// Verify reset token
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        valid: false,
        message: '유효하지 않거나 만료된 토큰입니다'
      });
    }

    res.json({
      valid: true,
      message: '유효한 토큰입니다'
    });

  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({
      valid: false,
      message: '토큰 검증 중 오류가 발생했습니다'
    });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        message: '필수 항목을 모두 입력해주세요'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: '비밀번호가 일치하지 않습니다'
      });
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: '비밀번호는 8자 이상이며, 대문자, 소문자, 숫자, 특수문자(!@#$%^&*)를 포함해야 합니다'
      });
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: '유효하지 않거나 만료된 토큰입니다'
      });
    }

    // Update password and clear reset token
    user.password = password;
    user.clearPasswordResetToken();
    await user.save();

    res.json({
      message: '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      message: '비밀번호 재설정 중 오류가 발생했습니다'
    });
  }
});

module.exports = router;