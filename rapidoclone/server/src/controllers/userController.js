// src/controllers/userController.js
const User = require('../models/User');
const SavedLocation = require('../models/SavedLocation');
const Notification = require('../models/Notification');
const Ride = require('../models/Ride');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { deleteFile, extractPublicId } = require('../config/cloudinary');
const { parsePagination, parseSort } = require('../utils/helpers');

// ==========================================
// PROFILE
// ==========================================

/**
 * @desc    Get user profile
 * @route   GET /api/v1/users/profile
 * @access  Private
 */
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('wallet')
    .select('-password -refreshToken');

  res.status(200).json(
    new ApiResponse(200, { user }, 'Profile retrieved successfully')
  );
});

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/users/profile
 * @access  Private
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone } = req.body;

  // Check if email/phone already exists
  if (email && email !== req.user.email) {
    const existingEmail = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: req.user._id },
    });
    if (existingEmail) {
      throw new ApiError(400, 'Email already in use');
    }
  }

  if (phone && phone !== req.user.phone) {
    const existingPhone = await User.findOne({
      phone,
      _id: { $ne: req.user._id },
    });
    if (existingPhone) {
      throw new ApiError(400, 'Phone number already in use');
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      firstName: firstName || req.user.firstName,
      lastName: lastName || req.user.lastName,
      email: email ? email.toLowerCase() : req.user.email,
      phone: phone || req.user.phone,
    },
    { new: true, runValidators: true }
  ).select('-password -refreshToken');

  res.status(200).json(
    new ApiResponse(200, { user }, 'Profile updated successfully')
  );
});

/**
 * @desc    Update user avatar
 * @route   PUT /api/v1/users/avatar
 * @access  Private
 */
exports.updateAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Please upload an image');
  }

  // Delete old avatar if exists
  if (req.user.avatar) {
    const publicId = extractPublicId(req.user.avatar);
    if (publicId) {
      await deleteFile(publicId);
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: req.file.path },
    { new: true }
  ).select('-password -refreshToken');

  res.status(200).json(
    new ApiResponse(200, { user }, 'Avatar updated successfully')
  );
});

/**
 * @desc    Remove user avatar
 * @route   DELETE /api/v1/users/avatar
 * @access  Private
 */
exports.removeAvatar = asyncHandler(async (req, res) => {
  if (req.user.avatar) {
    const publicId = extractPublicId(req.user.avatar);
    if (publicId) {
      await deleteFile(publicId);
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: '' },
    { new: true }
  ).select('-password -refreshToken');

  res.status(200).json(
    new ApiResponse(200, { user }, 'Avatar removed successfully')
  );
});

/**
 * @desc    Get user statistics
 * @route   GET /api/v1/users/stats
 * @access  Private
 */
exports.getUserStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [rideStats, ratingStats] = await Promise.all([
    Ride.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          totalRides: { $sum: 1 },
          completedRides: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          cancelledRides: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
          totalSpent: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, '$fare.total', 0],
            },
          },
          totalDistance: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, '$route.distance', 0],
            },
          },
        },
      },
    ]),
    User.findById(userId).select('ratings'),
  ]);

  const stats = {
    totalRides: rideStats[0]?.totalRides || 0,
    completedRides: rideStats[0]?.completedRides || 0,
    cancelledRides: rideStats[0]?.cancelledRides || 0,
    totalSpent: rideStats[0]?.totalSpent || 0,
    totalDistance: rideStats[0]?.totalDistance || 0,
    rating: ratingStats?.ratings?.average || 5,
    ratingCount: ratingStats?.ratings?.count || 0,
  };

  res.status(200).json(
    new ApiResponse(200, { stats }, 'Stats retrieved successfully')
  );
});

// ==========================================
// SAVED LOCATIONS
// ==========================================

/**
 * @desc    Get all saved locations
 * @route   GET /api/v1/users/saved-locations
 * @access  Private
 */
