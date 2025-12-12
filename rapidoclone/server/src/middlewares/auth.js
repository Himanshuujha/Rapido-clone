// src/middlewares/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Captain = require('../models/Captain');
const Admin = require('../models/Admin'); // Separate Admin model
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

// ============================================
// TOKEN UTILITIES
// ============================================

/**
 * Extract token from request (multiple sources)
 * @param {Object} req - Express request object
 * @returns {string|null} - Extracted token or null
 */
const extractToken = (req) => {
  // Priority: Authorization header > Cookie > Query param
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.substring(7);
  }

  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  // Query param only for WebSocket connections (check upgrade header)
  if (req.query?.token && req.headers.upgrade === 'websocket') {
    return req.query.token;
  }

  return null;
};

/**
 * Verify JWT token with detailed error handling
 * @param {string} token - JWT token
 * @param {string} secret - JWT secret (defaults to JWT_SECRET)
 * @returns {Object} - Decoded token payload
 */
const verifyToken = (token, secret = process.env.JWT_SECRET) => {
  try {
    return jwt.verify(token, secret, {
      algorithms: ['HS256'], // Restrict to specific algorithm
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Token expired. Please login again', 'TOKEN_EXPIRED');
    }
    if (error.name === 'JsonWebTokenError') {
      throw ApiError.unauthorized('Invalid token', 'INVALID_TOKEN');
    }
    if (error.name === 'NotBeforeError') {
      throw ApiError.unauthorized('Token not yet active', 'TOKEN_NOT_ACTIVE');
    }
    throw ApiError.unauthorized('Token verification failed', 'TOKEN_ERROR');
  }
};

/**
 * Check if token is blacklisted (logged out tokens)
 * @param {string} token - JWT token
 * @returns {Promise<boolean>}
 */
const isTokenBlacklisted = async (token) => {
  try {
    const blacklisted = await cache.get(`blacklist:${token}`);
    return !!blacklisted;
  } catch (error) {
    logger.error('Redis blacklist check error:', error);
    // Fail open or closed based on security requirements
    return false; // Fail open - allow if Redis is down
  }
};

/**
 * Blacklist a token (for logout)
 * @param {string} token - JWT token
 * @param {number} expiresIn - TTL in seconds
 */
const blacklistToken = async (token, expiresIn = 86400) => {
  try {
    await cache.set(`blacklist:${token}`, '1', expiresIn);
  } catch (error) {
    logger.error('Redis blacklist set error:', error);
  }
};

/**
 * Validate password change timestamp
 * @param {Object} entity - User/Captain/Admin entity
 * @param {number} tokenIssuedAt - Token iat timestamp
 * @returns {boolean}
 */
const isPasswordChangedAfterToken = (entity, tokenIssuedAt) => {
  if (!entity.passwordChangedAt) return false;
  const changedTimestamp = Math.floor(entity.passwordChangedAt.getTime() / 1000);
  return tokenIssuedAt < changedTimestamp;
};

// ============================================
// BASE AUTHENTICATION MIDDLEWARE
// ============================================

/**
 * Base authentication middleware factory
 * @param {Object} options - Configuration options
 */
const createAuthMiddleware = (options) => {
  const {
    model,
    entityKey,
    allowedRoles = [],
    checkStatus = false,
    statusField = 'status',
    allowedStatuses = ['approved', 'active'],
  } = options;

  return asyncHandler(async (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
      throw ApiError.unauthorized('Access denied. No token provided', 'NO_TOKEN');
    }

    // Check blacklist
    if (await isTokenBlacklisted(token)) {
      throw ApiError.unauthorized('Token is no longer valid. Please login again', 'TOKEN_REVOKED');
    }

    const decoded = verifyToken(token);

    // Validate role if specified
    if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
      throw ApiError.forbidden('Access denied. Invalid role', 'INVALID_ROLE');
    }

    // Get entity from database
    const entity = await model.findById(decoded.id).select('-password -refreshToken');

    if (!entity) {
      throw ApiError.unauthorized(`${entityKey} not found`, 'ENTITY_NOT_FOUND');
    }

    // Check active status
    if (entity.isActive === false) {
      throw ApiError.forbidden('Your account has been deactivated. Contact support', 'ACCOUNT_DEACTIVATED');
    }

    // Check entity-specific status
    if (checkStatus && entity[statusField]) {
      if (!allowedStatuses.includes(entity[statusField])) {
        const statusMessages = {
          pending: 'Your account is pending approval',
          rejected: 'Your application was rejected. Contact support',
          suspended: 'Your account is suspended. Contact support',
          blocked: 'Your account has been blocked. Contact support',
        };
        throw ApiError.forbidden(
          statusMessages[entity[statusField]] || 'Account status not allowed',
          'INVALID_STATUS'
        );
      }
    }

    // Check password change
    if (isPasswordChangedAfterToken(entity, decoded.iat)) {
      throw ApiError.unauthorized('Password recently changed. Please login again', 'PASSWORD_CHANGED');
    }

    // Attach to request
    req[entityKey] = entity;
    req.token = token;
    req.tokenPayload = decoded;

    next();
  });
};

