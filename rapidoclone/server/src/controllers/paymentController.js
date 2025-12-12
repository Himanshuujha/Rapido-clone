// src/controllers/paymentController.js
const crypto = require('crypto');
const Razorpay = require('razorpay');
let Stripe;
try {
  Stripe = require('stripe');
} catch (e) {
  console.warn('Stripe not installed, some payment features will be unavailable');
  Stripe = null;
}
const Payment = require('../models/Payment');
const Ride = require('../models/Ride');
const User = require('../models/User');
const Captain = require('../models/Captain');
const Wallet = require('../models/Wallet');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { sendEmail } = require('../services/emailService');
const { generateInvoicePDF } = require('../services/pdfService');
const { emitToUser, emitToCaptain } = require('../services/socketService');
const logger = require('../utils/logger');

// ==========================================
// PAYMENT GATEWAY INITIALIZATION
// ==========================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

let stripe = null;
if (Stripe) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
}

// ==========================================
// PAYMENT ORDERS
// ==========================================

/**
 * @desc    Create a payment order (Razorpay/Stripe)
 * @route   POST /api/v1/payments/create-order
 * @access  Private (User)
 */
exports.createOrder = asyncHandler(async (req, res, next) => {
  const { 
    amount, 
    currency = 'INR', 
    rideId, 
    method = 'card', 
    gateway = 'razorpay' 
  } = req.body;
  const userId = req.user._id;

  // Validate amount
  if (!amount || amount <= 0) {
    return next(new AppError('Invalid payment amount', 400));
  }

  // Validate ride
  if (!rideId) {
    return next(new AppError('Ride ID is required', 400));
  }

  const ride = await Ride.findById(rideId);
  if (!ride) {
    return next(new AppError('Ride not found', 404));
  }

  if (ride.user.toString() !== userId.toString()) {
    return next(new AppError('Unauthorized to pay for this ride', 403));
  }

  // Check if payment already completed
  const existingPayment = await Payment.findOne({
    ride: rideId,
    status: 'completed'
  });

  if (existingPayment) {
    return next(new AppError('Payment already completed for this ride', 400));
  }

  let order;
  let payment;

  try {
    if (gateway === 'razorpay') {
      order = await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency: currency.toUpperCase(),
        receipt: `ride_${rideId}_${Date.now()}`,
        notes: {
          userId: userId.toString(),
          rideId: rideId.toString(),
        },
      });

      payment = await Payment.create({
        ride: rideId,
        user: userId,
        amount,
        method,
        status: 'pending',
        gateway: {
          provider: 'razorpay',
          orderId: order.id,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: {
          orderId: order.id,
          paymentId: payment._id,
          amount: order.amount,
          currency: order.currency,
          gateway: 'razorpay',
          key: process.env.RAZORPAY_KEY_ID,
        },
      });

    } else if (gateway === 'stripe') {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        metadata: {
          userId: userId.toString(),
          rideId: rideId.toString(),
        },
        automatic_payment_methods: { enabled: true },
      });

      payment = await Payment.create({
        ride: rideId,
        user: userId,
        amount,
        method,
        status: 'pending',
        gateway: {
          provider: 'stripe',
          orderId: paymentIntent.id,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Payment intent created successfully',
        data: {
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          paymentId: payment._id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          gateway: 'stripe',
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        },
      });

    } else {
      return next(new AppError('Invalid payment gateway', 400));
    }
  } catch (error) {
    logger.error('Payment order creation failed:', error);
    return next(new AppError('Failed to create payment order', 500));
  }
});

/**
 * @desc    Verify payment after completion
 * @route   POST /api/v1/payments/verify
 * @access  Private (User)
 */
exports.verifyPayment = asyncHandler(async (req, res, next) => {
  const { orderId, paymentId: gatewayPaymentId, signature, rideId } = req.body;
  const userId = req.user._id;

  const payment = await Payment.findOne({
    'gateway.orderId': orderId,
    user: userId,
  });

  if (!payment) {
    return next(new AppError('Payment record not found', 404));
  }

  if (payment.status === 'completed') {
    return res.status(200).json({
      success: true,
      message: 'Payment already verified',
      data: { payment },
    });
  }

  try {
    let isValid = false;
    const provider = payment.gateway.provider;

    if (provider === 'razorpay') {
      const body = orderId + '|' + gatewayPaymentId;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');

      isValid = expectedSignature === signature;

      if (isValid) {
        payment.gateway.paymentId = gatewayPaymentId;
        payment.gateway.signature = signature;
        payment.status = 'completed';
      }

    } else if (provider === 'stripe') {
      const paymentIntent = await stripe.paymentIntents.retrieve(orderId);
      isValid = paymentIntent.status === 'succeeded';

      if (isValid) {
        payment.gateway.paymentId = paymentIntent.id;
        payment.status = 'completed';
      }
    }

    if (!isValid) {
      payment.status = 'failed';
      await payment.save();
      return next(new AppError('Payment verification failed', 400));
    }

    await payment.save();

    // Update ride
    const ride = await Ride.findByIdAndUpdate(
      payment.ride,
      { paymentStatus: 'completed', paymentId: payment._id },
      { new: true }
    ).populate('captain');

    // Notify captain
    if (ride?.captain) {
      emitToCaptain(ride.captain._id, 'payment:received', {
        rideId: ride._id,
        amount: payment.amount,
        method: payment.method,
      });

      await updateCaptainEarnings(ride.captain._id, payment.amount, ride._id);
    }

    emitToUser(userId, 'payment:success', {
      paymentId: payment._id,
      amount: payment.amount,
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: { payment },
    });

  } catch (error) {
    logger.error('Payment verification failed:', error);
    payment.status = 'failed';
    await payment.save();
    return next(new AppError('Payment verification failed', 500));
  }
});