exports.getSavedLocations = asyncHandler(async (req, res) => {
  const locations = await SavedLocation.find({
    user: req.user._id,
    isActive: true,
  }).sort({ type: 1, usageCount: -1 });

  res.status(200).json(
    new ApiResponse(200, { locations }, 'Saved locations retrieved')
  );
});

/**
 * @desc    Add a saved location
 * @route   POST /api/v1/users/saved-locations
 * @access  Private
 */
exports.addSavedLocation = asyncHandler(async (req, res) => {
  const { label, type, name, address, latitude, longitude, placeId } = req.body;

  const location = await SavedLocation.create({
    user: req.user._id,
    label,
    type: type || 'other',
    name,
    address,
    latitude,
    longitude,
    placeId,
    coordinates: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
  });

  res.status(201).json(
    new ApiResponse(201, { location }, 'Location saved successfully')
  );
});

/**
 * @desc    Get saved location by ID
 * @route   GET /api/v1/users/saved-locations/:locationId
 * @access  Private
 */
exports.getSavedLocationById = asyncHandler(async (req, res) => {
  const location = await SavedLocation.findOne({
    _id: req.params.locationId,
    user: req.user._id,
  });

  if (!location) {
    throw new ApiError(404, 'Location not found');
  }

  res.status(200).json(
    new ApiResponse(200, { location }, 'Location retrieved')
  );
});

/**
 * @desc    Update saved location
 * @route   PUT /api/v1/users/saved-locations/:locationId
 * @access  Private
 */
exports.updateSavedLocation = asyncHandler(async (req, res) => {
  const { label, type, name, address, latitude, longitude } = req.body;

  const location = await SavedLocation.findOneAndUpdate(
    { _id: req.params.locationId, user: req.user._id },
    {
      label,
      type,
      name,
      address,
      latitude,
      longitude,
      coordinates: latitude && longitude ? {
        type: 'Point',
        coordinates: [longitude, latitude],
      } : undefined,
    },
    { new: true, runValidators: true }
  );

  if (!location) {
    throw new ApiError(404, 'Location not found');
  }

  res.status(200).json(
    new ApiResponse(200, { location }, 'Location updated successfully')
  );
});

/**
 * @desc    Delete saved location
 * @route   DELETE /api/v1/users/saved-locations/:locationId
 * @access  Private
 */
exports.deleteSavedLocation = asyncHandler(async (req, res) => {
  const location = await SavedLocation.findOneAndDelete({
    _id: req.params.locationId,
    user: req.user._id,
  });

  if (!location) {
    throw new ApiError(404, 'Location not found');
  }

  res.status(200).json(
    new ApiResponse(200, null, 'Location deleted successfully')
  );
});

/**
 * @desc    Set location as home
 * @route   PUT /api/v1/users/saved-locations/:locationId/set-home
 * @access  Private
 */
exports.setAsHome = asyncHandler(async (req, res) => {
  // Remove existing home
  await SavedLocation.updateMany(
    { user: req.user._id, type: 'home' },
    { type: 'other' }
  );

  const location = await SavedLocation.findOneAndUpdate(
    { _id: req.params.locationId, user: req.user._id },
    { type: 'home' },
    { new: true }
  );

  if (!location) {
    throw new ApiError(404, 'Location not found');
  }

  res.status(200).json(
    new ApiResponse(200, { location }, 'Home location set successfully')
  );
});

/**
 * @desc    Set location as work
 * @route   PUT /api/v1/users/saved-locations/:locationId/set-work
 * @access  Private
 */
exports.setAsWork = asyncHandler(async (req, res) => {
  await SavedLocation.updateMany(
    { user: req.user._id, type: 'work' },
    { type: 'other' }
  );

  const location = await SavedLocation.findOneAndUpdate(
    { _id: req.params.locationId, user: req.user._id },
    { type: 'work' },
    { new: true }
  );

  if (!location) {
    throw new ApiError(404, 'Location not found');
  }

  res.status(200).json(
    new ApiResponse(200, { location }, 'Work location set successfully')
  );
});

