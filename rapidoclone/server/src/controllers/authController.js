// src/controllers/authController.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Captain = require('../models/Captain');
const Wallet = require('../models/Wallet');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { generateOTP, generateRandomString } = require('../utils/helpers');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

// Token generation helpers
const generateAccessToken = (id, type = 'user') => {
  return jwt.sign({ id, type }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const generateRefreshToken = (id, type = 'user') => {
  return jwt.sign({ id, type }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
};

// Cookie options
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ==========================================
// USER AUTHENTICATION
// ==========================================

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/user/register
 * @access  Public
 */
exports.registerUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, password, referralCode } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { phone }],
  });

  if (existingUser) {
    if (existingUser.email === email.toLowerCase()) {
      throw new ApiError(400, 'Email already registered');
    }
    throw new ApiError(400, 'Phone number already registered');
  }

  // Generate referral code for new user
  const userReferralCode = `${firstName.substring(0, 3).toUpperCase()}${generateRandomString(5).toUpperCase()}`;

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    phone,
    password,
    referralCode: userReferralCode,
  });

  // Create wallet for user
  const wallet = await Wallet.create({
    owner: user._id,
    ownerType: 'User',
  });

  user.wallet = wallet._id;
  await user.save();

  // Handle referral
  if (referralCode) {
    const referrer = await User.findOne({ referralCode });
    if (referrer) {
      user.referredBy = referrer._id;
      await user.save();
      // TODO: Add referral bonus logic
    }
  }

  // Generate tokens
  const accessToken = generateAccessToken(user._id, 'user');
  const refreshToken = generateRefreshToken(user._id, 'user');

  user.refreshToken = refreshToken;
  await user.save();

  // Set cookie
  res.cookie('refreshToken', refreshToken, cookieOptions);

  // Remove sensitive data
  user.password = undefined;
  user.refreshToken = undefined;

  res.status(201).json(
    new ApiResponse(201, {
      user,
      accessToken,
      refreshToken,
    }, 'User registered successfully')
  );
});

/**
 * @desc    Login user with email/phone and password
 * @route   POST /api/v1/auth/user/login
 * @access  Public
 */
exports.loginUser = asyncHandler(async (req, res) => {
  const { emailOrPhone, password, rememberMe } = req.body;

  // Find user by email or phone
  const user = await User.findOne({
    $or: [
      { email: emailOrPhone.toLowerCase() },
      { phone: emailOrPhone },
    ],
  }).select('+password');

  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Check if account is active
  if (!user.isActive) {
    throw new ApiError(403, 'Your account has been deactivated. Please contact support.');
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Generate tokens
  const accessToken = generateAccessToken(user._id, 'user');
  const refreshToken = generateRefreshToken(user._id, 'user');

  user.refreshToken = refreshToken;
  await user.save();

  // Set cookie with extended expiry if remember me
  const cookieOpts = { ...cookieOptions };
  if (rememberMe) {
    cookieOpts.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  }
  res.cookie('refreshToken', refreshToken, cookieOpts);

  // Remove sensitive data
  user.password = undefined;
  user.refreshToken = undefined;

  res.status(200).json(
    new ApiResponse(200, {
      user,
      accessToken,
      refreshToken,
    }, 'Login successful')
  );
});

/**
 * @desc    Request OTP for login
 * @route   POST /api/v1/auth/user/login-otp
 * @access  Public
 */
exports.requestLoginOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  const user = await User.findOne({ phone });
  if (!user) {
    throw new ApiError(404, 'No account found with this phone number');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Your account has been deactivated');
  }

  // Generate OTP
  const otp = generateOTP(4);
  const otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes

  // Store OTP in Redis
  await cache.set(`otp:login:${phone}`, { otp, expiry: otpExpiry }, 300);

  // TODO: Send OTP via SMS
  logger.info(`Login OTP for ${phone}: ${otp}`);

  res.status(200).json(
    new ApiResponse(200, { phone }, 'OTP sent successfully')
  );
});

