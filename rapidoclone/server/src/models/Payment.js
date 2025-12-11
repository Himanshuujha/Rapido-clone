// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  ride: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  method: {
    type: String,
    enum: ['cash', 'wallet', 'card', 'upi'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  gateway: {
    provider: String, // razorpay, stripe
    orderId: String,
    paymentId: String,
    signature: String
  },
  refund: {
    amount: Number,
    reason: String,
    refundId: String,
    refundedAt: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);