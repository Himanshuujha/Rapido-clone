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

const authLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many attempts. Please try again after an hour.',
});

const otpLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 3,
  message: 'Too many OTP requests. Please wait a minute.',
});

// User Authentication
router.post('/user/register', authLimiter, validateUserRegister, authController.registerUser);
router.post('/user/login', authLimiter, validateUserLogin, authController.loginUser);
router.post('/user/login-otp', authLimiter, authController.requestLoginOTP);
router.post('/user/verify-login-otp', validateOTP, authController.verifyLoginOTP);
router.post('/user/send-otp', otpLimiter, authController.sendOTP);
router.post('/user/verify-otp', validateOTP, authController.verifyOTP);
router.post('/user/resend-otp', otpLimiter, authController.resendOTP);
router.post('/user/forgot-password', authLimiter, validateForgotPassword, authController.forgotPassword);
router.post('/user/reset-password', validateResetPassword, authController.resetPassword);
router.post('/user/change-password', protect, validateChangePassword, authController.changePassword);
router.post('/user/logout', protect, authController.logoutUser);
router.get('/user/me', protect, authController.getCurrentUser);
router.post('/user/verify-email', authController.verifyEmail);
router.post('/user/resend-verification', protect, authController.resendEmailVerification);

// Captain Authentication
router.post('/captain/register', authLimiter, validateCaptainRegister, authController.registerCaptain);
router.post('/captain/login', authLimiter, validateCaptainLogin, authController.loginCaptain);
router.post('/captain/login-otp', authLimiter, authController.requestCaptainLoginOTP);
router.post('/captain/verify-login-otp', validateOTP, authController.verifyCaptainLoginOTP);
router.post('/captain/send-otp', otpLimiter, authController.sendCaptainOTP);
router.post('/captain/verify-otp', validateOTP, authController.verifyCaptainOTP);
router.post('/captain/forgot-password', authLimiter, validateForgotPassword, authController.forgotCaptainPassword);
router.post('/captain/reset-password', validateResetPassword, authController.resetCaptainPassword);
router.post('/captain/change-password', protectCaptain, validateChangePassword, authController.changeCaptainPassword);
router.post('/captain/logout', protectCaptain, authController.logoutCaptain);
router.get('/captain/me', protectCaptain, authController.getCurrentCaptain);
router.get('/captain/status', protectCaptain, authController.getCaptainStatus);

// Token Management
router.post('/refresh-token', authController.refreshToken);
router.post('/revoke-token', protect, authController.revokeToken);

// Social Authentication
router.post('/google', authController.googleAuth);
router.post('/google/callback', authController.googleAuthCallback);
router.post('/facebook', authController.facebookAuth);

// Account Verification
router.post('/check-phone', authController.checkPhoneExists);
router.post('/check-email', authController.checkEmailExists);

module.exports = router;