/**
 * @desc    Verify OTP and login
 * @route   POST /api/v1/auth/user/verify-login-otp
 * @access  Public
 */
exports.verifyLoginOTP = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  // Get OTP from Redis
  const storedData = await cache.get(`otp:login:${phone}`);

  if (!storedData) {
    throw new ApiError(400, 'OTP expired or not found. Please request a new one.');
  }

  if (storedData.otp !== otp) {
    throw new ApiError(400, 'Invalid OTP');
  }

  // Clear OTP
  await cache.del(`otp:login:${phone}`);

  const user = await User.findOne({ phone });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Generate tokens
  const accessToken = generateAccessToken(user._id, 'user');
  const refreshToken = generateRefreshToken(user._id, 'user');

  user.refreshToken = refreshToken;
  user.isVerified = true;
  await user.save();

  res.cookie('refreshToken', refreshToken, cookieOptions);

  res.status(200).json(
    new ApiResponse(200, {
      user,
      accessToken,
      refreshToken,
    }, 'Login successful')
  );
});

/**
 * @desc    Send OTP to phone
 * @route   POST /api/v1/auth/user/send-otp
 * @access  Public
 */
exports.sendOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  const otp = generateOTP(4);
  const otpExpiry = Date.now() + 5 * 60 * 1000;

  await cache.set(`otp:verify:${phone}`, { otp, expiry: otpExpiry }, 300);

  // TODO: Send OTP via SMS
  logger.info(`Verification OTP for ${phone}: ${otp}`);

  res.status(200).json(
    new ApiResponse(200, { phone }, 'OTP sent successfully')
  );
});

/**
 * @desc    Verify OTP
 * @route   POST /api/v1/auth/user/verify-otp
 * @access  Public
 */
exports.verifyOTP = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  const storedData = await cache.get(`otp:verify:${phone}`);

  if (!storedData) {
    throw new ApiError(400, 'OTP expired or not found');
  }

  if (storedData.otp !== otp) {
    throw new ApiError(400, 'Invalid OTP');
  }

  await cache.del(`otp:verify:${phone}`);

  // Update user verification status
  await User.findOneAndUpdate({ phone }, { isVerified: true });

  res.status(200).json(
    new ApiResponse(200, { verified: true }, 'Phone verified successfully')
  );
});

/**
 * @desc    Resend OTP
 * @route   POST /api/v1/auth/user/resend-otp
 * @access  Public
 */
exports.resendOTP = asyncHandler(async (req, res) => {
  const { phone, type = 'verify' } = req.body;

  const otp = generateOTP(4);
  const otpExpiry = Date.now() + 5 * 60 * 1000;

  await cache.set(`otp:${type}:${phone}`, { otp, expiry: otpExpiry }, 300);

  // TODO: Send OTP via SMS
  logger.info(`Resent OTP for ${phone}: ${otp}`);

  res.status(200).json(
    new ApiResponse(200, { phone }, 'OTP resent successfully')
  );
});

/**
 * @desc    Forgot password
 * @route   POST /api/v1/auth/user/forgot-password
 * @access  Public
 */
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { emailOrPhone } = req.body;

  const user = await User.findOne({
    $or: [
      { email: emailOrPhone.toLowerCase() },
      { phone: emailOrPhone },
    ],
  });

  if (!user) {
    throw new ApiError(404, 'No account found with this email/phone');
  }

  const otp = generateOTP(4);
  await cache.set(`otp:reset:${user.phone}`, { otp, userId: user._id.toString() }, 600);

  // TODO: Send OTP via SMS/Email
  logger.info(`Password reset OTP for ${user.phone}: ${otp}`);

  res.status(200).json(
    new ApiResponse(200, { phone: user.phone }, 'Password reset OTP sent')
  );
});

