// src/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect, protectCaptain } = require('../middlewares/auth');
const {
  validateCreateOrder,
  validateVerifyPayment,
  validateAddCard,
  validateRefund,
} = require('../validators/paymentValidator');

// ==========================================
// PAYMENT ORDERS
// ==========================================

/**
 * @route   POST /api/v1/payments/create-order
 * @desc    Create a payment order (Razorpay/Stripe)
 * @access  Private (User)
 * @body    { amount, currency?, rideId?, type }
 */
router.post(
  '/create-order',
  protect,
  validateCreateOrder,
  paymentController.createOrder
);

/**
 * @route   POST /api/v1/payments/verify
 * @desc    Verify payment after completion
 * @access  Private (User)
 * @body    { orderId, paymentId, signature, rideId? }
 */
router.post(
  '/verify',
  protect,
  validateVerifyPayment,
  paymentController.verifyPayment
);

/**
 * @route   GET /api/v1/payments/:paymentId
 * @desc    Get payment details
 * @access  Private (User)
 */
router.get('/:paymentId', protect, paymentController.getPaymentDetails);

/**
 * @route   GET /api/v1/payments/:paymentId/status
 * @desc    Get payment status
 * @access  Private (User)
 */
router.get('/:paymentId/status', protect, paymentController.getPaymentStatus);

// ==========================================
// PAYMENT HISTORY
// ==========================================

/**
 * @route   GET /api/v1/payments/history
 * @desc    Get payment history
 * @access  Private (User)
 * @query   { page, limit, status, startDate, endDate, type }
 */
router.get('/history', protect, paymentController.getPaymentHistory);

/**
 * @route   GET /api/v1/payments/summary
 * @desc    Get payment summary/statistics
 * @access  Private (User)
 * @query   { period: week | month | year }
 */
router.get('/summary', protect, paymentController.getPaymentSummary);

// ==========================================
// REFUNDS
// ==========================================

/**
 * @route   POST /api/v1/payments/refund
 * @desc    Request a refund
 * @access  Private (User)
 * @body    { paymentId, reason, amount? }
 */
router.post(
  '/refund',
  protect,
  validateRefund,
  paymentController.requestRefund
);

/**
 * @route   GET /api/v1/payments/refunds
 * @desc    Get refund history
 * @access  Private (User)
 * @query   { page, limit, status }
 */
router.get('/refunds', protect, paymentController.getRefundHistory);

/**
 * @route   GET /api/v1/payments/refunds/:refundId
 * @desc    Get refund details
 * @access  Private (User)
 */
router.get('/refunds/:refundId', protect, paymentController.getRefundDetails);

/**
 * @route   GET /api/v1/payments/refunds/:refundId/status
 * @desc    Get refund status
 * @access  Private (User)
 */
router.get('/refunds/:refundId/status', protect, paymentController.getRefundStatus);

// ==========================================
// PAYMENT METHODS (Cards, UPI, etc.)
// ==========================================

/**
 * @route   GET /api/v1/payments/methods
 * @desc    Get saved payment methods
 * @access  Private (User)
 */
router.get('/methods', protect, paymentController.getPaymentMethods);

/**
 * @route   POST /api/v1/payments/methods/card
 * @desc    Add a card
 * @access  Private (User)
 * @body    { cardNumber, expiryMonth, expiryYear, cvv, cardHolderName }
 */
router.post(
  '/methods/card',
  protect,
  validateAddCard,
  paymentController.addCard
);

/**
 * @route   DELETE /api/v1/payments/methods/card/:cardId
 * @desc    Remove a card
 * @access  Private (User)
 */
router.delete('/methods/card/:cardId', protect, paymentController.removeCard);

/**
 * @route   PUT /api/v1/payments/methods/card/:cardId/default
 * @desc    Set card as default
 * @access  Private (User)
 */
router.put('/methods/card/:cardId/default', protect, paymentController.setDefaultCard);

/**
 * @route   POST /api/v1/payments/methods/upi
 * @desc    Add UPI ID
 * @access  Private (User)
 * @body    { upiId }
 */
router.post('/methods/upi', protect, paymentController.addUPI);

/**
 * @route   POST /api/v1/payments/methods/upi/verify
 * @desc    Verify UPI ID
 * @access  Private (User)
 * @body    { upiId }
 */
router.post('/methods/upi/verify', protect, paymentController.verifyUPI);

/**
 * @route   DELETE /api/v1/payments/methods/upi/:upiId
 * @desc    Remove UPI ID
 * @access  Private (User)
 */
router.delete('/methods/upi/:upiId', protect, paymentController.removeUPI);

/**
 * @route   PUT /api/v1/payments/methods/upi/:upiId/default
 * @desc    Set UPI as default
 * @access  Private (User)
 */
router.put('/methods/upi/:upiId/default', protect, paymentController.setDefaultUPI);

