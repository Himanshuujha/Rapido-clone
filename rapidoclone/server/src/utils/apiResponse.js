// src/utils/apiResponse.js

/**
 * Standard API response format
 */
class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }

  /**
   * Success response (200)
   */
  static ok(data, message = 'Success') {
    return new ApiResponse(200, data, message);
  }

  /**
   * Created response (201)
   */
  static created(data, message = 'Resource created successfully') {
    return new ApiResponse(201, data, message);
  }

  /**
   * No content response (204)
   */
  static noContent() {
    return new ApiResponse(204, null, 'No content');
  }

  /**
   * Custom response
   */
  static custom(statusCode, data, message = 'Success') {
    return new ApiResponse(statusCode, data, message);
  }
}

module.exports = ApiResponse;