// ============================================
// USER AUTHENTICATION
// ============================================

/**
 * @desc    Protect routes - User authentication
 * @usage   router.get('/profile', protect, controller.getProfile)
 */
const protect = createAuthMiddleware({
  model: User,
  entityKey: 'user',
  allowedRoles: ['user', ''], // Empty string for legacy tokens without role
});

// ============================================
// CAPTAIN AUTHENTICATION
// ============================================

/**
 * @desc    Protect routes - Captain authentication
 * @usage   router.get('/dashboard', protectCaptain, controller.getDashboard)
 */
const protectCaptain = createAuthMiddleware({
  model: Captain,
  entityKey: 'captain',
  allowedRoles: ['captain'],
  checkStatus: true,
  statusField: 'status',
  allowedStatuses: ['approved'],
});

/**
 * @desc    Captain with pending status allowed (for profile completion)
 */
const protectCaptainPending = createAuthMiddleware({
  model: Captain,
  entityKey: 'captain',
  allowedRoles: ['captain'],
  checkStatus: true,
  statusField: 'status',
  allowedStatuses: ['pending', 'approved'],
});

// ============================================
// ADMIN AUTHENTICATION
// ============================================

/**
 * @desc    Protect routes - Admin authentication
 * @usage   router.get('/admin/dashboard', protectAdmin, controller.getDashboard)
 */
const protectAdmin = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw ApiError.unauthorized('Access denied. No token provided', 'NO_TOKEN');
  }

  if (await isTokenBlacklisted(token)) {
    throw ApiError.unauthorized('Token is no longer valid', 'TOKEN_REVOKED');
  }

  const decoded = verifyToken(token);

  // Check admin roles
  const adminRoles = ['admin', 'superadmin', 'moderator'];
  if (!adminRoles.includes(decoded.role)) {
    throw ApiError.forbidden('Access denied. Admin privileges required', 'NOT_ADMIN');
  }

  // Try Admin model first, then User model (for backward compatibility)
  let admin = null;

  try {
    const AdminModel = require('../models/Admin');
    admin = await AdminModel.findById(decoded.id).select('-password -refreshToken');
  } catch {
    // Admin model doesn't exist, fall back to User
  }

  if (!admin) {
    admin = await User.findById(decoded.id).select('-password -refreshToken');
  }

  if (!admin) {
    throw ApiError.unauthorized('Admin not found', 'ADMIN_NOT_FOUND');
  }

  if (!admin.isActive) {
    throw ApiError.forbidden('Admin account is deactivated', 'ADMIN_DEACTIVATED');
  }

  if (!adminRoles.includes(admin.role)) {
    throw ApiError.forbidden('Access denied. Admin privileges required', 'NOT_ADMIN');
  }

  // Check password change
  if (isPasswordChangedAfterToken(admin, decoded.iat)) {
    throw ApiError.unauthorized('Password recently changed. Please login again', 'PASSWORD_CHANGED');
  }

  req.admin = admin;
  req.token = token;
  req.tokenPayload = decoded;

  next();
});

