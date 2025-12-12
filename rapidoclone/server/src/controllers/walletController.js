// src/controllers/walletController.js
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const Captain = require('../models/Captain');
const Ride = require('../models/Ride');
const Payment = require('../models/Payment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { emitToUser, emitToCaptain } = require('../services/socketService');
const logger = require('../utils/logger');

// ==========================================
// RAZORPAY INITIALIZATION
// ==========================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ==========================================
// WALLET LIMITS
// ==========================================

const WALLET_LIMITS = {
  maxBalance: 100000,
  minTopup: 10,
  maxTopup: 10000,
  minWithdrawal: 100,
  maxWithdrawal: 50000,
  minTransfer: 1,
  maxTransfer: 5000,
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get owner info from request
 */
function getOwnerInfo(req) {
  if (req.user) {
    return { ownerId: req.user._id, ownerType: 'User' };
  } else if (req.captain) {
    return { ownerId: req.captain._id, ownerType: 'Captain' };
  }
  throw new AppError('Unauthorized', 401);
}

/**
 * Get or create wallet
 */
async function getOrCreateWallet(ownerId, ownerType) {
  let wallet = await Wallet.findOne({ owner: ownerId, ownerType });

  if (!wallet) {
    wallet = await Wallet.create({
      owner: ownerId,
      ownerType,
      balance: 0,
      currency: 'INR',
      isActive: true,
    });
  }

  return wallet;
}

/**
 * Emit wallet update to user/captain
 */
function emitWalletUpdate(ownerId, ownerType, event, data) {
  if (ownerType === 'User') {
    emitToUser(ownerId, event, data);
  } else {
    emitToCaptain(ownerId, event, data);
  }
}

// ==========================================
// COMMON WALLET ROUTES (User/Captain)
// ==========================================

/**
 * @desc    Get wallet details
 * @route   GET /api/v1/wallet
 * @access  Private (User/Captain)
 */
exports.getWallet = asyncHandler(async (req, res, next) => {
  const { ownerId, ownerType } = getOwnerInfo(req);

  const wallet = await getOrCreateWallet(ownerId, ownerType);

  // Get recent payments as transactions
  let recentTransactions = [];

  if (ownerType === 'User') {
    recentTransactions = await Payment.find({ user: ownerId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('amount method status createdAt ride')
      .populate('ride', 'pickupAddress dropAddress');
  } else {
    // For captain, get completed rides as earnings
    const rides = await Ride.find({
      captain: ownerId,
      status: 'completed',
      paymentStatus: 'completed',
    })
      .sort({ completedAt: -1 })
      .limit(10)
      .select('fare pickupAddress dropAddress completedAt');

    recentTransactions = rides.map(ride => ({
      type: 'earning',
      amount: Math.round(ride.fare * 0.80), // 80% after commission
      description: `Ride earning`,
      ride: {
        pickupAddress: ride.pickupAddress,
        dropAddress: ride.dropAddress,
      },
      createdAt: ride.completedAt,
    }));
  }

  res.status(200).json({
    success: true,
    data: {
      wallet: {
        id: wallet._id,
        balance: wallet.balance,
        currency: wallet.currency,
        isActive: wallet.isActive,
        createdAt: wallet.createdAt,
      },
      recentTransactions,
    },
  });
});

/**
 * @desc    Get wallet balance
 * @route   GET /api/v1/wallet/balance
 * @access  Private (User/Captain)
 */
exports.getBalance = asyncHandler(async (req, res, next) => {
  const { ownerId, ownerType } = getOwnerInfo(req);

  const wallet = await Wallet.findOne({ owner: ownerId, ownerType });

  res.status(200).json({
    success: true,
    data: {
      balance: wallet?.balance || 0,
      currency: wallet?.currency || 'INR',
      isActive: wallet?.isActive || false,
    },
  });
});

/**
 * @desc    Get transaction history
 * @route   GET /api/v1/wallet/transactions
 * @access  Private (User/Captain)
 */
exports.getTransactions = asyncHandler(async (req, res, next) => {
  const { ownerId, ownerType } = getOwnerInfo(req);
  const { page = 1, limit = 20, type, startDate, endDate } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  let transactions = [];
  let total = 0;

  if (ownerType === 'User') {
    // Get payments as transactions
    const query = { user: ownerId };

    if (type === 'credit') {
      query.status = 'refunded';
    } else if (type === 'debit') {
      query.status = 'completed';
      query.method = 'wallet';
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    [transactions, total] = await Promise.all([
      Payment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('ride', 'pickupAddress dropAddress'),
      Payment.countDocuments(query),
    ]);

    transactions = transactions.map(t => ({
      id: t._id,
      type: t.method === 'wallet' ? 'debit' : 'credit',
      category: t.method === 'wallet' ? 'ride_payment' : 'refund',
      amount: t.amount,
      status: t.status,
      description: t.method === 'wallet' ? 'Ride payment' : 'Refund',
      ride: t.ride,
      createdAt: t.createdAt,
    }));

  } else {
    // Captain - get ride earnings
    const query = {
      captain: ownerId,
      status: 'completed',
      paymentStatus: 'completed',
    };

    if (startDate || endDate) {
      query.completedAt = {};
      if (startDate) query.completedAt.$gte = new Date(startDate);
      if (endDate) query.completedAt.$lte = new Date(endDate);
    }

    [transactions, total] = await Promise.all([
      Ride.find(query)
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('fare pickupAddress dropAddress completedAt'),
      Ride.countDocuments(query),
    ]);

    transactions = transactions.map(t => ({
      id: t._id,
      type: 'credit',
      category: 'ride_earning',
      amount: Math.round(t.fare * 0.80),
      status: 'completed',
      description: 'Ride earning',
      ride: {
        pickupAddress: t.pickupAddress,
        dropAddress: t.dropAddress,
      },
      createdAt: t.completedAt,
    }));
  }

  res.status(200).json({
    success: true,
    data: {
      transactions,
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
 * @desc    Get transaction details
 * @route   GET /api/v1/wallet/transactions/:transactionId
 * @access  Private (User/Captain)
 */
exports.getTransactionDetails = asyncHandler(async (req, res, next) => {
  const { transactionId } = req.params;
  const { ownerId, ownerType } = getOwnerInfo(req);

  let transaction;

  if (ownerType === 'User') {
    const payment = await Payment.findOne({
      _id: transactionId,
      user: ownerId,
    }).populate('ride', 'pickupAddress dropAddress fare distance duration');

    if (!payment) {
      return next(new AppError('Transaction not found', 404));
    }

    transaction = {
      id: payment._id,
      type: payment.method === 'wallet' ? 'debit' : 'credit',
      category: payment.method === 'wallet' ? 'ride_payment' : 'payment',
      amount: payment.amount,
      status: payment.status,
      method: payment.method,
      ride: payment.ride,
      createdAt: payment.createdAt,
    };
  } else {
    const ride = await Ride.findOne({
      _id: transactionId,
      captain: ownerId,
      status: 'completed',
    }).populate('user', 'firstName lastName');

    if (!ride) {
      return next(new AppError('Transaction not found', 404));
    }

    transaction = {
      id: ride._id,
      type: 'credit',
      category: 'ride_earning',
      amount: Math.round(ride.fare * 0.80),
      grossAmount: ride.fare,
      commission: Math.round(ride.fare * 0.20),
      status: 'completed',
      ride: {
        pickupAddress: ride.pickupAddress,
        dropAddress: ride.dropAddress,
        distance: ride.distance,
        duration: ride.duration,
        user: ride.user,
      },
      createdAt: ride.completedAt,
    };
  }

  res.status(200).json({
    success: true,
    data: { transaction },
  });
});

/**
 * @desc    Get transaction summary
 * @route   GET /api/v1/wallet/transactions/summary
 * @access  Private (User/Captain)
 */
exports.getTransactionSummary = asyncHandler(async (req, res, next) => {
  const { ownerId, ownerType } = getOwnerInfo(req);
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

  let summary;

  if (ownerType === 'User') {
    const [walletPayments, refunds] = await Promise.all([
      Payment.aggregate([
        {
          $match: {
            user: ownerId,
            method: 'wallet',
            status: 'completed',
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      Payment.aggregate([
        {
          $match: {
            user: ownerId,
            status: 'refunded',
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$refund.amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    summary = {
      totalDebits: walletPayments[0]?.total || 0,
      totalCredits: refunds[0]?.total || 0,
      debitCount: walletPayments[0]?.count || 0,
      creditCount: refunds[0]?.count || 0,
    };
  } else {
    const earnings = await Ride.aggregate([
      {
        $match: {
          captain: ownerId,
          status: 'completed',
          paymentStatus: 'completed',
          completedAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalFare: { $sum: '$fare' },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalFare = earnings[0]?.totalFare || 0;
    summary = {
      totalCredits: Math.round(totalFare * 0.80),
      totalCommission: Math.round(totalFare * 0.20),
      totalDebits: 0,
      creditCount: earnings[0]?.count || 0,
      debitCount: 0,
    };
  }

  res.status(200).json({
    success: true,
    data: {
      period,
      startDate,
      endDate: now,
      ...summary,
      netChange: (summary.totalCredits || 0) - (summary.totalDebits || 0),
    },
  });
});

// ==========================================
// USER WALLET ROUTES
// ==========================================

/**
 * @desc    Initiate wallet topup
 * @route   POST /api/v1/wallet/topup
 * @access  Private (User)
 */
exports.initiateTopup = asyncHandler(async (req, res, next) => {
  const { amount } = req.body;
  const userId = req.user._id;

  // Validate amount
  if (!amount || amount < WALLET_LIMITS.minTopup) {
    return next(new AppError(`Minimum topup amount is ₹${WALLET_LIMITS.minTopup}`, 400));
  }

  if (amount > WALLET_LIMITS.maxTopup) {
    return next(new AppError(`Maximum topup amount is ₹${WALLET_LIMITS.maxTopup}`, 400));
  }

  const wallet = await getOrCreateWallet(userId, 'User');

  if (!wallet.isActive) {
    return next(new AppError('Wallet is not active', 400));
  }

  // Check max balance limit
  if (wallet.balance + amount > WALLET_LIMITS.maxBalance) {
    return next(new AppError(`Maximum wallet balance is ₹${WALLET_LIMITS.maxBalance}`, 400));
  }

  try {
    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `topup_${userId}_${Date.now()}`,
      notes: {
        userId: userId.toString(),
        walletId: wallet._id.toString(),
        type: 'wallet_topup',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Topup initiated',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
        walletBalance: wallet.balance,
      },
    });

  } catch (error) {
    logger.error('Topup initiation failed:', error);
    return next(new AppError('Failed to initiate topup', 500));
  }
});

/**
 * @desc    Verify topup payment
 * @route   POST /api/v1/wallet/topup/verify
 * @access  Private (User)
 */
exports.verifyTopup = asyncHandler(async (req, res, next) => {
  const { orderId, paymentId, signature } = req.body;
  const userId = req.user._id;

  // Verify signature
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature !== signature) {
    return next(new AppError('Payment verification failed', 400));
  }

  // Fetch payment details from Razorpay
  const razorpayPayment = await razorpay.payments.fetch(paymentId);

  if (razorpayPayment.status !== 'captured') {
    return next(new AppError('Payment not captured', 400));
  }

  const amount = razorpayPayment.amount / 100;

  // Update wallet balance
  const wallet = await Wallet.findOneAndUpdate(
    { owner: userId, ownerType: 'User' },
    { $inc: { balance: amount } },
    { new: true }
  );

  // Notify user
  emitToUser(userId, 'wallet:topup:success', {
    amount,
    balance: wallet.balance,
  });

  res.status(200).json({
    success: true,
    message: 'Topup successful',
    data: {
      amount,
      newBalance: wallet.balance,
      transactionId: paymentId,
    },
  });
});

/**
 * @desc    Get topup history
 * @route   GET /api/v1/wallet/topup/history
 * @access  Private (User)
 */
exports.getTopupHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { page = 1, limit = 20 } = req.query;

  // Since we don't have a separate transaction model,
  // we'll return empty or you can track topups via Payment model with a special type
  // For now, returning a placeholder response

  res.status(200).json({
    success: true,
    data: {
      topups: [],
      message: 'Topup history is available in your payment gateway dashboard',
      pagination: {
        current: parseInt(page),
        pages: 0,
        total: 0,
        limit: parseInt(limit),
      },
    },
  });
});

/**
 * @desc    Transfer money to another user
 * @route   POST /api/v1/wallet/transfer
 * @access  Private (User)
 */
exports.transferMoney = asyncHandler(async (req, res, next) => {
  const { recipientPhone, amount, note } = req.body;
  const userId = req.user._id;

  // Validate amount
  if (!amount || amount < WALLET_LIMITS.minTransfer) {
    return next(new AppError(`Minimum transfer amount is ₹${WALLET_LIMITS.minTransfer}`, 400));
  }

  if (amount > WALLET_LIMITS.maxTransfer) {
    return next(new AppError(`Maximum transfer amount is ₹${WALLET_LIMITS.maxTransfer}`, 400));
  }

  // Find sender wallet
  const senderWallet = await Wallet.findOne({ owner: userId, ownerType: 'User' });

  if (!senderWallet) {
    return next(new AppError('Wallet not found', 404));
  }

  if (!senderWallet.isActive) {
    return next(new AppError('Your wallet is not active', 400));
  }

  if (senderWallet.balance < amount) {
    return next(new AppError('Insufficient balance', 400));
  }

  // Find recipient
  const recipient = await User.findOne({ phone: recipientPhone });

  if (!recipient) {
    return next(new AppError('Recipient not found', 404));
  }

  if (recipient._id.toString() === userId.toString()) {
    return next(new AppError('Cannot transfer to yourself', 400));
  }

  // Get or create recipient wallet
  const recipientWallet = await getOrCreateWallet(recipient._id, 'User');

  if (!recipientWallet.isActive) {
    return next(new AppError('Recipient wallet is not active', 400));
  }

  // Check recipient max balance
  if (recipientWallet.balance + amount > WALLET_LIMITS.maxBalance) {
    return next(new AppError('Transfer would exceed recipient wallet limit', 400));
  }

  // Perform transfer using transaction
  const session = await Wallet.startSession();

  try {
    await session.withTransaction(async () => {
      // Debit sender
      await Wallet.findByIdAndUpdate(
        senderWallet._id,
        { $inc: { balance: -amount } },
        { session }
      );

      // Credit recipient
      await Wallet.findByIdAndUpdate(
        recipientWallet._id,
        { $inc: { balance: amount } },
        { session }
      );
    });

    await session.endSession();

    // Get updated balances
    const updatedSenderWallet = await Wallet.findById(senderWallet._id);
    const updatedRecipientWallet = await Wallet.findById(recipientWallet._id);

    // Notify both parties
    emitToUser(userId, 'wallet:transfer:sent', {
      amount,
      recipient: `${recipient.firstName} ${recipient.lastName || ''}`.trim(),
      balance: updatedSenderWallet.balance,
    });

    emitToUser(recipient._id, 'wallet:transfer:received', {
      amount,
      sender: `${req.user.firstName} ${req.user.lastName || ''}`.trim(),
      balance: updatedRecipientWallet.balance,
      note,
    });

    res.status(200).json({
      success: true,
      message: 'Transfer successful',
      data: {
        amount,
        recipient: {
          name: `${recipient.firstName} ${recipient.lastName || ''}`.trim(),
          phone: recipientPhone,
        },
        newBalance: updatedSenderWallet.balance,
        note,
      },
    });

  } catch (error) {
    await session.endSession();
    logger.error('Transfer failed:', error);
    return next(new AppError('Transfer failed', 500));
  }
});

/**
 * @desc    Get transfer history
 * @route   GET /api/v1/wallet/transfer/history
 * @access  Private (User)
 */
exports.getTransferHistory = asyncHandler(async (req, res, next) => {
  // Without a separate transaction model, we can't track transfers
  // You would need to add a transactions array to the Wallet model
  // or create a separate transaction model

  res.status(200).json({
    success: true,
    data: {
      transfers: [],
      message: 'Transfer history requires transaction tracking to be enabled',
      pagination: {
        current: 1,
        pages: 0,
        total: 0,
        limit: 20,
      },
    },
  });
});

/**
 * @desc    Pay for ride using wallet
 * @route   POST /api/v1/wallet/pay
 * @access  Private (User)
 */
exports.payFromWallet = asyncHandler(async (req, res, next) => {
  const { rideId, amount } = req.body;
  const userId = req.user._id;

  if (!rideId || !amount || amount <= 0) {
    return next(new AppError('Invalid ride or amount', 400));
  }

  // Find ride
  const ride = await Ride.findById(rideId);

  if (!ride) {
    return next(new AppError('Ride not found', 404));
  }

  if (ride.user.toString() !== userId.toString()) {
    return next(new AppError('Unauthorized to pay for this ride', 403));
  }

  if (ride.paymentStatus === 'completed') {
    return next(new AppError('Payment already completed', 400));
  }

  // Find wallet
  const wallet = await Wallet.findOne({ owner: userId, ownerType: 'User' });

  if (!wallet) {
    return next(new AppError('Wallet not found', 404));
  }

  if (!wallet.isActive) {
    return next(new AppError('Wallet is not active', 400));
  }

  if (wallet.balance < amount) {
    return next(new AppError('Insufficient wallet balance', 400));
  }

  // Perform payment using transaction
  const session = await Wallet.startSession();

  try {
    let payment;
    let updatedWallet;

    await session.withTransaction(async () => {
      // Debit wallet
      updatedWallet = await Wallet.findByIdAndUpdate(
        wallet._id,
        { $inc: { balance: -amount } },
        { new: true, session }
      );

      // Create payment record
      payment = await Payment.create([{
        ride: rideId,
        user: userId,
        amount,
        method: 'wallet',
        status: 'completed',
      }], { session });

      // Update ride
      await Ride.findByIdAndUpdate(
        rideId,
        {
          paymentStatus: 'completed',
          paymentId: payment[0]._id,
        },
        { session }
      );

      // Credit captain wallet if exists
      if (ride.captain) {
        const captainEarning = Math.round(amount * 0.80); // 80% to captain

        await Wallet.findOneAndUpdate(
          { owner: ride.captain, ownerType: 'Captain' },
          { $inc: { balance: captainEarning } },
          { upsert: true, session }
        );
      }
    });

    await session.endSession();

    // Notify user
    emitToUser(userId, 'wallet:payment:success', {
      rideId,
      amount,
      balance: updatedWallet.balance,
    });

    // Notify captain
    if (ride.captain) {
      emitToCaptain(ride.captain, 'payment:received', {
        rideId,
        amount,
        earning: Math.round(amount * 0.80),
        method: 'wallet',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment successful',
      data: {
        paymentId: payment[0]._id,
        rideId,
        amount,
        newBalance: updatedWallet.balance,
      },
    });

  } catch (error) {
    await session.endSession();
    logger.error('Wallet payment failed:', error);
    return next(new AppError('Payment failed', 500));
  }
});

/**
 * @desc    Get cashback history
 * @route   GET /api/v1/wallet/cashback
 * @access  Private (User)
 */
exports.getCashbackHistory = asyncHandler(async (req, res, next) => {
  res.status(200).json({
    success: true,
    data: {
      cashbacks: [],
      totalCashback: 0,
      message: 'Cashback tracking requires additional models',
    },
  });
});

/**
 * @desc    Get pending cashback
 * @route   GET /api/v1/wallet/cashback/pending
 * @access  Private (User)
 */
exports.getPendingCashback = asyncHandler(async (req, res, next) => {
  res.status(200).json({
    success: true,
    data: {
      pendingCashbacks: [],
      totalPending: 0,
    },
  });
});

// ==========================================
// CAPTAIN WALLET ROUTES
// ==========================================

/**
 * @desc    Get captain wallet details
 * @route   GET /api/v1/wallet/captain
 * @access  Private (Captain)
 */
exports.getCaptainWallet = asyncHandler(async (req, res, next) => {
  const captainId = req.captain._id;

  const wallet = await getOrCreateWallet(captainId, 'Captain');

  // Get today's earnings
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayRides = await Ride.aggregate([
    {
      $match: {
        captain: captainId,
        status: 'completed',
        paymentStatus: 'completed',
        completedAt: { $gte: todayStart },
      },
    },
    {
      $group: {
        _id: null,
        totalFare: { $sum: '$fare' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Get recent earnings
  const recentRides = await Ride.find({
    captain: captainId,
    status: 'completed',
    paymentStatus: 'completed',
  })
    .sort({ completedAt: -1 })
    .limit(10)
    .select('fare pickupAddress dropAddress completedAt');

  const recentEarnings = recentRides.map(ride => ({
    id: ride._id,
    type: 'credit',
    amount: Math.round(ride.fare * 0.80),
    grossAmount: ride.fare,
    description: 'Ride earning',
    ride: {
      pickupAddress: ride.pickupAddress,
      dropAddress: ride.dropAddress,
    },
    createdAt: ride.completedAt,
  }));

  res.status(200).json({
    success: true,
    data: {
      wallet: {
        id: wallet._id,
        balance: wallet.balance,
        currency: wallet.currency,
        isActive: wallet.isActive,
      },
      todayEarnings: {
        amount: Math.round((todayRides[0]?.totalFare || 0) * 0.80),
        rides: todayRides[0]?.count || 0,
      },
      recentEarnings,
    },
  });
});

/**
 * @desc    Get captain wallet balance
 * @route   GET /api/v1/wallet/captain/balance
 * @access  Private (Captain)
 */
exports.getCaptainBalance = asyncHandler(async (req, res, next) => {
  const captainId = req.captain._id;

  const wallet = await Wallet.findOne({ owner: captainId, ownerType: 'Captain' });

  res.status(200).json({
    success: true,
    data: {
      balance: wallet?.balance || 0,
      availableForWithdrawal: wallet?.balance || 0,
      currency: wallet?.currency || 'INR',
    },
  });
});

/**
 * @desc    Get captain earnings in wallet
 * @route   GET /api/v1/wallet/captain/earnings
 * @access  Private (Captain)
 */
exports.getCaptainEarnings = asyncHandler(async (req, res, next) => {
  const captainId = req.captain._id;

  // Date ranges
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const earningsQuery = async (dateFilter) => {
    const match = {
      captain: captainId,
      status: 'completed',
      paymentStatus: 'completed',
    };
    if (dateFilter) match.completedAt = dateFilter;

    return Ride.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalFare: { $sum: '$fare' },
          count: { $sum: 1 },
        },
      },
    ]);
  };

  const [todayStats, weekStats, monthStats, lifetimeStats] = await Promise.all([
    earningsQuery({ $gte: todayStart }),
    earningsQuery({ $gte: weekStart }),
    earningsQuery({ $gte: monthStart }),
    earningsQuery(null),
  ]);

  const formatEarnings = (stats) => ({
    grossEarnings: stats[0]?.totalFare || 0,
    netEarnings: Math.round((stats[0]?.totalFare || 0) * 0.80),
    commission: Math.round((stats[0]?.totalFare || 0) * 0.20),
    rides: stats[0]?.count || 0,
  });

  res.status(200).json({
    success: true,
    data: {
      today: formatEarnings(todayStats),
      thisWeek: formatEarnings(weekStats),
      thisMonth: formatEarnings(monthStats),
      lifetime: formatEarnings(lifetimeStats),
      commissionRate: '20%',
    },
  });
});

/**
 * @desc    Request withdrawal
 * @route   POST /api/v1/wallet/captain/withdraw
 * @access  Private (Captain)
 */
exports.requestWithdrawal = asyncHandler(async (req, res, next) => {
  const { amount } = req.body;
  const captainId = req.captain._id;

  // Validate amount
  if (!amount || amount < WALLET_LIMITS.minWithdrawal) {
    return next(new AppError(`Minimum withdrawal amount is ₹${WALLET_LIMITS.minWithdrawal}`, 400));
  }

  if (amount > WALLET_LIMITS.maxWithdrawal) {
    return next(new AppError(`Maximum withdrawal amount is ₹${WALLET_LIMITS.maxWithdrawal}`, 400));
  }

  const wallet = await Wallet.findOne({ owner: captainId, ownerType: 'Captain' });

  if (!wallet) {
    return next(new AppError('Wallet not found', 404));
  }

  if (!wallet.isActive) {
    return next(new AppError('Wallet is not active', 400));
  }

  if (wallet.balance < amount) {
    return next(new AppError('Insufficient balance', 400));
  }

  // Get captain bank details
  const captain = await Captain.findById(captainId).select('bankDetails firstName lastName');

  if (!captain.bankDetails?.accountNumber) {
    return next(new AppError('Please add bank details first', 400));
  }

  // Deduct from wallet (withdrawal will be processed manually or via payout API)
  wallet.balance -= amount;
  await wallet.save();

  // In production, you would integrate with Razorpay Payouts or similar
  const withdrawalId = `WD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Notify captain
  emitToCaptain(captainId, 'wallet:withdrawal:requested', {
    withdrawalId,
    amount,
    status: 'processing',
  });

  // Log withdrawal for manual processing
  logger.info('Withdrawal requested:', {
    withdrawalId,
    captainId,
    amount,
    bankDetails: {
      accountNumber: `XXXX${captain.bankDetails.accountNumber.slice(-4)}`,
      ifscCode: captain.bankDetails.ifscCode,
      bankName: captain.bankDetails.bankName,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Withdrawal request submitted',
    data: {
      withdrawalId,
      amount,
      status: 'processing',
      bankDetails: {
        accountNumber: `XXXX${captain.bankDetails.accountNumber.slice(-4)}`,
        bankName: captain.bankDetails.bankName,
      },
      newBalance: wallet.balance,
      estimatedProcessingTime: '1-3 business days',
    },
  });
});

/**
 * @desc    Get withdrawal history
 * @route   GET /api/v1/wallet/captain/withdrawals
 * @access  Private (Captain)
 */
exports.getWithdrawalHistory = asyncHandler(async (req, res, next) => {
  // Without a withdrawal model, we can't track history
  res.status(200).json({
    success: true,
    data: {
      withdrawals: [],
      message: 'Withdrawal history requires additional tracking',
      pagination: {
        current: 1,
        pages: 0,
        total: 0,
        limit: 20,
      },
    },
  });
});

/**
 * @desc    Get withdrawal details
 * @route   GET /api/v1/wallet/captain/withdrawals/:withdrawalId
 * @access  Private (Captain)
 */
exports.getWithdrawalDetails = asyncHandler(async (req, res, next) => {
  return next(new AppError('Withdrawal details require additional tracking model', 400));
});

/**
 * @desc    Cancel pending withdrawal
 * @route   POST /api/v1/wallet/captain/withdrawals/:withdrawalId/cancel
 * @access  Private (Captain)
 */
exports.cancelWithdrawal = asyncHandler(async (req, res, next) => {
  return next(new AppError('Withdrawal cancellation requires additional tracking model', 400));
});

/**
 * @desc    Get settlement info
 * @route   GET /api/v1/wallet/captain/settlement
 * @access  Private (Captain)
 */
exports.getSettlementInfo = asyncHandler(async (req, res, next) => {
  const captainId = req.captain._id;

  const wallet = await Wallet.findOne({ owner: captainId, ownerType: 'Captain' });
  const captain = await Captain.findById(captainId).select('bankDetails');

  // Calculate cash collection (platform's share from cash rides)
  const cashRides = await Ride.aggregate([
    {
      $match: {
        captain: captainId,
        status: 'completed',
        paymentStatus: 'completed',
      },
    },
    {
      $lookup: {
        from: 'payments',
        localField: '_id',
        foreignField: 'ride',
        as: 'payment',
      },
    },
    { $unwind: '$payment' },
    { $match: { 'payment.method': 'cash' } },
    {
      $group: {
        _id: null,
        totalFare: { $sum: '$fare' },
      },
    },
  ]);

  const cashCollected = cashRides[0]?.totalFare || 0;
  const platformDue = Math.round(cashCollected * 0.20); // 20% commission

  // Next settlement date (next Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(10, 0, 0, 0);

  res.status(200).json({
    success: true,
    data: {
      walletBalance: wallet?.balance || 0,
      cashCollectedFromRides: cashCollected,
      platformDue,
      netPayable: (wallet?.balance || 0) - platformDue,
      nextSettlementDate: nextMonday,
      bankDetails: captain.bankDetails ? {
        accountNumber: `XXXX${captain.bankDetails.accountNumber?.slice(-4) || ''}`,
        bankName: captain.bankDetails.bankName,
        ifscCode: captain.bankDetails.ifscCode,
      } : null,
      settlementSchedule: 'Weekly (Every Monday)',
    },
  });
});

/**
 * @desc    Get settlement history
 * @route   GET /api/v1/wallet/captain/settlement/history
 * @access  Private (Captain)
 */
exports.getSettlementHistory = asyncHandler(async (req, res, next) => {
  res.status(200).json({
    success: true,
    data: {
      settlements: [],
      message: 'Settlement history requires additional tracking',
      pagination: {
        current: 1,
        pages: 0,
        total: 0,
        limit: 20,
      },
    },
  });
});

// ==========================================
// WALLET SETTINGS
// ==========================================

/**
 * @desc    Get wallet settings
 * @route   GET /api/v1/wallet/settings
 * @access  Private (User/Captain)
 */
exports.getWalletSettings = asyncHandler(async (req, res, next) => {
  const { ownerId, ownerType } = getOwnerInfo(req);

  // Default settings (since we don't have a settings model)
  const settings = {
    autoPay: false,
    autoPayLimit: 500,
    lowBalanceAlert: 100,
    autoWithdraw: false,
    autoWithdrawThreshold: 1000,
  };

  res.status(200).json({
    success: true,
    data: { settings },
  });
});

/**
 * @desc    Update wallet settings
 * @route   PUT /api/v1/wallet/settings
 * @access  Private (User/Captain)
 */
exports.updateWalletSettings = asyncHandler(async (req, res, next) => {
  // Without a settings model, we can't persist settings
  res.status(200).json({
    success: true,
    message: 'Settings updated (note: persistence requires additional model)',
    data: { settings: req.body },
  });
});

/**
 * @desc    Toggle auto-pay from wallet
 * @route   PUT /api/v1/wallet/auto-pay
 * @access  Private (User)
 */
exports.toggleAutoPay = asyncHandler(async (req, res, next) => {
  const { enabled, limit = 500 } = req.body;

  res.status(200).json({
    success: true,
    message: `Auto-pay ${enabled ? 'enabled' : 'disabled'}`,
    data: {
      autoPay: enabled,
      autoPayLimit: limit,
      note: 'Persistence requires additional model',
    },
  });
});

/**
 * @desc    Toggle auto-withdraw for captain
 * @route   PUT /api/v1/wallet/auto-withdraw
 * @access  Private (Captain)
 */
exports.toggleAutoWithdraw = asyncHandler(async (req, res, next) => {
  const { enabled, threshold = 1000, schedule = 'weekly' } = req.body;
  const captainId = req.captain._id;

  // Check bank details
  const captain = await Captain.findById(captainId).select('bankDetails');
  if (enabled && !captain.bankDetails?.accountNumber) {
    return next(new AppError('Please add bank details first', 400));
  }

  res.status(200).json({
    success: true,
    message: `Auto-withdraw ${enabled ? 'enabled' : 'disabled'}`,
    data: {
      autoWithdraw: enabled,
      autoWithdrawThreshold: threshold,
      autoWithdrawSchedule: schedule,
      note: 'Persistence requires additional model',
    },
  });
});

// ==========================================
// WALLET OFFERS & REWARDS
// ==========================================

/**
 * @desc    Get wallet offers
 * @route   GET /api/v1/wallet/offers
 * @access  Private (User)
 */
exports.getWalletOffers = asyncHandler(async (req, res, next) => {
  // Static offers (in production, these would come from database)
  const offers = [
    {
      id: 'offer_1',
      title: 'Add ₹500, Get ₹50 Cashback',
      description: 'Add ₹500 or more to your wallet and get ₹50 cashback',
      cashbackType: 'fixed',
      cashbackValue: 50,
      minTopupAmount: 500,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
    {
      id: 'offer_2',
      title: '10% Cashback on First Topup',
      description: 'Get 10% cashback on your first wallet topup (max ₹100)',
      cashbackType: 'percentage',
      cashbackValue: 10,
      maxCashback: 100,
      minTopupAmount: 100,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  ];

  res.status(200).json({
    success: true,
    data: { offers },
  });
});

/**
 * @desc    Get offer details
 * @route   GET /api/v1/wallet/offers/:offerId
 * @access  Private (User)
 */
exports.getOfferDetails = asyncHandler(async (req, res, next) => {
  const { offerId } = req.params;

  // Static offer details
  const offer = {
    id: offerId,
    title: 'Wallet Cashback Offer',
    description: 'Add money to wallet and get cashback',
    terms: [
      'Offer valid for limited time only',
      'Cashback will be credited within 24 hours',
      'Cannot be combined with other offers',
    ],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };

  res.status(200).json({
    success: true,
    data: { offer },
  });
});

/**
 * @desc    Apply wallet offer
 * @route   POST /api/v1/wallet/offers/:offerId/apply
 * @access  Private (User)
 */
exports.applyWalletOffer = asyncHandler(async (req, res, next) => {
  const { offerId } = req.params;
  const { topupAmount } = req.body;

  // Calculate cashback (simplified)
  let cashbackAmount = 0;

  if (topupAmount >= 500) {
    cashbackAmount = 50;
  } else if (topupAmount >= 100) {
    cashbackAmount = Math.min(topupAmount * 0.1, 100);
  }

  res.status(200).json({
    success: true,
    message: 'Offer applied',
    data: {
      offerId,
      topupAmount,
      cashbackAmount: Math.round(cashbackAmount),
      totalCredit: topupAmount + Math.round(cashbackAmount),
      note: 'Cashback will be credited after successful topup',
    },
  });
});

/**
 * @desc    Get wallet rewards
 * @route   GET /api/v1/wallet/rewards
 * @access  Private (User)
 */
exports.getRewards = asyncHandler(async (req, res, next) => {
  res.status(200).json({
    success: true,
    data: {
      pendingRewards: [],
      totalPending: 0,
      totalEarned: 0,
      message: 'Rewards tracking requires additional implementation',
    },
  });
});

/**
 * @desc    Redeem reward
 * @route   POST /api/v1/wallet/rewards/:rewardId/redeem
 * @access  Private (User)
 */
exports.redeemReward = asyncHandler(async (req, res, next) => {
  return next(new AppError('Reward redemption requires additional implementation', 400));
});

// ==========================================
// REFERRAL BONUS
// ==========================================

/**
 * @desc    Get referral bonus in wallet
 * @route   GET /api/v1/wallet/referral-bonus
 * @access  Private (User)
 */
exports.getReferralBonus = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // Count successful referrals
  const referralCount = await User.countDocuments({ referredBy: userId });

  // Assuming ₹100 per referral
  const bonusPerReferral = 100;
  const totalEarned = referralCount * bonusPerReferral;

  res.status(200).json({
    success: true,
    data: {
      totalEarned,
      referralCount,
      bonusPerReferral,
      referralCode: req.user.referralCode,
    },
  });
});

/**
 * @desc    Get referral bonus history
 * @route   GET /api/v1/wallet/referral-bonus/history
 * @access  Private (User)
 */
exports.getReferralBonusHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get users referred by this user
  const [referredUsers, total] = await Promise.all([
    User.find({ referredBy: userId })
      .select('firstName lastName createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    User.countDocuments({ referredBy: userId }),
  ]);

  const bonusPerReferral = 100;

  const bonuses = referredUsers.map(user => ({
    id: user._id,
    referredUser: `${user.firstName} ${user.lastName || ''}`.trim(),
    amount: bonusPerReferral,
    status: 'completed',
    createdAt: user.createdAt,
  }));

  res.status(200).json({
    success: true,
    data: {
      bonuses,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    },
  });
});

// ==========================================
// WALLET LIMITS
// ==========================================

/**
 * @desc    Get wallet limits
 * @route   GET /api/v1/wallet/limits
 * @access  Private (User/Captain)
 */
exports.getWalletLimits = asyncHandler(async (req, res, next) => {
  const { ownerId, ownerType } = getOwnerInfo(req);

  const wallet = await Wallet.findOne({ owner: ownerId, ownerType });

  res.status(200).json({
    success: true,
    data: {
      limits: WALLET_LIMITS,
      currentBalance: wallet?.balance || 0,
      availableTopup: WALLET_LIMITS.maxBalance - (wallet?.balance || 0),
    },
  });
});

/**
 * @desc    Request wallet upgrade
 * @route   POST /api/v1/wallet/upgrade
 * @access  Private (User)
 */
exports.requestWalletUpgrade = asyncHandler(async (req, res, next) => {
  const { kycDocuments } = req.body;
  const userId = req.user._id;

  // In production, you'd handle KYC document upload and verification
  logger.info('Wallet upgrade requested:', { userId, documentsCount: kycDocuments?.length });

  res.status(200).json({
    success: true,
    message: 'Upgrade request submitted. You will be notified once verified.',
    data: {
      status: 'pending',
      estimatedTime: '2-3 business days',
    },
  });
});