// src/middlewares/errorHandler.js
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * Convert various errors to ApiError
 */
const normalizeError = (err) => {
  // Already an ApiError
  if (err instanceof ApiError) {
    return err;
  }

  // Mongoose CastError (Invalid ObjectId)
  if (err.name === 'CastError') {
    return ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    return ApiError.conflict(`${field} '${value}' already exists`);
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
      kind: e.kind,
    }));
    return ApiError.badRequest('Validation failed', errors);
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return ApiError.unauthorized('Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Token expired');
  }

  if (err.name === 'NotBeforeError') {
    return ApiError.unauthorized('Token not active yet');
  }

  // Multer Errors
  if (err.name === 'MulterError') {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return ApiError.badRequest('File too large');
      case 'LIMIT_FILE_COUNT':
        return ApiError.badRequest('Too many files');
      case 'LIMIT_FIELD_KEY':
        return ApiError.badRequest('Field name too long');
      case 'LIMIT_FIELD_VALUE':
        return ApiError.badRequest('Field value too long');
      case 'LIMIT_FIELD_COUNT':
        return ApiError.badRequest('Too many fields');
      case 'LIMIT_UNEXPECTED_FILE':
        return ApiError.badRequest('Unexpected file field');
      default:
        return ApiError.badRequest(err.message);
    }
  }

  // Axios Errors (external API calls)
  if (err.isAxiosError) {
    const status = err.response?.status;
    const message = err.response?.data?.message || 'External service error';

    if (status >= 500) {
      return ApiError.serviceUnavailable('External service unavailable');
    }
    return ApiError.badRequest(message);
  }

  // Stripe Errors
  if (err.type?.startsWith('Stripe')) {
    switch (err.type) {
      case 'StripeCardError':
        return ApiError.badRequest(err.message);
      case 'StripeInvalidRequestError':
        return ApiError.badRequest('Invalid payment request');
      case 'StripeAPIError':
        return ApiError.serviceUnavailable('Payment service error');
      case 'StripeConnectionError':
        return ApiError.serviceUnavailable('Payment service unavailable');
      case 'StripeAuthenticationError':
        return ApiError.internal('Payment configuration error');
      default:
        return ApiError.badRequest(err.message);
    }
  }

  // Razorpay Errors
  if (err.error?.description) {
    return ApiError.badRequest(err.error.description);
  }

  // MongoDB Errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return ApiError.conflict(`${field} already exists`);
    }
    logger.error('MongoDB Error:', err);
    return ApiError.internal('Database error');
  }

  // Syntax Error (Invalid JSON)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return ApiError.badRequest('Invalid JSON in request body');
  }

  // CORS Error
  if (err.message?.includes('CORS')) {
    return ApiError.forbidden('CORS policy violation');
  }

  // Default to internal error
  return ApiError.internal(
    process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  );
};

/**
 * Log error details
 */
const logError = (err, req) => {
  const errorLog = {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?._id || req.captain?._id || req.admin?._id,
    userAgent: req.headers['user-agent'],
    body: process.env.NODE_ENV === 'development' ? req.body : undefined,
    query: req.query,
    params: req.params,
  };

  if (err.statusCode >= 500) {
    logger.error('Server Error:', errorLog);
  } else if (err.statusCode >= 400) {
    logger.warn('Client Error:', errorLog);
  } else {
    logger.info('Error:', errorLog);
  }
};

/**
 * Main error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Normalize error
  const error = normalizeError(err);

  // Log error
  logError(error, req);

  // Send response
  const response = {
    success: false,
    message: error.message,
    ...(error.errors?.length && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      originalError: err.message !== error.message ? err.message : undefined,
    }),
  };

  res.status(error.statusCode || 500).json(response);
};

/**
 * 404 Not Found handler
 */
const notFound = (req, res, next) => {
  const error = ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`);
  next(error);
};

/**
 * Async error wrapper for routes
 */
const asyncErrorHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Unhandled rejection handler
 */
const unhandledRejectionHandler = (server) => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', { reason, promise });

    // Close server and exit
    server.close(() => {
      logger.error('Server closed due to unhandled rejection');
      process.exit(1);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      process.exit(1);
    }, 10000);
  });
};

/**
 * Uncaught exception handler
 */
const uncaughtExceptionHandler = () => {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = (server) => {
  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);

    server.close(() => {
      logger.info('HTTP server closed');

      // Close database connections
      const mongoose = require('mongoose');
      mongoose.connection.close(false, () => {
        logger.info('MongoDB connection closed');
        process.exit(0);
      });
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

module.exports = {
  errorHandler,
  notFound,
  asyncErrorHandler,
  unhandledRejectionHandler,
  uncaughtExceptionHandler,
  gracefulShutdown,
  normalizeError,
};