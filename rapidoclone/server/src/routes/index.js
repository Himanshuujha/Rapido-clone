// src/routes/index.js
const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const captainRoutes = require('./captainRoutes');
const rideRoutes = require('./rideRoutes');
const paymentRoutes = require('./paymentRoutes');
const walletRoutes = require('./walletRoutes');
const locationRoutes = require('./locationRoutes');
const adminRoutes = require('./adminRoutes');
const couponRoutes = require('./couponRoutes');
const notificationRoutes = require('./notificationRoutes');

// ==========================================
// API INFO
// ==========================================

/**
 * @route   GET /api/v1
 * @desc    API information
 * @access  Public
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Rapido Clone API v1',
    version: '1.0.0',
    documentation: '/api/v1/docs',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      captains: '/api/v1/captains',
      rides: '/api/v1/rides',
      payments: '/api/v1/payments',
      wallet: '/api/v1/wallet',
      locations: '/api/v1/locations',
      coupons: '/api/v1/coupons',
      notifications: '/api/v1/notifications',
      admin: '/api/v1/admin',
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * @route   GET /api/v1/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ==========================================
// MOUNT ROUTES
// ==========================================

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/captains', captainRoutes);
router.use('/rides', rideRoutes);
router.use('/payments', paymentRoutes);
router.use('/wallet', walletRoutes);
router.use('/locations', locationRoutes);
router.use('/coupons', couponRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);

// ==========================================
// 404 HANDLER
// ==========================================

router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    suggestion: 'Please check the API documentation at /api/v1/docs',
  });
});

module.exports = router;