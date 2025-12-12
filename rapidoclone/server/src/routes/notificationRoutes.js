// src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();

/**
 * Get notifications for user
 */
router.get('/', (req, res) => {
  res.json({ success: true, data: [] });
});

/**
 * Get notification by ID
 */
router.get('/:id', (req, res) => {
  res.json({ success: true, data: null });
});

/**
 * Mark notification as read
 */
router.patch('/:id/read', (req, res) => {
  res.json({ success: true, data: null });
});

/**
 * Mark all notifications as read
 */
router.patch('/read/all', (req, res) => {
  res.json({ success: true, message: 'All notifications marked as read' });
});

/**
 * Delete notification
 */
router.delete('/:id', (req, res) => {
  res.json({ success: true, message: 'Notification deleted' });
});

module.exports = router;
