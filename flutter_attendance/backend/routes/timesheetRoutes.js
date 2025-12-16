const express = require('express');
const timesheetController = require('../controllers/timesheetController');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');

const router = express.Router();

// All timesheet routes require admin authentication
router.get('/', adminAuthMiddleware, timesheetController.getTimesheets);
router.get('/stats', adminAuthMiddleware, timesheetController.getTimesheetStats);
router.get('/reports', adminAuthMiddleware, timesheetController.getTimesheetReports);
router.get('/:id', adminAuthMiddleware, timesheetController.getTimesheetById);
router.post('/', adminAuthMiddleware, timesheetController.createTimesheet);
router.put('/:id', adminAuthMiddleware, timesheetController.updateTimesheet);
router.post('/:id/submit', adminAuthMiddleware, timesheetController.submitTimesheet);
router.post('/:id/approve', adminAuthMiddleware, timesheetController.approveTimesheet);
router.post('/:id/reject', adminAuthMiddleware, timesheetController.rejectTimesheet);
router.post('/:id/ot/approve', adminAuthMiddleware, timesheetController.approveOT);
router.post('/:id/ot/reject', adminAuthMiddleware, timesheetController.rejectOT);

module.exports = router;

