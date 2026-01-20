const express = require('express');
const exportController = require('../controllers/exportController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/authorizeRoles');
const employeeRepository = require('../repositories/employeeRepository');

// Staff middleware - ensures user is a WORKER and has employee record
const staffMiddleware = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Check role (handle both uppercase and lowercase)
  const userRole = req.user.role?.toUpperCase();
  if (userRole !== 'WORKER') {
    return res.status(403).json({ message: 'Worker privileges required' });
  }

  try {
    const employee = await employeeRepository.findByEmail(req.user.email);
    
    if (!employee) {
      return res.status(403).json({ message: 'Employee record not found. Please contact administrator.' });
    }
    
    req.employeeId = employee.id;
    next();
  } catch (error) {
    console.error('Error in staffMiddleware:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

const router = express.Router();

// Monthly Summary Exports
// PDF: Available for both admin and staff (for approved summaries)
router.get(
  '/monthly-summaries/:id/pdf',
  authMiddleware,
  authorizeRoles('ADMIN', 'SUPERVISOR', 'WORKER'),
  exportController.exportMonthlySummaryPDF
);
router.get(
  '/monthly-summaries/:id/excel',
  authMiddleware,
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  exportController.exportMonthlySummaryExcel
);

// Bulk Monthly Summary Exports (all summaries)
router.post(
  '/monthly-summaries/bulk/pdf',
  authMiddleware,
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  exportController.exportBulkMonthlySummariesPDF
);
router.post(
  '/monthly-summaries/bulk/excel',
  authMiddleware,
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  exportController.exportBulkMonthlySummariesExcel
);

// Attendance Report Exports - ADMIN only
router.get(
  '/attendance/pdf',
  authMiddleware,
  authorizeRoles('ADMIN'),
  exportController.exportAttendanceReportPDF
);
router.get(
  '/attendance/excel',
  authMiddleware,
  authorizeRoles('ADMIN'),
  exportController.exportAttendanceReportExcel
);

// Leave Report Exports - ADMIN only
router.get(
  '/leave/pdf',
  authMiddleware,
  authorizeRoles('ADMIN'),
  exportController.exportLeaveReportPDF
);
router.get(
  '/leave/excel',
  authMiddleware,
  authorizeRoles('ADMIN'),
  exportController.exportLeaveReportExcel
);

// Timesheet Report Exports - ADMIN only
router.get(
  '/timesheet/pdf',
  authMiddleware,
  authorizeRoles('ADMIN'),
  exportController.exportTimesheetReportPDF
);
router.get(
  '/timesheet/excel',
  authMiddleware,
  authorizeRoles('ADMIN'),
  exportController.exportTimesheetReportExcel
);

module.exports = router;

