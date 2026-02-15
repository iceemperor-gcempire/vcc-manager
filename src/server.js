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
const projectRoutes = require('./routes/projects');
const backupRoutes = require('./routes/backup');
const updatelogRoutes = require('./routes/updatelog');
const apiKeyRoutes = require('./routes/apikeys');
const filesRoutes = require('./routes/files');
const errorHandler = require('./middleware/errorHandler');
const { verifyJWT, verifyApiKey } = require('./middleware/auth');
const { blockDuringBackup } = require('./middleware/backupLock');
const { transformUploadUrls } = require('./utils/signedUrl');
const { initializeQueues } = require('./services/queueService');
const migrateWorkboardApiFormat = require('./migrations/migrateWorkboardApiFormat');
const migrateMediaOrderIndex = require('./migrations/migrateMediaOrderIndex');

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

// JWT / API Key authentication middleware for API routes
app.use('/api', (req, res, next) => {
  // Skip auth for auth routes, public endpoints, and signed file URLs
  // (/files/* handles its own auth via signature or inline JWT/API Key check)
  if (req.path.startsWith('/auth/') || req.path === '/health' || req.path.startsWith('/files')) {
    return next();
  }

  // Check for API Key first
  const apiKey = req.header('X-API-Key');
  if (apiKey) {
    return verifyApiKey(req, res, next);
  }

  // Try JWT, fall back to session-based auth
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    return verifyJWT(req, res, next);
  } else {
    // For session-based auth (Google OAuth)
    return next();
  }
});

// 백업 진행 중 데이터 변경 차단 미들웨어
app.use('/api', blockDuringBackup);

// Signed URL response middleware: transform /uploads/... URLs in API JSON responses
app.use('/api', (req, res, next) => {
  // Skip for file serving routes (they handle their own responses)
  if (req.path.startsWith('/files')) {
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    try {
      return originalJson(transformUploadUrls(body));
    } catch (err) {
      return originalJson(body);
    }
  };
  next();
});

// Signed URL file serving (no JWT/API Key — signature is the auth)
app.use('/api/files', filesRoutes);

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
app.use('/api/projects', projectRoutes);
app.use('/api/admin/backup', backupRoutes);
app.use('/api/updatelog', updatelogRoutes);
app.use('/api/apikeys', apiKeyRoutes);

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
    
    // Run migrations
    console.log('Running migrations...');
    await migrateWorkboardApiFormat();
    await migrateMediaOrderIndex();

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