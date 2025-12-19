const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/jwt');
const monthlySummaryController = require('../controllers/monthlySummaryController');

// Middleware to verify authentication
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (!token || scheme !== 'Bearer') {
    return res.status(401).json({ message: 'Authorization header missing or malformed' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Admin routes - require admin role
const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin privileges required' });
  }
  next();
};

// Staff routes - require employee role (check if user email exists in employees table)
const staffMiddleware = async (req, res, next) => {
  try {
    const db = require('../config/db');
    const userEmail = req.user?.email;
    
    if (!userEmail) {
      return res.status(403).json({ message: 'Employee privileges required' });
    }

    // Check if user email exists in employees table
    const { rows } = await db.query(
      'SELECT id FROM employees WHERE LOWER(email) = LOWER($1)',
      [userEmail]
    );

    if (rows.length === 0) {
      return res.status(403).json({ message: 'Employee privileges required' });
    }

    next();
  } catch (error) {
    console.error('Staff middleware error:', error);
    return res.status(500).json({ message: 'Error verifying employee status' });
  }
};

// Apply auth middleware to all routes
router.use(authMiddleware);

// Admin routes
router.post('/generate', adminMiddleware, monthlySummaryController.generateMonthlySummary);
router.post('/generate-all', adminMiddleware, monthlySummaryController.generateMonthlySummariesForAllStaff);
router.get('/list', adminMiddleware, monthlySummaryController.getMonthlySummaries);
router.get('/:id', adminMiddleware, monthlySummaryController.getMonthlySummaryById);
router.post('/:id/approve', adminMiddleware, monthlySummaryController.adminApproveReject);
router.post('/:id/reject', adminMiddleware, monthlySummaryController.adminApproveReject);
router.post('/bulk-approve', adminMiddleware, monthlySummaryController.bulkApproveMonthlySummaries);

// Staff routes
router.get('/staff/list', staffMiddleware, monthlySummaryController.getStaffMonthlySummaries);
router.get('/staff/:id', staffMiddleware, monthlySummaryController.getMonthlySummaryById);
router.post('/staff/:id/sign', staffMiddleware, monthlySummaryController.staffSignOff);

module.exports = router;

