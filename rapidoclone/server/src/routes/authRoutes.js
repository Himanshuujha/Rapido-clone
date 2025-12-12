// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, protectCaptain } = require('../middlewares/auth');
const { rateLimiter } = require('../middlewares/rateLimiter');
const {
  validateUserRegister,
  validateUserLogin,
  validateCaptainRegister,
  validateCaptainLogin,
  validateOTP,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
} = require('../validators/authValidator');

// ==========================================
// RATE LIMITERS
// ==========================================

const authLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many attempts. Please try again after an hour.',
});

const otpLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  message: 'Too many OTP requests. Please wait a minute.',
});

// ==========================================
// USER AUTHENTICATION
// ==========================================

/**
 * @route   POST /api/v1/auth/user/register
 * @desc    Register a new user
 * @access  Public
 * @body    { firstName, lastName, email, phone, password }
 */
router.post(
  '/user/register',
  authLimiter,
  validateUserRegister,
  authController.registerUser
);

/**
 * @route   POST /api/v1/auth/user/login
 * @desc    Login user with email/phone and password
 * @access  Public
 * @body    { emailOrPhone, password }
 */
router.post(
  '/user/login',
  authLimiter,
  validateUserLogin,
  authController.loginUser
);

/**
 * @route   POST /api/v1/auth/user/login-otp
 * @desc    Request OTP for login
 * @access  Public
 * @body    { phone }
 */
router.post(
  '/user/login-otp',
  authLimiter,
  authController.requestLoginOTP
);

/**
 * @route   POST /api/v1/auth/user/verify-login-otp
 * @desc    Verify OTP and login
 * @access  Public
 * @body    { phone, otp }
 */
router.post(
  '/user/verify-login-otp',
  validateOTP,
  authController.verifyLoginOTP
);

/**
 * @route   POST /api/v1/auth/user/send-otp
 * @desc    Send OTP to phone for verification
 * @access  Public
 * @body    { phone }
 */
router.post(
  '/user/send-otp',
  otpLimiter,
  authController.sendOTP
);

/**
 * @route   POST /api/v1/auth/user/verify-otp
 * @desc    Verify phone OTP
 * @access  Public
 * @body    { phone, otp }
 */
router.post(
  '/user/verify-otp',
  validateOTP,
  authController.verifyOTP
);

/**
 * @route   POST /api/v1/auth/user/resend-otp
 * @desc    Resend OTP
 * @access  Public
 * @body    { phone }
 */
router.post(
  '/user/resend-otp',
  otpLimiter,
  authController.resendOTP
);

/**
 * @route   POST /api/v1/auth/user/forgot-password
 * @desc    Request password reset OTP/link
 * @access  Public
 * @body    { emailOrPhone }
 */
