// src/routes/captainRoutes.js
const express = require('express');
const router = express.Router();
const captainController = require('../controllers/captainController');
const { protectCaptain } = require('../middlewares/auth');
const { uploadAvatar, uploadDocument, uploadVehicleImage } = require('../config/cloudinary');
const {
  validateUpdateProfile,
  validateVehicle,
  validateBankDetails,
  validateDocument,
} = require('../validators/captainValidator');

// All routes require captain authentication
router.use(protectCaptain);

// ==========================================
// PROFILE ROUTES
// ==========================================

/**
 * @route   GET /api/v1/captains/profile
 * @desc    Get captain profile
 * @access  Private (Captain)
 */
router.get('/profile', captainController.getProfile);

/**
 * @route   PUT /api/v1/captains/profile
 * @desc    Update captain profile
 * @access  Private (Captain)
 * @body    { firstName, lastName, email, phone }
 */
router.put(
  '/profile',
  validateUpdateProfile,
  captainController.updateProfile
);

/**
 * @route   PUT /api/v1/captains/avatar
 * @desc    Update captain avatar
 * @access  Private (Captain)
 * @file    avatar (image)
 */
router.put(
  '/avatar',
  uploadAvatar.single('avatar'),
  captainController.updateAvatar
);

/**
 * @route   DELETE /api/v1/captains/avatar
 * @desc    Remove captain avatar
 * @access  Private (Captain)
 */
router.delete('/avatar', captainController.removeAvatar);

// ==========================================
// DOCUMENT ROUTES
// ==========================================

/**
 * @route   GET /api/v1/captains/documents
 * @desc    Get all documents
 * @access  Private (Captain)
 */
router.get('/documents', captainController.getDocuments);

/**
 * @route   GET /api/v1/captains/documents/status
 * @desc    Get document verification status
 * @access  Private (Captain)
 */
router.get('/documents/status', captainController.getDocumentStatus);

/**
 * @route   POST /api/v1/captains/documents/:documentType
 * @desc    Upload a document
 * @access  Private (Captain)
 * @params  documentType: driving_license | vehicle_rc | insurance | aadhar | pan | profile_photo
 * @file    document (image/pdf)
 * @body    { number?, expiryDate? }
 */
router.post(
  '/documents/:documentType',
  uploadDocument.single('document'),
  validateDocument,
  captainController.uploadDocument
);

/**
 * @route   PUT /api/v1/captains/documents/:documentType
 * @desc    Update a document
 * @access  Private (Captain)
 * @file    document (image/pdf)
 * @body    { number?, expiryDate? }
 */
router.put(
  '/documents/:documentType',
  uploadDocument.single('document'),
  validateDocument,
  captainController.updateDocument
);

/**
 * @route   DELETE /api/v1/captains/documents/:documentType
 * @desc    Delete a document
 * @access  Private (Captain)
 */
router.delete('/documents/:documentType', captainController.deleteDocument);

// ==========================================
// VEHICLE ROUTES
// ==========================================

/**
 * @route   GET /api/v1/captains/vehicle
 * @desc    Get vehicle details
 * @access  Private (Captain)
 */
router.get('/vehicle', captainController.getVehicle);

/**
 * @route   PUT /api/v1/captains/vehicle
 * @desc    Update vehicle details
 * @access  Private (Captain)
 * @body    { type, make, model, year, color, registrationNumber }
 */
router.put(
  '/vehicle',
  validateVehicle,
  captainController.updateVehicle
);

/**
 * @route   POST /api/v1/captains/vehicle/images
 * @desc    Upload vehicle images
 * @access  Private (Captain)
 * @files   images (max 5)
 * @body    { imageType: front | back | left | right | interior }
 */
router.post(
  '/vehicle/images',
  uploadVehicleImage.array('images', 5),
  captainController.uploadVehicleImages
);

/**
 * @route   DELETE /api/v1/captains/vehicle/images/:imageType
 * @desc    Delete a vehicle image
 * @access  Private (Captain)
 */