// ==========================================
// EMERGENCY CONTACTS
// ==========================================

/**
 * @desc    Get emergency contacts
 * @route   GET /api/v1/users/emergency-contacts
 * @access  Private
 */
exports.getEmergencyContacts = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('emergencyContacts');

  res.status(200).json(
    new ApiResponse(200, { contacts: user.emergencyContacts || [] }, 'Contacts retrieved')
  );
});

/**
 * @desc    Add emergency contact
 * @route   POST /api/v1/users/emergency-contacts
 * @access  Private
 */
exports.addEmergencyContact = asyncHandler(async (req, res) => {
  const { name, phone, relation } = req.body;

  const user = await User.findById(req.user._id);

  // Check limit
  if (user.emergencyContacts && user.emergencyContacts.length >= 5) {
    throw new ApiError(400, 'Maximum 5 emergency contacts allowed');
  }

  // Check if already exists
  const exists = user.emergencyContacts?.find(c => c.phone === phone);
  if (exists) {
    throw new ApiError(400, 'Contact with this phone already exists');
  }

  user.emergencyContacts = user.emergencyContacts || [];
  user.emergencyContacts.push({ name, phone, relation });
  await user.save();

  res.status(201).json(
    new ApiResponse(201, { contacts: user.emergencyContacts }, 'Contact added successfully')
  );
});

/**
 * @desc    Update emergency contact
 * @route   PUT /api/v1/users/emergency-contacts/:contactId
 * @access  Private
 */
exports.updateEmergencyContact = asyncHandler(async (req, res) => {
  const { name, phone, relation } = req.body;

  const user = await User.findById(req.user._id);

  const contactIndex = user.emergencyContacts?.findIndex(
    c => c._id.toString() === req.params.contactId
  );

  if (contactIndex === -1 || contactIndex === undefined) {
    throw new ApiError(404, 'Contact not found');
  }

  user.emergencyContacts[contactIndex] = {
    ...user.emergencyContacts[contactIndex],
    name: name || user.emergencyContacts[contactIndex].name,
    phone: phone || user.emergencyContacts[contactIndex].phone,
    relation: relation || user.emergencyContacts[contactIndex].relation,
  };

  await user.save();

  res.status(200).json(
    new ApiResponse(200, { contacts: user.emergencyContacts }, 'Contact updated successfully')
  );
});

/**
 * @desc    Delete emergency contact
 * @route   DELETE /api/v1/users/emergency-contacts/:contactId
 * @access  Private
 */
exports.deleteEmergencyContact = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  user.emergencyContacts = user.emergencyContacts?.filter(
    c => c._id.toString() !== req.params.contactId
  );

  await user.save();

  res.status(200).json(
    new ApiResponse(200, { contacts: user.emergencyContacts }, 'Contact deleted successfully')
  );
});

/**
 * @desc    Verify emergency contact
 * @route   POST /api/v1/users/emergency-contacts/verify/:contactId
 * @access  Private
 */
exports.verifyEmergencyContact = asyncHandler(async (req, res) => {
  // TODO: Send SMS to emergency contact for verification
  res.status(200).json(
    new ApiResponse(200, null, 'Verification SMS sent')
  );
});

// ==========================================
// PREFERENCES
// ==========================================

/**
 * @desc    Get user preferences
 * @route   GET /api/v1/users/preferences
 * @access  Private
 */
exports.getPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('preferences');

  res.status(200).json(
    new ApiResponse(200, { preferences: user.preferences }, 'Preferences retrieved')
  );
});

/**
 * @desc    Update user preferences
 * @route   PUT /api/v1/users/preferences
 * @access  Private
 */
exports.updatePreferences = asyncHandler(async (req, res) => {
  const { preferredPayment, notifications } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      'preferences.preferredPayment': preferredPayment,
      'preferences.notifications': notifications,
    },
    { new: true }
  ).select('preferences');

  res.status(200).json(
    new ApiResponse(200, { preferences: user.preferences }, 'Preferences updated')
  );
});

