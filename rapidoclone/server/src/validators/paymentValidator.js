const { body } = require('express-validator');
const { validate } = require('../middlewares/validate');


exports.validateCreateOrder = validate([
  body('amount')
    .exists().withMessage('Amount is required')
    .isNumeric().withMessage('Amount must be a number')
    .custom(v => v > 0).withMessage('Amount must be greater than 0'),

  body('type')
    .exists().withMessage('Payment type is required')
    .isIn(['ride', 'wallet', 'topup'])
    .withMessage('Invalid payment type'),

  body('currency')
    .optional()
    .isString()
    .isLength({ min: 3, max: 3 })
    .withMessage('Invalid currency code'),

  body('rideId')
    .optional()
    .isMongoId()
    .withMessage('Invalid rideId'),
]);

exports.validateVerifyPayment = validate([
  body('orderId')
    .exists().withMessage('orderId is required')
    .isString(),

  body('paymentId')
    .exists().withMessage('paymentId is required')
    .isString(),

  body('signature')
    .exists().withMessage('signature is required')
    .isString(),

  body('rideId')
    .optional()
    .isMongoId()
    .withMessage('Invalid rideId'),
]);

exports.validateAddCard = validate([
  body('cardNumber')
    .exists().withMessage('Card number is required')
    .isCreditCard()
    .withMessage('Invalid card number'),

  body('expiryMonth')
    .exists().withMessage('Expiry month is required')
    .isInt({ min: 1, max: 12 })
    .withMessage('Invalid expiry month'),

  body('expiryYear')
    .exists().withMessage('Expiry year is required')
    .isInt({ min: new Date().getFullYear() })
    .withMessage('Invalid expiry year'),

  body('cvv')
    .exists().withMessage('CVV is required')
    .isLength({ min: 3, max: 4 })
    .withMessage('Invalid CVV'),

  body('cardHolderName')
    .exists().withMessage('Card holder name is required')
    .isString()
    .trim(),
]);

exports.validateRefund = validate([
  body('paymentId')
    .exists().withMessage('paymentId is required')
    .isMongoId()
    .withMessage('Invalid paymentId'),

  body('reason')
    .exists().withMessage('Refund reason is required')
    .isString()
    .trim(),

  body('amount')
    .optional()
    .isNumeric()
    .custom(v => v > 0)
    .withMessage('Refund amount must be greater than 0'),
]);
