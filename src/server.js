const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const dotenv = require('dotenv');

const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const workboardRoutes = require('./routes/workboards');
const imageRoutes = require('./routes/images');
const jobRoutes = require('./routes/jobs');
const adminRoutes = require('./routes/admin');
const serverRoutes = require('./routes/servers');
const promptDataRoutes = require('./routes/promptData');
const tagRoutes = require('./routes/tags');
const errorHandler = require('./middleware/errorHandler');
const { verifyJWT } = require('./middleware/auth');
const { initializeQueues } = require('./services/queueService');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting (behind nginx/docker)
app.set('trust proxy', true);

// Database and queue initialization will be done in startServer function

// Security middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/vcc-manager'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport configuration
require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// JWT authentication middleware for API routes
app.use('/api', (req, res, next) => {
  // Skip JWT verification for auth routes and public endpoints
  if (req.path.startsWith('/auth/') || req.path === '/health') {
    return next();
  }
  
  // Try JWT first, fall back to session-based auth
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    return verifyJWT(req, res, next);
  } else {
    // For session-based auth (Google OAuth)
    return next();
  }
});

// Static file serving for uploads
app.use('/uploads', express.static(process.env.UPLOAD_PATH || './uploads'));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workboards', workboardRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/prompt-data', promptDataRoutes);
app.use('/api/tags', tagRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server with error handling
const startServer = async () => {
  try {
    console.log('Starting VCC Manager Backend...');
    
    // Connect to MongoDB first
    console.log('Connecting to MongoDB...');
    await connectDB();
    
    // Initialize job queues after database connection
    console.log('Initializing job queues...');
    await initializeQueues();
    
    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`✅ Server is running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log('🚀 VCC Manager Backend started successfully!');
    });

    // Handle server errors
    server.on('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = app;