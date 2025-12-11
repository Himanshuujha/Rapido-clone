// models/Ride.js
const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  rideId: {
    type: String,
    unique: true,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Captain'
  },
  
  // Ride Type
  vehicleType: {
    type: String,
    enum: ['bike', 'auto', 'cab'],
    required: true
  },
  
  // Locations
  pickup: {
    address: { type: String, required: true },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    }
  },
  destination: {
    address: { type: String, required: true },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    }
  },
  
  // Route
  route: {
    distance: Number, // in kilometers
    duration: Number, // in minutes
    polyline: String  // encoded polyline
  },
  
  // Status
  status: {
    type: String,
    enum: [
      'searching',      // Looking for captain
      'accepted',       // Captain accepted
      'arriving',       // Captain on the way
      'arrived',        // Captain at pickup
      'started',        // Ride started
      'completed',      // Ride completed
      'cancelled'       // Ride cancelled
    ],
    default: 'searching'
  },
  
  // Fare
  fare: {
    baseFare: Number,
    distanceFare: Number,
    timeFare: Number,
    surgeFare: Number,
    discount: Number,
    couponDiscount: Number,
    total: Number,
    platformFee: Number,
    captainEarnings: Number
  },
  
  // Payment
  payment: {
    method: {
      type: String,
      enum: ['cash', 'wallet', 'card', 'upi']
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: String
  },
  
  // Timestamps
  timestamps: {
    requested: Date,
    accepted: Date,
    captainArrived: Date,
    started: Date,
    completed: Date,
    cancelled: Date
  },
  
  // OTP for ride verification
  otp: {
    code: String,
    verified: { type: Boolean, default: false }
  },
  
  // Cancellation
  cancellation: {
    by: { type: String, enum: ['user', 'captain', 'system'] },
    reason: String,
    fee: Number
  },
  
  // Ratings
  userRating: {
    rating: Number,
    comment: String
  },
  captainRating: {
    rating: Number,
    comment: String
  },
  
  // Tracking
  tracking: [{
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    timestamp: Date
  }],
  
  // Applied coupon
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon'
  },
  
  // Surge pricing
  surgeMultiplier: {
    type: Number,
    default: 1
  },
  
  // Scheduled ride
  isScheduled: {
    type: Boolean,
    default: false
  },
  scheduledTime: Date
  
}, { timestamps: true });

// Indexes
rideSchema.index({ user: 1, createdAt: -1 });
rideSchema.index({ captain: 1, createdAt: -1 });
rideSchema.index({ status: 1 });
rideSchema.index({ 'pickup.coordinates': '2dsphere' });

module.exports = mongoose.model('Ride', rideSchema);