/**
 * @desc    Get payment details
 * @route   GET /api/v1/payments/:paymentId
 * @access  Private (User)
 */
exports.getPaymentDetails = asyncHandler(async (req, res, next) => {
  const { paymentId } = req.params;
  const userId = req.user._id;

  const payment = await Payment.findOne({
    _id: paymentId,
    user: userId,
  }).populate('ride', 'pickupAddress dropAddress fare distance duration status');

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  res.status(200).json({
    success: true,
    data: { payment },
  });
});

/**
 * @desc    Get payment status
 * @route   GET /api/v1/payments/:paymentId/status
 * @access  Private (User)
 */
exports.getPaymentStatus = asyncHandler(async (req, res, next) => {
  const { paymentId } = req.params;
  const userId = req.user._id;

  const payment = await Payment.findOne({
    _id: paymentId,
    user: userId,
  }).select('status method amount createdAt');

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      status: payment.status,
      method: payment.method,
      amount: payment.amount,
      createdAt: payment.createdAt,
    },
  });
});

// ==========================================
// PAYMENT HISTORY
// ==========================================

/**
 * @desc    Get payment history
 * @route   GET /api/v1/payments/history
 * @access  Private (User)
 */
exports.getPaymentHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { page = 1, limit = 10, status, startDate, endDate, method } = req.query;

  const query = { user: userId };

  if (status) query.status = status;
  if (method) query.method = method;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate('ride', 'pickupAddress dropAddress status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Payment.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: {
      payments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    },
  });
});

/**
 * @desc    Get payment summary/statistics
 * @route   GET /api/v1/payments/summary
 * @access  Private (User)
 */
exports.getPaymentSummary = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { period = 'month' } = req.query;

  const now = new Date();
  let startDate;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const [summary, methodBreakdown] = await Promise.all([
    Payment.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: startDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalPayments: { $sum: 1 },
          avgPayment: { $avg: '$amount' },
        },
      },
    ]),
    Payment.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: startDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      period,
      startDate,
      endDate: now,
      totalAmount: summary[0]?.totalAmount || 0,
      totalPayments: summary[0]?.totalPayments || 0,
      averagePayment: Math.round(summary[0]?.avgPayment || 0),
      byMethod: methodBreakdown.reduce((acc, item) => {
        acc[item._id] = { count: item.count, amount: item.amount };
        return acc;
      }, {}),
    },
  });
});

// ==========================================
// REFUNDS
// ==========================================

/**
 * @desc    Request a refund
 * @route   POST /api/v1/payments/refund
 * @access  Private (User)
 */
exports.requestRefund = asyncHandler(async (req, res, next) => {
  const { paymentId, reason, amount } = req.body;
  const userId = req.user._id;

  const payment = await Payment.findOne({
    _id: paymentId,
    user: userId,
  });

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  if (payment.status !== 'completed') {
    return next(new AppError('Can only refund completed payments', 400));
  }

  if (payment.refund?.refundId) {
    return next(new AppError('Refund already processed for this payment', 400));
  }

  const refundAmount = amount ? Math.min(amount, payment.amount) : payment.amount;

  try {
    let gatewayRefund;
    const provider = payment.gateway.provider;

    if (provider === 'razorpay') {
      gatewayRefund = await razorpay.payments.refund(payment.gateway.paymentId, {
        amount: Math.round(refundAmount * 100),
        notes: { reason, userId: userId.toString() },
      });
    } else if (provider === 'stripe') {
      gatewayRefund = await stripe.refunds.create({
        payment_intent: payment.gateway.orderId,
        amount: Math.round(refundAmount * 100),
        reason: 'requested_by_customer',
        metadata: { reason, userId: userId.toString() },
      });
    }

    payment.status = refundAmount === payment.amount ? 'refunded' : 'completed';
    payment.refund = {
      amount: refundAmount,
      reason,
      refundId: gatewayRefund.id,
      refundedAt: new Date(),
    };
    await payment.save();

    emitToUser(userId, 'refund:initiated', {
      paymentId: payment._id,
      amount: refundAmount,
    });

    res.status(200).json({
      success: true,
      message: 'Refund initiated successfully',
      data: { payment, refundAmount, refundId: gatewayRefund.id },
    });

  } catch (error) {
    logger.error('Refund initiation failed:', error);
    return next(new AppError('Failed to initiate refund', 500));
  }
});

/**
 * @desc    Get refund history
 * @route   GET /api/v1/payments/refunds
 * @access  Private (User)
 */
