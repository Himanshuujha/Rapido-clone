// src/config/constants.js
module.exports = {
  // Ride statuses
  RIDE_STATUS: {
    SEARCHING: 'searching',
    ACCEPTED: 'accepted',
    ARRIVING: 'arriving',
    ARRIVED: 'arrived',
    STARTED: 'started',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },

  // Vehicle types
  VEHICLE_TYPES: {
    BIKE: 'bike',
    AUTO: 'auto',
    CAB: 'cab',
    PREMIUM_CAB: 'premium_cab',
    SUV: 'suv'
  },

  // Payment methods
  PAYMENT_METHODS: {
    CASH: 'cash',
    WALLET: 'wallet',
    CARD: 'card',
    UPI: 'upi'
  },

  // Payment statuses
  PAYMENT_STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded'
  },

  // Captain statuses
  CAPTAIN_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    SUSPENDED: 'suspended'
  },

  // Document types
  DOCUMENT_TYPES: {
    DRIVING_LICENSE: 'driving_license',
    VEHICLE_RC: 'vehicle_rc',
    INSURANCE: 'insurance',
    AADHAR: 'aadhar',
    PAN: 'pan',
    PROFILE_PHOTO: 'profile_photo'
  },

  // Notification types
  NOTIFICATION_TYPES: {
    RIDE_REQUEST: 'ride_request',
    RIDE_ACCEPTED: 'ride_accepted',
    RIDE_CANCELLED: 'ride_cancelled',
    CAPTAIN_ARRIVING: 'captain_arriving',
    CAPTAIN_ARRIVED: 'captain_arrived',
    RIDE_STARTED: 'ride_started',
    RIDE_COMPLETED: 'ride_completed',
    PAYMENT_SUCCESSFUL: 'payment_successful',
    WALLET_CREDITED: 'wallet_credited',
    PROMO_OFFER: 'promo_offer'
  },

  // Cache TTL (in seconds)
  CACHE_TTL: {
    SHORT: 60,           // 1 minute
    MEDIUM: 300,         // 5 minutes
    LONG: 3600,          // 1 hour
    DAY: 86400,          // 24 hours
    WEEK: 604800         // 7 days
  },

  // Pagination defaults
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100
  },

  // OTP settings
  OTP: {
    LENGTH: 4,
    EXPIRY: 300,         // 5 minutes in seconds
    MAX_ATTEMPTS: 3
  },

  // Ride settings
  RIDE: {
    SEARCH_TIMEOUT: 60,  // seconds
    CAPTAIN_RESPONSE_TIME: 30, // seconds
    SEARCH_RADIUS: 5000, // meters
    MAX_SEARCH_RADIUS: 15000,
    CANCELLATION_FREE_TIME: 120 // seconds
  },

  // Commission
  COMMISSION: {
    PLATFORM_PERCENTAGE: 20
  },

  // Surge pricing
  SURGE: {
    MIN_MULTIPLIER: 1,
    MAX_MULTIPLIER: 3
  },

  // File upload limits
  UPLOAD: {
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    ALLOWED_DOC_TYPES: ['application/pdf', 'image/jpeg', 'image/png']
  }
};