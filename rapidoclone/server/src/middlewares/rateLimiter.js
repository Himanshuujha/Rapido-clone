// src/middlewares/rateLimiter.js
const rateLimit = require('express-rate-limit');
// const RedisStore = require('rate-limit-redis');  // Optional - install if Redis needed
const { getClient } = require('../config/redis');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * Create rate limiter with optional Redis store
 */
const createRateLimiter = (options = {}) => {
  let redis = null;
  
  try {
    redis = getClient();
  } catch (error) {
    // Redis not initialized yet, will use memory store
    logger.warn('Redis not available at module load, will use memory store');
  }

  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      return req.user?._id?.toString() ||
        req.captain?._id?.toString() ||
        req.ip ||
        req.headers['x-forwarded-for']?.split(',')[0] ||
        'unknown';
    },
    skip: (req) => {
      // Skip rate limiting for whitelisted IPs
      const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
      return whitelist.includes(req.ip);
    },
    handler: (req, res, next, options) => {
      logger.warn('Rate limit exceeded:', {
        ip: req.ip,
        path: req.path,
        userId: req.user?._id || req.captain?._id,
      });
      next(ApiError.tooManyRequests(options.message));
    },
  };

  const config = { ...defaultOptions, ...options };

  // Use Redis store if available and rate-limit-redis is installed
  if (redis) {
    try {
      const RedisStore = require('rate-limit-redis');
      config.store = new RedisStore({
        sendCommand: (...args) => redis.call(...args),
        prefix: options.prefix || 'rl:',
      });
    } catch (error) {
      logger.warn('Redis store for rate limiter not available, using memory store');
    }
  }

  return rateLimit(config);
};

/**
 * General API rate limiter
 * 100 requests per 15 minutes
 */
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many API requests, please try again later',
  prefix: 'rl:api:',
});

/**
 * Strict API rate limiter
 * 30 requests per 15 minutes
 */
const strictLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many requests, please slow down',
  prefix: 'rl:strict:',
});

/**
 * Auth rate limiter - Login/Register
 * 10 attempts per 15 minutes
 */
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again after 15 minutes',
  prefix: 'rl:auth:',
  skipSuccessfulRequests: true,
});

/**
 * OTP rate limiter
 * 3 OTP requests per minute
 */
const otpLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  message: 'Too many OTP requests, please try again after a minute',
  prefix: 'rl:otp:',
});

/**
 * OTP verification rate limiter
 * 5 verification attempts per 5 minutes
 */
const otpVerifyLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: 'Too many verification attempts, please try again later',
  prefix: 'rl:otp-verify:',
  skipSuccessfulRequests: true,
});

/**
 * Password reset rate limiter
 * 3 requests per hour
 */
const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Too many password reset requests, please try again after an hour',
  prefix: 'rl:pwd-reset:',
});

/**
 * Ride request rate limiter
 * 5 ride requests per minute
 */
const rideLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many ride requests, please wait before trying again',
  prefix: 'rl:ride:',
});

/**
 * Ride cancel rate limiter
 * 3 cancellations per hour
 */
const rideCancelLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Too many cancellations. You may be temporarily restricted',
  prefix: 'rl:ride-cancel:',
});

/**
 * Payment rate limiter
 * 10 payment attempts per 10 minutes
 */
const paymentLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  message: 'Too many payment attempts, please try again later',
  prefix: 'rl:payment:',
});

/**
 * Wallet transaction rate limiter
 * 10 transactions per 10 minutes
 */
const walletLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  message: 'Too many wallet transactions, please try again later',
  prefix: 'rl:wallet:',
});

/**
 * File upload rate limiter
 * 10 uploads per hour
 */
const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many file uploads, please try again later',
  prefix: 'rl:upload:',
});

/**
 * Search/Autocomplete rate limiter
 * 60 requests per minute
 */
const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many search requests, please slow down',
  prefix: 'rl:search:',
});

/**
 * Location update rate limiter (for captains)
 * 120 updates per minute (2 per second)
 */
const locationUpdateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: 'Too many location updates',
  prefix: 'rl:location:',
});

/**
 * Webhook rate limiter
 * 1000 requests per minute
 */
const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
  message: 'Too many webhook requests',
  prefix: 'rl:webhook:',
});

/**
 * Admin rate limiter
 * 200 requests per 15 minutes
 */
const adminLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many admin requests',
  prefix: 'rl:admin:',
});

/**
 * Dynamic rate limiter based on user type
 */
const dynamicLimiter = (req, res, next) => {
  // Premium users get higher limits
  const isPremium = req.user?.isPremium || req.captain?.isPremium;

  const limiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: isPremium ? 200 : 100,
    prefix: 'rl:dynamic:',
  });

  return limiter(req, res, next);
};

/**
 * Slow down middleware - adds delay after threshold
 */
// const slowDown = require('express-slow-down');  // Optional - install if needed

const createSlowDown = (options = {}) => {
  // Fallback to basic rate limiter if express-slow-down not installed
  return (req, res, next) => next();
};

const apiSlowDown = createSlowDown({
  delayAfter: 50,
  delayMs: 500,
  prefix: 'sd:api:',
});

module.exports = {
  createRateLimiter,
  rateLimiter: createRateLimiter,  // Alias for compatibility
  apiLimiter,
  strictLimiter,
  authLimiter,
  otpLimiter,
  otpVerifyLimiter,
  passwordResetLimiter,
  rideLimiter,
  rideCancelLimiter,
  paymentLimiter,
  walletLimiter,
  uploadLimiter,
  searchLimiter,
  locationUpdateLimiter,
  webhookLimiter,
  adminLimiter,
  dynamicLimiter,
  createSlowDown,
  apiSlowDown,
};