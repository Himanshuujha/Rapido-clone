// src/models/Vehicle.js
const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    captainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Captain',
      required: true,
      unique: true,
      index: true,
    },
    vehicleType: {
      type: String,
      required: true,
      enum: ['auto', 'bike', 'cab', 'premium'],
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    make: {
      type: String,
      required: true,
    },
    model: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    color: String,
    seatingCapacity: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    rc: {
      number: String,
      expiryDate: Date,
      document: String, // Cloudinary URL
    },
    insurance: {
      provider: String,
      policyNumber: String,
      expiryDate: Date,
      document: String, // Cloudinary URL
    },
    pollution: {
      certificateNumber: String,
      expiryDate: Date,
      document: String, // Cloudinary URL
    },
    images: {
      front: String,
      back: String,
      left: String,
      right: String,
      interior: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    verificationDetails: {
      rejectionReason: String,
      verifiedAt: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vehicle', vehicleSchema);
