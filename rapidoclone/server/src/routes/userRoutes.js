// src/routes/userRoutes.js
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

// All routes require authentication
router.use(protect);

// ==========================================
// PROFILE ROUTES
// ==========================================

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', userController.getProfile);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 * @body    { firstName, lastName, email, phone }
 */
router.put(
  '/profile',
  validateUpdateProfile,
  userController.updateProfile
);

/**
 * @route   PUT /api/v1/users/avatar
 * @desc    Update user avatar
 * @access  Private
 * @file    avatar (image)
 */
router.put(
  '/avatar',
  uploadAvatar.single('avatar'),
  userController.updateAvatar
);

/**
 * @route   DELETE /api/v1/users/avatar
 * @desc    Remove user avatar
 * @access  Private
 */
router.delete('/avatar', userController.removeAvatar);

/**
 * @route   GET /api/v1/users/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats', userController.getUserStats);

// ==========================================
// SAVED LOCATIONS
// ==========================================

/**
 * @route   GET /api/v1/users/saved-locations
 * @desc    Get all saved locations
 * @access  Private
 */
router.get('/saved-locations', userController.getSavedLocations);

/**
 * @route   POST /api/v1/users/saved-locations
 * @desc    Add a saved location
 * @access  Private
 * @body    { label, type, name, address, latitude, longitude }
 */
router.post(
  '/saved-locations',
  validateSavedLocation,
  userController.addSavedLocation
);

/**
 * @route   GET /api/v1/users/saved-locations/:locationId
 * @desc    Get a saved location by ID
 * @access  Private
 */
router.get('/saved-locations/:locationId', userController.getSavedLocationById);

/**
 * @route   PUT /api/v1/users/saved-locations/:locationId
 * @desc    Update a saved location
 * @access  Private
 * @body    { label, type, name, address, latitude, longitude }
 */
router.put(
  '/saved-locations/:locationId',
  validateSavedLocation,
  userController.updateSavedLocation
);

/**
 * @route   DELETE /api/v1/users/saved-locations/:locationId
 * @desc    Delete a saved location
 * @access  Private
 */
router.delete('/saved-locations/:locationId', userController.deleteSavedLocation);

/**
 * @route   PUT /api/v1/users/saved-locations/:locationId/set-home
 * @desc    Set location as home
 * @access  Private
 */
router.put('/saved-locations/:locationId/set-home', userController.setAsHome);

/**
 * @route   PUT /api/v1/users/saved-locations/:locationId/set-work
 * @desc    Set location as work
 * @access  Private
 */
router.put('/saved-locations/:locationId/set-work', userController.setAsWork);

// ==========================================
// EMERGENCY CONTACTS
// ==========================================

/**
 * @route   GET /api/v1/users/emergency-contacts
 * @desc    Get all emergency contacts
 * @access  Private
 */
router.get('/emergency-contacts', userController.getEmergencyContacts);

/**
 * @route   POST /api/v1/users/emergency-contacts
 * @desc    Add an emergency contact
 * @access  Private
 * @body    { name, phone, relation }
 */
router.post(
  '/emergency-contacts',
  validateEmergencyContact,
  userController.addEmergencyContact
);

/**
 * @route   PUT /api/v1/users/emergency-contacts/:contactId
 * @desc    Update an emergency contact
 * @access  Private
 * @body    { name, phone, relation }
 */
router.put(
  '/emergency-contacts/:contactId',
  validateEmergencyContact,
  userController.updateEmergencyContact
);

/**
 * @route   DELETE /api/v1/users/emergency-contacts/:contactId
 * @desc    Delete an emergency contact
 * @access  Private
 */
router.delete('/emergency-contacts/:contactId', userController.deleteEmergencyContact);

/**
 * @route   POST /api/v1/users/emergency-contacts/verify/:contactId
 * @desc    Send verification to emergency contact
 * @access  Private
 */
router.post('/emergency-contacts/verify/:contactId', userController.verifyEmergencyContact);

// ==========================================
// PREFERENCES
// ==========================================

/**
 * @route   GET /api/v1/users/preferences
 * @desc    Get user preferences
 * @access  Private
 */
router.get('/preferences', userController.getPreferences);

/**
 * @route   PUT /api/v1/users/preferences
 * @desc    Update user preferences
 * @access  Private
 * @body    { preferredPayment, notifications: { email, sms, push } }
 */
router.put(
  '/preferences',
  validatePreferences,
  userController.updatePreferences
);

/**
 * @route   PUT /api/v1/users/preferences/language
 * @desc    Update language preference
 * @access  Private
 * @body    { language }
 */
router.put('/preferences/language', userController.updateLanguage);

// ==========================================
// NOTIFICATIONS
// ==========================================

/**
 * @route   GET /api/v1/users/notifications
 * @desc    Get user notifications
 * @access  Private
 * @query   { page, limit, category, unreadOnly }
 */
router.get('/notifications', userController.getNotifications);

/**
 * @route   GET /api/v1/users/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/notifications/unread-count', userController.getUnreadCount);

/**
 * @route   PUT /api/v1/users/notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/notifications/:notificationId/read', userController.markNotificationRead);

/**
 * @route   PUT /api/v1/users/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/notifications/read-all', userController.markAllNotificationsRead);

/**
 * @route   DELETE /api/v1/users/notifications/:notificationId
 * @desc    Delete/dismiss a notification
 * @access  Private
 */
