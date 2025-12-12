// src/controllers/notificationController.js
const Notification = require('../models/Notification');
const User = require('../models/User');
const Captain = require('../models/Captain');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { emitToUser, emitToCaptain } = require('../services/socketService');
const { sendPushNotification } = require('../services/pushService');
const { sendEmail } = require('../services/emailService');
const { sendSMS } = require('../services/smsService');
const logger = require('../utils/logger');

// ==========================================
// NOTIFICATION TEMPLATES
// ==========================================

const NOTIFICATION_TEMPLATES = {
  // Ride related
  ride_request: {
    title: 'New Ride Request',
    message: 'You have a new ride request from {{pickup}} to {{drop}}',
    category: 'ride',
    priority: 'high',
    icon: 'car',
    color: '#4CAF50',
  },
  ride_accepted: {
    title: 'Ride Accepted',
    message: '{{captainName}} has accepted your ride. Captain is on the way!',
    category: 'ride',
    priority: 'high',
    icon: 'check-circle',
    color: '#4CAF50',
  },
  ride_cancelled: {
    title: 'Ride Cancelled',
    message: 'Your ride has been cancelled. {{reason}}',
    category: 'ride',
    priority: 'high',
    icon: 'x-circle',
    color: '#F44336',
  },
  captain_arriving: {
    title: 'Captain is Arriving',
    message: '{{captainName}} will arrive in {{eta}} minutes',
    category: 'ride',
    priority: 'medium',
    icon: 'navigation',
    color: '#2196F3',
  },
  captain_arrived: {
    title: 'Captain has Arrived',
    message: '{{captainName}} has arrived at your pickup location',
    category: 'ride',
    priority: 'urgent',
    icon: 'map-pin',
    color: '#4CAF50',
  },
  ride_started: {
    title: 'Ride Started',
    message: 'Your ride to {{drop}} has started. Enjoy your trip!',
    category: 'ride',
    priority: 'medium',
    icon: 'play-circle',
    color: '#2196F3',
  },
  ride_completed: {
    title: 'Ride Completed',
    message: 'You have arrived at your destination. Fare: ₹{{fare}}',
    category: 'ride',
    priority: 'high',
    icon: 'flag',
    color: '#4CAF50',
  },
  ride_scheduled_reminder: {
    title: 'Scheduled Ride Reminder',
    message: 'Your scheduled ride is in {{time}}. Be ready!',
    category: 'ride',
    priority: 'high',
    icon: 'clock',
    color: '#FF9800',
  },

  // Payment related
  payment_successful: {
    title: 'Payment Successful',
    message: 'Payment of ₹{{amount}} was successful',
    category: 'payment',
    priority: 'medium',
    icon: 'credit-card',
    color: '#4CAF50',
  },
  payment_failed: {
    title: 'Payment Failed',
    message: 'Payment of ₹{{amount}} failed. Please try again.',
    category: 'payment',
    priority: 'high',
    icon: 'alert-circle',
    color: '#F44336',
  },
  wallet_credited: {
    title: 'Wallet Credited',
    message: '₹{{amount}} has been added to your wallet. New balance: ₹{{balance}}',
    category: 'payment',
    priority: 'medium',
    icon: 'plus-circle',
    color: '#4CAF50',
  },
  wallet_debited: {
    title: 'Wallet Debited',
    message: '₹{{amount}} has been deducted from your wallet. New balance: ₹{{balance}}',
    category: 'payment',
    priority: 'medium',
    icon: 'minus-circle',
    color: '#FF9800',
  },
  withdrawal_processed: {
    title: 'Withdrawal Processed',
    message: '₹{{amount}} has been transferred to your bank account',
    category: 'payment',
    priority: 'high',
    icon: 'bank',
    color: '#4CAF50',
  },
  refund_processed: {
    title: 'Refund Processed',
    message: '₹{{amount}} has been refunded to your account',
    category: 'payment',
    priority: 'medium',
    icon: 'rotate-ccw',
    color: '#4CAF50',
  },

  // Promotional
  promo_offer: {
    title: 'Special Offer!',
    message: '{{message}}',
    category: 'promotion',
    priority: 'low',
    icon: 'gift',
    color: '#9C27B0',
  },
  discount_coupon: {
    title: 'New Coupon Available',
    message: 'Use code {{code}} to get {{discount}} off!',
    category: 'promotion',
    priority: 'low',
    icon: 'tag',
    color: '#E91E63',
  },
  referral_bonus: {
    title: 'Referral Bonus!',
    message: 'You earned ₹{{amount}} for referring {{name}}',
    category: 'promotion',
    priority: 'medium',
    icon: 'users',
    color: '#4CAF50',
  },
  cashback: {
    title: 'Cashback Received!',
    message: 'You received ₹{{amount}} cashback',
    category: 'promotion',
    priority: 'medium',
    icon: 'percent',
    color: '#4CAF50',
  },

  // Account related
  account_verified: {
    title: 'Account Verified',
    message: 'Your account has been verified successfully',
    category: 'account',
    priority: 'medium',
    icon: 'shield-check',
    color: '#4CAF50',
  },
  document_approved: {
    title: 'Document Approved',
    message: 'Your {{documentType}} has been approved',
    category: 'account',
    priority: 'medium',
    icon: 'file-check',
    color: '#4CAF50',
  },
  document_rejected: {
    title: 'Document Rejected',
    message: 'Your {{documentType}} was rejected. Reason: {{reason}}',
    category: 'account',
    priority: 'high',
    icon: 'file-x',
    color: '#F44336',
  },
  account_suspended: {
    title: 'Account Suspended',
    message: 'Your account has been suspended. Contact support for help.',
    category: 'account',
    priority: 'urgent',
    icon: 'alert-triangle',
    color: '#F44336',
  },
  password_changed: {
    title: 'Password Changed',
    message: 'Your password was changed successfully',
    category: 'account',
    priority: 'high',
    icon: 'lock',
    color: '#2196F3',
  },

  // Rating
  new_rating: {
    title: 'New Rating Received',
    message: 'You received a {{rating}}-star rating',
    category: 'rating',
    priority: 'low',
    icon: 'star',
    color: '#FFC107',
  },
  rating_reminder: {
    title: 'Rate Your Ride',
    message: 'How was your ride with {{name}}? Rate now!',
    category: 'rating',
    priority: 'low',
    icon: 'star',
    color: '#FFC107',
  },

  // System
  app_update: {
    title: 'App Update Available',
    message: 'A new version of the app is available. Update now!',
    category: 'system',
    priority: 'medium',
    icon: 'download',
    color: '#2196F3',
  },
  maintenance: {
    title: 'Scheduled Maintenance',
    message: 'App will be under maintenance on {{date}} from {{time}}',
    category: 'system',
    priority: 'high',
    icon: 'tool',
    color: '#FF9800',
  },
  policy_update: {
    title: 'Policy Update',
    message: 'Our terms and policies have been updated. Please review.',
    category: 'system',
    priority: 'medium',
    icon: 'file-text',
    color: '#607D8B',
  },
  general: {
    title: '{{title}}',
    message: '{{message}}',
    category: 'system',
    priority: 'low',
    icon: 'bell',
    color: '#607D8B',
  },

  // Captain specific
  high_demand_area: {
    title: 'High Demand Area!',
    message: 'High demand in {{area}}. Head there for more rides!',
    category: 'system',
    priority: 'medium',
    icon: 'trending-up',
    color: '#FF5722',
  },
  earnings_summary: {
    title: "Today's Earnings",
    message: 'You earned ₹{{amount}} from {{rides}} rides today!',
    category: 'payment',
    priority: 'low',
    icon: 'dollar-sign',
    color: '#4CAF50',
  },
  incentive_earned: {
    title: 'Incentive Earned!',
    message: 'You earned ₹{{amount}} bonus for {{reason}}',
    category: 'payment',
    priority: 'medium',
    icon: 'award',
    color: '#4CAF50',
  },
  streak_bonus: {
    title: 'Streak Bonus!',
    message: 'Congratulations! You completed {{count}} rides streak. Bonus: ₹{{amount}}',
    category: 'payment',
    priority: 'medium',
    icon: 'zap',
    color: '#FF9800',
  },
  new_zone_available: {
    title: 'New Zone Available',
    message: '{{zone}} is now available for rides!',
    category: 'system',
    priority: 'low',
    icon: 'map',
    color: '#2196F3',
  },

  // Safety
  sos_alert: {
    title: 'SOS Alert!',
    message: 'Emergency alert from {{name}}. Location shared.',
    category: 'safety',
    priority: 'urgent',
    icon: 'alert-octagon',
    color: '#F44336',
  },
  safety_tip: {
    title: 'Safety Tip',
    message: '{{tip}}',
    category: 'safety',
    priority: 'low',
    icon: 'shield',
    color: '#2196F3',
  },
  emergency_contact_notified: {
    title: 'Emergency Contact Notified',
    message: 'Your emergency contacts have been notified',
    category: 'safety',
    priority: 'urgent',
    icon: 'phone',
    color: '#F44336',
  },
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get recipient info from request
 */
function getRecipientInfo(req) {
  if (req.user) {
    return { recipientId: req.user._id, recipientType: 'User' };
  } else if (req.captain) {
    return { recipientId: req.captain._id, recipientType: 'Captain' };
  }
  throw new AppError('Unauthorized', 401);
}

/**
 * Replace template placeholders with actual values
 */
function parseTemplate(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

/**
 * Build notification from template
 */
function buildNotificationFromTemplate(type, templateData = {}) {
  const template = NOTIFICATION_TEMPLATES[type];
  if (!template) {
    throw new AppError(`Unknown notification type: ${type}`, 400);
  }

  return {
    type,
    category: template.category,
    priority: template.priority,
    title: parseTemplate(template.title, templateData),
    message: parseTemplate(template.message, templateData),
    shortMessage: parseTemplate(template.message, templateData).substring(0, 100),
    icon: template.icon,
    color: template.color,
  };
}

/**
 * Send notification through all enabled channels
 */
async function sendNotificationChannels(notification, recipient) {
  const results = {
    push: { sent: false },
    email: { sent: false },
    sms: { sent: false },
  };

  // Push notification
  if (notification.channels.push && recipient.fcmToken) {
    try {
      await sendPushNotification({
        token: recipient.fcmToken,
        title: notification.title,
        body: notification.shortMessage || notification.message,
        data: {
          notificationId: notification._id.toString(),
          type: notification.type,
          action: notification.action,
        },
        icon: notification.icon,
        color: notification.color,
        image: notification.image,
      });

      results.push = {
        sent: true,
        sentAt: new Date(),
      };
    } catch (error) {
      logger.error('Push notification failed:', error);
      results.push = {
        sent: false,
        error: error.message,
      };
    }
  }

  // Email notification
  if (notification.channels.email && recipient.email) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: notification.title,
        html: notification.richContent || `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: ${notification.color};">${notification.title}</h2>
            <p>${notification.message}</p>
            ${notification.image ? `<img src="${notification.image}" alt="" style="max-width: 100%;">` : ''}
            ${notification.action?.url ? `<a href="${notification.action.url}" style="display: inline-block; padding: 10px 20px; background: ${notification.color}; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px;">View Details</a>` : ''}
          </div>
        `,
      });

      results.email = {
        sent: true,
        sentAt: new Date(),
      };
    } catch (error) {
      logger.error('Email notification failed:', error);
      results.email = {
        sent: false,
        error: error.message,
      };
    }
  }

  // SMS notification
  if (notification.channels.sms && recipient.phone) {
    try {
      await sendSMS({
        to: recipient.phone,
        message: `${notification.title}: ${notification.shortMessage || notification.message}`,
      });

      results.sms = {
        sent: true,
        sentAt: new Date(),
      };
    } catch (error) {
      logger.error('SMS notification failed:', error);
      results.sms = {
        sent: false,
        error: error.message,
      };
    }
  }

  return results;
}