router.post(
  '/user/forgot-password',
  authLimiter,
  validateForgotPassword,
  authController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/user/reset-password
 * @desc    Reset password with OTP/token
 * @access  Public
 * @body    { emailOrPhone, otp, newPassword }
 */
router.post(
  '/user/reset-password',
  validateResetPassword,
  authController.resetPassword
);

/**
 * @route   POST /api/v1/auth/user/change-password
 * @desc    Change password (authenticated user)
 * @access  Private
 * @body    { currentPassword, newPassword }
 */
router.post(
  '/user/change-password',
  protect,
  validateChangePassword,
  authController.changePassword
);

/**
 * @route   POST /api/v1/auth/user/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  '/user/logout',
  protect,
  authController.logoutUser
);

/**
 * @route   GET /api/v1/auth/user/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get(
  '/user/me',
  protect,
  authController.getCurrentUser
);

/**
 * @route   POST /api/v1/auth/user/verify-email
 * @desc    Verify email with token
 * @access  Public
 * @body    { token }
 */
router.post(
  '/user/verify-email',
  authController.verifyEmail
);

/**
 * @route   POST /api/v1/auth/user/resend-verification
 * @desc    Resend email verification
 * @access  Private
 */
router.post(
  '/user/resend-verification',
  protect,
  authController.resendEmailVerification
);

// ==========================================
// CAPTAIN AUTHENTICATION
// ==========================================

/**
 * @route   POST /api/v1/auth/captain/register
 * @desc    Register a new captain
 * @access  Public
 * @body    { firstName, lastName, email, phone, password, vehicle: { type, model, registrationNumber, ... } }
 */
router.post(
  '/captain/register',
  authLimiter,
  validateCaptainRegister,
  authController.registerCaptain
);

/**
 * @route   POST /api/v1/auth/captain/login
 * @desc    Login captain
 * @access  Public
 * @body    { emailOrPhone, password }
 */
router.post(
  '/captain/login',
  authLimiter,
  validateCaptainLogin,
  authController.loginCaptain
);

/**
 * @route   POST /api/v1/auth/captain/login-otp
 * @desc    Request OTP for captain login
 * @access  Public
 * @body    { phone }
 */
router.post(
  '/captain/login-otp',
  authLimiter,
  authController.requestCaptainLoginOTP
);

/**
 * @route   POST /api/v1/auth/captain/verify-login-otp
 * @desc    Verify OTP and login captain
 * @access  Public
 * @body    { phone, otp }
 */
router.post(
  '/captain/verify-login-otp',
  validateOTP,
  authController.verifyCaptainLoginOTP
);

/**
 * @route   POST /api/v1/auth/captain/send-otp
 * @desc    Send OTP to captain phone
 * @access  Public
 * @body    { phone }
 */
router.post(
  '/captain/send-otp',
  otpLimiter,
  authController.sendCaptainOTP
);

/**
 * @route   POST /api/v1/auth/captain/verify-otp
 * @desc    Verify captain phone OTP
 * @access  Public
 * @body    { phone, otp }
 */
router.post(
  '/captain/verify-otp',
  validateOTP,
  authController.verifyCaptainOTP
);

/**
 * @route   POST /api/v1/auth/captain/forgot-password
 * @desc    Request captain password reset
 * @access  Public
 * @body    { emailOrPhone }
 */
router.post(
  '/captain/forgot-password',
  authLimiter,
  validateForgotPassword,
  authController.forgotCaptainPassword
);

/**
 * @route   POST /api/v1/auth/captain/reset-password
 * @desc    Reset captain password
 * @access  Public
 * @body    { emailOrPhone, otp, newPassword }
 */
router.post(
  '/captain/reset-password',
  validateResetPassword,
  authController.resetCaptainPassword
);

/**
 * @route   POST /api/v1/auth/captain/change-password
 * @desc    Change captain password
 * @access  Private (Captain)
 * @body    { currentPassword, newPassword }
 */
router.post(
  '/captain/change-password',
  protectCaptain,
  validateChangePassword,
  authController.changeCaptainPassword
);

/**
 * @route   POST /api/v1/auth/captain/logout
 * @desc    Logout captain
 * @access  Private (Captain)
 */
router.post(
  '/captain/logout',
  protectCaptain,
  authController.logoutCaptain
);

/**
 * @route   GET /api/v1/auth/captain/me
 * @desc    Get current authenticated captain
 * @access  Private (Captain)
 */
router.get(
  '/captain/me',
  protectCaptain,
  authController.getCurrentCaptain
);

/**
 * @route   GET /api/v1/auth/captain/status
 * @desc    Get captain approval status
 * @access  Private (Captain)
 */
router.get(
  '/captain/status',
  protectCaptain,
  authController.getCaptainStatus
);

// ==========================================
// TOKEN MANAGEMENT
// ==========================================

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 * @body    { refreshToken }
 */
router.post(
  '/refresh-token',
  authController.refreshToken
);

/**
 * @route   POST /api/v1/auth/revoke-token
 * @desc    Revoke refresh token
 * @access  Private
 * @body    { refreshToken }
 */
router.post(
  '/revoke-token',
  protect,
  authController.revokeToken
);

// ==========================================
// SOCIAL AUTHENTICATION
// ==========================================

/**
 * @route   POST /api/v1/auth/google
 * @desc    Authenticate with Google
 * @access  Public
 * @body    { idToken }
 */
router.post(
  '/google',
  authController.googleAuth
);

/**
 * @route   POST /api/v1/auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.post(
  '/google/callback',
  authController.googleAuthCallback
);

/**
 * @route   POST /api/v1/auth/facebook
 * @desc    Authenticate with Facebook
 * @access  Public
 * @body    { accessToken }
 */
router.post(
  '/facebook',
  authController.facebookAuth
);

// ==========================================
// ACCOUNT VERIFICATION
// ==========================================

/**
 * @route   POST /api/v1/auth/check-phone
 * @desc    Check if phone number exists
 * @access  Public
 * @body    { phone }
 */
router.post(
  '/check-phone',
  authController.checkPhoneExists
);

/**
 * @route   POST /api/v1/auth/check-email
 * @desc    Check if email exists
 * @access  Public
 * @body    { email }
 */
router.post(
  '/check-email',
  authController.checkEmailExists
);

module.exports = router;