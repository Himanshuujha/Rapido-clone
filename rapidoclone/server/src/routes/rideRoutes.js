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
// 🔴 IMPORTANT: ORDER MATTERS!
// Put ALL specific routes BEFORE /:rideId
// ==========================================

// ==========================================
// VEHICLE TYPES (Public - no auth needed)
// ==========================================
router.get('/vehicle-types', rideController.getVehicleTypes);
router.get('/vehicle-types/:vehicleType', rideController.getVehicleTypeDetails);

// ==========================================
// SHARED RIDE TRACKING (Public with token)
// ==========================================
router.get('/share/:shareToken', rideController.getSharedRideTracking);

// ==========================================
// CAPTAIN RIDE ROUTES (Must be before /:rideId)
// ==========================================
router.get('/captain/requests', protectCaptain, rideController.getNearbyRequests);
router.get('/captain/active', protectCaptain, rideController.getCaptainActiveRide);
router.get('/captain/history', protectCaptain, rideController.getCaptainRideHistory);
router.get('/captain/stats', protectCaptain, rideController.getCaptainRideStats);
router.post('/captain/accept/:rideId', protectCaptain, rideController.acceptRide);
router.post('/captain/reject/:rideId', protectCaptain, rideController.rejectRide);
router.post('/captain/arriving/:rideId', protectCaptain, rideController.setArriving);
router.post('/captain/arrived/:rideId', protectCaptain, rideController.captainArrived);
router.post('/captain/start/:rideId', protectCaptain, validateStartRide, rideController.startRide);
router.post('/captain/complete/:rideId', protectCaptain, rideController.completeRide);
router.post('/captain/cancel/:rideId', protectCaptain, validateCancelRide, rideController.captainCancelRide);
router.put('/captain/location/:rideId', protectCaptain, rideController.updateRideLocation);
router.post('/captain/rate/:rideId', protectCaptain, rideController.rateCaptainRide);
router.post('/captain/report/:rideId', protectCaptain, rideController.reportUserIssue);
router.post('/captain/collect-cash/:rideId', protectCaptain, rideController.collectCash);

// ==========================================
// COUPON ROUTES (Must be before /:rideId)
// ==========================================
router.get('/coupons/available', protect, rideController.getAvailableCoupons);
router.post('/coupons/validate', protect, rideController.validateCoupon);
router.post('/coupons/apply', protect, rideController.applyCoupon);
router.delete('/coupons/remove/:rideId', protect, rideController.removeCoupon);

// ==========================================
// USER RIDE ROUTES - Specific paths first
// ==========================================
router.post('/estimate', protect, validateFareEstimate, rideController.getFareEstimate);
router.post('/book', protect, validateBookRide, rideController.bookRide);
router.post('/schedule', protect, validateScheduleRide, rideController.scheduleRide);
router.get('/scheduled', protect, rideController.getScheduledRides);
router.put('/scheduled/:rideId', protect, rideController.updateScheduledRide);
router.delete('/scheduled/:rideId', protect, rideController.cancelScheduledRide);
router.get('/active', protectBoth, rideController.getActiveRide);
router.get('/history',protect, rideController.getRideHistory);
router.get('/recent', protect, rideController.getRecentRides);
router.get('/stats', protect, rideController.getUserRideStats);

// ==========================================
// 🔴 PARAMETERIZED ROUTES - MUST BE LAST!
// ==========================================
router.get('/:rideId', protectBoth, rideController.getRideDetails);
router.get('/:rideId/tracking', protect, rideController.getRideTracking);
router.get('/:rideId/route', protectBoth, rideController.getRideRoute);
router.post('/:rideId/cancel', protect, validateCancelRide, rideController.cancelRide);
router.post('/:rideId/rate', protect, validateRateRide, rideController.rateRide);
router.post('/:rideId/tip', protect, rideController.addTip);
router.get('/:rideId/receipt', protect, rideController.getRideReceipt);
router.post('/:rideId/receipt/email', protect, rideController.emailRideReceipt);
router.post('/:rideId/share', protect, rideController.shareRide);
router.delete('/:rideId/share', protect, rideController.stopShareRide);
router.post('/:rideId/sos', protect, rideController.triggerSOS);
router.post('/:rideId/report', protect, rideController.reportRideIssue);

module.exports = router;