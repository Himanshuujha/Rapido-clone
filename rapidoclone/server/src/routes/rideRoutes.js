// src/routes/rideRoutes.js
const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const { protect, protectCaptain, protectBoth } = require('../middlewares/auth');
const {
  validateFareEstimate,
  validateBookRide,
  validateScheduleRide,
  validateCancelRide,
  validateRateRide,
  validateStartRide,
} = require('../validators/rideValidator');

// ==========================================
// USER RIDE ROUTES
// ==========================================

/**
 * @route   POST /api/v1/rides/estimate
 * @desc    Get fare estimate for a ride
 * @access  Private (User)
 * @body    { pickup: { address, coordinates }, destination: { address, coordinates }, vehicleType }
 */
router.post(
  '/estimate',
  protect,
  validateFareEstimate,
  rideController.getFareEstimate
);

/**
 * @route   POST /api/v1/rides/book
 * @desc    Book a ride
 * @access  Private (User)
 * @body    { pickup, destination, vehicleType, paymentMethod, couponCode? }
 */
router.post(
  '/book',
  protect,
  validateBookRide,
  rideController.bookRide
);

/**
 * @route   POST /api/v1/rides/schedule
 * @desc    Schedule a ride for later
 * @access  Private (User)
 * @body    { pickup, destination, vehicleType, paymentMethod, scheduledTime }
 */
router.post(
  '/schedule',
  protect,
  validateScheduleRide,
  rideController.scheduleRide
);

/**
 * @route   GET /api/v1/rides/scheduled
 * @desc    Get all scheduled rides
 * @access  Private (User)
 */
router.get('/scheduled', protect, rideController.getScheduledRides);

/**
 * @route   PUT /api/v1/rides/scheduled/:rideId
 * @desc    Update scheduled ride
 * @access  Private (User)
 * @body    { scheduledTime?, pickup?, destination? }
 */
router.put('/scheduled/:rideId', protect, rideController.updateScheduledRide);

/**
 * @route   DELETE /api/v1/rides/scheduled/:rideId
 * @desc    Cancel scheduled ride
 * @access  Private (User)
 */
router.delete('/scheduled/:rideId', protect, rideController.cancelScheduledRide);

/**
 * @route   GET /api/v1/rides/active
 * @desc    Get active ride
 * @access  Private (User/Captain)
 */
router.get('/active', protectBoth, rideController.getActiveRide);

/**
 * @route   GET /api/v1/rides/history
 * @desc    Get ride history
 * @access  Private (User)
 * @query   { page, limit, status, startDate, endDate }
 */
router.get('/history', protect, rideController.getRideHistory);

/**
 * @route   GET /api/v1/rides/recent
 * @desc    Get recent rides (last 5)
 * @access  Private (User)
 */
router.get('/recent', protect, rideController.getRecentRides);

/**
 * @route   GET /api/v1/rides/stats
 * @desc    Get ride statistics
 * @access  Private (User)
 */
router.get('/stats', protect, rideController.getUserRideStats);

/**
 * @route   GET /api/v1/rides/:rideId
 * @desc    Get ride details
 * @access  Private (User/Captain)
 */
router.get('/:rideId', protectBoth, rideController.getRideDetails);

/**
 * @route   GET /api/v1/rides/:rideId/tracking
 * @desc    Get ride tracking info
 * @access  Private (User)
 */
router.get('/:rideId/tracking', protect, rideController.getRideTracking);

/**
 * @route   GET /api/v1/rides/:rideId/route
 * @desc    Get ride route (path taken)
 * @access  Private (User/Captain)
 */
router.get('/:rideId/route', protectBoth, rideController.getRideRoute);

/**
 * @route   POST /api/v1/rides/:rideId/cancel
 * @desc    Cancel ride (User)
 * @access  Private (User)
 * @body    { reason }
 */
router.post(
  '/:rideId/cancel',
  protect,
  validateCancelRide,
  rideController.cancelRide
);

