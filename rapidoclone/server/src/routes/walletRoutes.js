// src/routes/walletRoutes.js
const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { protect, protectCaptain, protectBoth } = require('../middlewares/auth');
const {
  validateTopup,
  validateWithdraw,
  validateTransfer,
} = require('../validators/walletValidator');

// ==========================================
// COMMON WALLET ROUTES (User/Captain)
// ==========================================

/**
 * @route   GET /api/v1/wallet
 * @desc    Get wallet details
 * @access  Private (User/Captain)
 */
router.get('/', protectBoth, walletController.getWallet);

/**
 * @route   GET /api/v1/wallet/balance
 * @desc    Get wallet balance
 * @access  Private (User/Captain)
 */
router.get('/balance', protectBoth, walletController.getBalance);

/**
 * @route   GET /api/v1/wallet/transactions
 * @desc    Get transaction history
 * @access  Private (User/Captain)
 * @query   { page, limit, type, category, startDate, endDate }
 */
router.get('/transactions', protectBoth, walletController.getTransactions);

/**
 * @route   GET /api/v1/wallet/transactions/:transactionId
 * @desc    Get transaction details
 * @access  Private (User/Captain)
 */
router.get('/transactions/:transactionId', protectBoth, walletController.getTransactionDetails);

/**
 * @route   GET /api/v1/wallet/transactions/summary
 * @desc    Get transaction summary
 * @access  Private (User/Captain)
 * @query   { period: week | month | year }
 */
router.get('/transactions/summary', protectBoth, walletController.getTransactionSummary);

// ==========================================
// USER WALLET ROUTES
// ==========================================

/**
 * @route   POST /api/v1/wallet/topup
 * @desc    Add money to wallet
 * @access  Private (User)
 * @body    { amount, paymentMethod }
 */
router.post(
  '/topup',
  protect,
  validateTopup,
  walletController.initiateTopup
);

/**
 * @route   POST /api/v1/wallet/topup/verify
 * @desc    Verify topup payment
 * @access  Private (User)
 * @body    { orderId, paymentId, signature }
 */
router.post('/topup/verify', protect, walletController.verifyTopup);

/**
 * @route   GET /api/v1/wallet/topup/history
 * @desc    Get topup history
 * @access  Private (User)
 * @query   { page, limit, status }
 */
router.get('/topup/history', protect, walletController.getTopupHistory);

/**
 * @route   POST /api/v1/wallet/transfer
 * @desc    Transfer money to another user
 * @access  Private (User)
 * @body    { recipientPhone, amount, note? }
 */
router.post(
  '/transfer',
  protect,
  validateTransfer,
  walletController.transferMoney
);

/**
 * @route   GET /api/v1/wallet/transfer/history
 * @desc    Get transfer history
 * @access  Private (User)
 * @query   { page, limit, type: sent | received }
 */
router.get('/transfer/history', protect, walletController.getTransferHistory);

/**
 * @route   POST /api/v1/wallet/pay
 * @desc    Pay for ride using wallet
 * @access  Private (User)
 * @body    { rideId, amount }
 */
router.post('/pay', protect, walletController.payFromWallet);

/**
 * @route   GET /api/v1/wallet/cashback
 * @desc    Get cashback history
 * @access  Private (User)
 * @query   { page, limit }
 */
router.get('/cashback', protect, walletController.getCashbackHistory);

/**
 * @route   GET /api/v1/wallet/cashback/pending
 * @desc    Get pending cashback
 * @access  Private (User)
 */
router.get('/cashback/pending', protect, walletController.getPendingCashback);

// ==========================================
// CAPTAIN WALLET ROUTES
// ==========================================

/**
 * @route   GET /api/v1/wallet/captain
 * @desc    Get captain wallet details
 * @access  Private (Captain)
 */
router.get('/captain', protectCaptain, walletController.getCaptainWallet);

/**
 * @route   GET /api/v1/wallet/captain/balance
 * @desc    Get captain wallet balance
 * @access  Private (Captain)
 */
router.get('/captain/balance', protectCaptain, walletController.getCaptainBalance);

/**
 * @route   GET /api/v1/wallet/captain/earnings
 * @desc    Get captain earnings in wallet
 * @access  Private (Captain)
 */
router.get('/captain/earnings', protectCaptain, walletController.getCaptainEarnings);

/**
 * @route   POST /api/v1/wallet/captain/withdraw
 * @desc    Withdraw money to bank
 * @access  Private (Captain)
 * @body    { amount }
 */
router.post(
  '/captain/withdraw',
  protectCaptain,
  validateWithdraw,
  walletController.requestWithdrawal
);

