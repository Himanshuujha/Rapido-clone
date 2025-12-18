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

router.use(protectCaptain);

router.get('/profile', captainController.getProfile);

router.put(
  '/profile',
  validateUpdateProfile,
  captainController.updateProfile
);

router.put(
  '/avatar',
  uploadAvatar.single('avatar'),
  captainController.updateAvatar
);

router.delete('/avatar', captainController.removeAvatar);

router.get('/documents', captainController.getDocuments);

router.get('/documents/status', captainController.getDocumentStatus);

router.post(
  '/documents/:documentType',
  uploadDocument.single('document'),
  validateDocument,
  captainController.uploadDocument
);

router.put(
  '/documents/:documentType',
  uploadDocument.single('document'),
  validateDocument,
  captainController.updateDocument
);

router.delete('/documents/:documentType', captainController.deleteDocument);

router.get('/vehicle', captainController.getVehicle);

router.put(
  '/vehicle',
  validateVehicle,
  captainController.updateVehicle
);

router.post(
  '/vehicle/images',
  uploadVehicleImage.array('images', 5),
  captainController.uploadVehicleImages
);

router.delete('/vehicle/images/:imageType', captainController.deleteVehicleImage);

router.get('/status', captainController.getStatus);

router.put('/status', captainController.toggleStatus);

router.put('/go-online', captainController.goOnline);

router.put('/go-offline', captainController.goOffline);

router.get('/approval-status', captainController.getApprovalStatus);

router.put('/location', captainController.updateLocation);

router.get('/location/history', captainController.getLocationHistory);

router.get('/earnings', captainController.getEarnings);

router.get('/earnings/today', captainController.getTodayEarnings);

router.get('/earnings/week', captainController.getWeeklyEarnings);

router.get('/earnings/month', captainController.getMonthlyEarnings);

router.get('/earnings/history', captainController.getEarningsHistory);

router.get('/earnings/breakdown', captainController.getEarningsBreakdown);

router.get('/stats', captainController.getStats);

router.get('/stats/ratings', captainController.getRatingsStats);

router.get('/stats/rides', captainController.getRideStats);

router.get('/stats/acceptance-rate', captainController.getAcceptanceRate);

router.get('/stats/cancellation-rate', captainController.getCancellationRate);

router.get('/ride-requests', captainController.getNearbyRequests);

router.get('/ride-requests/history', captainController.getRequestHistory);

router.get('/rides', captainController.getRideHistory);

router.get('/rides/active', captainController.getActiveRide);

router.get('/rides/:rideId', captainController.getRideDetails);

router.get('/bank-details', captainController.getBankDetails);

router.put(
  '/bank-details',
  validateBankDetails,
  captainController.updateBankDetails
);

router.post('/bank-details/verify', captainController.verifyBankAccount);

router.get('/withdrawals', captainController.getWithdrawals);

router.post('/withdrawals', captainController.requestWithdrawal);

router.get('/withdrawals/:withdrawalId', captainController.getWithdrawalDetails);

router.post('/withdrawals/:withdrawalId/cancel', captainController.cancelWithdrawal);

router.get('/incentives', captainController.getIncentives);

router.get('/incentives/active', captainController.getActiveIncentives);

router.get('/incentives/progress', captainController.getIncentiveProgress);

module.exports = router;