/**
 * @route   GET /api/v1/payments/methods/default
 * @desc    Get default payment method
 * @access  Private (User)
 */
router.get('/methods/default', protect, paymentController.getDefaultPaymentMethod);

/**
 * @route   PUT /api/v1/payments/methods/default
 * @desc    Set default payment method
 * @access  Private (User)
 * @body    { type: 'card' | 'upi' | 'wallet' | 'cash', id? }
 */
router.put('/methods/default', protect, paymentController.setDefaultPaymentMethod);

// ==========================================
// UPI PAYMENTS
// ==========================================

/**
 * @route   POST /api/v1/payments/upi/initiate
 * @desc    Initiate UPI payment
 * @access  Private (User)
 * @body    { amount, upiId, rideId? }
 */
router.post('/upi/initiate', protect, paymentController.initiateUPIPayment);

/**
 * @route   POST /api/v1/payments/upi/verify
 * @desc    Verify UPI payment
 * @access  Private (User)
 * @body    { transactionId }
 */
router.post('/upi/verify', protect, paymentController.verifyUPIPayment);

/**
 * @route   GET /api/v1/payments/upi/apps
 * @desc    Get available UPI apps
 * @access  Private (User)
 */
router.get('/upi/apps', protect, paymentController.getUPIApps);

// ==========================================
// NET BANKING
// ==========================================

/**
 * @route   GET /api/v1/payments/netbanking/banks
 * @desc    Get list of supported banks
 * @access  Private (User)
 */
router.get('/netbanking/banks', protect, paymentController.getSupportedBanks);

/**
 * @route   POST /api/v1/payments/netbanking/initiate
 * @desc    Initiate net banking payment
 * @access  Private (User)
 * @body    { amount, bankCode, rideId? }
 */
router.post('/netbanking/initiate', protect, paymentController.initiateNetBanking);

// ==========================================
// CAPTAIN PAYMENT ROUTES
// ==========================================

/**
 * @route   GET /api/v1/payments/captain/history
 * @desc    Get captain's payment/earnings history
 * @access  Private (Captain)
 * @query   { page, limit, type, startDate, endDate }
 */
router.get('/captain/history', protectCaptain, paymentController.getCaptainPaymentHistory);

/**
 * @route   GET /api/v1/payments/captain/pending
 * @desc    Get captain's pending payments
 * @access  Private (Captain)
 */
router.get('/captain/pending', protectCaptain, paymentController.getCaptainPendingPayments);

/**
 * @route   GET /api/v1/payments/captain/settled
 * @desc    Get captain's settled payments
 * @access  Private (Captain)
 * @query   { page, limit, startDate, endDate }
 */
router.get('/captain/settled', protectCaptain, paymentController.getCaptainSettledPayments);

/**
 * @route   GET /api/v1/payments/captain/summary
 * @desc    Get captain's payment summary
 * @access  Private (Captain)
 */
router.get('/captain/summary', protectCaptain, paymentController.getCaptainPaymentSummary);

// ==========================================
// INVOICES
// ==========================================

/**
 * @route   GET /api/v1/payments/invoices
 * @desc    Get all invoices
 * @access  Private (User)
 * @query   { page, limit, startDate, endDate }
 */
router.get('/invoices', protect, paymentController.getInvoices);

/**
 * @route   GET /api/v1/payments/invoices/:invoiceId
 * @desc    Get invoice details
 * @access  Private (User)
 */
router.get('/invoices/:invoiceId', protect, paymentController.getInvoiceDetails);

/**
 * @route   GET /api/v1/payments/invoices/:invoiceId/download
 * @desc    Download invoice PDF
 * @access  Private (User)
 */
router.get('/invoices/:invoiceId/download', protect, paymentController.downloadInvoice);

/**
 * @route   POST /api/v1/payments/invoices/:invoiceId/email
 * @desc    Email invoice
 * @access  Private (User)
 * @body    { email? }
 */
router.post('/invoices/:invoiceId/email', protect, paymentController.emailInvoice);

// ==========================================
// WEBHOOKS (Public - verified by signature)
// ==========================================

/**
 * @route   POST /api/v1/payments/webhook/razorpay
 * @desc    Razorpay webhook handler
 * @access  Public (Webhook - verified by signature)
 */
router.post(
  '/webhook/razorpay',
  express.raw({ type: 'application/json' }),
  paymentController.razorpayWebhook
);

/**
 * @route   POST /api/v1/payments/webhook/stripe
 * @desc    Stripe webhook handler
 * @access  Public (Webhook - verified by signature)
 */
router.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  paymentController.stripeWebhook
);

/**
 * @route   POST /api/v1/payments/webhook/paytm
 * @desc    Paytm webhook handler
 * @access  Public (Webhook - verified by signature)
 */
router.post('/webhook/paytm', paymentController.paytmWebhook);

module.exports = router;