/**
 * @desc    Protect routes - Super Admin only
 */
const protectSuperAdmin = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw ApiError.unauthorized('Access denied. No token provided', 'NO_TOKEN');
  }

  const decoded = verifyToken(token);

  if (decoded.role !== 'superadmin') {
    throw ApiError.forbidden('Access denied. Super Admin only', 'NOT_SUPERADMIN');
  }

  let admin = null;

  try {
    const AdminModel = require('../models/Admin');
    admin = await AdminModel.findById(decoded.id).select('-password -refreshToken');
  } catch {
    admin = await User.findById(decoded.id).select('-password -refreshToken');
  }

  if (!admin || admin.role !== 'superadmin') {
    throw ApiError.forbidden('Super Admin privileges required', 'NOT_SUPERADMIN');
  }

  if (!admin.isActive) {
    throw ApiError.forbidden('Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

  req.admin = admin;
  req.token = token;
  req.tokenPayload = decoded;

  next();
});

/**
 * @desc    Admin role restriction middleware
 * @usage   router.delete('/user/:id', protectAdmin, adminRole('superadmin', 'admin'), controller.deleteUser)
 */
const adminRole = (...roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      throw ApiError.unauthorized('Admin authentication required');
    }

    if (!roles.includes(req.admin.role)) {
      throw ApiError.forbidden(`Access denied. Required roles: ${roles.join(', ')}`);
    }

    next();
  };
};

// ============================================
// MULTI-TYPE AUTHENTICATION
// ============================================

/**
 * @desc    Protect routes - Both User and Captain
 * @usage   router.get('/notifications', protectBoth, controller.getNotifications)
 */
const protectBoth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw ApiError.unauthorized('Access denied. No token provided', 'NO_TOKEN');
  }

  if (await isTokenBlacklisted(token)) {
    throw ApiError.unauthorized('Token is no longer valid', 'TOKEN_REVOKED');
  }

  const decoded = verifyToken(token);

  let entity = null;
  let entityType = null;

  // Determine entity type from token role
  if (decoded.role === 'captain') {
    entity = await Captain.findById(decoded.id).select('-password -refreshToken');
    entityType = 'captain';
  } else {
    entity = await User.findById(decoded.id).select('-password -refreshToken');
    entityType = 'user';
  }

  if (!entity) {
    throw ApiError.unauthorized('Account not found', 'ENTITY_NOT_FOUND');
  }

  if (!entity.isActive) {
    throw ApiError.forbidden('Your account has been deactivated', 'ACCOUNT_DEACTIVATED');
  }

  // Captain-specific status check
  if (entityType === 'captain' && entity.status !== 'approved') {
    throw ApiError.forbidden('Your account is not approved', 'NOT_APPROVED');
  }

  // Check password change
  if (isPasswordChangedAfterToken(entity, decoded.iat)) {
    throw ApiError.unauthorized('Password recently changed. Please login again', 'PASSWORD_CHANGED');
  }

  // Attach to request
  req[entityType] = entity;
  req.token = token;
  req.tokenPayload = decoded;
  req.userType = entityType;
  req.currentUser = entity; // Generic reference

  next();
});

/**
 * @desc    Protect all entity types (User, Captain, Admin)
 */
const protectAll = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw ApiError.unauthorized('Access denied. No token provided', 'NO_TOKEN');
  }

  if (await isTokenBlacklisted(token)) {
    throw ApiError.unauthorized('Token is no longer valid', 'TOKEN_REVOKED');
  }

  const decoded = verifyToken(token);

  let entity = null;
  let entityType = null;

  // Determine entity type
  switch (decoded.role) {
    case 'captain':
      entity = await Captain.findById(decoded.id).select('-password -refreshToken');
      entityType = 'captain';
      break;

    case 'admin':
    case 'superadmin':
    case 'moderator':
      try {
        const AdminModel = require('../models/Admin');
        entity = await AdminModel.findById(decoded.id).select('-password -refreshToken');
      } catch {
        entity = await User.findById(decoded.id).select('-password -refreshToken');
      }
      entityType = 'admin';
      break;

    default:
      entity = await User.findById(decoded.id).select('-password -refreshToken');
      entityType = 'user';
  }

  if (!entity) {
    throw ApiError.unauthorized('Account not found', 'ENTITY_NOT_FOUND');
  }

  if (!entity.isActive) {
    throw ApiError.forbidden('Account has been deactivated', 'ACCOUNT_DEACTIVATED');
  }

  req[entityType] = entity;
  req.token = token;
  req.tokenPayload = decoded;
  req.userType = entityType;
  req.currentUser = entity;

  next();
});