/**
 * Emit real-time notification via socket
 */
function emitRealtimeNotification(recipientId, recipientType, notification) {
  const eventData = {
    id: notification._id,
    type: notification.type,
    category: notification.category,
    title: notification.title,
    message: notification.message,
    icon: notification.icon,
    color: notification.color,
    action: notification.action,
    createdAt: notification.createdAt,
  };

  if (recipientType === 'User') {
    emitToUser(recipientId, 'notification:new', eventData);
  } else if (recipientType === 'Captain') {
    emitToCaptain(recipientId, 'notification:new', eventData);
  }
}

// ==========================================
// USER/CAPTAIN NOTIFICATION ROUTES
// ==========================================

/**
 * @desc    Get all notifications
 * @route   GET /api/v1/notifications
 * @access  Private (User/Captain)
 */
exports.getNotifications = asyncHandler(async (req, res, next) => {
  const { recipientId, recipientType } = getRecipientInfo(req);
  const { page = 1, limit = 20, category, unreadOnly } = req.query;

  const notifications = await Notification.getUserNotifications(
    recipientId,
    recipientType,
    {
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      unreadOnly: unreadOnly === 'true',
    }
  );

  const total = await Notification.countDocuments({
    recipient: recipientId,
    recipientType,
    isDismissed: false,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    ...(category && { category }),
    ...(unreadOnly === 'true' && { isRead: false }),
  });

  const unreadCount = await Notification.getUnreadCount(recipientId, recipientType);

  res.status(200).json({
    success: true,
    data: {
      notifications,
      unreadCount,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    },
  });
});