exports.getRefundHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { page = 1, limit = 10, status } = req.query;

  const query = {
    user: userId,
    'refund.refundId': { $exists: true },
  };

  if (status === 'refunded') {
    query.status = 'refunded';
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate('ride', 'pickupAddress dropAddress')
      .sort({ 'refund.refundedAt': -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Payment.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: {
      refunds: payments.map(p => ({
        paymentId: p._id,
        rideId: p.ride?._id,
        originalAmount: p.amount,
        refundAmount: p.refund.amount,
        reason: p.refund.reason,
        refundId: p.refund.refundId,
        refundedAt: p.refund.refundedAt,
        status: p.status,
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    },
  });
});

/**
 * @desc    Get refund details
 * @route   GET /api/v1/payments/refunds/:refundId
 * @access  Private (User)
 */
exports.getRefundDetails = asyncHandler(async (req, res, next) => {
  const { refundId } = req.params;
  const userId = req.user._id;

  const payment = await Payment.findOne({
    user: userId,
    'refund.refundId': refundId,
  }).populate('ride');

  if (!payment) {
    return next(new AppError('Refund not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      paymentId: payment._id,
      ride: payment.ride,
      originalAmount: payment.amount,
      refund: payment.refund,
      status: payment.status,
    },
  });
});

/**
 * @desc    Get refund status
 * @route   GET /api/v1/payments/refunds/:refundId/status
 * @access  Private (User)
 */
exports.getRefundStatus = asyncHandler(async (req, res, next) => {
  const { refundId } = req.params;
  const userId = req.user._id;

  const payment = await Payment.findOne({
    user: userId,
    'refund.refundId': refundId,
  }).select('status refund gateway');

  if (!payment) {
    return next(new AppError('Refund not found', 404));
  }

  // Optionally fetch real-time status from gateway
  let gatewayStatus = null;
  try {
    if (payment.gateway?.provider === 'razorpay') {
      const refund = await razorpay.refunds.fetch(refundId);
      gatewayStatus = refund.status;
    } else if (payment.gateway?.provider === 'stripe') {
      const refund = await stripe.refunds.retrieve(refundId);
      gatewayStatus = refund.status;
    }
  } catch (error) {
    logger.warn('Failed to fetch gateway refund status:', error);
  }

  res.status(200).json({
    success: true,
    data: {
      refundId,
      amount: payment.refund.amount,
      status: payment.status,
      gatewayStatus,
      refundedAt: payment.refund.refundedAt,
    },
  });
});

// ==========================================
// PAYMENT METHODS (Using Your User Model)
// ==========================================

/**
 * @desc    Get saved payment methods
 * @route   GET /api/v1/payments/methods
 * @access  Private (User)
 */
exports.getPaymentMethods = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const user = await User.findById(userId)
    .select('savedCards savedUPI preferences.preferredPayment wallet')
    .populate('wallet', 'balance');

  res.status(200).json({
    success: true,
    data: {
      cards: user.savedCards || [],
      upiIds: user.savedUPI || [],
      wallet: user.wallet ? { balance: user.wallet.balance } : null,
      defaultMethod: user.preferences?.preferredPayment || 'cash',
    },
  });
});

/**
 * @desc    Add a card
 * @route   POST /api/v1/payments/methods/card
 * @access  Private (User)
 */
exports.addCard = asyncHandler(async (req, res, next) => {
  const { cardNumber, expiryMonth, expiryYear, cvv, cardHolderName } = req.body;
  const userId = req.user._id;

  try {
    // Tokenize with Stripe
    const token = await stripe.tokens.create({
      card: {
        number: cardNumber,
        exp_month: expiryMonth,
        exp_year: expiryYear,
        cvc: cvv,
        name: cardHolderName,
      },
    });

    // Get or create Stripe customer
    let user = await User.findById(userId);
    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        phone: user.phone,
      });
      stripeCustomerId = customer.id;
      user.stripeCustomerId = stripeCustomerId;
    }

    // Add card to Stripe customer
    const card = await stripe.customers.createSource(stripeCustomerId, {
      source: token.id,
    });

    // Check if first card
    const isFirstCard = !user.savedCards || user.savedCards.length === 0;

    const savedCard = {
      id: card.id,
      last4: card.last4,
      brand: card.brand,
      expiryMonth: card.exp_month,
      expiryYear: card.exp_year,
      cardHolderName,
      isDefault: isFirstCard,
      addedAt: new Date(),
    };

    // Initialize savedCards if doesn't exist
    if (!user.savedCards) {
      user.savedCards = [];
    }
    user.savedCards.push(savedCard);

    // Update preferred payment if first card
    if (isFirstCard) {
      user.preferences.preferredPayment = 'card';
    }

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Card added successfully',
      data: { card: savedCard },
    });

  } catch (error) {
    logger.error('Add card failed:', error);
    if (error.type === 'StripeCardError') {
      return next(new AppError(error.message, 400));
    }
    return next(new AppError('Failed to add card', 500));
  }
});

/**
 * @desc    Remove a card
 * @route   DELETE /api/v1/payments/methods/card/:cardId
 * @access  Private (User)
 */
exports.removeCard = asyncHandler(async (req, res, next) => {
  const { cardId } = req.params;
  const userId = req.user._id;

  const user = await User.findById(userId);

  const cardIndex = user.savedCards?.findIndex(c => c.id === cardId);
  if (cardIndex === -1 || cardIndex === undefined) {
    return next(new AppError('Card not found', 404));
  }

  const wasDefault = user.savedCards[cardIndex].isDefault;

  try {
    // Remove from Stripe
    if (user.stripeCustomerId) {
      await stripe.customers.deleteSource(user.stripeCustomerId, cardId);
    }

    // Remove from database
    user.savedCards.splice(cardIndex, 1);

    // If removed card was default, set another as default
    if (wasDefault && user.savedCards.length > 0) {
      user.savedCards[0].isDefault = true;
    }

    // If no cards left and preferred was card, reset to cash
    if (user.savedCards.length === 0 && user.preferences.preferredPayment === 'card') {
      user.preferences.preferredPayment = 'cash';
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Card removed successfully',
    });

  } catch (error) {
    logger.error('Remove card failed:', error);
    return next(new AppError('Failed to remove card', 500));
  }
});

/**
 * @desc    Set card as default
 * @route   PUT /api/v1/payments/methods/card/:cardId/default
 * @access  Private (User)
 */
exports.setDefaultCard = asyncHandler(async (req, res, next) => {
  const { cardId } = req.params;
  const userId = req.user._id;

  const user = await User.findById(userId);

  const cardExists = user.savedCards?.find(c => c.id === cardId);
  if (!cardExists) {
    return next(new AppError('Card not found', 404));
  }

  // Update all cards' default status
  user.savedCards = user.savedCards.map(card => ({
    ...card.toObject(),
    isDefault: card.id === cardId,
  }));

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Default card updated',
  });
});

/**
 * @desc    Add UPI ID
 * @route   POST /api/v1/payments/methods/upi
 * @access  Private (User)
 */