// ============================================
// OPTIONAL & CONDITIONAL AUTHENTICATION
// ============================================

/**
 * @desc    Optional authentication - Doesn't fail if no token
 * @usage   router.get('/public', optionalAuth, controller.getPublicData)
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    if (await isTokenBlacklisted(token)) {
      return next();
    }

    const decoded = verifyToken(token);
    let entity = null;
    let entityType = null;

    if (decoded.role === 'captain') {
      entity = await Captain.findById(decoded.id).select('-password -refreshToken');
      entityType = 'captain';
    } else {
      entity = await User.findById(decoded.id).select('-password -refreshToken');
      entityType = 'user';
    }

    if (entity?.isActive) {
      req[entityType] = entity;
      req.token = token;
      req.tokenPayload = decoded;
      req.userType = entityType;
      req.currentUser = entity;
      req.isAuthenticated = true;
    }
  } catch (error) {
    // Silently ignore errors for optional auth
    logger.debug('Optional auth failed:', error.message);
  }

  next();
});

/**
 * @desc    Conditional authentication based on route/method
 */
const conditionalAuth = (condition) => {
  return asyncHandler(async (req, res, next) => {
    const shouldAuthenticate = typeof condition === 'function' ? condition(req) : condition;

    if (shouldAuthenticate) {
      return protectBoth(req, res, next);
    }

    next();
  });
};

// ============================================
// ROLE & PERMISSION MIDDLEWARE
// ============================================

/**
 * @desc    Restrict to specific roles
 * @usage   router.delete('/user/:id', protect, restrictTo('admin', 'superadmin'), controller.deleteUser)
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    const entity = req.user || req.captain || req.admin;

    if (!entity) {
      throw ApiError.unauthorized('Authentication required');
    }

    const userRole = entity.role || 'user';

    if (!roles.includes(userRole)) {
      throw ApiError.forbidden(
        'You do not have permission to perform this action',
        'INSUFFICIENT_PERMISSIONS'
      );
    }

    next();
  };
};

/**
 * @desc    Check specific permissions
 * @usage   router.post('/settings', protect, hasPermission('manage_settings'), controller.updateSettings)
 */
