// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Recipient
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'recipientType'
  },
  
  recipientType: {
    type: String,
    required: true,
    enum: ['User', 'Captain', 'Admin']
  },
  
  // Notification type
  type: {
    type: String,
    required: true,
    enum: [
      // Ride related
      'ride_request',
      'ride_accepted',
      'ride_cancelled',
      'captain_arriving',
      'captain_arrived',
      'ride_started',
      'ride_completed',
      'ride_scheduled_reminder',
      
      // Payment related
      'payment_successful',
      'payment_failed',
      'wallet_credited',
      'wallet_debited',
      'withdrawal_processed',
      'refund_processed',
      
      // Promotional
      'promo_offer',
      'discount_coupon',
      'referral_bonus',
      'cashback',
      
      // Account related
      'account_verified',
      'document_approved',
      'document_rejected',
      'account_suspended',
      'password_changed',
      
      // Rating
      'new_rating',
      'rating_reminder',
      
      // System
      'app_update',
      'maintenance',
      'policy_update',
      'general',
      
      // Captain specific
      'high_demand_area',
      'earnings_summary',
      'incentive_earned',
      'streak_bonus',
      'new_zone_available',
      
      // Safety
      'sos_alert',
      'safety_tip',
      'emergency_contact_notified'
    ]
  },
  
  // Notification category for grouping
  category: {
    type: String,
    enum: ['ride', 'payment', 'promotion', 'account', 'rating', 'system', 'safety'],
    required: true
  },
  
  // Priority level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Content
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  // Short message for push notification
  shortMessage: {
    type: String,
    maxlength: 100
  },
  
  // Rich content (HTML for in-app display)
  richContent: {
    type: String
  },
  
  // Image/Icon
  image: {
    type: String
  },
  
  icon: {
    type: String,
    default: 'bell'
  },
  
  // Color for UI
  color: {
    type: String,
    default: '#007bff'
  },
  
  // Action data (deep linking)
  action: {
    type: {
      type: String,
      enum: ['navigate', 'open_url', 'open_ride', 'open_payment', 'open_offer', 'none'],
      default: 'none'
    },
    screen: String,        // For in-app navigation
    url: String,           // For external links
    params: {              // Additional parameters
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },
  
  // Related entities
  relatedEntity: {
    entityType: {
      type: String,
      enum: ['Ride', 'Payment', 'Coupon', 'User', 'Captain', 'Transaction']
    },
    entityId: mongoose.Schema.Types.ObjectId
  },
  
  // Delivery channels
  channels: {
    push: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false }
  },
  
  // Delivery status for each channel
  deliveryStatus: {
    push: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      delivered: { type: Boolean, default: false },
      deliveredAt: Date,
      clicked: { type: Boolean, default: false },
      clickedAt: Date,
      error: String
    },
    email: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      opened: { type: Boolean, default: false },
      openedAt: Date,
      error: String
    },
    sms: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      delivered: { type: Boolean, default: false },
      deliveredAt: Date,
      error: String
    }
  },
  
  // Read status
  isRead: {
    type: Boolean,
    default: false
  },
  
  readAt: {
    type: Date
  },
  
  // Dismissed by user
  isDismissed: {
    type: Boolean,
    default: false
  },
  
  dismissedAt: {
    type: Date
  },
  
  // Scheduling
  scheduledFor: {
    type: Date
  },
  
  // Expiry (notification won't be shown after this)
  expiresAt: {
    type: Date
  },
  
  // Metadata
  metadata: {
    source: {
      type: String,
      enum: ['system', 'admin', 'automated', 'triggered'],
      default: 'system'
    },
    triggeredBy: String,
    campaign: String,
    batchId: String
  },
  
  // Localization
  locale: {
    type: String,
    default: 'en'
  },
  
  // Template used
  template: {
    type: String
  }
  
}, { timestamps: true });

// Indexes
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, category: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 });

// TTL index - delete old notifications after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// Virtual for checking if expired
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to mark as dismissed
notificationSchema.methods.dismiss = function() {
  this.isDismissed = true;
  this.dismissedAt = new Date();
  return this.save();
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function(recipientId, recipientType) {
  return this.countDocuments({
    recipient: recipientId,
    recipientType,
    isRead: false,
    isDismissed: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

// Static method to get user notifications with pagination
notificationSchema.statics.getUserNotifications = function(recipientId, recipientType, options = {}) {
  const {
    page = 1,
    limit = 20,
    category,
    unreadOnly = false
  } = options;

  const query = {
    recipient: recipientId,
    recipientType,
    isDismissed: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  };

  if (category) {
    query.category = category;
  }

  if (unreadOnly) {
    query.isRead = false;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = function(recipientId, recipientType) {
  return this.updateMany(
    {
      recipient: recipientId,
      recipientType,
      isRead: false
    },
    {
      isRead: true,
      readAt: new Date()
    }
  );
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this(data);
  await notification.save();
  
  // Trigger push notification if enabled
  if (data.channels?.push) {
    // This would be handled by the notification service
    const NotificationService = require('../services/notificationService');
    await NotificationService.sendPush(notification);
  }
  
  return notification;
};

module.exports = mongoose.model('Notification', notificationSchema);