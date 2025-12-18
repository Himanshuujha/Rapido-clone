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

router.post('/create-order', protect, validateCreateOrder, paymentController.createOrder);
router.post('/verify', protect, validateVerifyPayment, paymentController.verifyPayment);

router.get('/:paymentId', protect, paymentController.getPaymentDetails);
router.get('/:paymentId/status', protect, paymentController.getPaymentStatus);

router.get('/history', protect, paymentController.getPaymentHistory);
router.get('/summary', protect, paymentController.getPaymentSummary);

router.post('/refund', protect, validateRefund, paymentController.requestRefund);
router.get('/refunds', protect, paymentController.getRefundHistory);
router.get('/refunds/:refundId', protect, paymentController.getRefundDetails);
router.get('/refunds/:refundId/status', protect, paymentController.getRefundStatus);

router.get('/methods', protect, paymentController.getPaymentMethods);
router.post('/methods/card', protect, validateAddCard, paymentController.addCard);
router.delete('/methods/card/:cardId', protect, paymentController.removeCard);
router.put('/methods/card/:cardId/default', protect, paymentController.setDefaultCard);

router.post('/methods/upi', protect, paymentController.addUPI);
router.post('/methods/upi/verify', protect, paymentController.verifyUPI);
router.delete('/methods/upi/:upiId', protect, paymentController.removeUPI);
router.put('/methods/upi/:upiId/default', protect, paymentController.setDefaultUPI);

router.get('/methods/default', protect, paymentController.getDefaultPaymentMethod);
router.put('/methods/default', protect, paymentController.setDefaultPaymentMethod);

router.post('/upi/initiate', protect, paymentController.initiateUPIPayment);
router.post('/upi/verify', protect, paymentController.verifyUPIPayment);
router.get('/upi/apps', protect, paymentController.getUPIApps);

router.get('/netbanking/banks', protect, paymentController.getSupportedBanks);
router.post('/netbanking/initiate', protect, paymentController.initiateNetBanking);

router.get('/captain/history', protectCaptain, paymentController.getCaptainPaymentHistory);
router.get('/captain/pending', protectCaptain, paymentController.getCaptainPendingPayments);
router.get('/captain/settled', protectCaptain, paymentController.getCaptainSettledPayments);
router.get('/captain/summary', protectCaptain, paymentController.getCaptainPaymentSummary);

router.get('/invoices', protect, paymentController.getInvoices);
router.get('/invoices/:invoiceId', protect, paymentController.getInvoiceDetails);
router.get('/invoices/:invoiceId/download', protect, paymentController.downloadInvoice);
router.post('/invoices/:invoiceId/email', protect, paymentController.emailInvoice);

router.post(
  '/webhook/razorpay',
  express.raw({ type: 'application/json' }),
  paymentController.razorpayWebhook
);

router.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  paymentController.stripeWebhook
);

router.post('/webhook/paytm', paymentController.paytmWebhook);

module.exports = router;