/**
 * @desc    Reset password
 * @route   POST /api/v1/auth/user/reset-password
 * @access  Public
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { emailOrPhone, otp, newPassword } = req.body;

  const user = await User.findOne({
    $or: [
      { email: emailOrPhone.toLowerCase() },
      { phone: emailOrPhone },
    ],
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const storedData = await cache.get(`otp:reset:${user.phone}`);

  if (!storedData || storedData.otp !== otp) {
    throw new ApiError(400, 'Invalid or expired OTP');
  }

  user.password = newPassword;
  user.refreshToken = undefined;
  await user.save();

  await cache.del(`otp:reset:${user.phone}`);

  res.status(200).json(
    new ApiResponse(200, null, 'Password reset successful. Please login with your new password.')
  );
});

/**
 * @desc    Change password
 * @route   POST /api/v1/auth/user/change-password
 * @access  Private
 */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json(
    new ApiResponse(200, null, 'Password changed successfully')
  );
});

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/user/logout
 * @access  Private
 */
exports.logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    refreshToken: undefined,
    fcmToken: undefined,
  });

  res.clearCookie('refreshToken');

  res.status(200).json(
    new ApiResponse(200, null, 'Logged out successfully')
  );
});

/**
 * @desc    Get current user
 * @route   GET /api/v1/auth/user/me
 * @access  Private
 */
exports.getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('wallet');

  res.status(200).json(
    new ApiResponse(200, { user }, 'User retrieved successfully')
  );
});

/**
 * @desc    Verify email
 * @route   POST /api/v1/auth/user/verify-email
 * @access  Public
 */
exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;

  const storedData = await cache.get(`email:verify:${token}`);

  if (!storedData) {
    throw new ApiError(400, 'Invalid or expired verification link');
  }

  await User.findByIdAndUpdate(storedData.userId, { isVerified: true });
  await cache.del(`email:verify:${token}`);

  res.status(200).json(
    new ApiResponse(200, null, 'Email verified successfully')
  );
});

/**
 * @desc    Resend email verification
 * @route   POST /api/v1/auth/user/resend-verification
 * @access  Private
 */
exports.resendEmailVerification = asyncHandler(async (req, res) => {
  const user = req.user;

  if (user.isVerified) {
    throw new ApiError(400, 'Email is already verified');
  }

  const token = generateRandomString(32);
  await cache.set(`email:verify:${token}`, { userId: user._id.toString() }, 86400);

  // TODO: Send verification email
  logger.info(`Email verification token for ${user.email}: ${token}`);

  res.status(200).json(
    new ApiResponse(200, null, 'Verification email sent')
  );
});

// ==========================================
// CAPTAIN AUTHENTICATION
// ==========================================

/**
 * @desc    Register a new captain
 * @route   POST /api/v1/auth/captain/register
 * @access  Public
 */
exports.registerCaptain = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    password,
    vehicle,
  } = req.body;

  // Check if captain exists
  const existingCaptain = await Captain.findOne({
    $or: [{ email: email.toLowerCase() }, { phone }],
  });

  if (existingCaptain) {
    if (existingCaptain.email === email.toLowerCase()) {
      throw new ApiError(400, 'Email already registered');
    }
    throw new ApiError(400, 'Phone number already registered');
  }

  // Check if vehicle registration number exists
  if (vehicle?.registrationNumber) {
    const existingVehicle = await Captain.findOne({
      'vehicle.registrationNumber': vehicle.registrationNumber.toUpperCase(),
    });
    if (existingVehicle) {
      throw new ApiError(400, 'Vehicle registration number already registered');
    }
  }

  // Create captain
  const captain = await Captain.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    phone,
    password,
    vehicle: {
      ...vehicle,
      registrationNumber: vehicle.registrationNumber?.toUpperCase(),
    },
    status: 'pending',
  });

  // Create wallet
  const wallet = await Wallet.create({
    owner: captain._id,
    ownerType: 'Captain',
  });

  captain.wallet = wallet._id;
  await captain.save();

  // Generate tokens
  const accessToken = generateAccessToken(captain._id, 'captain');
  const refreshToken = generateRefreshToken(captain._id, 'captain');

  captain.refreshToken = refreshToken;
  await captain.save();

  res.cookie('refreshToken', refreshToken, cookieOptions);

  captain.password = undefined;
  captain.refreshToken = undefined;

  res.status(201).json(
    new ApiResponse(201, {
      captain,
      accessToken,
      refreshToken,
    }, 'Captain registered successfully. Your application is pending approval.')
  );
});

