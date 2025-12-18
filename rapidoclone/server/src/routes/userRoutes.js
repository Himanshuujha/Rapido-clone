const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middlewares/auth');
const { uploadAvatar } = require('../config/cloudinary');
const {
  validateUpdateProfile,
  validateSavedLocation,
  validateEmergencyContact,
  validatePreferences,
} = require('../validators/userValidator');

router.use(protect);

router.get('/profile', userController.getProfile);

router.put(
  '/profile',
  validateUpdateProfile,
  userController.updateProfile
);

router.put(
  '/avatar',
  uploadAvatar.single('avatar'),
  userController.updateAvatar
);

router.delete('/avatar', userController.removeAvatar);

router.get('/stats', userController.getUserStats);

router.get('/saved-locations', userController.getSavedLocations);

router.post(
  '/saved-locations',
  validateSavedLocation,
  userController.addSavedLocation
);

router.get('/saved-locations/:locationId', userController.getSavedLocationById);

router.put(
  '/saved-locations/:locationId',
  validateSavedLocation,
  userController.updateSavedLocation
);

router.delete('/saved-locations/:locationId', userController.deleteSavedLocation);

router.put('/saved-locations/:locationId/set-home', userController.setAsHome);

router.put('/saved-locations/:locationId/set-work', userController.setAsWork);

router.get('/emergency-contacts', userController.getEmergencyContacts);

router.post(
  '/emergency-contacts',
  validateEmergencyContact,
  userController.addEmergencyContact
);

router.put(
  '/emergency-contacts/:contactId',
  validateEmergencyContact,
  userController.updateEmergencyContact
);

router.delete('/emergency-contacts/:contactId', userController.deleteEmergencyContact);

router.post('/emergency-contacts/verify/:contactId', userController.verifyEmergencyContact);

router.get('/preferences', userController.getPreferences);

router.put(
  '/preferences',
  validatePreferences,
  userController.updatePreferences
);

router.put('/preferences/language', userController.updateLanguage);

router.get('/notifications', userController.getNotifications);

router.get('/notifications/unread-count', userController.getUnreadCount);

router.put('/notifications/:notificationId/read', userController.markNotificationRead);

router.put('/notifications/read-all', userController.markAllNotificationsRead);

router.delete('/notifications/:notificationId', userController.dismissNotification);

router.get('/notifications/settings', userController.getNotificationSettings);

router.put('/notifications/settings', userController.updateNotificationSettings);

router.put('/fcm-token', userController.updateFCMToken);

router.delete('/fcm-token', userController.removeFCMToken);

router.get('/referral', userController.getReferralInfo);

router.post('/referral/apply', userController.applyReferralCode);

router.get('/referral/history', userController.getReferralHistory);

router.post('/referral/share', userController.generateReferralLink);

router.get('/favorite-captains', userController.getFavoriteCaptains);

router.post('/favorite-captains/:captainId', userController.addFavoriteCaptain);

router.delete('/favorite-captains/:captainId', userController.removeFavoriteCaptain);

router.get('/blocked-captains', userController.getBlockedCaptains);

router.post('/blocked-captains/:captainId', userController.blockCaptain);

router.delete('/blocked-captains/:captainId', userController.unblockCaptain);

router.get('/support/tickets', userController.getSupportTickets);

router.post('/support/tickets', userController.createSupportTicket);

router.get('/support/tickets/:ticketId', userController.getSupportTicketDetails);

router.post('/support/tickets/:ticketId/reply', userController.replySupportTicket);

router.get('/support/faqs', userController.getFAQs);

router.post('/account/deactivate', userController.deactivateAccount);

router.post('/account/reactivate', userController.reactivateAccount);

router.delete('/account', userController.deleteAccount);

router.get('/account/data', userController.downloadUserData);

module.exports = router;
