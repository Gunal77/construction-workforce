const express = require('express');
const timesheetController = require('../controllers/timesheetController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/authorizeRoles');

const router = express.Router();

// All timesheet routes require authentication and ADMIN role
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN'));

router.get('/', timesheetController.getTimesheets);
router.get('/stats', timesheetController.getTimesheetStats);
router.get('/reports', timesheetController.getTimesheetReports);
router.post('/bulk/approve', timesheetController.bulkApproveTimesheets);
router.get('/:id', timesheetController.getTimesheetById);
router.post('/', timesheetController.createTimesheet);
router.put('/:id', timesheetController.updateTimesheet);
router.post('/:id/submit', timesheetController.submitTimesheet);
router.post('/:id/approve', timesheetController.approveTimesheet);
router.post('/:id/reject', timesheetController.rejectTimesheet);
router.post('/:id/ot/approve', timesheetController.approveOT);
router.post('/:id/ot/reject', timesheetController.rejectOT);

module.exports = router;

