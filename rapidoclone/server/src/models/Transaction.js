// src/models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: [
      'ride_payment',
      'ride_earnings',
      'wallet_topup',
      'refund',
      'withdrawal',
      'bonus',
      'referral',
      'cancellation_fee'
    ],
    required: true
  },
  reference: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceType'
  },
  referenceType: {
    type: String,
    enum: ['Ride', 'Payment']
  },
  description: String,
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  balanceAfter: Number
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);