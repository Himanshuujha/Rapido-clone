// src/routes/webhookRoutes.js
const express = require('express');
const router = express.Router();

/**
 * Razorpay payment webhook
 */
router.post('/razorpay', (req, res) => {
  try {
    // Webhook logic here
    res.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Twilio SMS webhook
 */
router.post('/twilio', (req, res) => {
  try {
    // Webhook logic here
    res.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
