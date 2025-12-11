// models/Coupon.js
const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  description: String,
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  maxDiscount: Number,
  minOrderValue: {
    type: Number,
    default: 0
  },
  validFrom: Date,
  validUntil: Date,
  usageLimit: Number,
  usedCount: {
    type: Number,
    default: 0
  },
  perUserLimit: {
    type: Number,
    default: 1
  },
  applicableVehicles: [{
    type: String,
    enum: ['bike', 'auto', 'cab']
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  usedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    usedAt: Date
  }]
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);