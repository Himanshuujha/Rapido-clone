// models/Vehicle.js
const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  // Owner of the vehicle (Captain)
  captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Captain',
    required: true
  },
  
  // Vehicle type
  type: {
    type: String,
    enum: ['bike', 'auto', 'cab', 'premium_cab', 'suv', 'electric'],
    required: true
  },
  
  // Vehicle category
  category: {
    type: String,
    enum: ['two_wheeler', 'three_wheeler', 'four_wheeler'],
    required: true
  },
  
  // Basic Information
  make: {
    type: String,
    required: true,
    trim: true
  },
  
  model: {
    type: String,
    required: true,
    trim: true
  },
  
  variant: {
    type: String,
    trim: true
  },
  
  year: {
    type: Number,
    required: true,
    min: 2000
  },
  
  color: {
    type: String,
    required: true,
    trim: true
  },
  
  // Registration Details
  registration: {
    number: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    state: String,
    rto: String,
    registrationDate: Date,
    expiryDate: Date
  },
  
  // Engine/Motor Details
  engine: {
    type: {
      type: String,
      enum: ['petrol', 'diesel', 'cng', 'electric', 'hybrid']
    },
    displacement: Number, // in CC
    power: Number,        // in HP/BHP
    fuelEfficiency: Number // km/l
  },
  
  // For Electric Vehicles
  electric: {
    batteryCapacity: Number, // in kWh
    range: Number,           // in km
    chargingTime: Number     // in hours
  },
  
  // Seating capacity
  seatingCapacity: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  
  // Features
  features: {
    ac: { type: Boolean, default: false },
    music: { type: Boolean, default: false },
    gps: { type: Boolean, default: true },
    airbags: { type: Boolean, default: false },
    helmet: { type: Boolean, default: false },  // For bikes
    childSeat: { type: Boolean, default: false },
    wheelchairAccessible: { type: Boolean, default: false },
    luggageSpace: { type: Boolean, default: false },
    roofCarrier: { type: Boolean, default: false }
  },
  
  // Vehicle Images
  images: {
    front: {
      type: String,
      required: true
    },
    back: String,
    left: String,
    right: String,
    interior: String,
    dashboard: String
  },
  
  // Documents
  documents: {
    rc: {
      number: String,
      image: { type: String, required: true },
      expiryDate: Date,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
      },
      rejectionReason: String
    },
    insurance: {
      policyNumber: String,
      company: String,
      image: { type: String, required: true },
      startDate: Date,
      expiryDate: Date,
      type: {
        type: String,
        enum: ['comprehensive', 'third_party']
      },
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
      },
      rejectionReason: String
    },
    puc: {
      certificateNumber: String,
      image: String,
      issueDate: Date,
      expiryDate: Date,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
      },
      rejectionReason: String
    },
    fitness: {
      certificateNumber: String,
      image: String,
      issueDate: Date,
      expiryDate: Date,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
      },
      rejectionReason: String
    },
    permit: {
      permitNumber: String,
      type: {
        type: String,
        enum: ['national', 'state', 'contract']
      },
      image: String,
      issueDate: Date,
      expiryDate: Date,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
      },
      rejectionReason: String
    }
  },
  
  // Verification Status
  verificationStatus: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  
  // Overall verification
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verifiedAt: {
    type: Date
  },
  
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  
  rejectionReason: {
    type: String
  },
  
  // Vehicle condition
  condition: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'needs_maintenance'],
    default: 'good'
  },
  
  // Last inspection
  lastInspection: {
    date: Date,
    result: {
      type: String,
      enum: ['passed', 'failed', 'conditional']
    },
    notes: String,
    inspector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    nextDue: Date
  },
  
  // Odometer reading
  odometer: {
    reading: Number,      // in km
    lastUpdated: Date
  },
  
  // Active status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Deactivation info
  deactivation: {
    reason: String,
    deactivatedAt: Date,
    deactivatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  },
  
  // Statistics
  stats: {
    totalRides: { type: Number, default: 0 },
    totalDistance: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    averageRating: { type: Number, default: 5 }
  },
  
  // Maintenance records
  maintenanceHistory: [{
    type: {
      type: String,
      enum: ['service', 'repair', 'parts_replacement', 'inspection']
    },
    description: String,
    date: Date,
    cost: Number,
    vendor: String,
    odometer: Number,
    documents: [String],
    notes: String
  }],
  
  // Notes/Comments
  adminNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
  
}, { timestamps: true });

// Indexes
vehicleSchema.index({ captain: 1 });
vehicleSchema.index({ type: 1, isActive: 1 });
vehicleSchema.index({ 'registration.number': 1 });
vehicleSchema.index({ verificationStatus: 1 });
vehicleSchema.index({ 'documents.insurance.expiryDate': 1 });
vehicleSchema.index({ 'documents.puc.expiryDate': 1 });

// Virtual for full vehicle name
vehicleSchema.virtual('fullName').get(function() {
  return `${this.year} ${this.make} ${this.model}${this.variant ? ' ' + this.variant : ''}`;
});

// Virtual for checking if documents are expiring soon
vehicleSchema.virtual('hasExpiringDocuments').get(function() {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  return (
    (this.documents.insurance.expiryDate && this.documents.insurance.expiryDate <= thirtyDaysFromNow) ||
    (this.documents.puc.expiryDate && this.documents.puc.expiryDate <= thirtyDaysFromNow) ||
    (this.documents.fitness.expiryDate && this.documents.fitness.expiryDate <= thirtyDaysFromNow)
  );
});

// Method to check all documents verified
vehicleSchema.methods.checkAllDocumentsVerified = function() {
  return (
    this.documents.rc.verified &&
    this.documents.insurance.verified &&
    (!this.documents.puc.image || this.documents.puc.verified) &&
    (!this.documents.fitness.image || this.documents.fitness.verified)
  );
};

// Method to update verification status
vehicleSchema.methods.updateVerificationStatus = async function() {
  if (this.checkAllDocumentsVerified()) {
    this.verificationStatus = 'approved';
    this.isVerified = true;
    this.verifiedAt = new Date();
  }
  return this.save();
};

// Static method to find vehicles with expiring documents
vehicleSchema.statics.findExpiringDocuments = function(days = 30) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  
  return this.find({
    isActive: true,
    $or: [
      { 'documents.insurance.expiryDate': { $lte: expiryDate } },
      { 'documents.puc.expiryDate': { $lte: expiryDate } },
      { 'documents.fitness.expiryDate': { $lte: expiryDate } },
      { 'documents.permit.expiryDate': { $lte: expiryDate } }
    ]
  }).populate('captain', 'firstName lastName phone email');
};

// Pre-save middleware to set category based on type
vehicleSchema.pre('save', function(next) {
  if (this.type === 'bike') {
    this.category = 'two_wheeler';
  } else if (this.type === 'auto') {
    this.category = 'three_wheeler';
  } else {
    this.category = 'four_wheeler';
  }
  next();
});

module.exports = mongoose.model('Vehicle', vehicleSchema);