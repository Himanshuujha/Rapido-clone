// server.js
console.log('[DEBUG] 1. Requiring HTTP module');
const http = require('http');

console.log('[DEBUG] 2. Requiring app');
const app = require('./app');

console.log('[DEBUG] 3. Requiring database config');
const connectDB = require('./src/config/database');

console.log('[DEBUG] 4. Requiring redis config');
const { connectRedis } = require('./src/config/redis');

console.log('[DEBUG] 5. Requiring socket initialization');
const initializeSocket = require('./src/sockets');

console.log('[DEBUG] 6. Requiring logger');
const logger = require('./src/utils/logger');

console.log('[DEBUG] 7. Requiring jobs');
const { initializeJobs } = require('./src/jobs');

// Environment variables
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Development defaults for secrets (do NOT use in production)
if (NODE_ENV !== 'production') {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_change_me';
}

console.log('[DEBUG] 8. Environment loaded - PORT:', PORT, 'NODE_ENV:', NODE_ENV);

// Create HTTP server
console.log('[DEBUG] 9. Creating HTTP server');
const server = http.createServer(app);
console.log('[DEBUG] 10. HTTP server created');

// Store server globally for graceful shutdown
global.server = server;

// Initialize Socket.io
console.log('[DEBUG] 11. Initializing Socket.io');
const io = initializeSocket(server);
console.log('[DEBUG] 12. Socket.io initialized');

// Make io accessible in routes
app.set('io', io);

console.log('[DEBUG] 13. About to call startServer()');

// Start server
const startServer = async () => {
  try {
    console.log('[DEBUG] startServer called');

    // Connect to MongoDB with error handling
    try {
      console.log('[DEBUG] Attempting MongoDB connection...');
      await connectDB();
      console.log('[DEBUG] MongoDB connection successful');
      logger.info('✅ MongoDB connected successfully');
    } catch (error) {
      console.log('[DEBUG] MongoDB connection error:', error.message);
      logger.warn('⚠️ MongoDB connection failed. Server will start without database.', error.message);
    }

    // Connect to Redis with error handling
    try {
      console.log('[DEBUG] Attempting Redis connection...');
      await connectRedis();
      console.log('[DEBUG] Redis connection successful');
      logger.info('✅ Redis connected successfully');
    } catch (error) {
      console.log('[DEBUG] Redis connection error:', error.message);
      logger.warn('⚠️ Redis connection failed. Server will start without cache.', error.message);
    }

    // Initialize background jobs
    try {
      console.log('[DEBUG] Initializing jobs...');
      await initializeJobs();
      console.log('[DEBUG] Jobs initialized');
      logger.info('✅ Background jobs initialized');
    } catch (error) {
      console.log('[DEBUG] Jobs initialization error:', error.message);
      logger.warn('⚠️ Background jobs initialization failed.', error.message);
    }

    // Start listening
    console.log('[DEBUG] Starting HTTP server on port', PORT);
    server.listen(PORT, () => {
      logger.info(`
      ╔═══════════════════════════════════════════════════╗
      ║                                                   ║
      ║   🚀 RAPIDO CLONE SERVER STARTED                  ║
      ║                                                   ║
      ║   🌐 Environment: ${NODE_ENV.padEnd(28)}║
      ║   🔗 Port: ${PORT.toString().padEnd(35)}║
      ║   📡 API: http://localhost:${PORT}/api/v1${' '.repeat(10)}║
      ║   📚 Docs: http://localhost:${PORT}/api/docs${' '.repeat(7)}║
      ║   ❤️  Health: http://localhost:${PORT}/health${' '.repeat(6)}║
      ║                                                   ║
      ╚═══════════════════════════════════════════════════╝
      `);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      switch (error.code) {
        case 'EACCES':
          logger.error(`Port ${PORT} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`Port ${PORT} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

  } catch (error) {
    console.log('[DEBUG] Unhandled error in startServer:', error);
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
console.log('[DEBUG] 14. Calling startServer()');
startServer();
console.log('[DEBUG] 15. startServer() called (async)');