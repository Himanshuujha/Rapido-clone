// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protectAdmin, adminRole } = require('../middlewares/auth');

// All routes require admin authentication
router.use(protectAdmin);

// ==========================================
// DASHBOARD & ANALYTICS
// ==========================================

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get dashboard overview stats
 * @access  Private (Admin)
 */
router.get('/dashboard', adminController.getDashboardStats);

/**
 * @route   GET /api/v1/admin/dashboard/realtime
 * @desc    Get realtime dashboard data
 * @access  Private (Admin)
 */
router.get('/dashboard/realtime', adminController.getRealtimeStats);

/**
 * @route   GET /api/v1/admin/analytics
 * @desc    Get detailed analytics
 * @access  Private (Admin)
 * @query   { period, startDate, endDate }
 */
router.get('/analytics', adminController.getAnalytics);

/**
 * @route   GET /api/v1/admin/analytics/revenue
 * @desc    Get revenue analytics
 * @access  Private (Admin)
 * @query   { period, startDate, endDate, groupBy }
 */
router.get('/analytics/revenue', adminController.getRevenueAnalytics);

/**
 * @route   GET /api/v1/admin/analytics/rides
 * @desc    Get ride analytics
 * @access  Private (Admin)
 * @query   { period, startDate, endDate }
 */
router.get('/analytics/rides', adminController.getRideAnalytics);

/**
 * @route   GET /api/v1/admin/analytics/users
 * @desc    Get user analytics
 * @access  Private (Admin)
 * @query   { period, startDate, endDate }
 */
router.get('/analytics/users', adminController.getUserAnalytics);

/**
 * @route   GET /api/v1/admin/analytics/captains
 * @desc    Get captain analytics
 * @access  Private (Admin)
 * @query   { period, startDate, endDate }
 */
router.get('/analytics/captains', adminController.getCaptainAnalytics);

// ==========================================
// USER MANAGEMENT
// ==========================================

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users
 * @access  Private (Admin)
 * @query   { page, limit, search, status, sortBy, order }
 */
router.get('/users', adminController.getUsers);

/**
 * @route   GET /api/v1/admin/users/:userId
 * @desc    Get user details
 * @access  Private (Admin)
 */
router.get('/users/:userId', adminController.getUserDetails);

/**
 * @route   PUT /api/v1/admin/users/:userId
 * @desc    Update user
 * @access  Private (Admin)
 * @body    { firstName, lastName, email, phone, isActive }
 */
router.put('/users/:userId', adminController.updateUser);

/**
 * @route   PUT /api/v1/admin/users/:userId/status
 * @desc    Update user status (activate/suspend/ban)
 * @access  Private (Admin)
 * @body    { status, reason? }
 */
router.put('/users/:userId/status', adminController.updateUserStatus);

/**
 * @route   DELETE /api/v1/admin/users/:userId
 * @desc    Delete user
 * @access  Private (Super Admin)
 */
router.delete('/users/:userId', adminRole('superadmin'), adminController.deleteUser);

/**
 * @route   GET /api/v1/admin/users/:userId/rides
 * @desc    Get user's ride history
 * @access  Private (Admin)
 * @query   { page, limit, status }
 */
router.get('/users/:userId/rides', adminController.getUserRides);

/**
 * @route   GET /api/v1/admin/users/:userId/transactions
 * @desc    Get user's transactions
 * @access  Private (Admin)
 * @query   { page, limit, type }
 */
router.get('/users/:userId/transactions', adminController.getUserTransactions);

/**
 * @route   GET /api/v1/admin/users/:userId/wallet
 * @desc    Get user's wallet details
 * @access  Private (Admin)
 */
router.get('/users/:userId/wallet', adminController.getUserWallet);

/**
 * @route   POST /api/v1/admin/users/:userId/wallet/credit
 * @desc    Credit user wallet
 * @access  Private (Admin)
 * @body    { amount, reason }
 */
router.post('/users/:userId/wallet/credit', adminController.creditUserWallet);

