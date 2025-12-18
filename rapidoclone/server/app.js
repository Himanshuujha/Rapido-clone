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
const { errorHandler, notFound } = require('./src/middlewares/errorHandler');
const logger = require('./src/utils/logger');

// Initialize express app
const app = express();

// ============================================
// TRUST PROXY (for Codespaces/reverse proxies)
// ============================================
app.set('trust proxy', 1);

// ============================================
// CORS CONFIGURATION
// ============================================
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Allowed origins
    const allowedPatterns = [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /\.app\.github\.dev$/,
      /\.gitpod\.io$/,
      /\.vercel\.app$/,
      /\.netlify\.app$/,
    ];
    
    const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(null, true); // Allow anyway in development - change for production
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
    'X-CSRF-Token',
    'X-API-Key',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

// ============================================
// BODY PARSING
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================
// DATA SANITIZATION & SECURITY
// ============================================
app.use(mongoSanitize());
app.use(xss());
app.use(hpp({
  whitelist: ['sort', 'fields', 'page', 'limit', 'status'],
}));

// ============================================
// COMPRESSION & LOGGING
// ============================================
app.use(compression());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ============================================
// RATE LIMITING
// ============================================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api';
  },
});

app.use('/api', limiter);

// ============================================
// STATIC FILES
// ============================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ============================================
// HEALTH CHECK ROUTES
// ============================================
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  });
});

app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Rapido Clone API',
    version: '1.0.0',
    documentation: '/api/docs',
  });
});

app.get('/api/v1', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Rapido Clone API v1',
    version: '1.0.0',
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
    },
  });
});

// ============================================
// API ROUTES
// ============================================
const API_PREFIX = '/api/v1';

// Route loader helper with detailed logging
const loadRoute = (name, routePath, mountPath) => {
  try {
    const route = require(routePath);
    app.use(mountPath, route);
    console.log(`✅ [ROUTES] ${name} mounted at ${mountPath}`);
    return true;
  } catch (error) {
    console.error(`❌ [ROUTES] ${name} failed to load:`);
    console.error(`   Path: ${routePath}`);
    console.error(`   Error: ${error.message}`);
    
    // In development, log full stack trace
    if (process.env.NODE_ENV === 'development') {
      console.error(`   Stack: ${error.stack}`);
    }
    return false;
  }
};

// Load all routes
console.log('\n📍 Loading API Routes...\n');

loadRoute('Auth Routes', './src/routes/authRoutes', `${API_PREFIX}/auth`);
loadRoute('User Routes', './src/routes/userRoutes', `${API_PREFIX}/users`);
loadRoute('Captain Routes', './src/routes/captainRoutes', `${API_PREFIX}/captains`);
loadRoute('Ride Routes', './src/routes/rideRoutes', `${API_PREFIX}/rides`);
loadRoute('Payment Routes', './src/routes/paymentRoutes', `${API_PREFIX}/payments`);
loadRoute('Wallet Routes', './src/routes/walletRoutes', `${API_PREFIX}/wallet`);
loadRoute('Location Routes', './src/routes/locationRoutes', `${API_PREFIX}/locations`);
loadRoute('Coupon Routes', './src/routes/couponRoutes', `${API_PREFIX}/coupons`);
loadRoute('Notification Routes', './src/routes/notificationRoutes', `${API_PREFIX}/notifications`);
loadRoute('Admin Routes', './src/routes/adminRoutes', `${API_PREFIX}/admin`);
loadRoute('Webhook Routes', './src/routes/webhookRoutes', `${API_PREFIX}/webhooks`);

console.log('\n📍 Route loading complete.\n');

// ============================================
// DEBUG: List All Registered Routes
// ============================================
if (process.env.NODE_ENV === 'development') {
  const listRoutes = () => {
    console.log('\n🛣️  Registered API Routes:');
    console.log('═'.repeat(50));
    
    const routes = [];
    
    const extractRoutes = (stack, basePath = '') => {
      stack.forEach((layer) => {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods)
            .filter(m => layer.route.methods[m])
            .map(m => m.toUpperCase())
            .join(', ');
          routes.push({
            method: methods,
            path: basePath + layer.route.path,
          });
        } else if (layer.name === 'router' && layer.handle.stack) {
          const routerPath = layer.regexp.source
            .replace('\\/?(?=\\/|$)', '')
            .replace(/\\\//g, '/')
            .replace(/\^/g, '')
            .replace(/\$/g, '')
            .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':param');
          extractRoutes(layer.handle.stack, basePath + routerPath);
        }
      });
    };
    
    extractRoutes(app._router.stack);
    
    // Sort routes by path
    routes.sort((a, b) => a.path.localeCompare(b.path));
    
    // Group by base path
    const grouped = {};
    routes.forEach(r => {
      const base = r.path.split('/').slice(0, 4).join('/');
      if (!grouped[base]) grouped[base] = [];
      grouped[base].push(r);
    });
    
    Object.keys(grouped).forEach(base => {
      console.log(`\n${base}:`);
      grouped[base].forEach(r => {
        console.log(`  ${r.method.padEnd(8)} ${r.path}`);
      });
    });
    
    console.log('\n' + '═'.repeat(50));
    console.log(`Total routes: ${routes.length}\n`);
  };
  
  // Uncomment to see all routes on startup
  // listRoutes();
}

// ============================================
// 404 HANDLER - Must be after all routes
// ============================================
app.use(notFound);

// ============================================
// ERROR HANDLER - Must be last
// ============================================
app.use(errorHandler);

// ============================================
// GRACEFUL SHUTDOWN HANDLING
// ============================================
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  if (global.server) {
    global.server.close(() => {
      console.log('💤 Process terminated.');
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received. Shutting down gracefully...');
  if (global.server) {
    global.server.close(() => {
      console.log('💤 Process terminated.');
      process.exit(0);
    });
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;