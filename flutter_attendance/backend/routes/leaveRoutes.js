const express = require('express');
const multer = require('multer');
const leaveController = require('../controllers/leaveController');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../config/db');

// Staff middleware for mobile app (similar to monthlySummaryRoutes)
const staffMiddleware = async (req, res, next) => {
  if (!req.user?.id || !req.user?.email) {
    return res.status(403).json({ message: 'Employee privileges required: User ID or email missing from token.' });
  }
  try {
    const { rows } = await db.query('SELECT id FROM employees WHERE email = $1', [req.user.email]);
    if (rows.length === 0) {
      return res.status(403).json({ message: 'Employee privileges required: User not found in employees table.' });
    }
    // Attach employee_id to req for controllers that need it
    req.employeeId = rows[0].id;
    next();
  } catch (error) {
    console.error('Error in staffMiddleware:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

// Multer configuration for document uploads (PDF, images)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for documents
  fileFilter: (req, file, cb) => {
    const mimetype = file.mimetype || '';
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (allowedMimes.includes(mimetype)) {
      return cb(null, true);
    }
    
    return cb(new Error('Only PDF and image files are allowed'));
  },
});

const router = express.Router();

// Staff routes (mobile app) - with file upload support
router.get('/staff/types', authMiddleware, staffMiddleware, leaveController.getLeaveTypes);
router.get('/staff/balance', authMiddleware, staffMiddleware, async (req, res) => {
  // Redirect to balance endpoint with employee ID
  req.params.employeeId = req.employeeId;
  return leaveController.getLeaveBalance(req, res);
});
router.get('/staff/requests', authMiddleware, staffMiddleware, async (req, res) => {
  // Filter by employee ID
  req.query.employeeId = req.employeeId;
  return leaveController.getLeaveRequests(req, res);
});
router.post('/staff/requests', authMiddleware, staffMiddleware, upload.single('mcDocument'), async (req, res) => {
  // Set employee ID from middleware
  req.body.employeeId = req.employeeId;
  req.body.employee_id = req.employeeId;
  return leaveController.createLeaveRequest(req, res);
});
// Staff endpoint to fetch employees for stand-in selector
router.get('/staff/employees', authMiddleware, staffMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, email FROM employees ORDER BY name ASC`
    );
    return res.json({ employees: rows });
  } catch (error) {
    console.error('Error fetching employees for stand-in:', error);
    return res.status(500).json({ message: 'Failed to fetch employees' });
  }
});

// Public routes (for employees to view their own data) - kept for backward compatibility
router.get('/types', authMiddleware, leaveController.getLeaveTypes);
router.get('/balance/:employeeId', authMiddleware, leaveController.getLeaveBalance);
router.get('/requests', authMiddleware, leaveController.getLeaveRequests);
router.post('/requests', authMiddleware, upload.single('mcDocument'), leaveController.createLeaveRequest);

// Admin routes
router.get('/admin/types', adminAuthMiddleware, leaveController.getLeaveTypes);
router.get('/admin/balance/:employeeId', adminAuthMiddleware, leaveController.getLeaveBalance);
router.get('/admin/requests', adminAuthMiddleware, leaveController.getLeaveRequests);
router.post('/admin/requests', adminAuthMiddleware, leaveController.createLeaveRequest);
router.get('/admin/statistics', adminAuthMiddleware, leaveController.getLeaveStatistics);
router.put('/admin/requests/:requestId/status', adminAuthMiddleware, leaveController.updateLeaveRequestStatus);
router.post('/admin/initialize-balances', adminAuthMiddleware, leaveController.initializeLeaveBalances);

module.exports = router;