/**
 * @route   POST /api/v1/admin/users/:userId/wallet/debit
 * @desc    Debit user wallet
 * @access  Private (Admin)
 * @body    { amount, reason }
 */
router.post('/users/:userId/wallet/debit', adminController.debitUserWallet);

// ==========================================
// CAPTAIN MANAGEMENT
// ==========================================

/**
 * @route   GET /api/v1/admin/captains
 * @desc    Get all captains
 * @access  Private (Admin)
 * @query   { page, limit, search, status, vehicleType, isOnline, sortBy, order }
 */
router.get('/captains', adminController.getCaptains);

/**
 * @route   GET /api/v1/admin/captains/pending
 * @desc    Get captains pending approval
 * @access  Private (Admin)
 * @query   { page, limit }
 */
router.get('/captains/pending', adminController.getPendingCaptains);

/**
 * @route   GET /api/v1/admin/captains/online
 * @desc    Get online captains
 * @access  Private (Admin)
 * @query   { vehicleType?, city? }
 */
router.get('/captains/online', adminController.getOnlineCaptains);

/**
 * @route   GET /api/v1/admin/captains/:captainId
 * @desc    Get captain details
 * @access  Private (Admin)
 */
router.get('/captains/:captainId', adminController.getCaptainDetails);

/**
 * @route   PUT /api/v1/admin/captains/:captainId
 * @desc    Update captain
 * @access  Private (Admin)
 * @body    { firstName, lastName, email, phone }
 */
router.put('/captains/:captainId', adminController.updateCaptain);

/**
 * @route   PUT /api/v1/admin/captains/:captainId/approve
 * @desc    Approve captain
 * @access  Private (Admin)
 * @body    { notes? }
 */
router.put('/captains/:captainId/approve', adminController.approveCaptain);

/**
 * @route   PUT /api/v1/admin/captains/:captainId/reject
 * @desc    Reject captain
 * @access  Private (Admin)
 * @body    { reason }
 */
router.put('/captains/:captainId/reject', adminController.rejectCaptain);

/**
 * @route   PUT /api/v1/admin/captains/:captainId/suspend
 * @desc    Suspend captain
 * @access  Private (Admin)
 * @body    { reason, duration? }
 */
router.put('/captains/:captainId/suspend', adminController.suspendCaptain);

/**
 * @route   PUT /api/v1/admin/captains/:captainId/activate
 * @desc    Activate captain
 * @access  Private (Admin)
 */
router.put('/captains/:captainId/activate', adminController.activateCaptain);

/**
 * @route   DELETE /api/v1/admin/captains/:captainId
 * @desc    Delete captain
 * @access  Private (Super Admin)
 */
router.delete('/captains/:captainId', adminRole('superadmin'), adminController.deleteCaptain);

/**
 * @route   GET /api/v1/admin/captains/:captainId/documents
 * @desc    Get captain documents
 * @access  Private (Admin)
 */
router.get('/captains/:captainId/documents', adminController.getCaptainDocuments);

/**
 * @route   PUT /api/v1/admin/captains/:captainId/documents/:docType/verify
 * @desc    Verify captain document
 * @access  Private (Admin)
 */
router.put('/captains/:captainId/documents/:docType/verify', adminController.verifyCaptainDocument);

/**
 * @route   PUT /api/v1/admin/captains/:captainId/documents/:docType/reject
 * @desc    Reject captain document
 * @access  Private (Admin)
 * @body    { reason }
 */
router.put('/captains/:captainId/documents/:docType/reject', adminController.rejectCaptainDocument);

/**
 * @route   GET /api/v1/admin/captains/:captainId/rides
 * @desc    Get captain's ride history
 * @access  Private (Admin)
 * @query   { page, limit, status }
 */
router.get('/captains/:captainId/rides', adminController.getCaptainRides);

/**
 * @route   GET /api/v1/admin/captains/:captainId/earnings
 * @desc    Get captain's earnings
 * @access  Private (Admin)
 * @query   { period, startDate, endDate }
 */