/**
 * @desc    Login captain
 * @route   POST /api/v1/auth/captain/login
 * @access  Public
 */
exports.loginCaptain = asyncHandler(async (req, res) => {
  const { emailOrPhone, password } = req.body;

  const captain = await Captain.findOne({
    $or: [
      { email: emailOrPhone.toLowerCase() },
      { phone: emailOrPhone },
    ],
  }).select('+password');

  if (!captain) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Check captain status
  if (captain.status === 'suspended') {
    throw new ApiError(403, 'Your account has been suspended. Please contact support.');
  }

  if (captain.status === 'rejected') {
    throw new ApiError(403, 'Your application was rejected. Please contact support.');
  }

  const isPasswordValid = await captain.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const accessToken = generateAccessToken(captain._id, 'captain');
  const refreshToken = generateRefreshToken(captain._id, 'captain');

  captain.refreshToken = refreshToken;
  await captain.save();

  res.cookie('refreshToken', refreshToken, cookieOptions);

  captain.password = undefined;
  captain.refreshToken = undefined;

  res.status(200).json(
    new ApiResponse(200, {
      captain,
      accessToken,
      refreshToken,
    }, 'Login successful')
  );
});

/**
 * @desc    Request OTP for captain login
 * @route   POST /api/v1/auth/captain/login-otp
 * @access  Public
 */
exports.requestCaptainLoginOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  const captain = await Captain.findOne({ phone });
  if (!captain) {
    throw new ApiError(404, 'No captain account found with this phone number');
  }

  const otp = generateOTP(4);
  await cache.set(`otp:captain:login:${phone}`, { otp }, 300);

  // TODO: Send OTP via SMS
  logger.info(`Captain login OTP for ${phone}: ${otp}`);

  res.status(200).json(
    new ApiResponse(200, { phone }, 'OTP sent successfully')
  );
});

/**
 * @desc    Verify captain OTP and login
 * @route   POST /api/v1/auth/captain/verify-login-otp
 * @access  Public
 */
exports.verifyCaptainLoginOTP = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  const storedData = await cache.get(`otp:captain:login:${phone}`);

  if (!storedData || storedData.otp !== otp) {
    throw new ApiError(400, 'Invalid or expired OTP');
  }

  await cache.del(`otp:captain:login:${phone}`);

  const captain = await Captain.findOne({ phone });

  const accessToken = generateAccessToken(captain._id, 'captain');
  const refreshToken = generateRefreshToken(captain._id, 'captain');

  captain.refreshToken = refreshToken;
  await captain.save();

  res.cookie('refreshToken', refreshToken, cookieOptions);

  res.status(200).json(
    new ApiResponse(200, {
      captain,
      accessToken,
      refreshToken,
    }, 'Login successful')
  );
});

/**
 * @desc    Send OTP to captain
 * @route   POST /api/v1/auth/captain/send-otp
 * @access  Public
 */
exports.sendCaptainOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  const otp = generateOTP(4);
  await cache.set(`otp:captain:verify:${phone}`, { otp }, 300);

  logger.info(`Captain OTP for ${phone}: ${otp}`);

  res.status(200).json(
    new ApiResponse(200, { phone }, 'OTP sent successfully')
  );
});

/**
 * @desc    Verify captain phone OTP
 * @route   POST /api/v1/auth/captain/verify-otp
 * @access  Public
 */
exports.verifyCaptainOTP = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  const storedData = await cache.get(`otp:captain:verify:${phone}`);

  if (!storedData || storedData.otp !== otp) {
    throw new ApiError(400, 'Invalid or expired OTP');
  }

  await cache.del(`otp:captain:verify:${phone}`);

  res.status(200).json(
    new ApiResponse(200, { verified: true }, 'Phone verified successfully')
  );
});