/**
 * @desc    Get single notification
 * @route   GET /api/v1/notifications/:id
 * @access  Private (User/Captain)
 */
exports.getNotification = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { recipientId, recipientType } = getRecipientInfo(req);

  const notification = await Notification.findOne({
    _id: id,
    recipient: recipientId,
    recipientType,
  });

  if (!notification) {
    return next(new AppError('Notification not found', 404));
  }

  res.status(200).json({
    success: true,
    data: { notification },
  });
});

/**
 * @desc    Get unread count
 * @route   GET /api/v1/notifications/unread-count
 * @access  Private (User/Captain)
 */
exports.getUnreadCount = asyncHandler(async (req, res, next) => {
  const { recipientId, recipientType } = getRecipientInfo(req);

  const count = await Notification.getUnreadCount(recipientId, recipientType);

  // Get count by category
  const categoryCount = await Notification.aggregate([
    {
      $match: {
        recipient: recipientId,
        recipientType,
        isRead: false,
        isDismissed: false,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      },
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      total: count,
      byCategory: categoryCount.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    },
  });
});

/**
 * @desc    Mark notification as read
 * @route   PUT /api/v1/notifications/:id/read
 * @access  Private (User/Captain)
 */
exports.markAsRead = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { recipientId, recipientType } = getRecipientInfo(req);

  const notification = await Notification.findOne({
    _id: id,
    recipient: recipientId,
    recipientType,
  });

  if (!notification) {
    return next(new AppError('Notification not found', 404));
  }

  await notification.markAsRead();

  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: { notification },
  });
});

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/v1/notifications/read-all
 * @access  Private (User/Captain)
 */
