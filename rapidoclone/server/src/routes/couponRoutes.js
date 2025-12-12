// src/routes/couponRoutes.js
const express = require('express');
const router = express.Router();

/**
 * Get all coupons
 */
router.get('/', (req, res) => {
  res.json({ success: true, data: [] });
});

/**
 * Get coupon by code
 */
router.get('/:code', (req, res) => {
  res.json({ success: true, data: null });
});

/**
 * Create coupon (admin only)
 */
router.post('/', (req, res) => {
  res.status(201).json({ success: true, data: null });
});

/**
 * Update coupon (admin only)
 */
router.put('/:id', (req, res) => {
  res.json({ success: true, data: null });
});

/**
 * Delete coupon (admin only)
 */
router.delete('/:id', (req, res) => {
  res.json({ success: true, message: 'Coupon deleted' });
});

module.exports = router;