router.get('/captains/:captainId/earnings', adminController.getCaptainEarnings);

/**
 * @route   GET /api/v1/admin/captains/:captainId/wallet
 * @desc    Get captain's wallet
 * @access  Private (Admin)
 */
router.get('/captains/:captainId/wallet', adminController.getCaptainWallet);

/**
 * @route   POST /api/v1/admin/captains/:captainId/wallet/credit
 * @desc    Credit captain wallet (bonus, adjustment)
 * @access  Private (Admin)
 * @body    { amount, reason, category }
 */
router.post('/captains/:captainId/wallet/credit', adminController.creditCaptainWallet);

// ==========================================
// RIDE MANAGEMENT
// ==========================================

/**
 * @route   GET /api/v1/admin/rides
 * @desc    Get all rides
 * @access  Private (Admin)
 * @query   { page, limit, status, vehicleType, startDate, endDate, city }
 */
router.get('/rides', adminController.getRides);

/**
 * @route   GET /api/v1/admin/rides/active
 * @desc    Get active rides
 * @access  Private (Admin)
 * @query   { city?, vehicleType? }
 */
router.get('/rides/active', adminController.getActiveRides);

/**
 * @route   GET /api/v1/admin/rides/live-map
 * @desc    Get rides for live map
 * @access  Private (Admin)
 * @query   { city?, bounds? }
 */
router.get('/rides/live-map', adminController.getRidesForLiveMap);

/**
 * @route   GET /api/v1/admin/rides/:rideId
 * @desc    Get ride details
 * @access  Private (Admin)
 */
router.get('/rides/:rideId', adminController.getRideDetails);

/**
 * @route   PUT /api/v1/admin/rides/:rideId
 * @desc    Update ride
 * @access  Private (Admin)
 * @body    { status?, fare?, notes? }
 */
router.put('/rides/:rideId', adminController.updateRide);

/**
 * @route   PUT /api/v1/admin/rides/:rideId/cancel
 * @desc    Cancel ride (Admin override)
 * @access  Private (Admin)
 * @body    { reason }
 */
router.put('/rides/:rideId/cancel', adminController.cancelRide);

/**
 * @route   PUT /api/v1/admin/rides/:rideId/reassign
 * @desc    Reassign ride to different captain
 * @access  Private (Admin)
 * @body    { captainId }
 */
router.put('/rides/:rideId/reassign', adminController.reassignRide);

/**
 * @route   PUT /api/v1/admin/rides/:rideId/refund
 * @desc    Process ride refund
 * @access  Private (Admin)
 * @body    { amount, reason }
 */
router.put('/rides/:rideId/refund', adminController.processRefund);

/**
 * @route   GET /api/v1/admin/rides/:rideId/tracking
 * @desc    Get ride tracking data
 * @access  Private (Admin)
 */
router.get('/rides/:rideId/tracking', adminController.getRideTracking);

// ==========================================
// PAYMENT & TRANSACTIONS
// ==========================================

/**
 * @route   GET /api/v1/admin/payments
 * @desc    Get all payments
 * @access  Private (Admin)
 * @query   { page, limit, status, method, startDate, endDate }
 */
router.get('/payments', adminController.getPayments);

/**
 * @route   GET /api/v1/admin/payments/:paymentId
 * @desc    Get payment details
 * @access  Private (Admin)
 */
router.get('/payments/:paymentId', adminController.getPaymentDetails);

/**
 * @route   GET /api/v1/admin/transactions
 * @desc    Get all transactions
 * @access  Private (Admin)
 * @query   { page, limit, type, category, startDate, endDate }
 */
router.get('/transactions', adminController.getTransactions);

/**
 * @route   GET /api/v1/admin/transactions/:transactionId
 * @desc    Get transaction details
 * @access  Private (Admin)
 */
router.get('/transactions/:transactionId', adminController.getTransactionDetails);

