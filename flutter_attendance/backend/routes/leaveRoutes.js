const express = require('express');
const multer = require('multer');
const leaveController = require('../controllers/leaveController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/authorizeRoles');
const employeeRepository = require('../repositories/employeeRepository');

// Staff middleware for mobile app - ensures user is a WORKER and has employee record
const staffMiddleware = async (req, res, next) => {
  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Check if user is a WORKER
  if (req.user.role !== 'WORKER') {
    return res.status(403).json({ message: 'Worker privileges required' });
  }

  // Find employee by user email (employees are linked to users by email)
  try {
    const employee = await employeeRepository.findByEmail(req.user.email);
    
    if (!employee) {
      return res.status(403).json({ message: 'Employee record not found. Please contact administrator.' });
    }
    
    // Attach employee_id to req for controllers that need it
    req.employeeId = employee.id;
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

// Staff routes (mobile app) - WORKER role only, with file upload support
router.get('/staff/types', authMiddleware, authorizeRoles('WORKER'), staffMiddleware, leaveController.getLeaveTypes);
router.get('/staff/balance', authMiddleware, authorizeRoles('WORKER'), staffMiddleware, async (req, res) => {
  // Redirect to balance endpoint with employee ID
  req.params.employeeId = req.employeeId;
  return leaveController.getLeaveBalance(req, res);
});
router.get('/staff/requests', authMiddleware, authorizeRoles('WORKER'), staffMiddleware, async (req, res) => {
  // Filter by employee ID
  req.query.employeeId = req.employeeId;
  return leaveController.getLeaveRequests(req, res);
});
router.post('/staff/requests', authMiddleware, authorizeRoles('WORKER'), staffMiddleware, upload.single('mcDocument'), async (req, res) => {
  // Set employee ID from middleware
  req.body.employeeId = req.employeeId;
  req.body.employee_id = req.employeeId;
  return leaveController.createLeaveRequest(req, res);
});
// Staff endpoint to fetch employees for stand-in selector
router.get('/staff/employees', authMiddleware, authorizeRoles('WORKER'), staffMiddleware, async (req, res) => {
  try {
    const employees = await employeeRepository.findAll({ orderBy: 'name asc' });
    return res.json({ employees });
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

// Admin/Supervisor routes - approve/manage leave requests
router.get('/admin/types', authMiddleware, authorizeRoles('ADMIN', 'SUPERVISOR'), leaveController.getLeaveTypes);
router.get('/admin/balance/:employeeId', authMiddleware, authorizeRoles('ADMIN', 'SUPERVISOR'), leaveController.getLeaveBalance);
router.get('/admin/requests', authMiddleware, authorizeRoles('ADMIN', 'SUPERVISOR'), leaveController.getLeaveRequests);
router.post('/admin/requests', authMiddleware, authorizeRoles('ADMIN', 'SUPERVISOR'), leaveController.createLeaveRequest);
router.get('/admin/statistics', authMiddleware, authorizeRoles('ADMIN', 'SUPERVISOR'), leaveController.getLeaveStatistics);
router.put('/admin/requests/:requestId/status', authMiddleware, authorizeRoles('ADMIN', 'SUPERVISOR'), leaveController.updateLeaveRequestStatus);
router.post('/admin/requests/bulk-approve', authMiddleware, authorizeRoles('ADMIN', 'SUPERVISOR'), leaveController.bulkApproveLeaveRequests);
router.post('/admin/initialize-balances', authMiddleware, authorizeRoles('ADMIN'), leaveController.initializeLeaveBalances);

module.exports = router;