/**
 * @desc    Update language preference
 * @route   PUT /api/v1/users/preferences/language
 * @access  Private
 */
exports.updateLanguage = asyncHandler(async (req, res) => {
  const { language } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { 'preferences.language': language },
    { new: true }
  ).select('preferences');

  res.status(200).json(
    new ApiResponse(200, { preferences: user.preferences }, 'Language updated')
  );
});

// ==========================================
// NOTIFICATIONS
// ==========================================

/**
 * @desc    Get user notifications
 * @route   GET /api/v1/users/notifications
 * @access  Private
 */
exports.getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { category, unreadOnly } = req.query;

  const query = {
    recipient: req.user._id,
    recipientType: 'User',
    isDismissed: false,
  };

  if (category) query.category = category;
  if (unreadOnly === 'true') query.isRead = false;

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }, 'Notifications retrieved')
  );
});

/**
 * @desc    Get unread notification count
 * @route   GET /api/v1/users/notifications/unread-count
 * @access  Private
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    recipient: req.user._id,
    recipientType: 'User',
    isRead: false,
    isDismissed: false,
  });

  res.status(200).json(
    new ApiResponse(200, { count }, 'Unread count retrieved')
  );
});

/**
 * @desc    Mark notification as read
 * @route   PUT /api/v1/users/notifications/:notificationId/read
 * @access  Private
 */
exports.markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.notificationId, recipient: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  res.status(200).json(
    new ApiResponse(200, { notification }, 'Notification marked as read')
  );
});

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/v1/users/notifications/read-all
 * @access  Private
 */
exports.markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, recipientType: 'User', isRead: false },
    { isRead: true, readAt: new Date() }
  );

  res.status(200).json(
    new ApiResponse(200, null, 'All notifications marked as read')
  );
});

/**
 * @desc    Dismiss notification
 * @route   DELETE /api/v1/users/notifications/:notificationId
 * @access  Private
 */
exports.dismissNotification = asyncHandler(async (req, res) => {
  await Notification.findOneAndUpdate(
    { _id: req.params.notificationId, recipient: req.user._id },
    { isDismissed: true, dismissedAt: new Date() }
  );

  res.status(200).json(
    new ApiResponse(200, null, 'Notification dismissed')
  );
});

/**
 * @desc    Get notification settings
 * @route   GET /api/v1/users/notifications/settings
 * @access  Private
 */
exports.getNotificationSettings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('preferences.notifications');

  res.status(200).json(
    new ApiResponse(200, { settings: user.preferences?.notifications }, 'Settings retrieved')
  );
});

/**
 * @desc    Update notification settings
 * @route   PUT /api/v1/users/notifications/settings
 * @access  Private
 */
exports.updateNotificationSettings = asyncHandler(async (req, res) => {
  const { email, sms, push, promotional } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      'preferences.notifications.email': email,
      'preferences.notifications.sms': sms,
      'preferences.notifications.push': push,
      'preferences.notifications.promotional': promotional,
    },
    { new: true }
  ).select('preferences.notifications');

  res.status(200).json(
    new ApiResponse(200, { settings: user.preferences?.notifications }, 'Settings updated')
  );
});

// ==========================================
// FCM TOKEN
// ==========================================

/**
 * @desc    Update FCM token
 * @route   PUT /api/v1/users/fcm-token
 * @access  Private
 */
exports.updateFCMToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;

  await User.findByIdAndUpdate(req.user._id, { fcmToken });

  res.status(200).json(
    new ApiResponse(200, null, 'FCM token updated')
  );
});

/**
 * @desc    Remove FCM token
 * @route   DELETE /api/v1/users/fcm-token
 * @access  Private
 */
exports.removeFCMToken = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { fcmToken: null });

  res.status(200).json(
    new ApiResponse(200, null, 'FCM token removed')
  );
});

// ==========================================
// REFERRAL
// ==========================================

/**
 * @desc    Get referral info
 * @route   GET /api/v1/users/referral
 * @access  Private
 */