router.delete('/notifications/:notificationId', userController.dismissNotification);

/**
 * @route   GET /api/v1/users/notifications/settings
 * @desc    Get notification settings
 * @access  Private
 */
router.get('/notifications/settings', userController.getNotificationSettings);

/**
 * @route   PUT /api/v1/users/notifications/settings
 * @desc    Update notification settings
 * @access  Private
 * @body    { email, sms, push, promotional }
 */
router.put('/notifications/settings', userController.updateNotificationSettings);

// ==========================================
// FCM TOKEN (Push Notifications)
// ==========================================

/**
 * @route   PUT /api/v1/users/fcm-token
 * @desc    Update FCM token for push notifications
 * @access  Private
 * @body    { fcmToken }
 */
router.put('/fcm-token', userController.updateFCMToken);

/**
 * @route   DELETE /api/v1/users/fcm-token
 * @desc    Remove FCM token
 * @access  Private
 */
router.delete('/fcm-token', userController.removeFCMToken);

// ==========================================
// REFERRAL
// ==========================================

/**
 * @route   GET /api/v1/users/referral
 * @desc    Get referral info and code
 * @access  Private
 */
router.get('/referral', userController.getReferralInfo);

/**
 * @route   POST /api/v1/users/referral/apply
 * @desc    Apply a referral code
 * @access  Private
 * @body    { referralCode }
 */
router.post('/referral/apply', userController.applyReferralCode);

/**
 * @route   GET /api/v1/users/referral/history
 * @desc    Get referral history
 * @access  Private
 */
router.get('/referral/history', userController.getReferralHistory);

/**
 * @route   POST /api/v1/users/referral/share
 * @desc    Generate shareable referral link
 * @access  Private
 */
router.post('/referral/share', userController.generateReferralLink);

// ==========================================
// FAVORITE CAPTAINS
// ==========================================

/**
 * @route   GET /api/v1/users/favorite-captains
 * @desc    Get favorite captains
 * @access  Private
 */
router.get('/favorite-captains', userController.getFavoriteCaptains);

/**
 * @route   POST /api/v1/users/favorite-captains/:captainId
 * @desc    Add captain to favorites
 * @access  Private
 */
router.post('/favorite-captains/:captainId', userController.addFavoriteCaptain);

/**
 * @route   DELETE /api/v1/users/favorite-captains/:captainId
 * @desc    Remove captain from favorites
 * @access  Private
 */
router.delete('/favorite-captains/:captainId', userController.removeFavoriteCaptain);

// ==========================================
// BLOCKED CAPTAINS
// ==========================================

/**
 * @route   GET /api/v1/users/blocked-captains
 * @desc    Get blocked captains
 * @access  Private
 */
router.get('/blocked-captains', userController.getBlockedCaptains);

/**
 * @route   POST /api/v1/users/blocked-captains/:captainId
 * @desc    Block a captain
 * @access  Private
 * @body    { reason }
 */
router.post('/blocked-captains/:captainId', userController.blockCaptain);

/**
 * @route   DELETE /api/v1/users/blocked-captains/:captainId
 * @desc    Unblock a captain
 * @access  Private
 */
router.delete('/blocked-captains/:captainId', userController.unblockCaptain);

// ==========================================
// SUPPORT
// ==========================================

/**
 * @route   GET /api/v1/users/support/tickets
 * @desc    Get user's support tickets
 * @access  Private
 */
router.get('/support/tickets', userController.getSupportTickets);

/**
 * @route   POST /api/v1/users/support/tickets
 * @desc    Create a support ticket
 * @access  Private
 * @body    { subject, description, category, rideId? }
 */
router.post('/support/tickets', userController.createSupportTicket);

/**
 * @route   GET /api/v1/users/support/tickets/:ticketId
 * @desc    Get support ticket details
 * @access  Private
 */
router.get('/support/tickets/:ticketId', userController.getSupportTicketDetails);

/**
 * @route   POST /api/v1/users/support/tickets/:ticketId/reply
 * @desc    Reply to a support ticket
 * @access  Private
 * @body    { message }
 */
router.post('/support/tickets/:ticketId/reply', userController.replySupportTicket);

/**
 * @route   GET /api/v1/users/support/faqs
 * @desc    Get FAQs
 * @access  Private
 */
router.get('/support/faqs', userController.getFAQs);

// ==========================================
// ACCOUNT MANAGEMENT
// ==========================================

/**
 * @route   POST /api/v1/users/account/deactivate
 * @desc    Deactivate user account
 * @access  Private
 * @body    { reason, password }
 */
router.post('/account/deactivate', userController.deactivateAccount);

/**
 * @route   POST /api/v1/users/account/reactivate
 * @desc    Reactivate user account
 * @access  Private
 * @body    { password }
 */
router.post('/account/reactivate', userController.reactivateAccount);

/**
 * @route   DELETE /api/v1/users/account
 * @desc    Permanently delete user account
 * @access  Private
 * @body    { password, confirmDelete: true }
 */
router.delete('/account', userController.deleteAccount);

/**
 * @route   GET /api/v1/users/account/data
 * @desc    Download user data (GDPR compliance)
 * @access  Private
 */
router.get('/account/data', userController.downloadUserData);

module.exports = router;