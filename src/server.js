const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const passport = require('passport');
const dotenv = require('dotenv');

const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const workboardRoutes = require('./routes/workboards');
const imageRoutes = require('./routes/images');
const jobRoutes = require('./routes/jobs');
const conversationRoutes = require('./routes/conversations');
const textRoutes = require('./routes/texts');
const pipelineRoutes = require('./routes/pipelines');
const pipelineRunRoutes = require('./routes/pipelineRuns');
const { initPipelineRunQueue, closePipelineRunQueue } = require('./services/pipelineRunService');
const adminRoutes = require('./routes/admin');
const serverRoutes = require('./routes/servers');
const promptDataRoutes = require('./routes/promptData');
const tagRoutes = require('./routes/tags');
const projectRoutes = require('./routes/projects');
const backupRoutes = require('./routes/backup');
const updatelogRoutes = require('./routes/updatelog');
const apiKeyRoutes = require('./routes/apikeys');
const filesRoutes = require('./routes/files');
const groupRoutes = require('./routes/groups');
const dashboardRoutes = require('./routes/dashboard');
const errorHandler = require('./middleware/errorHandler');
const { verifyJWT, verifyApiKey } = require('./middleware/auth');
const { blockDuringBackup } = require('./middleware/backupLock');
const { transformUploadUrls } = require('./utils/signedUrl');
const { initializeQueues, closeQueues, getQueueStats } = require('./services/queueService');
const migrateMediaOrderIndex = require('./migrations/migrateMediaOrderIndex');
const migrateServerTypeToOpenAI = require('./migrations/migrateServerTypeToOpenAI');
const dropBackupJobTTL = require('./migrations/dropBackupJobTTL');
const dropWorkboardApiFormat = require('./migrations/dropWorkboardApiFormat');
const dropLegacyModelCacheCollection = require('./migrations/dropLegacyModelCacheCollection');
const cleanupStuckSyncs = require('./migrations/cleanupStuckSyncs');
const cleanupStuckBackupRestoreJobs = require('./migrations/cleanupStuckBackupRestoreJobs');
const cleanupOrphanBackupFiles = require('./migrations/cleanupOrphanBackupFiles');
const initializeDefaultGroup = require('./migrations/initializeDefaultGroup');
const assignDefaultGroupToWorkboards = require('./migrations/assignDefaultGroupToWorkboards');
const backfillCustomFieldRoles = require('./migrations/backfillCustomFieldRoles');
const dropBaseInputFieldsSchema = require('./migrations/dropBaseInputFieldsSchema');
const relocateCivitaiApiKey = require('./migrations/relocateCivitaiApiKey');
const encryptExistingSecrets = require('./migrations/encryptExistingSecrets');
const ensureWorldviewTag = require('./migrations/ensureWorldviewTag');
const backfillConversationTags = require('./migrations/backfillConversationTags');
const alignTagColorsV2 = require('./migrations/alignTagColorsV2');
const backfillVideoThumbnails = require('./migrations/backfillVideoThumbnails');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
let httpServer = null; // 종료 처리에서 close 하기 위해 모듈 스코프 유지 (#523)

// Trust proxy for rate limiting (behind nginx/docker)
app.set('trust proxy', 1);

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

// API GET 응답에 Cache-Control 명시 — 브라우저 heuristic 캐싱으로 인한 stale 응답 방지
// (예: admin 모델 sync 후 picker 가 같은 URL 캐시를 재사용해 이전 목록을 보이는 문제)
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
  }
  next();
});

// Passport configuration
require('./config/passport');
app.use(passport.initialize());

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

  // Require JWT for all other API routes
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    return verifyJWT(req, res, next);
  } else {
    return res.status(401).json({ message: 'Authentication required' });
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
      // Convert Mongoose documents to plain objects before transforming URLs
      const plain = JSON.parse(JSON.stringify(body));
      return originalJson(transformUploadUrls(plain));
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
app.use('/api/conversations', conversationRoutes);
app.use('/api/texts', textRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/prompt-data', promptDataRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/pipelines', pipelineRoutes);
app.use('/api/projects/:projectId/pipeline-runs', pipelineRunRoutes);
app.use('/api/admin/backup', backupRoutes);
app.use('/api/updatelog', updatelogRoutes);
app.use('/api/apikeys', apiKeyRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/dashboard', dashboardRoutes);

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

// 종료 처리 (#523) — 잡이 매우 길 수 있어 active 잡 완료는 기다리지 않는다 (빠른 종료).
// 대신 중단되는 잡 수를 경고로 남기고, 신규 수락 중단 + 연결 정리만 짧은 시간 내 수행.
const SHUTDOWN_TIMEOUT_MS = 5000;
let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Shutting down...`);

  // 경고: 진행/대기 중 잡 표시 (재기동 후 Bull stalled 재시도로 이어질 수 있음)
  try {
    const stats = await getQueueStats();
    if (stats.active > 0 || stats.waiting > 0) {
      console.warn(`⚠️ 종료로 중단되는 잡 — 진행 중 ${stats.active}건 / 대기 ${stats.waiting}건`);
    }
  } catch (e) {
    console.warn('큐 상태 조회 실패 (무시):', e.message);
  }

  // 정리가 늦으면 강제 종료 (빠른 종료 우선)
  const forceExit = setTimeout(() => {
    console.warn(`정리 ${SHUTDOWN_TIMEOUT_MS}ms 초과 — 강제 종료`);
    process.exit(0);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
      console.log('🛑 HTTP server closed');
    }
    await Promise.allSettled([closeQueues(), closePipelineRunQueue()]);
    await require('mongoose').disconnect();
    console.log('🛑 MongoDB disconnected');
  } catch (e) {
    console.error('Shutdown cleanup error:', e.message);
  }

  clearTimeout(forceExit);
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

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
    await migrateMediaOrderIndex();
    await migrateServerTypeToOpenAI();
    await dropBackupJobTTL();
    await dropWorkboardApiFormat();
    await dropLegacyModelCacheCollection();
    await cleanupStuckSyncs();
    await cleanupStuckBackupRestoreJobs();
    await cleanupOrphanBackupFiles();
    await initializeDefaultGroup();
    await assignDefaultGroupToWorkboards();
    await backfillCustomFieldRoles();
    await dropBaseInputFieldsSchema();
    await relocateCivitaiApiKey();
    await encryptExistingSecrets();
    await ensureWorldviewTag();
    await backfillConversationTags();
    await alignTagColorsV2();
    await backfillVideoThumbnails(); // #672 기존 동영상 썸네일 백필 (best-effort)

    // Initialize job queues after database connection
    console.log('Initializing job queues...');
    await initializeQueues();
    await initPipelineRunQueue();
    
    // Start HTTP server
    httpServer = app.listen(PORT, () => {
      console.log(`✅ Server is running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log('🚀 VCC Manager Backend started successfully!');
    });

    // Handle server errors
    httpServer.on('error', (err) => {
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