const hasPermission = (...permissions) => {
  return (req, res, next) => {
    const entity = req.admin || req.user;

    if (!entity) {
      throw ApiError.unauthorized('Authentication required');
    }

    const userPermissions = entity.permissions || [];

    // Superadmin has all permissions
    if (entity.role === 'superadmin') {
      return next();
    }

    const hasRequiredPermission = permissions.some((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasRequiredPermission) {
      throw ApiError.forbidden(
        `Required permission: ${permissions.join(' or ')}`,
        'MISSING_PERMISSION'
      );
    }

    next();
  };
};

// ============================================
// STATUS & VERIFICATION MIDDLEWARE
// ============================================

/**
 * @desc    Check if user is verified
 * @usage   router.post('/ride', protect, isVerified, controller.createRide)
 */
const isVerified = asyncHandler(async (req, res, next) => {
  const entity = req.user || req.captain;

  if (!entity) {
    throw ApiError.unauthorized('Authentication required');
  }

  // Check email verification
  if (!entity.isEmailVerified && !entity.isPhoneVerified) {
    throw ApiError.forbidden(
      'Please verify your email or phone number to continue',
      'NOT_VERIFIED'
    );
  }

  next();
});

/**
 * @desc    Check if email is verified specifically
 */
const isEmailVerified = asyncHandler(async (req, res, next) => {
  const entity = req.user || req.captain;

  if (!entity) {
    throw ApiError.unauthorized('Authentication required');
  }

  if (!entity.isEmailVerified) {
    throw ApiError.forbidden('Please verify your email to continue', 'EMAIL_NOT_VERIFIED');
  }

  next();
});

/**
 * @desc    Check if phone is verified specifically
 */
const isPhoneVerified = asyncHandler(async (req, res, next) => {
  const entity = req.user || req.captain;

  if (!entity) {
    throw ApiError.unauthorized('Authentication required');
  }

  if (!entity.isPhoneVerified) {
    throw ApiError.forbidden('Please verify your phone number to continue', 'PHONE_NOT_VERIFIED');
  }

  next();
});

/**
 * @desc    Check if captain is approved and online
 * @usage   router.post('/ride/accept', protectCaptain, isCaptainReady, controller.acceptRide)
 */
const isCaptainReady = asyncHandler(async (req, res, next) => {
  const { captain } = req;

  if (!captain) {
    throw ApiError.unauthorized('Captain authentication required');
  }

  if (captain.status !== 'approved') {
    throw ApiError.forbidden('Your account is not approved yet', 'NOT_APPROVED');
  }

  if (!captain.isOnline) {
    throw ApiError.badRequest('You must be online to perform this action', 'CAPTAIN_OFFLINE');
  }

  if (!captain.isAvailable) {
    throw ApiError.badRequest('You are currently on another ride', 'CAPTAIN_BUSY');
  }

  // Check document expiry
  if (captain.documents?.drivingLicense?.expiryDate) {
    if (new Date(captain.documents.drivingLicense.expiryDate) < new Date()) {
      throw ApiError.forbidden('Your driving license has expired', 'LICENSE_EXPIRED');
    }
  }

  next();
});

/**
 * @desc    Check if captain has completed profile
 */
const isCaptainProfileComplete = asyncHandler(async (req, res, next) => {
  const { captain } = req;

  if (!captain) {
    throw ApiError.unauthorized('Captain authentication required');
  }

  const requiredFields = [
    'firstName',
    'lastName',
    'phone',
    'vehicle.type',
    'vehicle.plateNumber',
    'documents.drivingLicense',
  ];

  const missingFields = requiredFields.filter((field) => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], captain);
    return !value;
  });

  if (missingFields.length > 0) {
    throw ApiError.badRequest(
      `Please complete your profile. Missing: ${missingFields.join(', ')}`,
      'INCOMPLETE_PROFILE'
    );
  }

  next();
});

// ============================================
// TOKEN REFRESH MIDDLEWARE
// ============================================

/**
 * @desc    Refresh token middleware
 * @usage   router.post('/auth/refresh', refreshTokenMiddleware, controller.refreshToken)
 */
const refreshTokenMiddleware = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!refreshToken) {
    throw ApiError.unauthorized('Refresh token not provided', 'NO_REFRESH_TOKEN');
  }

  // Check if refresh token is blacklisted
  if (await isTokenBlacklisted(refreshToken)) {
    throw ApiError.unauthorized('Refresh token is revoked', 'REFRESH_TOKEN_REVOKED');
  }

  try {
    const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);

    let entity = null;
    let entityType = null;

    // Find entity based on role
    if (decoded.role === 'captain') {
      entity = await Captain.findOne({
        _id: decoded.id,
        refreshToken,
      }).select('-password');
      entityType = 'captain';
    } else if (['admin', 'superadmin', 'moderator'].includes(decoded.role)) {
      try {
        const AdminModel = require('../models/Admin');
        entity = await AdminModel.findOne({
          _id: decoded.id,
          refreshToken,
        }).select('-password');
      } catch {
        entity = await User.findOne({
          _id: decoded.id,
          refreshToken,
        }).select('-password');
      }
      entityType = 'admin';
    } else {
      entity = await User.findOne({
        _id: decoded.id,
        refreshToken,
      }).select('-password');
      entityType = 'user';
    }

    if (!entity) {
      throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    if (!entity.isActive) {
      throw ApiError.forbidden('Account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    req.entity = entity;
    req.entityType = entityType;
    req.refreshToken = refreshToken;
    req.tokenPayload = decoded;

    next();
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Refresh token expired. Please login again', 'REFRESH_TOKEN_EXPIRED');
    }
    throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }
});

