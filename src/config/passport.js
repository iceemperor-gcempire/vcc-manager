const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const Group = require('../models/Group');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });

    if (user) {
      await user.updateLastLogin();
      await user.updateAdminStatus();
      return done(null, user);
    }

    // 기본 그룹 자동 가입 (#198) — Google OAuth 신규 사용자도 동일 정책
    const defaultGroup = await Group.findDefault();
    const initialGroupIds = defaultGroup ? [defaultGroup._id] : [];

    const newUser = new User({
      googleId: profile.id,
      email: profile.emails[0].value,
      nickname: profile.displayName,
      avatar: profile.photos[0]?.value,
      authProvider: 'google',
      isEmailVerified: true, // Google users are pre-verified
      groupIds: initialGroupIds
    });

    await newUser.updateAdminStatus();
    if (newUser.isAdmin) {
      newUser.groupIds = [];
    }
    await newUser.save();
    
    return done(null, newUser);
  } catch (error) {
    console.error('Error in Google Strategy:', error);
    return done(error, null);
  }
}));

module.exports = passport;