/**
 * @route   GET /api/v1/admin/withdrawals
 * @desc    Get all withdrawal requests
 * @access  Private (Admin)
 * @query   { page, limit, status }
 */
router.get('/withdrawals', adminController.getWithdrawals);

/**
 * @route   GET /api/v1/admin/withdrawals/:withdrawalId
 * @desc    Get withdrawal details
 * @access  Private (Admin)
 */
router.get('/withdrawals/:withdrawalId', adminController.getWithdrawalDetails);

/**
 * @route   PUT /api/v1/admin/withdrawals/:withdrawalId/approve
 * @desc    Approve withdrawal
 * @access  Private (Admin)
 * @body    { transactionReference? }
 */
router.put('/withdrawals/:withdrawalId/approve', adminController.approveWithdrawal);

/**
 * @route   PUT /api/v1/admin/withdrawals/:withdrawalId/reject
 * @desc    Reject withdrawal
 * @access  Private (Admin)
 * @body    { reason }
 */
router.put('/withdrawals/:withdrawalId/reject', adminController.rejectWithdrawal);

/**
 * @route   PUT /api/v1/admin/withdrawals/:withdrawalId/process
 * @desc    Mark withdrawal as processed
 * @access  Private (Admin)
 * @body    { transactionReference, notes? }
 */
router.put('/withdrawals/:withdrawalId/process', adminController.processWithdrawal);

// ==========================================
// COUPON MANAGEMENT
// ==========================================

/**
 * @route   GET /api/v1/admin/coupons
 * @desc    Get all coupons
 * @access  Private (Admin)
 * @query   { page, limit, status, type }
 */
router.get('/coupons', adminController.getCoupons);

/**
 * @route   POST /api/v1/admin/coupons
 * @desc    Create coupon
 * @access  Private (Admin)
 * @body    { code, discountType, discountValue, ... }
 */
router.post('/coupons', adminController.createCoupon);

/**
 * @route   GET /api/v1/admin/coupons/:couponId
 * @desc    Get coupon details
 * @access  Private (Admin)
 */
router.get('/coupons/:couponId', adminController.getCouponDetails);

/**
 * @route   PUT /api/v1/admin/coupons/:couponId
 * @desc    Update coupon
 * @access  Private (Admin)
 * @body    { discountValue, validUntil, usageLimit, ... }
 */
router.put('/coupons/:couponId', adminController.updateCoupon);

/**
 * @route   DELETE /api/v1/admin/coupons/:couponId
 * @desc    Delete coupon
 * @access  Private (Admin)
 */
router.delete('/coupons/:couponId', adminController.deleteCoupon);

/**
 * @route   PUT /api/v1/admin/coupons/:couponId/toggle
 * @desc    Toggle coupon active status
 * @access  Private (Admin)
 */
router.put('/coupons/:couponId/toggle', adminController.toggleCoupon);

/**
 * @route   GET /api/v1/admin/coupons/:couponId/usage
 * @desc    Get coupon usage stats
 * @access  Private (Admin)
 */
router.get('/coupons/:couponId/usage', adminController.getCouponUsage);

// ==========================================
// FARE & PRICING CONFIGURATION
// ==========================================

/**
 * @route   GET /api/v1/admin/fare-config
 * @desc    Get fare configuration
 * @access  Private (Admin)
 * @query   { city? }
 */
router.get('/fare-config', adminController.getFareConfig);

/**
 * @route   PUT /api/v1/admin/fare-config
 * @desc    Update fare configuration
 * @access  Private (Admin)
 * @body    { vehicleType, city?, baseFare, perKm, perMinute, ... }
 */
router.put('/fare-config', adminController.updateFareConfig);

/**
 * @route   GET /api/v1/admin/vehicle-types
 * @desc    Get vehicle types configuration
 * @access  Private (Admin)
 */
router.get('/vehicle-types', adminController.getVehicleTypes);

/**
 * @route   POST /api/v1/admin/vehicle-types
 * @desc    Add vehicle type
 * @access  Private (Admin)
 * @body    { code, name, category, capacity, ... }
 */
