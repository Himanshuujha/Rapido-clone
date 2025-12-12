// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Import custom modules
const connectDB = require('./src/config/database');
const connectRedis = require('./src/config/redis');
const { errorHandler, notFound } = require('./src/middlewares/errorHandler');
const logger = require('./src/utils/logger');

// Import routes - with safe loading
let authRoutes, userRoutes, captainRoutes, rideRoutes, paymentRoutes, walletRoutes, locationRoutes, couponRoutes, notificationRoutes, adminRoutes, webhookRoutes;

// Safe route loading
try {
  authRoutes = require('./src/routes/authRoutes');
} catch (e) {
  console.warn('[ROUTES] authRoutes failed to load:', e.message);
}
try {
  userRoutes = require('./src/routes/userRoutes');
} catch (e) {
  console.warn('[ROUTES] userRoutes failed to load:', e.message);
}
try {
  captainRoutes = require('./src/routes/captainRoutes');
} catch (e) {
  console.warn('[ROUTES] captainRoutes failed to load:', e.message);
}
try {
  rideRoutes = require('./src/routes/rideRoutes');
} catch (e) {
  console.warn('[ROUTES] rideRoutes failed to load:', e.message);
}
try {
  paymentRoutes = require('./src/routes/paymentRoutes');
} catch (e) {
  console.warn('[ROUTES] paymentRoutes failed to load:', e.message);
}
try {
  walletRoutes = require('./src/routes/walletRoutes');
} catch (e) {
  console.warn('[ROUTES] walletRoutes failed to load:', e.message);
}
try {
  locationRoutes = require('./src/routes/locationRoutes');
} catch (e) {
  console.warn('[ROUTES] locationRoutes failed to load:', e.message);
}
try {
  couponRoutes = require('./src/routes/couponRoutes');
} catch (e) {
  console.warn('[ROUTES] couponRoutes failed to load:', e.message);
}
try {
  notificationRoutes = require('./src/routes/notificationRoutes');
} catch (e) {
  console.warn('[ROUTES] notificationRoutes failed to load:', e.message);
}
try {
  adminRoutes = require('./src/routes/adminRoutes');
} catch (e) {
  console.warn('[ROUTES] adminRoutes failed to load:', e.message);
}
try {
  webhookRoutes = require('./src/routes/webhookRoutes');
} catch (e) {
  console.warn('[ROUTES] webhookRoutes failed to load:', e.message);
}

// Initialize express app
const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Set security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://maps.googleapis.com"],
    },
  },
}));

// Enable CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // In development, allow all origins from app.github.dev and localhost
    if (process.env.NODE_ENV === 'development') {
      if (origin.includes('app.github.dev') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }

    // Production: strict origin checking
    const allowedOrigins = [
      process.env.CLIENT_URL,
      process.env.CAPTAIN_APP_URL,
      process.env.ADMIN_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002'
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-CSRF-Token'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Total-Pages'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// ============================================
// RATE LIMITING
// ============================================

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for webhooks
    return req.path.startsWith('/api/v1/webhooks');
  }
});

// Strict rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts per hour
  message: {
    success: false,
    message: 'Too many login attempts, please try again after an hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// OTP rate limiter
const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 OTP requests per minute
  message: {
    success: false,
    message: 'Too many OTP requests, please try again after a minute'
  }
});

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/send-otp', otpLimiter);
app.use('/api/v1/auth/resend-otp', otpLimiter);

// ============================================
// BODY PARSING & DATA SANITIZATION
// ============================================

// Webhook routes need raw body for signature verification
app.use('/api/v1/webhooks', express.raw({ type: 'application/json' }));

// Body parser - reading data from body into req.body
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Cookie parser
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
  whitelist: [
    'status',
    'type',
    'vehicleType',
    'rating',
    'price',
    'distance',
    'duration',
    'sort',
    'page',
    'limit'
  ]
}));

// ============================================
// COMPRESSION & LOGGING
// ============================================