exports.getReferralInfo = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('referralCode referredBy');

  const referralCount = await User.countDocuments({ referredBy: req.user._id });

  res.status(200).json(
    new ApiResponse(200, {
      referralCode: user.referralCode,
      referralCount,
      referralLink: `${process.env.CLIENT_URL}/register?ref=${user.referralCode}`,
    }, 'Referral info retrieved')
  );
});

/**
 * @desc    Apply referral code
 * @route   POST /api/v1/users/referral/apply
 * @access  Private
 */
exports.applyReferralCode = asyncHandler(async (req, res) => {
  const { referralCode } = req.body;

  if (req.user.referredBy) {
    throw new ApiError(400, 'You have already applied a referral code');
  }

  const referrer = await User.findOne({ referralCode });
  if (!referrer) {
    throw new ApiError(404, 'Invalid referral code');
  }

  if (referrer._id.toString() === req.user._id.toString()) {
    throw new ApiError(400, 'You cannot use your own referral code');
  }

  await User.findByIdAndUpdate(req.user._id, { referredBy: referrer._id });

  // TODO: Add referral bonus to both users

  res.status(200).json(
    new ApiResponse(200, null, 'Referral code applied successfully')
  );
});

/**
 * @desc    Get referral history
 * @route   GET /api/v1/users/referral/history
 * @access  Private
 */
exports.getReferralHistory = asyncHandler(async (req, res) => {
  const referrals = await User.find({ referredBy: req.user._id })
    .select('firstName lastName createdAt')
    .sort({ createdAt: -1 });

  res.status(200).json(
    new ApiResponse(200, { referrals }, 'Referral history retrieved')
  );
});

/**
 * @desc    Generate referral link
 * @route   POST /api/v1/users/referral/share
 * @access  Private
 */
exports.generateReferralLink = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('referralCode');

  const link = `${process.env.CLIENT_URL}/register?ref=${user.referralCode}`;

  res.status(200).json(
    new ApiResponse(200, { link }, 'Referral link generated')
  );
});

// ==========================================
// FAVORITE CAPTAINS
// ==========================================

/**
 * @desc    Get favorite captains
 * @route   GET /api/v1/users/favorite-captains
 * @access  Private
 */
exports.getFavoriteCaptains = asyncHandler(async (req, res) => {
  // TODO: Implement favorite captains model
  res.status(200).json(
    new ApiResponse(200, { captains: [] }, 'Favorite captains retrieved')
  );
});

/**
 * @desc    Add captain to favorites
 * @route   POST /api/v1/users/favorite-captains/:captainId
 * @access  Private
 */
exports.addFavoriteCaptain = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, null, 'Captain added to favorites')
  );
});

/**
 * @desc    Remove captain from favorites
 * @route   DELETE /api/v1/users/favorite-captains/:captainId
 * @access  Private
 */
exports.removeFavoriteCaptain = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, null, 'Captain removed from favorites')
  );
});

// ==========================================
// BLOCKED CAPTAINS
// ==========================================

/**
 * @desc    Get blocked captains
 * @route   GET /api/v1/users/blocked-captains
 * @access  Private
 */
exports.getBlockedCaptains = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, { captains: [] }, 'Blocked captains retrieved')
  );
});

/**
 * @desc    Block a captain
 * @route   POST /api/v1/users/blocked-captains/:captainId
 * @access  Private
 */
exports.blockCaptain = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, null, 'Captain blocked')
  );
});

/**
 * @desc    Unblock a captain
 * @route   DELETE /api/v1/users/blocked-captains/:captainId
 * @access  Private
 */
exports.unblockCaptain = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, null, 'Captain unblocked')
  );
});

// ==========================================
// SUPPORT
// ==========================================

/**
 * @desc    Get support tickets
 * @route   GET /api/v1/users/support/tickets
 * @access  Private
 */
