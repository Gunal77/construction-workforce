const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/jwt');

// Middleware to verify client authentication
const clientAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (!token || scheme !== 'Bearer') {
    return res.status(401).json({ message: 'Authorization header missing or malformed' });
  }

  try {
    const decoded = verifyToken(token);

    // Check for CLIENT role (uppercase from MongoDB) or 'client' (lowercase)
    const role = decoded.role?.toLowerCase();
    if (role !== 'client') {
      return res.status(403).json({ message: 'Client privileges required' });
    }

    // Handle both 'id' and 'userId' in token payload
    const clientId = decoded.id || decoded.userId;

    req.client = {
      id: clientId,
      email: decoded.email,
      role: decoded.role,
    };
    return next();
  } catch (error) {
    if (error.name !== 'JsonWebTokenError' || error.message !== 'invalid signature') {
      console.error('Client auth error', error.name, error.message);
    }
    return res.status(401).json({ 
      message: error.name === 'TokenExpiredError' 
        ? 'Token expired. Please log in again.' 
        : error.name === 'JsonWebTokenError' && error.message === 'invalid signature'
        ? 'Invalid token. Please log out and log in again.'
        : 'Invalid or expired token' 
    });
  }
};

// All routes require client authentication
router.use(clientAuthMiddleware);

// GET /api/client/attendance - Get attendance records for client's projects
router.get('/', async (req, res) => {
  try {
    const clientUserId = req.client.id;

    const { sortBy = 'check_in_time', sortOrder = 'desc', date, from, to, employeeId, projectId } = req.query;

    const ProjectMerged = require('../models/ProjectMerged');
    const AttendanceMerged = require('../models/AttendanceMerged');
    const EmployeeMerged = require('../models/EmployeeMerged');

      // Get all projects for this client
      const clientProjects = await ProjectMerged.find({
        'client.client_id': clientUserId
      }).select('_id').lean();

      if (!clientProjects || clientProjects.length === 0) {
        return res.json({ records: [] });
      }

      const projectIds = clientProjects.map(p => p._id.toString());

      // Get all employees assigned to these projects
      const employees = await EmployeeMerged.find({
        'project_assignments.project_id': { $in: projectIds },
        'project_assignments.status': 'active'
      }).lean();

      if (!employees || employees.length === 0) {
        return res.json({ records: [] });
      }

      // Get employee user IDs and staff IDs
      const employeeUserIds = employees.map(e => e.user_id).filter(Boolean);
      const employeeStaffIds = employees.map(e => e._id.toString());

      // Build query for attendance records
      const attendanceQuery = {
        $or: [
          { user_id: { $in: employeeUserIds } },
          { staff_id: { $in: employeeStaffIds } }
        ],
        project_id: { $in: projectIds }
      };

      // Apply filters
      if (projectId) {
        attendanceQuery.project_id = projectId;
      }

      if (employeeId) {
        const emp = employees.find(e => e._id.toString() === employeeId);
        if (emp) {
          attendanceQuery.$or = [
            { user_id: emp.user_id },
            { staff_id: emp._id.toString() }
          ];
        } else {
          return res.json({ records: [] });
        }
      }

      if (date) {
        const dateObj = new Date(date);
        const startOfDay = new Date(dateObj);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateObj);
        endOfDay.setHours(23, 59, 59, 999);
        attendanceQuery.check_in_time = { $gte: startOfDay, $lte: endOfDay };
      } else if (from && to) {
        const fromDate = new Date(from);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        attendanceQuery.check_in_time = { $gte: fromDate, $lte: toDate };
      }

      // Build sort
      const sortField = sortBy === 'check_out_time' ? 'check_out_time' : 'check_in_time';
      const sortDirection = sortOrder?.toLowerCase() === 'asc' ? 1 : -1;

      const attendanceRecords = await AttendanceMerged.find(attendanceQuery)
        .sort({ [sortField]: sortDirection })
        .lean();

      // Enrich with employee and project data
      const employeeMap = new Map(employees.map(e => [e._id.toString(), e]));
      const projectMap = new Map(clientProjects.map(p => [p._id.toString(), p]));

      const enrichedRecords = attendanceRecords.map(record => {
        const emp = Array.from(employeeMap.values()).find(e => 
          e.user_id === record.user_id || e._id.toString() === record.staff_id
        );
        const project = projectMap.get(record.project_id?.toString());

        // Convert Decimal128 to numbers for latitude/longitude
        const convertDecimal = (value) => {
          if (!value) return null;
          if (typeof value === 'object' && value.constructor && value.constructor.name === 'Decimal128') {
            return parseFloat(value.toString());
          }
          return typeof value === 'number' ? value : parseFloat(value);
        };

        return {
          id: record._id.toString(),
          user_id: record.user_id,
          check_in_time: record.check_in_time,
          check_out_time: record.check_out_time,
          image_url: record.image_url,
          checkout_image_url: record.checkout_image_url,
          latitude: convertDecimal(record.latitude),
          longitude: convertDecimal(record.longitude),
          checkout_latitude: convertDecimal(record.checkout_latitude),
          checkout_longitude: convertDecimal(record.checkout_longitude),
          user_email: emp?.email || null,
          employee_name: emp?.name || null,
          employee_role: emp?.role || null,
          project_id: project?._id?.toString() || null,
          project_name: project?.name || null,
        };
      });

      return res.json({ records: enrichedRecords });
  } catch (error) {
    console.error('Get client attendance error:', error);
    return res.status(500).json({ message: 'Failed to fetch attendance records', error: error.message });
  }
});

module.exports = router;