router.delete('/vehicle/images/:imageType', captainController.deleteVehicleImage);

// ==========================================
// STATUS ROUTES
// ==========================================

/**
 * @route   GET /api/v1/captains/status
 * @desc    Get captain status (online/offline, on ride, etc.)
 * @access  Private (Captain)
 */
router.get('/status', captainController.getStatus);

/**
 * @route   PUT /api/v1/captains/status
 * @desc    Toggle online/offline status
 * @access  Private (Captain)
 * @body    { isOnline, latitude?, longitude? }
 */
router.put('/status', captainController.toggleStatus);

/**
 * @route   PUT /api/v1/captains/go-online
 * @desc    Go online
 * @access  Private (Captain)
 * @body    { latitude, longitude }
 */
router.put('/go-online', captainController.goOnline);

/**
 * @route   PUT /api/v1/captains/go-offline
 * @desc    Go offline
 * @access  Private (Captain)
 */
router.put('/go-offline', captainController.goOffline);

/**
 * @route   GET /api/v1/captains/approval-status
 * @desc    Get account approval status
 * @access  Private (Captain)
 */
router.get('/approval-status', captainController.getApprovalStatus);

// ==========================================
// LOCATION ROUTES
// ==========================================

/**
 * @route   PUT /api/v1/captains/location
 * @desc    Update current location
 * @access  Private (Captain)
 * @body    { latitude, longitude, heading?, speed?, accuracy? }
 */
router.put('/location', captainController.updateLocation);

/**
 * @route   GET /api/v1/captains/location/history
 * @desc    Get location history
 * @access  Private (Captain)
 * @query   { startDate, endDate, rideId? }
 */
router.get('/location/history', captainController.getLocationHistory);

// ==========================================
// EARNINGS ROUTES
// ==========================================

/**
 * @route   GET /api/v1/captains/earnings
 * @desc    Get earnings summary
 * @access  Private (Captain)
 */
router.get('/earnings', captainController.getEarnings);

/**
 * @route   GET /api/v1/captains/earnings/today
 * @desc    Get today's earnings
 * @access  Private (Captain)
 */
router.get('/earnings/today', captainController.getTodayEarnings);

/**
 * @route   GET /api/v1/captains/earnings/week
 * @desc    Get this week's earnings
 * @access  Private (Captain)
 */
router.get('/earnings/week', captainController.getWeeklyEarnings);

/**
 * @route   GET /api/v1/captains/earnings/month
 * @desc    Get this month's earnings
 * @access  Private (Captain)
 */
router.get('/earnings/month', captainController.getMonthlyEarnings);

/**
 * @route   GET /api/v1/captains/earnings/history
 * @desc    Get detailed earnings history
 * @access  Private (Captain)
 * @query   { startDate, endDate, page, limit }
 */
router.get('/earnings/history', captainController.getEarningsHistory);

/**
 * @route   GET /api/v1/captains/earnings/breakdown
 * @desc    Get earnings breakdown (fares, tips, incentives)
 * @access  Private (Captain)
 * @query   { period: day | week | month }
 */
router.get('/earnings/breakdown', captainController.getEarningsBreakdown);

// ==========================================
// STATS ROUTES
// ==========================================

/**
 * @route   GET /api/v1/captains/stats
 * @desc    Get performance stats
 * @access  Private (Captain)
 */
router.get('/stats', captainController.getStats);

/**
 * @route   GET /api/v1/captains/stats/ratings
 * @desc    Get ratings breakdown
 * @access  Private (Captain)
 */
router.get('/stats/ratings', captainController.getRatingsStats);

/**
 * @route   GET /api/v1/captains/stats/rides
 * @desc    Get ride statistics
 * @access  Private (Captain)
 * @query   { period: day | week | month | year }
 */
router.get('/stats/rides', captainController.getRideStats);

/**
 * @route   GET /api/v1/captains/stats/acceptance-rate
 * @desc    Get acceptance rate details
 * @access  Private (Captain)
 */