router.post('/vehicle-types', adminController.addVehicleType);

/**
 * @route   PUT /api/v1/admin/vehicle-types/:vehicleTypeId
 * @desc    Update vehicle type
 * @access  Private (Admin)
 */
router.put('/vehicle-types/:vehicleTypeId', adminController.updateVehicleType);

/**
 * @route   DELETE /api/v1/admin/vehicle-types/:vehicleTypeId
 * @desc    Delete vehicle type
 * @access  Private (Admin)
 */
router.delete('/vehicle-types/:vehicleTypeId', adminController.deleteVehicleType);

// ==========================================
// SURGE PRICING
// ==========================================

/**
 * @route   GET /api/v1/admin/surge
 * @desc    Get surge pricing settings
 * @access  Private (Admin)
 */
router.get('/surge', adminController.getSurgeSettings);

/**
 * @route   PUT /api/v1/admin/surge
 * @desc    Update surge pricing settings
 * @access  Private (Admin)
 * @body    { enabled, maxMultiplier, ... }
 */
router.put('/surge', adminController.updateSurgeSettings);

/**
 * @route   GET /api/v1/admin/surge/zones
 * @desc    Get surge zones
 * @access  Private (Admin)
 */
router.get('/surge/zones', adminController.getSurgeZones);

/**
 * @route   POST /api/v1/admin/surge/zones
 * @desc    Create surge zone
 * @access  Private (Admin)
 * @body    { name, polygon, multiplier, ... }
 */
router.post('/surge/zones', adminController.createSurgeZone);

/**
 * @route   PUT /api/v1/admin/surge/zones/:zoneId
 * @desc    Update surge zone
 * @access  Private (Admin)
 */
router.put('/surge/zones/:zoneId', adminController.updateSurgeZone);

/**
 * @route   DELETE /api/v1/admin/surge/zones/:zoneId
 * @desc    Delete surge zone
 * @access  Private (Admin)
 */
router.delete('/surge/zones/:zoneId', adminController.deleteSurgeZone);

/**
 * @route   PUT /api/v1/admin/surge/manual
 * @desc    Set manual surge for area
 * @access  Private (Admin)
 * @body    { zoneId, multiplier, duration }
 */
router.put('/surge/manual', adminController.setManualSurge);

// ==========================================
// NOTIFICATIONS
// ==========================================

/**
 * @route   GET /api/v1/admin/notifications/templates
 * @desc    Get notification templates
 * @access  Private (Admin)
 */
router.get('/notifications/templates', adminController.getNotificationTemplates);

/**
 * @route   POST /api/v1/admin/notifications/templates
 * @desc    Create notification template
 * @access  Private (Admin)
 * @body    { name, code, type, title, message, ... }
 */
router.post('/notifications/templates', adminController.createNotificationTemplate);

/**
 * @route   PUT /api/v1/admin/notifications/templates/:templateId
 * @desc    Update notification template
 * @access  Private (Admin)
 */
router.put('/notifications/templates/:templateId', adminController.updateNotificationTemplate);

/**
 * @route   POST /api/v1/admin/notifications/send
 * @desc    Send notification to specific users
 * @access  Private (Admin)
 * @body    { userIds, title, message, data? }
 */
router.post('/notifications/send', adminController.sendNotification);

/**
 * @route   POST /api/v1/admin/notifications/broadcast
 * @desc    Broadcast notification to all users
 * @access  Private (Admin)
 * @body    { target: 'users' | 'captains' | 'all', title, message, data? }
 */
router.post('/notifications/broadcast', adminController.broadcastNotification);

/**
 * @route   GET /api/v1/admin/notifications/history
 * @desc    Get notification history
 * @access  Private (Admin)
 * @query   { page, limit, type }
 */
router.get('/notifications/history', adminController.getNotificationHistory);

// ==========================================
// REPORTS
// ==========================================