/**
 * @route   GET /api/v1/wallet/captain/withdrawals
 * @desc    Get withdrawal history
 * @access  Private (Captain)
 * @query   { page, limit, status }
 */
router.get('/captain/withdrawals', protectCaptain, walletController.getWithdrawalHistory);

/**
 * @route   GET /api/v1/wallet/captain/withdrawals/:withdrawalId
 * @desc    Get withdrawal details
 * @access  Private (Captain)
 */
router.get('/captain/withdrawals/:withdrawalId', protectCaptain, walletController.getWithdrawalDetails);

/**
 * @route   POST /api/v1/wallet/captain/withdrawals/:withdrawalId/cancel
 * @desc    Cancel pending withdrawal
 * @access  Private (Captain)
 */
router.post('/captain/withdrawals/:withdrawalId/cancel', protectCaptain, walletController.cancelWithdrawal);

/**
 * @route   GET /api/v1/wallet/captain/settlement
 * @desc    Get settlement info
 * @access  Private (Captain)
 */
router.get('/captain/settlement', protectCaptain, walletController.getSettlementInfo);

/**
 * @route   GET /api/v1/wallet/captain/settlement/history
 * @desc    Get settlement history
 * @access  Private (Captain)
 * @query   { page, limit, startDate, endDate }
 */
router.get('/captain/settlement/history', protectCaptain, walletController.getSettlementHistory);

// ==========================================
// WALLET SETTINGS
// ==========================================

/**
 * @route   GET /api/v1/wallet/settings
 * @desc    Get wallet settings
 * @access  Private (User/Captain)
 */
router.get('/settings', protectBoth, walletController.getWalletSettings);

/**
 * @route   PUT /api/v1/wallet/settings
 * @desc    Update wallet settings
 * @access  Private (User/Captain)
 * @body    { autoPay?, autoPayLimit?, lowBalanceAlert? }
 */
router.put('/settings', protectBoth, walletController.updateWalletSettings);

/**
 * @route   PUT /api/v1/wallet/auto-pay
 * @desc    Toggle auto-pay from wallet
 * @access  Private (User)
 * @body    { enabled, limit? }
 */
router.put('/auto-pay', protect, walletController.toggleAutoPay);

/**
 * @route   PUT /api/v1/wallet/auto-withdraw
 * @desc    Toggle auto-withdraw for captain
 * @access  Private (Captain)
 * @body    { enabled, threshold?, schedule? }
 */
router.put('/auto-withdraw', protectCaptain, walletController.toggleAutoWithdraw);

// ==========================================
// WALLET OFFERS & REWARDS
// ==========================================

/**
 * @route   GET /api/v1/wallet/offers
 * @desc    Get wallet offers (cashback on topup, etc.)
 * @access  Private (User)
 */
router.get('/offers', protect, walletController.getWalletOffers);

/**
 * @route   GET /api/v1/wallet/offers/:offerId
 * @desc    Get offer details
 * @access  Private (User)
 */
router.get('/offers/:offerId', protect, walletController.getOfferDetails);

/**
 * @route   POST /api/v1/wallet/offers/:offerId/apply
 * @desc    Apply wallet offer
 * @access  Private (User)
 * @body    { topupAmount }
 */
router.post('/offers/:offerId/apply', protect, walletController.applyWalletOffer);

/**
 * @route   GET /api/v1/wallet/rewards
 * @desc    Get wallet rewards
 * @access  Private (User)
 */
router.get('/rewards', protect, walletController.getRewards);

/**
 * @route   POST /api/v1/wallet/rewards/:rewardId/redeem
 * @desc    Redeem reward
 * @access  Private (User)
 */
router.post('/rewards/:rewardId/redeem', protect, walletController.redeemReward);

// ==========================================
// REFERRAL BONUS
// ==========================================

/**
 * @route   GET /api/v1/wallet/referral-bonus
 * @desc    Get referral bonus in wallet
 * @access  Private (User)
 */
router.get('/referral-bonus', protect, walletController.getReferralBonus);

/**
 * @route   GET /api/v1/wallet/referral-bonus/history
 * @desc    Get referral bonus history
 * @access  Private (User)
 */
router.get('/referral-bonus/history', protect, walletController.getReferralBonusHistory);

// ==========================================
// WALLET LIMITS
// ==========================================

/**
 * @route   GET /api/v1/wallet/limits
 * @desc    Get wallet limits
 * @access  Private (User/Captain)
 */
router.get('/limits', protectBoth, walletController.getWalletLimits);

/**
 * @route   POST /api/v1/wallet/upgrade
 * @desc    Request wallet upgrade (higher limits)
 * @access  Private (User)
 * @body    { kycDocuments }
 */
router.post('/upgrade', protect, walletController.requestWalletUpgrade);

module.exports = router;