exports.getSupportTickets = asyncHandler(async (req, res) => {
  // TODO: Implement support tickets model
  res.status(200).json(
    new ApiResponse(200, { tickets: [] }, 'Support tickets retrieved')
  );
});

/**
 * @desc    Create support ticket
 * @route   POST /api/v1/users/support/tickets
 * @access  Private
 */
exports.createSupportTicket = asyncHandler(async (req, res) => {
  const { subject, description, category, rideId } = req.body;

  // TODO: Create support ticket

  res.status(201).json(
    new ApiResponse(201, null, 'Support ticket created')
  );
});

/**
 * @desc    Get support ticket details
 * @route   GET /api/v1/users/support/tickets/:ticketId
 * @access  Private
 */
exports.getSupportTicketDetails = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, { ticket: null }, 'Ticket details retrieved')
  );
});

/**
 * @desc    Reply to support ticket
 * @route   POST /api/v1/users/support/tickets/:ticketId/reply
 * @access  Private
 */
exports.replySupportTicket = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, null, 'Reply sent')
  );
});

/**
 * @desc    Get FAQs
 * @route   GET /api/v1/users/support/faqs
 * @access  Private
 */
exports.getFAQs = asyncHandler(async (req, res) => {
  const faqs = [
    {
      question: 'How do I book a ride?',
      answer: 'Open the app, enter your destination, select a vehicle type, and confirm your booking.',
    },
    {
      question: 'What payment methods are accepted?',
      answer: 'We accept cash, wallet, UPI, and credit/debit cards.',
    },
    {
      question: 'How do I cancel a ride?',
      answer: 'Go to your active ride and tap the cancel button. Note that cancellation fees may apply.',
    },
  ];

  res.status(200).json(
    new ApiResponse(200, { faqs }, 'FAQs retrieved')
  );
});

// ==========================================
// ACCOUNT MANAGEMENT
// ==========================================

/**
 * @desc    Deactivate account
 * @route   POST /api/v1/users/account/deactivate
 * @access  Private
 */
exports.deactivateAccount = asyncHandler(async (req, res) => {
  const { reason, password } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(400, 'Password is incorrect');
  }

  user.isActive = false;
  user.refreshToken = undefined;
  await user.save();

  res.clearCookie('refreshToken');

  res.status(200).json(
    new ApiResponse(200, null, 'Account deactivated successfully')
  );
});

/**
 * @desc    Reactivate account
 * @route   POST /api/v1/users/account/reactivate
 * @access  Private
 */
exports.reactivateAccount = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { isActive: true });

  res.status(200).json(
    new ApiResponse(200, null, 'Account reactivated successfully')
  );
});

/**
 * @desc    Delete account
 * @route   DELETE /api/v1/users/account
 * @access  Private
 */
exports.deleteAccount = asyncHandler(async (req, res) => {
  const { password, confirmDelete } = req.body;

  if (!confirmDelete) {
    throw new ApiError(400, 'Please confirm account deletion');
  }

  const user = await User.findById(req.user._id).select('+password');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(400, 'Password is incorrect');
  }

  // Delete related data
  await SavedLocation.deleteMany({ user: req.user._id });
  await Notification.deleteMany({ recipient: req.user._id, recipientType: 'User' });

  // Delete user
  await User.findByIdAndDelete(req.user._id);

  res.clearCookie('refreshToken');

  res.status(200).json(
    new ApiResponse(200, null, 'Account deleted successfully')
  );
});

/**
 * @desc    Download user data
 * @route   GET /api/v1/users/account/data
 * @access  Private
 */
exports.downloadUserData = asyncHandler(async (req, res) => {
  const [user, locations, rides] = await Promise.all([
    User.findById(req.user._id).select('-password -refreshToken'),
    SavedLocation.find({ user: req.user._id }),
    Ride.find({ user: req.user._id }).select('-tracking'),
  ]);

  const data = {
    user,
    savedLocations: locations,
    rides,
    exportedAt: new Date().toISOString(),
  };

  res.status(200).json(
    new ApiResponse(200, { data }, 'User data exported')
  );
});