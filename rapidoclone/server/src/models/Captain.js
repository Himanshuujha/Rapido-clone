// models/Captain.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const captainSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: String,
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  isOnRide: {
    type: Boolean,
    default: false
  },
  
  // Vehicle Details
  vehicle: {
    type: {
      type: String,
      enum: ['bike', 'auto', 'cab'],
      required: true
    },
    model: String,
    color: String,
    registrationNumber: {
      type: String,
      required: true,
      unique: true
    },
    registrationYear: Number
  },
  
  // Documents
  documents: {
    drivingLicense: {
      number: String,
      image: String,
      expiryDate: Date,
      verified: { type: Boolean, default: false }
    },
    vehicleRC: {
      number: String,
      image: String,
      verified: { type: Boolean, default: false }
    },
    insurance: {
      number: String,
      image: String,
      expiryDate: Date,
      verified: { type: Boolean, default: false }
    },
    aadhar: {
      number: String,
      image: String,
      verified: { type: Boolean, default: false }
    },
    pan: {
      number: String,
      image: String,
      verified: { type: Boolean, default: false }
    },
    profilePhoto: {
      image: String,
      verified: { type: Boolean, default: false }
    }
  },
  
  // Location
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  lastLocationUpdate: Date,
  
  // Ratings & Stats
  ratings: {
    average: { type: Number, default: 5 },
    count: { type: Number, default: 0 }
  },
  stats: {
    totalRides: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    totalDistance: { type: Number, default: 0 },
    acceptanceRate: { type: Number, default: 100 },
    cancellationRate: { type: Number, default: 0 }
  },
  
  // Bank Details
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,
    bankName: String
  },
  
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet'
  },
  
  fcmToken: String,
  refreshToken: String
}, { timestamps: true });

// Geospatial index for location queries
captainSchema.index({ currentLocation: '2dsphere' });

// Password hashing
captainSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

captainSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Captain', captainSchema);