// src/validators/authValidator.js
const { body, validationResult } = require('express-validator');

/**
 * User registration validation
 */
const validateUserRegister = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

/**
 * User login validation
 */
const validateUserLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

/**
 * Captain registration validation
 */
const validateCaptainRegister = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('vehicleNumber').trim().notEmpty().withMessage('Vehicle number is required'),
];

/**
 * Captain login validation
 */
const validateCaptainLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

/**
 * OTP validation
 */
const validateOTP = [
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
];

/**
 * Forgot password validation
 */
const validateForgotPassword = [
  body('email').isEmail().withMessage('Valid email is required'),
];

/**
 * Reset password validation
 */
const validateResetPassword = [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
];

/**
 * Change password validation
 */
const validateChangePassword = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
];

module.exports = {
  validateUserRegister,
  validateUserLogin,
  validateCaptainRegister,
  validateCaptainLogin,
  validateOTP,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
};