// ============================================
// EXTERNAL API AUTHENTICATION
// ============================================

/**
 * @desc    API Key authentication for external services
 * @usage   router.post('/webhook', apiKeyAuth, controller.handleWebhook)
 */
const apiKeyAuth = asyncHandler(async (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('ApiKey ', '');

  if (!apiKey) {
    throw ApiError.unauthorized('API key required', 'NO_API_KEY');
  }

  // Get valid API keys from environment or database
  const validApiKeys = process.env.VALID_API_KEYS?.split(',').map((k) => k.trim()) || [];

  // You can also check against database
  // const apiKeyRecord = await ApiKey.findOne({ key: apiKey, isActive: true });

  if (!validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key attempt:', { apiKey: apiKey.substring(0, 8) + '...' });
    throw ApiError.unauthorized('Invalid API key', 'INVALID_API_KEY');
  }

  // Optionally attach API key info to request
  req.apiKey = apiKey;
  req.isApiKeyAuth = true;

  next();
});

/**
 * @desc    Webhook signature verification
 * @param   {string} provider - Webhook provider (stripe, razorpay, etc.)
 */
const verifyWebhookSignature = (provider) => {
  return asyncHandler(async (req, res, next) => {
    const signature = req.headers['x-webhook-signature'] || req.headers[`x-${provider}-signature`];

    if (!signature) {
      throw ApiError.unauthorized('Webhook signature missing', 'NO_SIGNATURE');
    }

    const secret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`];

    if (!secret) {
      logger.error(`Webhook secret not configured for ${provider}`);
      throw ApiError.internal('Webhook configuration error');
    }

    // Verify signature (implementation depends on provider)
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature && signature !== `sha256=${expectedSignature}`) {
      throw ApiError.unauthorized('Invalid webhook signature', 'INVALID_SIGNATURE');
    }

    req.webhookProvider = provider;
    req.webhookVerified = true;

    next();
  });
};

// ============================================
// RESOURCE OWNERSHIP & ACCESS CONTROL
// ============================================

/**
 * @desc    Check ownership of resource
 * @param   {String} modelName - Model name
 * @param   {String} paramName - Request param name for ID
 * @param   {Object} options - Additional options
 */
const checkOwnership = (modelName, paramName = 'id', options = {}) => {
  const {
    ownerField = null, // Auto-detect if null
    allowAdmin = true,
    populate = null,
  } = options;

  return asyncHandler(async (req, res, next) => {
    const Model = require(`../models/${modelName}`);
    const resourceId = req.params[paramName];
    const userId = req.user?._id || req.captain?._id;
    const isAdmin = !!req.admin;

    if (!resourceId) {
      throw ApiError.badRequest('Resource ID is required');
    }

    let query = Model.findById(resourceId);

    if (populate) {
      query = query.populate(populate);
    }

    const resource = await query;

    if (!resource) {
      throw ApiError.notFound(`${modelName} not found`);
    }

    // Admin bypass
    if (allowAdmin && isAdmin) {
      req.resource = resource;
      return next();
    }

    // Determine owner field
    const possibleOwnerFields = ownerField
      ? [ownerField]
      : ['user', 'captain', 'owner', 'createdBy', 'userId', 'captainId'];

    let ownerId = null;

    for (const field of possibleOwnerFields) {
      if (resource[field]) {
        ownerId = resource[field]._id || resource[field];
        break;
      }
    }

    if (!ownerId) {
      throw ApiError.forbidden('Unable to verify ownership');
    }

    if (ownerId.toString() !== userId?.toString()) {
      throw ApiError.forbidden('You do not have permission to access this resource', 'NOT_OWNER');
    }

    req.resource = resource;
    next();
  });
};

/**
 * @desc    Check if user can access resource (ownership or shared access)
 */
const canAccess = (modelName, paramName = 'id') => {
  return asyncHandler(async (req, res, next) => {
    const Model = require(`../models/${modelName}`);
    const resourceId = req.params[paramName];
    const userId = req.user?._id || req.captain?._id;

    const resource = await Model.findById(resourceId);

    if (!resource) {
      throw ApiError.notFound(`${modelName} not found`);
    }

    // Check ownership
    const ownerId = resource.user || resource.captain || resource.owner;
    const isOwner = ownerId?.toString() === userId?.toString();

    // Check shared access
    const sharedWith = resource.sharedWith || [];
    const isShared = sharedWith.some((id) => id.toString() === userId?.toString());

    // Check if public
    const isPublic = resource.isPublic || resource.visibility === 'public';

    if (!isOwner && !isShared && !isPublic) {
      throw ApiError.forbidden('You do not have access to this resource');
    }

    req.resource = resource;
    req.isOwner = isOwner;
    req.accessType = isOwner ? 'owner' : isShared ? 'shared' : 'public';

    next();
  });
};

// ============================================
// RATE LIMITING BY USER
// ============================================

/**
 * @desc    User-specific rate limiting
 * @param   {number} maxRequests - Max requests per window
 * @param   {number} windowMs - Time window in milliseconds
 */
const userRateLimit = (maxRequests = 100, windowMs = 60000) => {
  return asyncHandler(async (req, res, next) => {
    const userId = req.user?._id || req.captain?._id || req.ip;
    const key = `ratelimit:${userId}`;

    try {
      const current = await cache.incr(key);

      if (current === 1) {
        await cache.expire(key, Math.ceil(windowMs / 1000));
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));

      if (current > maxRequests) {
        throw ApiError.tooManyRequests('Rate limit exceeded. Please try again later.');
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      // If Redis fails, allow the request
      logger.error('Rate limit check failed:', error);
    }

    next();
  });
};

// ============================================
// SOCKET AUTHENTICATION
// ============================================

/**
 * @desc    Socket.io authentication middleware
 * @usage   io.use(socketAuth)
 */
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    if (await isTokenBlacklisted(token)) {
      return next(new Error('Token is no longer valid'));
    }

    const decoded = verifyToken(token);

    let entity = null;
    let entityType = null;

    if (decoded.role === 'captain') {
      entity = await Captain.findById(decoded.id).select('-password -refreshToken');
      entityType = 'captain';
    } else {
      entity = await User.findById(decoded.id).select('-password -refreshToken');
      entityType = 'user';
    }

    if (!entity || !entity.isActive) {
      return next(new Error('User not found or inactive'));
    }

    // Attach to socket
    socket.user = entity;
    socket.userType = entityType;
    socket.userId = entity._id.toString();
    socket.token = token;

    next();
  } catch (error) {
    logger.error('Socket auth error:', error);
    next(new Error(error.message || 'Authentication failed'));
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Token utilities
  extractToken,
  verifyToken,
  isTokenBlacklisted,
  blacklistToken,

  // User authentication
  protect,

  // Captain authentication
  protectCaptain,
  protectCaptainPending,

  // Admin authentication
  protectAdmin,
  protectSuperAdmin,
  adminRole,

  // Multi-type authentication
  protectBoth,
  protectAll,

  // Optional/Conditional
  optionalAuth,
  conditionalAuth,

  // Role & Permission
  restrictTo,
  hasPermission,

  // Status & Verification
  isVerified,
  isEmailVerified,
  isPhoneVerified,
  isCaptainReady,
  isCaptainProfileComplete,

  // Token refresh
  refreshTokenMiddleware,

  // External API
  apiKeyAuth,
  verifyWebhookSignature,

  // Resource access
  checkOwnership,
  canAccess,

  // Rate limiting
  userRateLimit,

  // Socket
  socketAuth,
};