/**
 * @route   POST /api/v1/rides/:rideId/rate
 * @desc    Rate ride and captain
 * @access  Private (User)
 * @body    { rating, comment?, tip? }
 */
router.post(
  '/:rideId/rate',
  protect,
  validateRateRide,
  rideController.rateRide
);

/**
 * @route   POST /api/v1/rides/:rideId/tip
 * @desc    Add tip to ride
 * @access  Private (User)
 * @body    { amount }
 */
router.post('/:rideId/tip', protect, rideController.addTip);

/**
 * @route   GET /api/v1/rides/:rideId/receipt
 * @desc    Get ride receipt
 * @access  Private (User)
 */
router.get('/:rideId/receipt', protect, rideController.getRideReceipt);

/**
 * @route   POST /api/v1/rides/:rideId/receipt/email
 * @desc    Email ride receipt
 * @access  Private (User)
 * @body    { email? }
 */
router.post('/:rideId/receipt/email', protect, rideController.emailRideReceipt);

/**
 * @route   POST /api/v1/rides/:rideId/share
 * @desc    Share ride status with contacts
 * @access  Private (User)
 * @body    { contacts: [{ name, phone }] }
 */
router.post('/:rideId/share', protect, rideController.shareRide);

/**
 * @route   DELETE /api/v1/rides/:rideId/share
 * @desc    Stop sharing ride
 * @access  Private (User)
 */
router.delete('/:rideId/share', protect, rideController.stopShareRide);

/**
 * @route   POST /api/v1/rides/:rideId/sos
 * @desc    Trigger SOS emergency
 * @access  Private (User)
 * @body    { location? }
 */
router.post('/:rideId/sos', protect, rideController.triggerSOS);

/**
 * @route   POST /api/v1/rides/:rideId/report
 * @desc    Report an issue with ride
 * @access  Private (User)
 * @body    { issueType, description }
 */
router.post('/:rideId/report', protect, rideController.reportRideIssue);

// ==========================================
// CAPTAIN RIDE ROUTES
// ==========================================

/**
 * @route   GET /api/v1/rides/captain/requests
 * @desc    Get nearby ride requests
 * @access  Private (Captain)
 */
router.get('/captain/requests', protectCaptain, rideController.getNearbyRequests);

/**
 * @route   GET /api/v1/rides/captain/active
 * @desc    Get captain's active ride
 * @access  Private (Captain)
 */
router.get('/captain/active', protectCaptain, rideController.getCaptainActiveRide);

/**
 * @route   GET /api/v1/rides/captain/history
 * @desc    Get captain's ride history
 * @access  Private (Captain)
 * @query   { page, limit, status, startDate, endDate }
 */
router.get('/captain/history', protectCaptain, rideController.getCaptainRideHistory);

/**
 * @route   GET /api/v1/rides/captain/stats
 * @desc    Get captain's ride statistics
 * @access  Private (Captain)
 */
router.get('/captain/stats', protectCaptain, rideController.getCaptainRideStats);

/**
 * @route   POST /api/v1/rides/captain/accept/:rideId
 * @desc    Accept ride request
 * @access  Private (Captain)
 */
router.post('/captain/accept/:rideId', protectCaptain, rideController.acceptRide);

/**
 * @route   POST /api/v1/rides/captain/reject/:rideId
 * @desc    Reject ride request
 * @access  Private (Captain)
 * @body    { reason? }
 */
router.post('/captain/reject/:rideId', protectCaptain, rideController.rejectRide);

/**
 * @route   POST /api/v1/rides/captain/arriving/:rideId
 * @desc    Update status to arriving
 * @access  Private (Captain)
 * @body    { eta? }
 */
router.post('/captain/arriving/:rideId', protectCaptain, rideController.setArriving);

/**
 * @route   POST /api/v1/rides/captain/arrived/:rideId
 * @desc    Captain arrived at pickup
 * @access  Private (Captain)
 */
router.post('/captain/arrived/:rideId', protectCaptain, rideController.captainArrived);