/**
 * @desc    Forgot captain password
 * @route   POST /api/v1/auth/captain/forgot-password
 * @access  Public
 */
exports.forgotCaptainPassword = asyncHandler(async (req, res) => {
  const { emailOrPhone } = req.body;

  const captain = await Captain.findOne({
    $or: [
      { email: emailOrPhone.toLowerCase() },
      { phone: emailOrPhone },
    ],
  });

  if (!captain) {
    throw new ApiError(404, 'No captain account found');
  }

  const otp = generateOTP(4);
  await cache.set(`otp:captain:reset:${captain.phone}`, { otp }, 600);

  logger.info(`Captain password reset OTP for ${captain.phone}: ${otp}`);

  res.status(200).json(
    new ApiResponse(200, { phone: captain.phone }, 'Password reset OTP sent')
  );
});

/**
 * @desc    Reset captain password
 * @route   POST /api/v1/auth/captain/reset-password
 * @access  Public
 */
exports.resetCaptainPassword = asyncHandler(async (req, res) => {
  const { emailOrPhone, otp, newPassword } = req.body;

  const captain = await Captain.findOne({
    $or: [
      { email: emailOrPhone.toLowerCase() },
      { phone: emailOrPhone },
    ],
  });

  if (!captain) {
    throw new ApiError(404, 'Captain not found');
  }

  const storedData = await cache.get(`otp:captain:reset:${captain.phone}`);

  if (!storedData || storedData.otp !== otp) {
    throw new ApiError(400, 'Invalid or expired OTP');
  }

  captain.password = newPassword;
  captain.refreshToken = undefined;
  await captain.save();

  await cache.del(`otp:captain:reset:${captain.phone}`);

  res.status(200).json(
    new ApiResponse(200, null, 'Password reset successful')
  );
});

/**
 * @desc    Change captain password
 * @route   POST /api/v1/auth/captain/change-password
 * @access  Private (Captain)
 */
exports.changeCaptainPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const captain = await Captain.findById(req.captain._id).select('+password');

  const isMatch = await captain.comparePassword(currentPassword);
  if (!isMatch) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  captain.password = newPassword;
  await captain.save();

  res.status(200).json(
    new ApiResponse(200, null, 'Password changed successfully')
  );
});

/**
 * @desc    Logout captain
 * @route   POST /api/v1/auth/captain/logout
 * @access  Private (Captain)
 */
exports.logoutCaptain = asyncHandler(async (req, res) => {
  await Captain.findByIdAndUpdate(req.captain._id, {
    refreshToken: undefined,
    fcmToken: undefined,
    isOnline: false,
  });

  res.clearCookie('refreshToken');

  res.status(200).json(
    new ApiResponse(200, null, 'Logged out successfully')
  );
});

/**
 * @desc    Get current captain
 * @route   GET /api/v1/auth/captain/me
 * @access  Private (Captain)
 */
exports.getCurrentCaptain = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id).populate('wallet');

  res.status(200).json(
    new ApiResponse(200, { captain }, 'Captain retrieved successfully')
  );
});

/**
 * @desc    Get captain approval status
 * @route   GET /api/v1/auth/captain/status
 * @access  Private (Captain)
 */
exports.getCaptainStatus = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id).select('status documents');

  const documentStatus = {
    drivingLicense: captain.documents?.drivingLicense?.verified || false,
    vehicleRC: captain.documents?.vehicleRC?.verified || false,
    insurance: captain.documents?.insurance?.verified || false,
    aadhar: captain.documents?.aadhar?.verified || false,
    pan: captain.documents?.pan?.verified || false,
    profilePhoto: captain.documents?.profilePhoto?.verified || false,
  };

  res.status(200).json(
    new ApiResponse(200, {
      status: captain.status,
      documents: documentStatus,
    }, 'Status retrieved successfully')
  );
});