exports.markAllAsRead = asyncHandler(async (req, res, next) => {
  const { recipientId, recipientType } = getRecipientInfo(req);
  const { category } = req.body;

  const query = {
    recipient: recipientId,
    recipientType,
    isRead: false,
  };

  if (category) {
    query.category = category;
  }

  const result = await Notification.updateMany(query, {
    isRead: true,
    readAt: new Date(),
  });

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} notifications marked as read`,
    data: { modifiedCount: result.modifiedCount },
  });
});

/**
 * @desc    Dismiss notification
 * @route   DELETE /api/v1/notifications/:id
 * @access  Private (User/Captain)
 */
exports.dismissNotification = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { recipientId, recipientType } = getRecipientInfo(req);

  const notification = await Notification.findOne({
    _id: id,
    recipient: recipientId,
    recipientType,
  });

  if (!notification) {
    return next(new AppError('Notification not found', 404));
  }

  await notification.dismiss();

  res.status(200).json({
    success: true,
    message: 'Notification dismissed',
  });
});

/**
 * @desc    Dismiss all notifications
 * @route   DELETE /api/v1/notifications
 * @access  Private (User/Captain)
 */
exports.dismissAll = asyncHandler(async (req, res, next) => {
  const { recipientId, recipientType } = getRecipientInfo(req);
  const { category } = req.query;

  const query = {
    recipient: recipientId,
    recipientType,
    isDismissed: false,
  };

  if (category) {
    query.category = category;
  }

  const result = await Notification.updateMany(query, {
    isDismissed: true,
    dismissedAt: new Date(),
  });

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} notifications dismissed`,
    data: { modifiedCount: result.modifiedCount },
  });
});

/**
 * @desc    Get notifications by category
 * @route   GET /api/v1/notifications/category/:category
 * @access  Private (User/Captain)
 */