/**
 * @route   POST /api/v1/rides/captain/start/:rideId
 * @desc    Start ride (with OTP verification)
 * @access  Private (Captain)
 * @body    { otp }
 */
router.post(
  '/captain/start/:rideId',
  protectCaptain,
  validateStartRide,
  rideController.startRide
);

/**
 * @route   POST /api/v1/rides/captain/complete/:rideId
 * @desc    Complete ride
 * @access  Private (Captain)
 * @body    { finalFare?, tollCharges?, waitingCharges? }
 */
router.post('/captain/complete/:rideId', protectCaptain, rideController.completeRide);

/**
 * @route   POST /api/v1/rides/captain/cancel/:rideId
 * @desc    Cancel ride (Captain)
 * @access  Private (Captain)
 * @body    { reason }
 */
router.post(
  '/captain/cancel/:rideId',
  protectCaptain,
  validateCancelRide,
  rideController.captainCancelRide
);

/**
 * @route   PUT /api/v1/rides/captain/location/:rideId
 * @desc    Update captain location during ride
 * @access  Private (Captain)
 * @body    { latitude, longitude, heading?, speed? }
 */
router.put('/captain/location/:rideId', protectCaptain, rideController.updateRideLocation);

/**
 * @route   POST /api/v1/rides/captain/rate/:rideId
 * @desc    Rate user
 * @access  Private (Captain)
 * @body    { rating, comment? }
 */
router.post('/captain/rate/:rideId', protectCaptain, rideController.rateCaptainRide);

/**
 * @route   POST /api/v1/rides/captain/report/:rideId
 * @desc    Report issue with user
 * @access  Private (Captain)
 * @body    { issueType, description }
 */
router.post('/captain/report/:rideId', protectCaptain, rideController.reportUserIssue);

/**
 * @route   POST /api/v1/rides/captain/collect-cash/:rideId
 * @desc    Mark cash collected
 * @access  Private (Captain)
 * @body    { amount }
 */
router.post('/captain/collect-cash/:rideId', protectCaptain, rideController.collectCash);

// ==========================================
// COUPON ROUTES (Related to rides)
// ==========================================

/**
 * @route   GET /api/v1/rides/coupons/available
 * @desc    Get available coupons
 * @access  Private (User)
 * @query   { vehicleType? }
 */
router.get('/coupons/available', protect, rideController.getAvailableCoupons);

/**
 * @route   POST /api/v1/rides/coupons/validate
 * @desc    Validate a coupon
 * @access  Private (User)
 * @body    { code, vehicleType, fareAmount }
 */
router.post('/coupons/validate', protect, rideController.validateCoupon);

/**
 * @route   POST /api/v1/rides/coupons/apply
 * @desc    Apply coupon to ride
 * @access  Private (User)
 * @body    { rideId, code }
 */
router.post('/coupons/apply', protect, rideController.applyCoupon);

/**
 * @route   DELETE /api/v1/rides/coupons/remove/:rideId
 * @desc    Remove coupon from ride
 * @access  Private (User)
 */
router.delete('/coupons/remove/:rideId', protect, rideController.removeCoupon);

// ==========================================
// VEHICLE TYPES
// ==========================================

/**
 * @route   GET /api/v1/rides/vehicle-types
 * @desc    Get available vehicle types
 * @access  Public
 * @query   { city? }
 */
router.get('/vehicle-types', rideController.getVehicleTypes);

/**
 * @route   GET /api/v1/rides/vehicle-types/:vehicleType
 * @desc    Get vehicle type details
 * @access  Public
 */
router.get('/vehicle-types/:vehicleType', rideController.getVehicleTypeDetails);

// ==========================================
// SHARED RIDE TRACKING (Public with token)
// ==========================================

/**
 * @route   GET /api/v1/rides/share/:shareToken
 * @desc    Get shared ride tracking info
 * @access  Public
 */
router.get('/share/:shareToken', rideController.getSharedRideTracking);

module.exports = router;