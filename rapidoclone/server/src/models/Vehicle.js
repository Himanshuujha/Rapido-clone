const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Captain',
    required: true
  },
  vehicleType: {
    type: String,
    enum: ['bike', 'auto', 'car', 'premium'],
    required: true
  },
  make: { type: String, required: true, trim: true },
  model: { type: String, required: true, trim: true },
  year: { type: Number, required: true },
  color: { type: String, required: true, trim: true },
  registrationNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  registrationExpiry: Date,
  insuranceNumber: String,
  insuranceExpiry: Date,
  documents: {
    registrationCertificate: { url: String, publicId: String, verified: { type: Boolean, default: false } },
    insurance: { url: String, publicId: String, verified: { type: Boolean, default: false } },
    permit: { url: String, publicId: String, verified: { type: Boolean, default: false } },
    pollution: { url: String, publicId: String, verified: { type: Boolean, default: false } }
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  verifiedAt: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

vehicleSchema.index({ captain: 1 });
vehicleSchema.index({ registrationNumber: 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);
