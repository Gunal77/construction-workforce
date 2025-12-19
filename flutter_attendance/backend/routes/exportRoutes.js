const express = require('express');
const exportController = require('../controllers/exportController');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../config/db');

// Staff middleware (reused from monthlySummaryRoutes)
const staffMiddleware = async (req, res, next) => {
  if (!req.user?.id || !req.user?.email) {
    return res.status(403).json({ message: 'Employee privileges required: User ID or email missing from token.' });
  }
  try {
    const { rows } = await db.query('SELECT id FROM employees WHERE email = $1', [req.user.email]);
    if (rows.length === 0) {
      return res.status(403).json({ message: 'Employee privileges required: User not found in employees table.' });
    }
    req.employeeId = rows[0].id;
    next();
  } catch (error) {
    console.error('Error in staffMiddleware:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

const router = express.Router();

// Monthly Summary Exports
// PDF: Available for both admin and staff (for approved summaries)
// Use adminAuthMiddleware for admin access, fallback to authMiddleware for staff
router.get(
  '/monthly-summaries/:id/pdf',
  adminAuthMiddleware, // Changed to adminAuthMiddleware for admin portal
  exportController.exportMonthlySummaryPDF
);
router.get(
  '/monthly-summaries/:id/excel',
  adminAuthMiddleware,
  exportController.exportMonthlySummaryExcel
);

// Attendance Report Exports
router.get(
  '/attendance/pdf',
  adminAuthMiddleware,
  exportController.exportAttendanceReportPDF
);
router.get(
  '/attendance/excel',
  adminAuthMiddleware,
  exportController.exportAttendanceReportExcel
);

// Leave Report Exports
router.get(
  '/leave/pdf',
  adminAuthMiddleware,
  exportController.exportLeaveReportPDF
);
router.get(
  '/leave/excel',
  adminAuthMiddleware,
  exportController.exportLeaveReportExcel
);

// Timesheet Report Exports
router.get(
  '/timesheet/pdf',
  adminAuthMiddleware,
  exportController.exportTimesheetReportPDF
);
router.get(
  '/timesheet/excel',
  adminAuthMiddleware,
  exportController.exportTimesheetReportExcel
);

module.exports = router;

