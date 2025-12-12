// src/middlewares/validate.js
const { validationResult, matchedData } = require('express-validator');
const ApiError = require('../utils/apiError');

/**
 * @desc    Validation middleware wrapper
 * @param   {Array} validations - Array of express-validator checks
 * @usage   router.post('/register', validate(registerValidation), controller.register)
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations in parallel
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);

    if (errors.isEmpty()) {
      // Attach only validated data to request
      req.validatedData = matchedData(req);
      return next();
    }

    // Format errors
    const extractedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
      location: err.location,
    }));

    // Group errors by field
    const groupedErrors = extractedErrors.reduce((acc, error) => {
      if (!acc[error.field]) {
        acc[error.field] = [];
      }
      acc[error.field].push(error.message);
      return acc;
    }, {});

    return next(
      ApiError.badRequest('Validation failed', extractedErrors)
    );
  };
};

/**
 * @desc    Sanitize request body
 * @usage   router.post('/update', sanitizeBody, validate(updateValidation), controller.update)
 */
const sanitizeBody = (req, res, next) => {
  if (req.body) {
    // Remove any fields that start with $ (MongoDB operators)
    const sanitize = (obj) => {
      for (const key in obj) {
        if (key.startsWith('$')) {
          delete obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    };
    sanitize(req.body);
  }
  next();
};

/**
 * @desc    Validate MongoDB ObjectId
 * @param   {String} paramName - Parameter name to validate
 * @usage   router.get('/:id', validateObjectId('id'), controller.getById)
 */
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;

    if (!id || !objectIdRegex.test(id)) {
      return next(ApiError.badRequest(`Invalid ${paramName} format`));
    }

    next();
  };
};

/**
 * @desc    Validate request content type
 * @param   {Array} allowedTypes - Allowed content types
 * @usage   router.post('/upload', validateContentType(['multipart/form-data']), controller.upload)
 */
const validateContentType = (allowedTypes = ['application/json']) => {
  return (req, res, next) => {
    const contentType = req.headers['content-type'];

    if (!contentType) {
      return next(ApiError.badRequest('Content-Type header is required'));
    }

    const isAllowed = allowedTypes.some((type) =>
      contentType.toLowerCase().includes(type.toLowerCase())
    );

    if (!isAllowed) {
      return next(
        ApiError.badRequest(
          `Invalid Content-Type. Allowed: ${allowedTypes.join(', ')}`
        )
      );
    }

    next();
  };
};

/**
 * @desc    Validate query parameters
 * @param   {Object} schema - Schema for query validation
 * @usage   router.get('/list', validateQuery({ page: 'number', limit: 'number' }), controller.list)
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const errors = [];

    for (const [key, type] of Object.entries(schema)) {
      const value = req.query[key];

      if (value !== undefined) {
        switch (type) {
          case 'number':
            if (isNaN(Number(value))) {
              errors.push({ field: key, message: `${key} must be a number` });
            }
            break;
          case 'boolean':
            if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
              errors.push({ field: key, message: `${key} must be a boolean` });
            }
            break;
          case 'date':
            if (isNaN(Date.parse(value))) {
              errors.push({ field: key, message: `${key} must be a valid date` });
            }
            break;
          case 'array':
            if (!Array.isArray(value) && typeof value !== 'string') {
              errors.push({ field: key, message: `${key} must be an array` });
            }
            break;
        }
      }
    }

    if (errors.length > 0) {
      return next(ApiError.badRequest('Invalid query parameters', errors));
    }

    next();
  };
};

/**
 * @desc    Transform query parameters
 * @usage   router.get('/list', transformQuery, controller.list)
 */
const transformQuery = (req, res, next) => {
  // Parse page and limit
  if (req.query.page) {
    req.query.page = Math.max(1, parseInt(req.query.page) || 1);
  }
  if (req.query.limit) {
    req.query.limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  }

  // Parse sort
  if (req.query.sort) {
    const sortFields = req.query.sort.split(',');
    req.query.sortBy = sortFields.reduce((acc, field) => {
      if (field.startsWith('-')) {
        acc[field.substring(1)] = -1;
      } else {
        acc[field] = 1;
      }
      return acc;
    }, {});
  }

  // Parse boolean fields
  ['isActive', 'isVerified', 'isOnline', 'isAvailable'].forEach((field) => {
    if (req.query[field] !== undefined) {
      req.query[field] = req.query[field] === 'true' || req.query[field] === '1';
    }
  });

  // Parse date range
  if (req.query.startDate) {
    req.query.startDate = new Date(req.query.startDate);
  }
  if (req.query.endDate) {
    req.query.endDate = new Date(req.query.endDate);
  }

  next();
};

module.exports = {
  validate,
  sanitizeBody,
  validateObjectId,
  validateContentType,
  validateQuery,
  transformQuery,
};