/**
 * @route   GET /api/v1/admin/reports/rides
 * @desc    Get ride reports
 * @access  Private (Admin)
 * @query   { startDate, endDate, groupBy, city?, vehicleType? }
 */
router.get('/reports/rides', adminController.getRideReports);

/**
 * @route   GET /api/v1/admin/reports/revenue
 * @desc    Get revenue reports
 * @access  Private (Admin)
 * @query   { startDate, endDate, groupBy }
 */
router.get('/reports/revenue', adminController.getRevenueReports);

/**
 * @route   GET /api/v1/admin/reports/users
 * @desc    Get user reports
 * @access  Private (Admin)
 * @query   { startDate, endDate }
 */
router.get('/reports/users', adminController.getUserReports);

/**
 * @route   GET /api/v1/admin/reports/captains
 * @desc    Get captain reports
 * @access  Private (Admin)
 * @query   { startDate, endDate }
 */
router.get('/reports/captains', adminController.getCaptainReports);

/**
 * @route   GET /api/v1/admin/reports/financial
 * @desc    Get financial reports
 * @access  Private (Admin)
 * @query   { startDate, endDate, type }
 */
router.get('/reports/financial', adminController.getFinancialReports);

/**
 * @route   POST /api/v1/admin/reports/export
 * @desc    Export report data
 * @access  Private (Admin)
 * @body    { reportType, format, startDate, endDate, filters }
 */
router.post('/reports/export', adminController.exportReport);

/**
 * @route   GET /api/v1/admin/reports/scheduled
 * @desc    Get scheduled reports
 * @access  Private (Admin)
 */
router.get('/reports/scheduled', adminController.getScheduledReports);

/**
 * @route   POST /api/v1/admin/reports/scheduled
 * @desc    Create scheduled report
 * @access  Private (Admin)
 * @body    { reportType, schedule, recipients, filters }
 */
router.post('/reports/scheduled', adminController.createScheduledReport);

// ==========================================
// SETTINGS
// ==========================================

/**
 * @route   GET /api/v1/admin/settings
 * @desc    Get all settings
 * @access  Private (Admin)
 */
router.get('/settings', adminController.getSettings);

/**
 * @route   PUT /api/v1/admin/settings
 * @desc    Update settings
 * @access  Private (Admin)
 * @body    { category, settings }
 */
router.put('/settings', adminController.updateSettings);

/**
 * @route   GET /api/v1/admin/settings/app
 * @desc    Get app configuration
 * @access  Private (Admin)
 */
router.get('/settings/app', adminController.getAppConfig);

/**
 * @route   PUT /api/v1/admin/settings/app
 * @desc    Update app configuration
 * @access  Private (Admin)
 * @body    { appName, logo, colors, features, ... }
 */
router.put('/settings/app', adminController.updateAppConfig);

/**
 * @route   GET /api/v1/admin/settings/commission
 * @desc    Get commission settings
 * @access  Private (Admin)
 */
router.get('/settings/commission', adminController.getCommissionSettings);

/**
 * @route   PUT /api/v1/admin/settings/commission
 * @desc    Update commission settings
 * @access  Private (Admin)
 * @body    { percentage, vehicleType?, city? }
 */
router.put('/settings/commission', adminController.updateCommissionSettings);

// ==========================================
// SUPPORT & TICKETS
// ==========================================

/**
 * @route   GET /api/v1/admin/support/tickets
 * @desc    Get support tickets
 * @access  Private (Admin)
 * @query   { page, limit, status, priority, category }
 */
router.get('/support/tickets', adminController.getSupportTickets);

/**
 * @route   GET /api/v1/admin/support/tickets/:ticketId
 * @desc    Get ticket details
 * @access  Private (Admin)
 */
router.get('/support/tickets/:ticketId', adminController.getTicketDetails);

/**
 * @route   PUT /api/v1/admin/support/tickets/:ticketId
 * @desc    Update ticket
 * @access  Private (Admin)
 * @body    { status, priority, assignee }
 */
router.put('/support/tickets/:ticketId', adminController.updateTicket);