// Compress all responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6
}));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Custom morgan token for user ID
  morgan.token('user-id', (req) => {
    return req.user ? req.user._id : 'anonymous';
  });
  
  morgan.token('body', (req) => {
    // Don't log sensitive data
    const sensitiveFields = ['password', 'otp', 'token', 'cardNumber'];
    const body = { ...req.body };
    sensitiveFields.forEach(field => {
      if (body[field]) body[field] = '[REDACTED]';
    });
    return JSON.stringify(body);
  });

  app.use(morgan(
    ':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms',
    {
      stream: {
        write: (message) => logger.http(message.trim())
      },
      skip: (req) => {
        // Skip logging for health checks
        return req.url === '/health' || req.url === '/api/health';
      }
    }
  ));
}

// ============================================
// STATIC FILES
// ============================================

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// ============================================
// HEALTH CHECK & INFO ROUTES
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Rapido Clone API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      captains: '/api/v1/captains',
      rides: '/api/v1/rides',
      payments: '/api/v1/payments',
      wallet: '/api/v1/wallet',
      locations: '/api/v1/locations',
      coupons: '/api/v1/coupons',
      notifications: '/api/v1/notifications',
      admin: '/api/v1/admin'
    }
  });
});

// Detailed health check (protected - for monitoring systems)
app.get('/api/health/detailed', async (req, res) => {
  const mongoose = require('mongoose');
  const redis = require('./config/redis');
  
  const healthCheck = {
    success: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    memory: process.memoryUsage(),
    services: {
      database: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        name: mongoose.connection.name
      },
      redis: {
        status: 'checking'
      }
    }
  };

  try {
    const redisClient = await redis.getClient();
    await redisClient.ping();
    healthCheck.services.redis.status = 'connected';
  } catch (error) {
    healthCheck.services.redis.status = 'disconnected';
    healthCheck.services.redis.error = error.message;
  }

  const allServicesHealthy = 
    healthCheck.services.database.status === 'connected' &&
    healthCheck.services.redis.status === 'connected';

  res.status(allServicesHealthy ? 200 : 503).json(healthCheck);
});

// ============================================
// API ROUTES
// ============================================

const API_PREFIX = '/api/v1';

// Mount routes - conditionally mounted if loaded successfully
if (authRoutes) app.use(`${API_PREFIX}/auth`, authRoutes);
if (userRoutes) app.use(`${API_PREFIX}/users`, userRoutes);
if (captainRoutes) app.use(`${API_PREFIX}/captains`, captainRoutes);
if (rideRoutes) app.use(`${API_PREFIX}/rides`, rideRoutes);
if (paymentRoutes) app.use(`${API_PREFIX}/payments`, paymentRoutes);
if (walletRoutes) app.use(`${API_PREFIX}/wallet`, walletRoutes);
if (locationRoutes) app.use(`${API_PREFIX}/locations`, locationRoutes);
if (couponRoutes) app.use(`${API_PREFIX}/coupons`, couponRoutes);
if (notificationRoutes) app.use(`${API_PREFIX}/notifications`, notificationRoutes);
if (adminRoutes) app.use(`${API_PREFIX}/admin`, adminRoutes);
if (webhookRoutes) app.use(`${API_PREFIX}/webhooks`, webhookRoutes);

// ============================================
// API DOCUMENTATION (Swagger)
// ============================================

if (process.env.NODE_ENV !== 'production') {
  const swaggerUi = require('swagger-ui-express');
  const swaggerDocument = require('./src/docs/swagger.json');
  
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Rapido Clone API Docs'
  }));
}

// ============================================
// ERROR HANDLING
// ============================================

// Handle 404 - Route not found
app.use(notFound);

// Global error handler
app.use(errorHandler);

// ============================================
// GRACEFUL SHUTDOWN HANDLING
// ============================================

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  logger.error(err.stack);
  
  // Close server & exit process
  if (process.env.NODE_ENV === 'production') {
    // Give time for logging before exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  logger.error(err.stack);
  
  // Exit process
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  
  // Close server
  if (global.server) {
    global.server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });
  }
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  
  if (global.server) {
    global.server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });
  }
});

module.exports = app;