exports.getByCategory = asyncHandler(async (req, res, next) => {
  const { category } = req.params;
  const { recipientId, recipientType } = getRecipientInfo(req);
  const { page = 1, limit = 20 } = req.query;

  const validCategories = ['ride', 'payment', 'promotion', 'account', 'rating', 'system', 'safety'];
  if (!validCategories.includes(category)) {
    return next(new AppError('Invalid category', 400));
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [notifications, total] = await Promise.all([
    Notification.find({
      recipient: recipientId,
      recipientType,
      category,
      isDismissed: false,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Notification.countDocuments({
      recipient: recipientId,
      recipientType,
      category,
      isDismissed: false,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      notifications,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    },
  });
});

/**
 * @desc    Track notification click/action
 * @route   POST /api/v1/notifications/:id/track
 * @access  Private (User/Captain)
 */
exports.trackAction = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { action } = req.body; // 'click', 'view', 'dismiss'
  const { recipientId, recipientType } = getRecipientInfo(req);

  const notification = await Notification.findOne({
    _id: id,
    recipient: recipientId,
    recipientType,
  });

  if (!notification) {
    return next(new AppError('Notification not found', 404));
  }

  // Update tracking based on action
  if (action === 'click') {
    notification.deliveryStatus.push.clicked = true;
    notification.deliveryStatus.push.clickedAt = new Date();
  }

  // Mark as read on any action
  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
  }

  await notification.save();

  res.status(200).json({
    success: true,
    message: 'Action tracked',
  });
});

/**
 * @desc    Get notification preferences
 * @route   GET /api/v1/notifications/preferences
 * @access  Private (User/Captain)
 */
exports.getPreferences = asyncHandler(async (req, res, next) => {
  const { recipientId, recipientType } = getRecipientInfo(req);

  let preferences;

  if (recipientType === 'User') {
    const user = await User.findById(recipientId).select('preferences.notifications');
    preferences = user?.preferences?.notifications || {
      email: true,
      sms: true,
      push: true,
    };
  } else {
    const captain = await Captain.findById(recipientId).select('preferences.notifications');
    preferences = captain?.preferences?.notifications || {
      email: true,
      sms: true,
      push: true,
    };
  }

  // Default category preferences
  const categoryPreferences = {
    ride: { push: true, email: false, sms: true },
    payment: { push: true, email: true, sms: false },
    promotion: { push: true, email: true, sms: false },
    account: { push: true, email: true, sms: true },
    rating: { push: true, email: false, sms: false },
    system: { push: true, email: false, sms: false },
    safety: { push: true, email: true, sms: true },
  };

  res.status(200).json({
    success: true,
    data: {
      global: preferences,
      byCategory: categoryPreferences,
    },
  });
});

/**
 * @desc    Update notification preferences
 * @route   PUT /api/v1/notifications/preferences
 * @access  Private (User/Captain)
 */
exports.updatePreferences = asyncHandler(async (req, res, next) => {
  const { recipientId, recipientType } = getRecipientInfo(req);
  const { email, sms, push, categories } = req.body;

  const updateData = {};
  if (typeof email === 'boolean') updateData['preferences.notifications.email'] = email;
  if (typeof sms === 'boolean') updateData['preferences.notifications.sms'] = sms;
  if (typeof push === 'boolean') updateData['preferences.notifications.push'] = push;

  if (recipientType === 'User') {
    await User.findByIdAndUpdate(recipientId, { $set: updateData });
  } else {
    await Captain.findByIdAndUpdate(recipientId, { $set: updateData });
  }

  res.status(200).json({
    success: true,
    message: 'Preferences updated',
    data: {
      email: email ?? true,
      sms: sms ?? true,
      push: push ?? true,
    },
  });
});

/**
 * @desc    Register/Update FCM token
 * @route   POST /api/v1/notifications/fcm-token
 * @access  Private (User/Captain)
 */
exports.updateFCMToken = asyncHandler(async (req, res, next) => {
  const { token, deviceType, deviceId } = req.body;
  const { recipientId, recipientType } = getRecipientInfo(req);

  if (!token) {
    return next(new AppError('FCM token is required', 400));
  }

  const updateData = {
    fcmToken: token,
    ...(deviceType && { deviceType }),
    ...(deviceId && { deviceId }),
  };

  if (recipientType === 'User') {
    await User.findByIdAndUpdate(recipientId, updateData);
  } else {
    await Captain.findByIdAndUpdate(recipientId, updateData);
  }

  res.status(200).json({
    success: true,
    message: 'FCM token updated',
  });
});

/**
 * @desc    Remove FCM token (logout)
 * @route   DELETE /api/v1/notifications/fcm-token
 * @access  Private (User/Captain)
 */
exports.removeFCMToken = asyncHandler(async (req, res, next) => {
  const { recipientId, recipientType } = getRecipientInfo(req);

  if (recipientType === 'User') {
    await User.findByIdAndUpdate(recipientId, { $unset: { fcmToken: 1 } });
  } else {
    await Captain.findByIdAndUpdate(recipientId, { $unset: { fcmToken: 1 } });
  }

  res.status(200).json({
    success: true,
    message: 'FCM token removed',
  });
});

// ==========================================
// INTERNAL/SERVICE METHODS (Not Routes)
// ==========================================

/**
 * Send notification to a user/captain
 * Used internally by other services
 */
exports.sendNotification = async ({
  recipientId,
  recipientType,
  type,
  templateData = {},
  channels = { push: true, inApp: true, email: false, sms: false },
  action = { type: 'none' },
  relatedEntity = null,
  priority = null,
  scheduledFor = null,
  expiresAt = null,
  metadata = {},
}) => {
  try {
    // Build notification from template
    const templateNotification = buildNotificationFromTemplate(type, templateData);

    // Get recipient details
    let recipient;
    if (recipientType === 'User') {
      recipient = await User.findById(recipientId).select('firstName lastName email phone fcmToken preferences.notifications');
    } else if (recipientType === 'Captain') {
      recipient = await Captain.findById(recipientId).select('firstName lastName email phone fcmToken preferences.notifications');
    } else {
      throw new AppError('Invalid recipient type', 400);
    }

    if (!recipient) {
      throw new AppError('Recipient not found', 404);
    }

    // Check user preferences
    const userPrefs = recipient.preferences?.notifications || { push: true, email: true, sms: true };

    // Merge channel settings with user preferences
    const finalChannels = {
      push: channels.push && userPrefs.push,
      inApp: channels.inApp,
      email: channels.email && userPrefs.email,
      sms: channels.sms && userPrefs.sms,
    };

    // Create notification
    const notification = await Notification.create({
      recipient: recipientId,
      recipientType,
      type,
      category: templateNotification.category,
      priority: priority || templateNotification.priority,
      title: templateNotification.title,
      message: templateNotification.message,
      shortMessage: templateNotification.shortMessage,
      icon: templateNotification.icon,
      color: templateNotification.color,
      action,
      relatedEntity,
      channels: finalChannels,
      scheduledFor,
      expiresAt,
      metadata: {
        source: metadata.source || 'system',
        triggeredBy: metadata.triggeredBy,
        campaign: metadata.campaign,
        batchId: metadata.batchId,
      },
    });

    // If scheduled for future, don't send now
    if (scheduledFor && new Date(scheduledFor) > new Date()) {
      return notification;
    }

    // Send through channels
    const deliveryResults = await sendNotificationChannels(notification, recipient);

    // Update delivery status
    notification.deliveryStatus = {
      push: deliveryResults.push,
      email: deliveryResults.email,
      sms: deliveryResults.sms,
    };
    await notification.save();

    // Emit real-time notification for in-app
    if (finalChannels.inApp) {
      emitRealtimeNotification(recipientId, recipientType, notification);
    }

    return notification;
  } catch (error) {
    logger.error('Failed to send notification:', error);
    throw error;
  }
};

/**
 * Send notification to multiple recipients
 */
exports.sendBulkNotification = async ({
  recipients, // Array of { recipientId, recipientType }
  type,
  templateData = {},
  channels = { push: true, inApp: true, email: false, sms: false },
  action = { type: 'none' },
  metadata = {},
}) => {
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const recipient of recipients) {
    try {
      await exports.sendNotification({
        recipientId: recipient.recipientId,
        recipientType: recipient.recipientType,
        type,
        templateData,
        channels,
        action,
        metadata: { ...metadata, batchId },
      });
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        recipientId: recipient.recipientId,
        error: error.message,
      });
    }
  }

  return results;
};

