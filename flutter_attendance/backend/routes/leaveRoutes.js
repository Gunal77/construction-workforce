const express = require('express');
const leaveController = require('../controllers/leaveController');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (for employees to view their own data)
router.get('/types', authMiddleware, leaveController.getLeaveTypes);
router.get('/balance/:employeeId', authMiddleware, leaveController.getLeaveBalance);
router.get('/requests', authMiddleware, leaveController.getLeaveRequests);
router.post('/requests', authMiddleware, leaveController.createLeaveRequest);

// Admin routes
router.get('/admin/types', adminAuthMiddleware, leaveController.getLeaveTypes);
router.get('/admin/balance/:employeeId', adminAuthMiddleware, leaveController.getLeaveBalance);
router.get('/admin/requests', adminAuthMiddleware, leaveController.getLeaveRequests);
router.post('/admin/requests', adminAuthMiddleware, leaveController.createLeaveRequest);
router.get('/admin/statistics', adminAuthMiddleware, leaveController.getLeaveStatistics);
router.put('/admin/requests/:requestId/status', adminAuthMiddleware, leaveController.updateLeaveRequestStatus);
router.post('/admin/initialize-balances', adminAuthMiddleware, leaveController.initializeLeaveBalances);

module.exports = router;