router.get('/stats/acceptance-rate', captainController.getAcceptanceRate);

/**
 * @route   GET /api/v1/captains/stats/cancellation-rate
 * @desc    Get cancellation rate details
 * @access  Private (Captain)
 */
router.get('/stats/cancellation-rate', captainController.getCancellationRate);

// ==========================================
// RIDE REQUESTS ROUTES
// ==========================================

/**
 * @route   GET /api/v1/captains/ride-requests
 * @desc    Get nearby ride requests
 * @access  Private (Captain)
 */
router.get('/ride-requests', captainController.getNearbyRequests);

/**
 * @route   GET /api/v1/captains/ride-requests/history
 * @desc    Get ride request history (accepted/rejected)
 * @access  Private (Captain)
 * @query   { page, limit, status }
 */
router.get('/ride-requests/history', captainController.getRequestHistory);

/**
 * @route   GET /api/v1/captains/rides
 * @desc    Get captain's ride history
 * @access  Private (Captain)
 * @query   { page, limit, status }
 */
router.get('/rides', captainController.getRideHistory);

/**
 * @route   GET /api/v1/captains/rides/active
 * @desc    Get captain's active ride
 * @access  Private (Captain)
 */
router.get('/rides/active', captainController.getActiveRide);

/**
 * @route   GET /api/v1/captains/rides/:rideId
 * @desc    Get ride details
 * @access  Private (Captain)
 */
router.get('/rides/:rideId', captainController.getRideDetails);

// ==========================================
// BANK DETAILS ROUTES
// ==========================================

/**
 * @route   GET /api/v1/captains/bank-details
 * @desc    Get bank details
 * @access  Private (Captain)
 */
router.get('/bank-details', captainController.getBankDetails);

/**
 * @route   PUT /api/v1/captains/bank-details
 * @desc    Update bank details
 * @access  Private (Captain)
 * @body    { accountNumber, ifscCode, accountHolderName, bankName }
 */
router.put(
  '/bank-details',
  validateBankDetails,
  captainController.updateBankDetails
);

/**
 * @route   POST /api/v1/captains/bank-details/verify
 * @desc    Verify bank account
 * @access  Private (Captain)
 */
router.post('/bank-details/verify', captainController.verifyBankAccount);

// ==========================================
// WITHDRAWAL ROUTES
// ==========================================

/**
 * @route   GET /api/v1/captains/withdrawals
 * @desc    Get withdrawal history
 * @access  Private (Captain)
 * @query   { page, limit, status }
 */
router.get('/withdrawals', captainController.getWithdrawals);

/**
 * @route   POST /api/v1/captains/withdrawals
 * @desc    Request withdrawal
 * @access  Private (Captain)
 * @body    { amount }
 */
router.post('/withdrawals', captainController.requestWithdrawal);

/**
 * @route   GET /api/v1/captains/withdrawals/:withdrawalId
 * @desc    Get withdrawal details
 * @access  Private (Captain)
 */
router.get('/withdrawals/:withdrawalId', captainController.getWithdrawalDetails);

/**
 * @route   POST /api/v1/captains/withdrawals/:withdrawalId/cancel
 * @desc    Cancel pending withdrawal
 * @access  Private (Captain)
 */
router.post('/withdrawals/:withdrawalId/cancel', captainController.cancelWithdrawal);

// ==========================================
// INCENTIVES & BONUSES
// ==========================================

/**
 * @route   GET /api/v1/captains/incentives
 * @desc    Get available incentives
 * @access  Private (Captain)
 */
router.get('/incentives', captainController.getIncentives);

/**
 * @route   GET /api/v1/captains/incentives/active
 * @desc    Get active incentive challenges
 * @access  Private (Captain)
 */
router.get('/incentives/active', captainController.getActiveIncentives);

/**
 * @route   GET /api/v1/captains/incentives/progress
 * @desc    Get incentive progress
 * @access  Private (Captain)
 */
router.get('/incentives/progress', captainController.getIncentiveProgress);