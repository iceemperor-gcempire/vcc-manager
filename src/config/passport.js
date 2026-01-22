const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

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

    const newUser = new User({
      googleId: profile.id,
      email: profile.emails[0].value,
      nickname: profile.displayName,
      avatar: profile.photos[0]?.value,
      authProvider: 'google',
      isEmailVerified: true // Google users are pre-verified
    });

    await newUser.updateAdminStatus();
    await newUser.save();
    
    return done(null, newUser);
  } catch (error) {
    console.error('Error in Google Strategy:', error);
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;