/**
 * @route   POST /api/v1/admin/support/tickets/:ticketId/reply
 * @desc    Reply to ticket
 * @access  Private (Admin)
 * @body    { message }
 */
router.post('/support/tickets/:ticketId/reply', adminController.replyToTicket);

/**
 * @route   PUT /api/v1/admin/support/tickets/:ticketId/close
 * @desc    Close ticket
 * @access  Private (Admin)
 * @body    { resolution }
 */
router.put('/support/tickets/:ticketId/close', adminController.closeTicket);

// ==========================================
// ADMIN MANAGEMENT (Super Admin only)
// ==========================================

/**
 * @route   GET /api/v1/admin/admins
 * @desc    Get all admins
 * @access  Private (Super Admin)
 */
router.get('/admins', adminRole('superadmin'), adminController.getAdmins);

/**
 * @route   POST /api/v1/admin/admins
 * @desc    Create new admin
 * @access  Private (Super Admin)
 * @body    { name, email, password, role, permissions }
 */
router.post('/admins', adminRole('superadmin'), adminController.createAdmin);

/**
 * @route   GET /api/v1/admin/admins/:adminId
 * @desc    Get admin details
 * @access  Private (Super Admin)
 */
router.get('/admins/:adminId', adminRole('superadmin'), adminController.getAdminDetails);

/**
 * @route   PUT /api/v1/admin/admins/:adminId
 * @desc    Update admin
 * @access  Private (Super Admin)
 * @body    { name, email, role, permissions, isActive }
 */
router.put('/admins/:adminId', adminRole('superadmin'), adminController.updateAdmin);

/**
 * @route   DELETE /api/v1/admin/admins/:adminId
 * @desc    Delete admin
 * @access  Private (Super Admin)
 */
router.delete('/admins/:adminId', adminRole('superadmin'), adminController.deleteAdmin);

/**
 * @route   GET /api/v1/admin/roles
 * @desc    Get admin roles
 * @access  Private (Super Admin)
 */
router.get('/roles', adminRole('superadmin'), adminController.getAdminRoles);

/**
 * @route   POST /api/v1/admin/roles
 * @desc    Create admin role
 * @access  Private (Super Admin)
 * @body    { name, permissions }
 */
router.post('/roles', adminRole('superadmin'), adminController.createAdminRole);

/**
 * @route   PUT /api/v1/admin/roles/:roleId
 * @desc    Update admin role
 * @access  Private (Super Admin)
 */
router.put('/roles/:roleId', adminRole('superadmin'), adminController.updateAdminRole);

// ==========================================
// AUDIT LOGS
// ==========================================

/**
 * @route   GET /api/v1/admin/audit-logs
 * @desc    Get audit logs
 * @access  Private (Super Admin)
 * @query   { page, limit, action, adminId, startDate, endDate }
 */
router.get('/audit-logs', adminRole('superadmin'), adminController.getAuditLogs);

/**
 * @route   GET /api/v1/admin/audit-logs/:logId
 * @desc    Get audit log details
 * @access  Private (Super Admin)
 */
router.get('/audit-logs/:logId', adminRole('superadmin'), adminController.getAuditLogDetails);

// ==========================================
// SYSTEM
// ==========================================

/**
 * @route   GET /api/v1/admin/system/health
 * @desc    Get system health
 * @access  Private (Admin)
 */
router.get('/system/health', adminController.getSystemHealth);

/**
 * @route   GET /api/v1/admin/system/logs
 * @desc    Get system logs
 * @access  Private (Super Admin)
 * @query   { level, startDate, endDate, limit }
 */
router.get('/system/logs', adminRole('superadmin'), adminController.getSystemLogs);

/**
 * @route   POST /api/v1/admin/system/cache/clear
 * @desc    Clear system cache
 * @access  Private (Super Admin)
 * @body    { type: 'all' | 'rides' | 'users' | ... }
 */
router.post('/system/cache/clear', adminRole('superadmin'), adminController.clearCache);

module.exports = router;