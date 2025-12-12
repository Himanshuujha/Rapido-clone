// src/utils/apiError.js

/**
 * Custom API Error class for standardized error responses
 */
class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.data = null;

    Error.captureStackTrace(this, this.constructor);
  }

  // Static methods for common HTTP errors
  static badRequest(message, errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message, errors = []) {
    return new ApiError(401, message, errors);
  }

  static forbidden(message, errors = []) {
    return new ApiError(403, message, errors);
  }

  static notFound(message, errors = []) {
    return new ApiError(404, message, errors);
  }

  static conflict(message, errors = []) {
    return new ApiError(409, message, errors);
  }

  static unprocessableEntity(message, errors = []) {
    return new ApiError(422, message, errors);
  }

  static tooManyRequests(message, errors = []) {
    return new ApiError(429, message, errors);
  }

  static internalServerError(message, errors = []) {
    return new ApiError(500, message, errors);
  }

  // Backwards-compatible alias expected by error handler
  static internal(message, errors = []) {
    return ApiError.internalServerError(message, errors);
  }

  static serviceUnavailable(message, errors = []) {
    return new ApiError(503, message, errors);
  }
}

module.exports = ApiError;
