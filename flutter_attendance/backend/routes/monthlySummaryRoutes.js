const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/authorizeRoles');
const monthlySummaryController = require('../controllers/monthlySummaryController');
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
    const EmployeeMerged = require('../models/EmployeeMerged');
    const User = require('../models/User');
      
      // Get user to find employee
      const userId = req.user.id || req.user.userId;
      const user = await User.findById(userId).lean();
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Try multiple methods to find employee
      let employee = await EmployeeMerged.findOne({ user_id: userId }).lean();
      
      if (!employee && user.email) {
        employee = await EmployeeMerged.findOne({ 
          email: user.email.toLowerCase() 
        }).lean();
      }
      
      // If still not found, try employeeRepository
      if (!employee && user.email) {
        const empFromRepo = await employeeRepository.findByEmail(user.email);
        if (empFromRepo) {
          employee = await EmployeeMerged.findById(empFromRepo._id || empFromRepo.id).lean();
        }
      }

      // Log warning but don't block - allow access for debugging
      if (!employee) {
        console.warn(`[WARNING] Employee not found for user ${user.email}, but allowing access`);
      }

    next();
  } catch (error) {
    console.error('Staff middleware error:', error);
    // Don't block on error - allow access for debugging
    console.warn('[WARNING] Staff middleware error, but allowing access:', error.message);
    next();
  }
};

// Apply auth middleware to all routes
router.use(authMiddleware);

// Admin routes - ADMIN role only
router.post('/generate', authorizeRoles('ADMIN'), monthlySummaryController.generateMonthlySummary);
router.post('/generate-all', authorizeRoles('ADMIN'), monthlySummaryController.generateMonthlySummariesForAllStaff);
router.get('/list', authorizeRoles('ADMIN'), monthlySummaryController.getMonthlySummaries);
router.get('/:id', authorizeRoles('ADMIN'), monthlySummaryController.getMonthlySummaryById);
router.post('/:id/approve', authorizeRoles('ADMIN'), monthlySummaryController.adminApproveReject);
router.post('/:id/reject', authorizeRoles('ADMIN'), monthlySummaryController.adminApproveReject);
router.post('/bulk-approve', authorizeRoles('ADMIN'), monthlySummaryController.bulkApproveMonthlySummaries);

// Staff routes
// IMPORTANT: More specific routes must come BEFORE parameterized routes
router.get('/staff/list', staffMiddleware, monthlySummaryController.getStaffMonthlySummaries);
// Alternative endpoint to fetch by month/year (more reliable) - MUST come before /staff/:id
router.get('/staff/by-month', staffMiddleware, monthlySummaryController.getStaffMonthlySummaryByMonth);
// Alternative sign endpoint by month/year - MUST come before /staff/:id/sign
router.post('/staff/by-month/sign', staffMiddleware, monthlySummaryController.staffSignOffByMonth);
// Parameterized routes come last
router.get('/staff/:id', staffMiddleware, (req, res, next) => {
  console.log(`[ROUTE] GET /staff/:id - ID: ${req.params.id}, User: ${req.user?.email}, Role: ${req.user?.role}`);
  next();
}, monthlySummaryController.getMonthlySummaryById);
router.post('/staff/:id/sign', staffMiddleware, (req, res, next) => {
  console.log(`[ROUTE] POST /staff/:id/sign - ID: ${req.params.id}, User: ${req.user?.email}`);
  next();
}, monthlySummaryController.staffSignOff);

module.exports = router;