/**
 * Send notification to all users of a type
 */
exports.sendToAll = async ({
  recipientType, // 'User' or 'Captain'
  type,
  templateData = {},
  channels = { push: true, inApp: true, email: false, sms: false },
  action = { type: 'none' },
  filter = {}, // Additional filter for recipients
  metadata = {},
}) => {
  const Model = recipientType === 'User' ? User : Captain;

  const recipients = await Model.find({
    isActive: true,
    ...filter,
  }).select('_id');

  return exports.sendBulkNotification({
    recipients: recipients.map((r) => ({ recipientId: r._id, recipientType })),
    type,
    templateData,
    channels,
    action,
    metadata,
  });
};

// ==========================================
// NOTIFICATION TRIGGERS (Called by other services)
// ==========================================

/**
 * Ride notifications
 */
exports.notifyRideRequest = async (captainId, rideData) => {
  return exports.sendNotification({
    recipientId: captainId,
    recipientType: 'Captain',
    type: 'ride_request',
    templateData: {
      pickup: rideData.pickupAddress,
      drop: rideData.dropAddress,
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    action: {
      type: 'open_ride',
      screen: 'RideRequest',
      params: new Map([['rideId', rideData.rideId]]),
    },
    relatedEntity: { entityType: 'Ride', entityId: rideData.rideId },
    priority: 'high',
    expiresAt: new Date(Date.now() + 60 * 1000), // Expires in 1 minute
  });
};

exports.notifyRideAccepted = async (userId, rideData) => {
  return exports.sendNotification({
    recipientId: userId,
    recipientType: 'User',
    type: 'ride_accepted',
    templateData: {
      captainName: rideData.captainName,
    },
    channels: { push: true, inApp: true, email: false, sms: true },
    action: {
      type: 'open_ride',
      screen: 'RideTracking',
      params: new Map([['rideId', rideData.rideId]]),
    },
    relatedEntity: { entityType: 'Ride', entityId: rideData.rideId },
    priority: 'high',
  });
};

exports.notifyRideCancelled = async (recipientId, recipientType, rideData) => {
  return exports.sendNotification({
    recipientId,
    recipientType,
    type: 'ride_cancelled',
    templateData: {
      reason: rideData.reason || 'No reason provided',
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    relatedEntity: { entityType: 'Ride', entityId: rideData.rideId },
    priority: 'high',
  });
};

exports.notifyCaptainArriving = async (userId, rideData) => {
  return exports.sendNotification({
    recipientId: userId,
    recipientType: 'User',
    type: 'captain_arriving',
    templateData: {
      captainName: rideData.captainName,
      eta: rideData.eta,
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    action: {
      type: 'open_ride',
      screen: 'RideTracking',
      params: new Map([['rideId', rideData.rideId]]),
    },
    relatedEntity: { entityType: 'Ride', entityId: rideData.rideId },
  });
};

exports.notifyCaptainArrived = async (userId, rideData) => {
  return exports.sendNotification({
    recipientId: userId,
    recipientType: 'User',
    type: 'captain_arrived',
    templateData: {
      captainName: rideData.captainName,
    },
    channels: { push: true, inApp: true, email: false, sms: true },
    action: {
      type: 'open_ride',
      screen: 'RideTracking',
      params: new Map([['rideId', rideData.rideId]]),
    },
    relatedEntity: { entityType: 'Ride', entityId: rideData.rideId },
    priority: 'urgent',
  });
};

exports.notifyRideStarted = async (userId, rideData) => {
  return exports.sendNotification({
    recipientId: userId,
    recipientType: 'User',
    type: 'ride_started',
    templateData: {
      drop: rideData.dropAddress,
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    action: {
      type: 'open_ride',
      screen: 'RideTracking',
      params: new Map([['rideId', rideData.rideId]]),
    },
    relatedEntity: { entityType: 'Ride', entityId: rideData.rideId },
  });
};

exports.notifyRideCompleted = async (userId, rideData) => {
  return exports.sendNotification({
    recipientId: userId,
    recipientType: 'User',
    type: 'ride_completed',
    templateData: {
      fare: rideData.fare,
    },
    channels: { push: true, inApp: true, email: true, sms: false },
    action: {
      type: 'open_ride',
      screen: 'RideSummary',
      params: new Map([['rideId', rideData.rideId]]),
    },
    relatedEntity: { entityType: 'Ride', entityId: rideData.rideId },
    priority: 'high',
  });
};

/**
 * Payment notifications
 */
exports.notifyPaymentSuccess = async (userId, paymentData) => {
  return exports.sendNotification({
    recipientId: userId,
    recipientType: 'User',
    type: 'payment_successful',
    templateData: {
      amount: paymentData.amount,
    },
    channels: { push: true, inApp: true, email: true, sms: false },
    action: {
      type: 'open_payment',
      screen: 'PaymentDetails',
      params: new Map([['paymentId', paymentData.paymentId]]),
    },
    relatedEntity: { entityType: 'Payment', entityId: paymentData.paymentId },
  });
};

exports.notifyPaymentFailed = async (userId, paymentData) => {
  return exports.sendNotification({
    recipientId: userId,
    recipientType: 'User',
    type: 'payment_failed',
    templateData: {
      amount: paymentData.amount,
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    priority: 'high',
  });
};

exports.notifyWalletCredited = async (recipientId, recipientType, walletData) => {
  return exports.sendNotification({
    recipientId,
    recipientType,
    type: 'wallet_credited',
    templateData: {
      amount: walletData.amount,
      balance: walletData.balance,
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    action: {
      type: 'navigate',
      screen: 'Wallet',
    },
  });
};

exports.notifyWalletDebited = async (userId, walletData) => {
  return exports.sendNotification({
    recipientId: userId,
    recipientType: 'User',
    type: 'wallet_debited',
    templateData: {
      amount: walletData.amount,
      balance: walletData.balance,
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    action: {
      type: 'navigate',
      screen: 'Wallet',
    },
  });
};

exports.notifyWithdrawalProcessed = async (captainId, withdrawalData) => {
  return exports.sendNotification({
    recipientId: captainId,
    recipientType: 'Captain',
    type: 'withdrawal_processed',
    templateData: {
      amount: withdrawalData.amount,
    },
    channels: { push: true, inApp: true, email: true, sms: true },
    priority: 'high',
  });
};

exports.notifyRefund = async (userId, refundData) => {
  return exports.sendNotification({
    recipientId: userId,
    recipientType: 'User',
    type: 'refund_processed',
    templateData: {
      amount: refundData.amount,
    },
    channels: { push: true, inApp: true, email: true, sms: false },
  });
};

/**
 * Captain specific notifications
 */
exports.notifyHighDemandArea = async (captainId, areaData) => {
  return exports.sendNotification({
    recipientId: captainId,
    recipientType: 'Captain',
    type: 'high_demand_area',
    templateData: {
      area: areaData.areaName,
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    action: {
      type: 'navigate',
      screen: 'HeatMap',
    },
  });
};

exports.notifyEarningsSummary = async (captainId, earningsData) => {
  return exports.sendNotification({
    recipientId: captainId,
    recipientType: 'Captain',
    type: 'earnings_summary',
    templateData: {
      amount: earningsData.amount,
      rides: earningsData.rides,
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    action: {
      type: 'navigate',
      screen: 'Earnings',
    },
  });
};

exports.notifyIncentiveEarned = async (captainId, incentiveData) => {
  return exports.sendNotification({
    recipientId: captainId,
    recipientType: 'Captain',
    type: 'incentive_earned',
    templateData: {
      amount: incentiveData.amount,
      reason: incentiveData.reason,
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    priority: 'medium',
  });
};

exports.notifyStreakBonus = async (captainId, streakData) => {
  return exports.sendNotification({
    recipientId: captainId,
    recipientType: 'Captain',
    type: 'streak_bonus',
    templateData: {
      count: streakData.count,
      amount: streakData.amount,
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    priority: 'medium',
  });
};

/**
 * Account notifications
 */
exports.notifyAccountVerified = async (recipientId, recipientType) => {
  return exports.sendNotification({
    recipientId,
    recipientType,
    type: 'account_verified',
    templateData: {},
    channels: { push: true, inApp: true, email: true, sms: false },
  });
};

exports.notifyDocumentApproved = async (captainId, documentData) => {
  return exports.sendNotification({
    recipientId: captainId,
    recipientType: 'Captain',
    type: 'document_approved',
    templateData: {
      documentType: documentData.documentType,
    },
    channels: { push: true, inApp: true, email: true, sms: false },
  });
};

exports.notifyDocumentRejected = async (captainId, documentData) => {
  return exports.sendNotification({
    recipientId: captainId,
    recipientType: 'Captain',
    type: 'document_rejected',
    templateData: {
      documentType: documentData.documentType,
      reason: documentData.reason,
    },
    channels: { push: true, inApp: true, email: true, sms: false },
    priority: 'high',
  });
};

/**
 * Rating notifications
 */
exports.notifyNewRating = async (recipientId, recipientType, ratingData) => {
  return exports.sendNotification({
    recipientId,
    recipientType,
    type: 'new_rating',
    templateData: {
      rating: ratingData.rating,
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    priority: 'low',
  });
};

exports.notifyRatingReminder = async (userId, rideData) => {
  return exports.sendNotification({
    recipientId: userId,
    recipientType: 'User',
    type: 'rating_reminder',
    templateData: {
      name: rideData.captainName,
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    action: {
      type: 'open_ride',
      screen: 'RateRide',
      params: new Map([['rideId', rideData.rideId]]),
    },
    relatedEntity: { entityType: 'Ride', entityId: rideData.rideId },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
  });
};

/**
 * Safety notifications
 */
exports.notifySOSAlert = async (recipientId, recipientType, sosData) => {
  return exports.sendNotification({
    recipientId,
    recipientType,
    type: 'sos_alert',
    templateData: {
      name: sosData.userName,
    },
    channels: { push: true, inApp: true, email: true, sms: true },
    priority: 'urgent',
    action: {
      type: 'navigate',
      screen: 'SOSDetails',
      params: new Map([['sosId', sosData.sosId]]),
    },
  });
};

exports.notifyEmergencyContactNotified = async (userId) => {
  return exports.sendNotification({
    recipientId: userId,
    recipientType: 'User',
    type: 'emergency_contact_notified',
    templateData: {},
    channels: { push: true, inApp: true, email: false, sms: false },
    priority: 'urgent',
  });
};

/**
 * Promotional notifications
 */
exports.notifyPromoOffer = async (userId, promoData) => {
  return exports.sendNotification({
    recipientId: userId,
    recipientType: 'User',
    type: 'promo_offer',
    templateData: {
      message: promoData.message,
    },
    channels: { push: true, inApp: true, email: promoData.sendEmail || false, sms: false },
    action: promoData.action || { type: 'none' },
    priority: 'low',
    expiresAt: promoData.expiresAt,
    metadata: { campaign: promoData.campaignId },
  });
};

exports.notifyReferralBonus = async (userId, referralData) => {
  return exports.sendNotification({
    recipientId: userId,
    recipientType: 'User',
    type: 'referral_bonus',
    templateData: {
      amount: referralData.amount,
      name: referralData.referredName,
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    action: {
      type: 'navigate',
      screen: 'Referrals',
    },
  });
};

exports.notifyCashback = async (userId, cashbackData) => {
  return exports.sendNotification({
    recipientId: userId,
    recipientType: 'User',
    type: 'cashback',
    templateData: {
      amount: cashbackData.amount,
    },
    channels: { push: true, inApp: true, email: false, sms: false },
    action: {
      type: 'navigate',
      screen: 'Wallet',
    },
  });
};

// ==========================================
// SCHEDULED NOTIFICATION PROCESSOR
// ==========================================

/**
 * Process scheduled notifications (run via cron job)
 */
exports.processScheduledNotifications = async () => {
  const now = new Date();

  const scheduledNotifications = await Notification.find({
    scheduledFor: { $lte: now },
    'deliveryStatus.push.sent': false,
  }).limit(100);

  for (const notification of scheduledNotifications) {
    try {
      let recipient;
      if (notification.recipientType === 'User') {
        recipient = await User.findById(notification.recipient).select('fcmToken email phone');
      } else {
        recipient = await Captain.findById(notification.recipient).select('fcmToken email phone');
      }

      if (recipient) {
        const deliveryResults = await sendNotificationChannels(notification, recipient);
        notification.deliveryStatus = {
          push: deliveryResults.push,
          email: deliveryResults.email,
          sms: deliveryResults.sms,
        };
        await notification.save();

        if (notification.channels.inApp) {
          emitRealtimeNotification(
            notification.recipient,
            notification.recipientType,
            notification
          );
        }
      }
    } catch (error) {
      logger.error('Failed to process scheduled notification:', error);
    }
  }

  return scheduledNotifications.length;
};

/**
 * Clean up expired notifications (run via cron job)
 */
exports.cleanupExpiredNotifications = async () => {
  const result = await Notification.deleteMany({
    expiresAt: { $lt: new Date() },
    isRead: false,
  });

  return result.deletedCount;
};