exports.addUPI = asyncHandler(async (req, res, next) => {
  const { upiId } = req.body;
  const userId = req.user._id;

  // Validate UPI ID format
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  if (!upiRegex.test(upiId)) {
    return next(new AppError('Invalid UPI ID format', 400));
  }

  const user = await User.findById(userId);

  // Check if already exists
  if (user.savedUPI?.find(u => u.upiId === upiId)) {
    return next(new AppError('UPI ID already added', 400));
  }

  const isFirstUPI = !user.savedUPI || user.savedUPI.length === 0;

  const newUPI = {
    id: `upi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    upiId,
    verified: false,
    isDefault: isFirstUPI,
    addedAt: new Date(),
  };

  if (!user.savedUPI) {
    user.savedUPI = [];
  }
  user.savedUPI.push(newUPI);

  // Update preferred payment if first UPI
  if (isFirstUPI && user.preferences.preferredPayment === 'cash') {
    user.preferences.preferredPayment = 'upi';
  }

  await user.save();

  res.status(201).json({
    success: true,
    message: 'UPI ID added successfully',
    data: { upi: newUPI },
  });
});

/**
 * @desc    Verify UPI ID
 * @route   POST /api/v1/payments/methods/upi/verify
 * @access  Private (User)
 */
exports.verifyUPI = asyncHandler(async (req, res, next) => {
  const { upiId } = req.body;
  const userId = req.user._id;

  try {
    // Verify with Razorpay
    const validation = await razorpay.payments.validateVpa(upiId);

    if (!validation.success) {
      return next(new AppError('Invalid UPI ID', 400));
    }

    // Update in database
    await User.updateOne(
      { _id: userId, 'savedUPI.upiId': upiId },
      {
        $set: {
          'savedUPI.$.verified': true,
          'savedUPI.$.customerName': validation.customer_name,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: 'UPI ID verified successfully',
      data: {
        upiId,
        customerName: validation.customer_name,
        verified: true,
      },
    });

  } catch (error) {
    logger.error('UPI verification failed:', error);
    return next(new AppError('UPI verification failed', 500));
  }
});

/**
 * @desc    Remove UPI ID
 * @route   DELETE /api/v1/payments/methods/upi/:upiId
 * @access  Private (User)
 */
exports.removeUPI = asyncHandler(async (req, res, next) => {
  const { upiId } = req.params;
  const userId = req.user._id;

  const user = await User.findById(userId);

  const upiIndex = user.savedUPI?.findIndex(u => u.id === upiId);
  if (upiIndex === -1 || upiIndex === undefined) {
    return next(new AppError('UPI ID not found', 404));
  }

  const wasDefault = user.savedUPI[upiIndex].isDefault;

  user.savedUPI.splice(upiIndex, 1);

  // If removed was default, set another as default
  if (wasDefault && user.savedUPI.length > 0) {
    user.savedUPI[0].isDefault = true;
  }

  // If no UPI left and preferred was upi, reset to cash
  if (user.savedUPI.length === 0 && user.preferences.preferredPayment === 'upi') {
    user.preferences.preferredPayment = 'cash';
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'UPI ID removed successfully',
  });
});

/**
 * @desc    Set UPI as default
 * @route   PUT /api/v1/payments/methods/upi/:upiId/default
 * @access  Private (User)
 */
exports.setDefaultUPI = asyncHandler(async (req, res, next) => {
  const { upiId } = req.params;
  const userId = req.user._id;

  const user = await User.findById(userId);

  const upiExists = user.savedUPI?.find(u => u.id === upiId);
  if (!upiExists) {
    return next(new AppError('UPI ID not found', 404));
  }

  user.savedUPI = user.savedUPI.map(upi => ({
    ...upi.toObject(),
    isDefault: upi.id === upiId,
  }));

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Default UPI updated',
  });
});

/**
 * @desc    Get default payment method
 * @route   GET /api/v1/payments/methods/default
 * @access  Private (User)
 */
exports.getDefaultPaymentMethod = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const user = await User.findById(userId)
    .select('preferences.preferredPayment savedCards savedUPI wallet')
    .populate('wallet', 'balance');

  const preferredPayment = user.preferences?.preferredPayment || 'cash';

  let defaultDetails = null;

  switch (preferredPayment) {
    case 'card':
      defaultDetails = user.savedCards?.find(c => c.isDefault) || null;
      break;
    case 'upi':
      defaultDetails = user.savedUPI?.find(u => u.isDefault) || null;
      break;
    case 'wallet':
      defaultDetails = user.wallet ? { balance: user.wallet.balance } : null;
      break;
    case 'cash':
    default:
      defaultDetails = null;
  }

  res.status(200).json({
    success: true,
    data: {
      type: preferredPayment,
      details: defaultDetails,
    },
  });
});

/**
 * @desc    Set default payment method
 * @route   PUT /api/v1/payments/methods/default
 * @access  Private (User)
 */
exports.setDefaultPaymentMethod = asyncHandler(async (req, res, next) => {
  const { type, id } = req.body;
  const userId = req.user._id;

  const validTypes = ['card', 'upi', 'wallet', 'cash'];
  if (!validTypes.includes(type)) {
    return next(new AppError('Invalid payment type', 400));
  }

  const user = await User.findById(userId);

  // Validate the payment method exists
  if (type === 'card' && id) {
    const cardExists = user.savedCards?.find(c => c.id === id);
    if (!cardExists) {
      return next(new AppError('Card not found', 404));
    }
    // Set this card as default
    user.savedCards = user.savedCards.map(card => ({
      ...card.toObject(),
      isDefault: card.id === id,
    }));
  } else if (type === 'upi' && id) {
    const upiExists = user.savedUPI?.find(u => u.id === id);
    if (!upiExists) {
      return next(new AppError('UPI ID not found', 404));
    }
    // Set this UPI as default
    user.savedUPI = user.savedUPI.map(upi => ({
      ...upi.toObject(),
      isDefault: upi.id === id,
    }));
  } else if (type === 'wallet') {
    if (!user.wallet) {
      return next(new AppError('Wallet not found', 404));
    }
  }

  // Update preferred payment type
  user.preferences.preferredPayment = type;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Default payment method updated',
  });
});

// ==========================================
// UPI PAYMENTS
// ==========================================

/**
 * @desc    Initiate UPI payment
 * @route   POST /api/v1/payments/upi/initiate
 * @access  Private (User)
 */
exports.initiateUPIPayment = asyncHandler(async (req, res, next) => {
  const { amount, upiId, rideId } = req.body;
  const userId = req.user._id;

  if (!rideId) {
    return next(new AppError('Ride ID is required', 400));
  }

  const ride = await Ride.findById(rideId);
  if (!ride) {
    return next(new AppError('Ride not found', 404));
  }

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `upi_${rideId}_${Date.now()}`,
      notes: {
        userId: userId.toString(),
        rideId: rideId.toString(),
        upiId,
      },
    });

    const payment = await Payment.create({
      ride: rideId,
      user: userId,
      amount,
      method: 'upi',
      status: 'pending',
      gateway: {
        provider: 'razorpay',
        orderId: order.id,
      },
    });

    res.status(201).json({
      success: true,
      message: 'UPI payment initiated',
      data: {
        orderId: order.id,
        paymentId: payment._id,
        amount: order.amount,
        upiId,
      },
    });

  } catch (error) {
    logger.error('UPI payment initiation failed:', error);
    return next(new AppError('Failed to initiate UPI payment', 500));
  }
});

/**
 * @desc    Verify UPI payment
 * @route   POST /api/v1/payments/upi/verify
 * @access  Private (User)
 */
exports.verifyUPIPayment = asyncHandler(async (req, res, next) => {
  const { transactionId } = req.body;
  const userId = req.user._id;

  const payment = await Payment.findOne({
    user: userId,
    'gateway.paymentId': transactionId,
  });

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  try {
    const razorpayPayment = await razorpay.payments.fetch(transactionId);

    if (razorpayPayment.status === 'captured') {
      payment.status = 'completed';
      await payment.save();

      await Ride.findByIdAndUpdate(payment.ride, {
        paymentStatus: 'completed',
      });

      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: { payment },
      });
    } else {
      res.status(200).json({
        success: false,
        message: 'Payment not yet completed',
        data: { status: razorpayPayment.status },
      });
    }

  } catch (error) {
    logger.error('UPI verification failed:', error);
    return next(new AppError('Failed to verify UPI payment', 500));
  }
});

/**
 * @desc    Get available UPI apps
 * @route   GET /api/v1/payments/upi/apps
 * @access  Private (User)
 */
exports.getUPIApps = asyncHandler(async (req, res, next) => {
  const upiApps = [
    { id: 'gpay', name: 'Google Pay', package: 'com.google.android.apps.nbu.paisa.user', icon: 'gpay.png' },
    { id: 'phonepe', name: 'PhonePe', package: 'com.phonepe.app', icon: 'phonepe.png' },
    { id: 'paytm', name: 'Paytm', package: 'net.one97.paytm', icon: 'paytm.png' },
    { id: 'bhim', name: 'BHIM', package: 'in.org.npci.upiapp', icon: 'bhim.png' },
    { id: 'amazonpay', name: 'Amazon Pay', package: 'in.amazon.mShop.android.shopping', icon: 'amazonpay.png' },
  ];

  res.status(200).json({
    success: true,
    data: { apps: upiApps },
  });
});

// ==========================================
// NET BANKING
// ==========================================

/**
 * @desc    Get list of supported banks
 * @route   GET /api/v1/payments/netbanking/banks
 * @access  Private (User)
 */
exports.getSupportedBanks = asyncHandler(async (req, res, next) => {
  const banks = [
    { code: 'HDFC', name: 'HDFC Bank', icon: 'hdfc.png' },
    { code: 'ICIC', name: 'ICICI Bank', icon: 'icici.png' },
    { code: 'SBIN', name: 'State Bank of India', icon: 'sbi.png' },
    { code: 'AXIS', name: 'Axis Bank', icon: 'axis.png' },
    { code: 'KKBK', name: 'Kotak Mahindra Bank', icon: 'kotak.png' },
    { code: 'YESB', name: 'Yes Bank', icon: 'yes.png' },
    { code: 'PUNB', name: 'Punjab National Bank', icon: 'pnb.png' },
    { code: 'BARB', name: 'Bank of Baroda', icon: 'bob.png' },
    { code: 'CNRB', name: 'Canara Bank', icon: 'canara.png' },
    { code: 'UBIN', name: 'Union Bank of India', icon: 'union.png' },
  ];

  res.status(200).json({
    success: true,
    data: { banks },
  });
});

/**
 * @desc    Initiate net banking payment
 * @route   POST /api/v1/payments/netbanking/initiate
 * @access  Private (User)
 */
exports.initiateNetBanking = asyncHandler(async (req, res, next) => {
  const { amount, bankCode, rideId } = req.body;
  const userId = req.user._id;

  if (!rideId) {
    return next(new AppError('Ride ID is required', 400));
  }

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `nb_${rideId}_${Date.now()}`,
      notes: {
        userId: userId.toString(),
        rideId: rideId.toString(),
        bankCode,
      },
    });

    // Note: Using 'card' method as netbanking isn't in your enum
    // Consider adding 'netbanking' to your Payment model's method enum
    const payment = await Payment.create({
      ride: rideId,
      user: userId,
      amount,
      method: 'card', // or update your model to include 'netbanking'
      status: 'pending',
      gateway: {
        provider: 'razorpay',
        orderId: order.id,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Net banking payment initiated',
      data: {
        orderId: order.id,
        paymentId: payment._id,
        amount: order.amount,
        bankCode,
      },
    });

  } catch (error) {
    logger.error('Net banking initiation failed:', error);
    return next(new AppError('Failed to initiate net banking payment', 500));
  }
});

// ==========================================
// CAPTAIN PAYMENT ROUTES
// ==========================================

/**
 * @desc    Get captain's payment/earnings history
 * @route   GET /api/v1/payments/captain/history
 * @access  Private (Captain)
 */
exports.getCaptainPaymentHistory = asyncHandler(async (req, res, next) => {
  const captainId = req.captain._id;
  const { page = 1, limit = 10, startDate, endDate } = req.query;

  const query = { captain: captainId, paymentStatus: 'completed' };

  if (startDate || endDate) {
    query.completedAt = {};
    if (startDate) query.completedAt.$gte = new Date(startDate);
    if (endDate) query.completedAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const commissionRate = 0.20;

  const [rides, total] = await Promise.all([
    Ride.find(query)
      .populate('user', 'firstName lastName')
      .populate('paymentId', 'method')
      .select('pickupAddress dropAddress fare paymentStatus completedAt')
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Ride.countDocuments(query),
  ]);

  const earnings = rides.map(ride => ({
    rideId: ride._id,
    pickup: ride.pickupAddress,
    drop: ride.dropAddress,
    fare: ride.fare,
    commission: Math.round(ride.fare * commissionRate),
    earning: Math.round(ride.fare * (1 - commissionRate)),
    completedAt: ride.completedAt,
    user: ride.user ? `${ride.user.firstName} ${ride.user.lastName || ''}`.trim() : 'Unknown',
    paymentMethod: ride.paymentId?.method || 'cash',
  }));

  res.status(200).json({
    success: true,
    data: {
      earnings,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    },
  });
});

/**
 * @desc    Get captain's pending payments
 * @route   GET /api/v1/payments/captain/pending
 * @access  Private (Captain)
 */
exports.getCaptainPendingPayments = asyncHandler(async (req, res, next) => {
  const captainId = req.captain._id;

  // Find completed rides with cash payment
  const cashPayments = await Payment.find({ method: 'cash', status: 'completed' })
    .select('_id');
  const cashPaymentIds = cashPayments.map(p => p._id);

  const pendingRides = await Ride.find({
    captain: captainId,
    status: 'completed',
    paymentStatus: 'completed',
    paymentId: { $in: cashPaymentIds },
  }).select('pickupAddress dropAddress fare completedAt');

  const commissionRate = 0.20;
  const pending = pendingRides.map(ride => ({
    rideId: ride._id,
    fare: ride.fare,
    platformDue: Math.round(ride.fare * commissionRate),
    completedAt: ride.completedAt,
  }));

  const totalPlatformDue = pending.reduce((sum, p) => sum + p.platformDue, 0);

  res.status(200).json({
    success: true,
    data: {
      pending,
      totalPlatformDue,
      count: pending.length,
    },
  });
});

/**
 * @desc    Get captain's settled payments
 * @route   GET /api/v1/payments/captain/settled
 * @access  Private (Captain)
 */
exports.getCaptainSettledPayments = asyncHandler(async (req, res, next) => {
  const captainId = req.captain._id;
  const { page = 1, limit = 10, startDate, endDate } = req.query;

  // Find online payments (non-cash)
  const onlinePayments = await Payment.find({ 
    method: { $ne: 'cash' }, 
    status: 'completed' 
  }).select('_id method');
  const onlinePaymentIds = onlinePayments.map(p => p._id);

  const query = {
    captain: captainId,
    status: 'completed',
    paymentStatus: 'completed',
    paymentId: { $in: onlinePaymentIds },
  };

  if (startDate || endDate) {
    query.completedAt = {};
    if (startDate) query.completedAt.$gte = new Date(startDate);
    if (endDate) query.completedAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [rides, total] = await Promise.all([
    Ride.find(query)
      .populate('paymentId', 'method')
      .select('fare completedAt')
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Ride.countDocuments(query),
  ]);

  const settled = rides.map(ride => ({
    rideId: ride._id,
    fare: ride.fare,
    earning: Math.round(ride.fare * 0.80),
    settledAt: ride.completedAt,
    method: ride.paymentId?.method,
  }));

  res.status(200).json({
    success: true,
    data: {
      settled,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    },
  });
});

/**
 * @desc    Get captain's payment summary
 * @route   GET /api/v1/payments/captain/summary
 * @access  Private (Captain)
 */
exports.getCaptainPaymentSummary = asyncHandler(async (req, res, next) => {
  const captainId = req.captain._id;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const commissionRate = 0.20;

  const aggregateQuery = (dateFilter) => {
    const match = {
      captain: captainId,
      status: 'completed',
      paymentStatus: 'completed',
    };
    if (dateFilter) {
      match.completedAt = dateFilter;
    }
    return Ride.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalFare: { $sum: '$fare' },
          rides: { $sum: 1 },
        },
      },
    ]);
  };

  const [todayStats, weekStats, monthStats, totalStats] = await Promise.all([
    aggregateQuery({ $gte: todayStart }),
    aggregateQuery({ $gte: weekStart }),
    aggregateQuery({ $gte: monthStart }),
    aggregateQuery(null),
  ]);

  const calculateEarning = (fare) => Math.round(fare * (1 - commissionRate));

  res.status(200).json({
    success: true,
    data: {
      today: {
        rides: todayStats[0]?.rides || 0,
        fare: todayStats[0]?.totalFare || 0,
        earnings: calculateEarning(todayStats[0]?.totalFare || 0),
      },
      thisWeek: {
        rides: weekStats[0]?.rides || 0,
        fare: weekStats[0]?.totalFare || 0,
        earnings: calculateEarning(weekStats[0]?.totalFare || 0),
      },
      thisMonth: {
        rides: monthStats[0]?.rides || 0,
        fare: monthStats[0]?.totalFare || 0,
        earnings: calculateEarning(monthStats[0]?.totalFare || 0),
      },
      lifetime: {
        rides: totalStats[0]?.rides || 0,
        fare: totalStats[0]?.totalFare || 0,
        earnings: calculateEarning(totalStats[0]?.totalFare || 0),
      },
      commissionRate: `${commissionRate * 100}%`,
    },
  });
});

// ==========================================
// INVOICES
// ==========================================

/**
 * @desc    Get all invoices
 * @route   GET /api/v1/payments/invoices
 * @access  Private (User)
 */
exports.getInvoices = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { page = 1, limit = 10, startDate, endDate } = req.query;

  const query = { user: userId, status: 'completed' };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate('ride', 'pickupAddress dropAddress distance duration')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Payment.countDocuments(query),
  ]);

  const invoices = payments.map(payment => formatInvoice(payment));

  res.status(200).json({
    success: true,
    data: {
      invoices,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    },
  });
});

/**
 * @desc    Get invoice details
 * @route   GET /api/v1/payments/invoices/:invoiceId
 * @access  Private (User)
 */
exports.getInvoiceDetails = asyncHandler(async (req, res, next) => {
  const { invoiceId } = req.params;
  const userId = req.user._id;

  // invoiceId could be payment _id or invoice number
  let payment = await Payment.findOne({
    _id: invoiceId,
    user: userId,
  }).populate('ride').populate('user', 'firstName lastName email phone');

  if (!payment) {
    return next(new AppError('Invoice not found', 404));
  }

  res.status(200).json({
    success: true,
    data: { invoice: formatInvoice(payment, true) },
  });
});

/**
 * @desc    Download invoice PDF
 * @route   GET /api/v1/payments/invoices/:invoiceId/download
 * @access  Private (User)
 */
exports.downloadInvoice = asyncHandler(async (req, res, next) => {
  const { invoiceId } = req.params;
  const userId = req.user._id;

  const payment = await Payment.findOne({
    _id: invoiceId,
    user: userId,
  }).populate('ride').populate('user', 'firstName lastName email phone');

  if (!payment) {
    return next(new AppError('Invoice not found', 404));
  }

  try {
    const invoiceData = formatInvoice(payment, true);
    const pdfBuffer = await generateInvoicePDF(invoiceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice_${invoiceData.invoiceNumber}.pdf`
    );
    res.send(pdfBuffer);

  } catch (error) {
    logger.error('PDF generation failed:', error);
    return next(new AppError('Failed to generate invoice PDF', 500));
  }
});

