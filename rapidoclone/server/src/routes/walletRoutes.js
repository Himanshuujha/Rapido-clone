const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { protect, protectCaptain, protectBoth } = require('../middlewares/auth');
const {
  validateTopup,
  validateWithdraw,
  validateTransfer,
} = require('../validators/walletValidator');

router.get('/', protectBoth, walletController.getWallet);
router.get('/balance', protectBoth, walletController.getBalance);
router.get('/transactions', protectBoth, walletController.getTransactions);
router.get('/transactions/:transactionId', protectBoth, walletController.getTransactionDetails);
router.get('/transactions/summary', protectBoth, walletController.getTransactionSummary);

router.post('/topup', protect, validateTopup, walletController.initiateTopup);
router.post('/topup/verify', protect, walletController.verifyTopup);
router.get('/topup/history', protect, walletController.getTopupHistory);
router.post('/transfer', protect, validateTransfer, walletController.transferMoney);
router.get('/transfer/history', protect, walletController.getTransferHistory);
router.post('/pay', protect, walletController.payFromWallet);
router.get('/cashback', protect, walletController.getCashbackHistory);
router.get('/cashback/pending', protect, walletController.getPendingCashback);

router.get('/captain', protectCaptain, walletController.getCaptainWallet);
router.get('/captain/balance', protectCaptain, walletController.getCaptainBalance);
router.get('/captain/earnings', protectCaptain, walletController.getCaptainEarnings);
router.post('/captain/withdraw', protectCaptain, validateWithdraw, walletController.requestWithdrawal);
router.get('/captain/withdrawals', protectCaptain, walletController.getWithdrawalHistory);
router.get('/captain/withdrawals/:withdrawalId', protectCaptain, walletController.getWithdrawalDetails);
router.post('/captain/withdrawals/:withdrawalId/cancel', protectCaptain, walletController.cancelWithdrawal);
router.get('/captain/settlement', protectCaptain, walletController.getSettlementInfo);
router.get('/captain/settlement/history', protectCaptain, walletController.getSettlementHistory);

router.get('/settings', protectBoth, walletController.getWalletSettings);
router.put('/settings', protectBoth, walletController.updateWalletSettings);
router.put('/auto-pay', protect, walletController.toggleAutoPay);
router.put('/auto-withdraw', protectCaptain, walletController.toggleAutoWithdraw);

router.get('/offers', protect, walletController.getWalletOffers);
router.get('/offers/:offerId', protect, walletController.getOfferDetails);
router.post('/offers/:offerId/apply', protect, walletController.applyWalletOffer);
router.get('/rewards', protect, walletController.getRewards);
router.post('/rewards/:rewardId/redeem', protect, walletController.redeemReward);

router.get('/referral-bonus', protect, walletController.getReferralBonus);
router.get('/referral-bonus/history', protect, walletController.getReferralBonusHistory);

router.get('/limits', protectBoth, walletController.getWalletLimits);
router.post('/upgrade', protect, walletController.requestWalletUpgrade);

module.exports = router;