// ==========================================
// TOKEN MANAGEMENT
// ==========================================

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || req.cookies;

  if (!refreshToken) {
    throw new ApiError(401, 'Refresh token not provided');
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    let user;
    if (decoded.type === 'captain') {
      user = await Captain.findById(decoded.id);
    } else {
      user = await User.findById(decoded.id);
    }

    if (!user || user.refreshToken !== refreshToken) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    const newAccessToken = generateAccessToken(user._id, decoded.type);
    const newRefreshToken = generateRefreshToken(user._id, decoded.type);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.cookie('refreshToken', newRefreshToken, cookieOptions);

    res.status(200).json(
      new ApiResponse(200, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      }, 'Token refreshed successfully')
    );
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
});

/**
 * @desc    Revoke refresh token
 * @route   POST /api/v1/auth/revoke-token
 * @access  Private
 */
exports.revokeToken = asyncHandler(async (req, res) => {
  const user = req.user || req.captain;

  user.refreshToken = undefined;
  await user.save();

  res.clearCookie('refreshToken');

  res.status(200).json(
    new ApiResponse(200, null, 'Token revoked successfully')
  );
});

// ==========================================
// SOCIAL AUTHENTICATION
// ==========================================

/**
 * @desc    Authenticate with Google
 * @route   POST /api/v1/auth/google
 * @access  Public
 */
exports.googleAuth = asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  // TODO: Verify Google ID token
  // const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
  // const payload = ticket.getPayload();

  // For now, mock the payload
  const payload = {
    email: 'user@gmail.com',
    name: 'Google User',
    picture: 'https://example.com/avatar.jpg',
  };

  let user = await User.findOne({ email: payload.email });

  if (!user) {
    // Create new user
    user = await User.create({
      firstName: payload.name.split(' ')[0],
      lastName: payload.name.split(' ').slice(1).join(' '),
      email: payload.email,
      avatar: payload.picture,
      isVerified: true,
      password: generateRandomString(20), // Random password for social auth
    });

    // Create wallet
    const wallet = await Wallet.create({
      owner: user._id,
      ownerType: 'User',
    });
    user.wallet = wallet._id;
    await user.save();
  }

  const accessToken = generateAccessToken(user._id, 'user');
  const refreshToken = generateRefreshToken(user._id, 'user');

  user.refreshToken = refreshToken;
  await user.save();

  res.cookie('refreshToken', refreshToken, cookieOptions);

  res.status(200).json(
    new ApiResponse(200, {
      user,
      accessToken,
      refreshToken,
    }, 'Google authentication successful')
  );
});

/**
 * @desc    Google OAuth callback
 * @route   POST /api/v1/auth/google/callback
 * @access  Public
 */
exports.googleAuthCallback = asyncHandler(async (req, res) => {
  // Handle OAuth callback
  res.status(200).json(
    new ApiResponse(200, null, 'Callback received')
  );
});

/**
 * @desc    Authenticate with Facebook
 * @route   POST /api/v1/auth/facebook
 * @access  Public
 */
exports.facebookAuth = asyncHandler(async (req, res) => {
  // TODO: Implement Facebook authentication
  res.status(501).json(
    new ApiResponse(501, null, 'Facebook authentication not implemented yet')
  );
});

// ==========================================
// ACCOUNT VERIFICATION
// ==========================================

/**
 * @desc    Check if phone exists
 * @route   POST /api/v1/auth/check-phone
 * @access  Public
 */
exports.checkPhoneExists = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  const user = await User.findOne({ phone });
  const captain = await Captain.findOne({ phone });

  res.status(200).json(
    new ApiResponse(200, {
      exists: !!(user || captain),
      type: user ? 'user' : captain ? 'captain' : null,
    }, 'Check completed')
  );
});

/**
 * @desc    Check if email exists
 * @route   POST /api/v1/auth/check-email
 * @access  Public
 */
exports.checkEmailExists = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  const captain = await Captain.findOne({ email: email.toLowerCase() });

  res.status(200).json(
    new ApiResponse(200, {
      exists: !!(user || captain),
      type: user ? 'user' : captain ? 'captain' : null,
    }, 'Check completed')
  );
});