/**
 * @desc    Email invoice
 * @route   POST /api/v1/payments/invoices/:invoiceId/email
 * @access  Private (User)
 */
exports.emailInvoice = asyncHandler(async (req, res, next) => {
  const { invoiceId } = req.params;
  const { email } = req.body;
  const userId = req.user._id;

  const payment = await Payment.findOne({
    _id: invoiceId,
    user: userId,
  }).populate('ride').populate('user', 'firstName lastName email phone');

  if (!payment) {
    return next(new AppError('Invoice not found', 404));
  }

  const recipientEmail = email || payment.user.email;
  const invoiceData = formatInvoice(payment, true);
  const userName = `${payment.user.firstName} ${payment.user.lastName || ''}`.trim();

  try {
    const pdfBuffer = await generateInvoicePDF(invoiceData);

    await sendEmail({
      to: recipientEmail,
      subject: `Invoice #${invoiceData.invoiceNumber} - RideApp`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Your Invoice</h2>
          <p>Dear ${userName},</p>
          <p>Please find attached the invoice for your recent ride.</p>
          <br/>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0;"><strong>Invoice Number:</strong></td>
              <td>${invoiceData.invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Amount:</strong></td>
              <td>₹${invoiceData.amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Date:</strong></td>
              <td>${new Date(invoiceData.date).toLocaleDateString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Payment Method:</strong></td>
              <td>${invoiceData.method.toUpperCase()}</td>
            </tr>
          </table>
          <br/>
          <p>Thank you for using RideApp!</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;"/>
          <p style="color: #888; font-size: 12px;">
            This is an automated email. Please do not reply directly to this message.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `invoice_${invoiceData.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: `Invoice sent to ${recipientEmail}`,
    });

  } catch (error) {
    logger.error('Email invoice failed:', error);
    return next(new AppError('Failed to email invoice', 500));
  }
});

// ==========================================
// WEBHOOKS
// ==========================================

/**
 * @desc    Razorpay webhook handler
 * @route   POST /api/v1/payments/webhook/razorpay
 * @access  Public (Webhook)
 */
exports.razorpayWebhook = asyncHandler(async (req, res, next) => {
  const signature = req.headers['x-razorpay-signature'];
  const body = req.body;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');

  if (signature !== expectedSignature) {
    logger.warn('Invalid Razorpay webhook signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = body.event;
  const payload = body.payload;

  logger.info(`Razorpay webhook received: ${event}`);

  try {
    switch (event) {
      case 'payment.captured':
        await handleRazorpayPaymentCaptured(payload.payment.entity);
        break;
      case 'payment.failed':
        await handleRazorpayPaymentFailed(payload.payment.entity);
        break;
      case 'refund.created':
      case 'refund.processed':
        await handleRazorpayRefund(payload.refund.entity);
        break;
      default:
        logger.info(`Unhandled Razorpay event: ${event}`);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    logger.error('Razorpay webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * @desc    Stripe webhook handler
 * @route   POST /api/v1/payments/webhook/stripe
 * @access  Public (Webhook)
 */
exports.stripeWebhook = asyncHandler(async (req, res, next) => {
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    logger.warn('Invalid Stripe webhook signature:', error.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  logger.info(`Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleStripePaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handleStripePaymentFailed(event.data.object);
        break;
      case 'charge.refunded':
        await handleStripeRefund(event.data.object);
        break;
      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    logger.error('Stripe webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * @desc    Paytm webhook handler
 * @route   POST /api/v1/payments/webhook/paytm
 * @access  Public (Webhook)
 */
exports.paytmWebhook = asyncHandler(async (req, res, next) => {
  const params = req.body;

  logger.info('Paytm webhook received:', params);

  if (params.STATUS === 'TXN_SUCCESS') {
    const payment = await Payment.findOne({
      'gateway.orderId': params.ORDERID,
    });

    if (payment) {
      payment.status = 'completed';
      payment.gateway.paymentId = params.TXNID;
      await payment.save();

      await Ride.findByIdAndUpdate(payment.ride, {
        paymentStatus: 'completed',
      });
    }
  } else if (params.STATUS === 'TXN_FAILURE') {
    const payment = await Payment.findOne({
      'gateway.orderId': params.ORDERID,
    });

    if (payment) {
      payment.status = 'failed';
      await payment.save();
    }
  }

  res.status(200).json({ received: true });
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function handleRazorpayPaymentCaptured(paymentEntity) {
  const payment = await Payment.findOne({
    'gateway.orderId': paymentEntity.order_id,
  });

  if (payment && payment.status !== 'completed') {
    payment.status = 'completed';
    payment.gateway.paymentId = paymentEntity.id;
    await payment.save();

    await Ride.findByIdAndUpdate(payment.ride, {
      paymentStatus: 'completed',
      paymentId: payment._id,
    });

    const ride = await Ride.findById(payment.ride);
    if (ride?.captain) {
      await updateCaptainEarnings(ride.captain, payment.amount, ride._id);
    }

    emitToUser(payment.user, 'payment:success', {
      paymentId: payment._id,
      amount: payment.amount,
    });
  }
}

async function handleRazorpayPaymentFailed(paymentEntity) {
  const payment = await Payment.findOne({
    'gateway.orderId': paymentEntity.order_id,
  });

  if (payment) {
    payment.status = 'failed';
    await payment.save();

    emitToUser(payment.user, 'payment:failed', {
      paymentId: payment._id,
      reason: paymentEntity.error_description || 'Payment failed',
    });
  }
}

async function handleRazorpayRefund(refundEntity) {
  const payment = await Payment.findOne({
    'gateway.paymentId': refundEntity.payment_id,
  });

  if (payment) {
    payment.status = 'refunded';
    payment.refund = {
      amount: refundEntity.amount / 100,
      refundId: refundEntity.id,
      refundedAt: new Date(),
    };
    await payment.save();

    emitToUser(payment.user, 'refund:completed', {
      paymentId: payment._id,
      amount: payment.refund.amount,
    });
  }
}

async function handleStripePaymentSucceeded(paymentIntent) {
  const payment = await Payment.findOne({
    'gateway.orderId': paymentIntent.id,
  });

  if (payment && payment.status !== 'completed') {
    payment.status = 'completed';
    payment.gateway.paymentId = paymentIntent.id;
    await payment.save();

    await Ride.findByIdAndUpdate(payment.ride, {
      paymentStatus: 'completed',
      paymentId: payment._id,
    });

    const ride = await Ride.findById(payment.ride);
    if (ride?.captain) {
      await updateCaptainEarnings(ride.captain, payment.amount, ride._id);
    }

    emitToUser(payment.user, 'payment:success', {
      paymentId: payment._id,
      amount: payment.amount,
    });
  }
}

async function handleStripePaymentFailed(paymentIntent) {
  const payment = await Payment.findOne({
    'gateway.orderId': paymentIntent.id,
  });

  if (payment) {
    payment.status = 'failed';
    await payment.save();

    emitToUser(payment.user, 'payment:failed', {
      paymentId: payment._id,
      reason: paymentIntent.last_payment_error?.message || 'Payment failed',
    });
  }
}

async function handleStripeRefund(charge) {
  if (charge.refunded) {
    const payment = await Payment.findOne({
      'gateway.orderId': charge.payment_intent,
    });

    if (payment) {
      payment.status = 'refunded';
      payment.refund = {
        amount: charge.amount_refunded / 100,
        refundedAt: new Date(),
      };
      await payment.save();

      emitToUser(payment.user, 'refund:completed', {
        paymentId: payment._id,
        amount: payment.refund.amount,
      });
    }
  }
}

async function updateCaptainEarnings(captainId, amount, rideId) {
  const commissionRate = 0.20;
  const captainEarning = Math.round(amount * (1 - commissionRate));

  await Captain.findByIdAndUpdate(captainId, {
    $inc: {
      'earnings.total': captainEarning,
      'earnings.today': captainEarning,
      totalRides: 1,
    },
  });

  logger.info(`Captain ${captainId} earned ₹${captainEarning} from ride ${rideId}`);
}

function formatInvoice(payment, detailed = false) {
  const tax = Math.round(payment.amount * 0.05);
  const subtotal = payment.amount - tax;

  const invoice = {
    invoiceNumber: `INV-${payment._id.toString().slice(-8).toUpperCase()}`,
    paymentId: payment._id,
    amount: payment.amount,
    subtotal,
    tax,
    method: payment.method,
    status: payment.status,
    date: payment.createdAt,
  };

  if (detailed) {
    invoice.ride = payment.ride;
    invoice.user = payment.user;
    invoice.gateway = payment.gateway?.provider;
  }

  return invoice;
}