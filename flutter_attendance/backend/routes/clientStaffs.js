const express = require('express');
const { verifyToken } = require('../utils/jwt');

const router = express.Router();

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

// GET /api/client/staffs - Fetch all staff assigned to projects belonging to the authenticated client
router.get('/', async (req, res) => {
  try {
    const clientUserId = req.client.id;

    const ProjectMerged = require('../models/ProjectMerged');
    const EmployeeMerged = require('../models/EmployeeMerged');

      // Get all projects for this client
      const projects = await ProjectMerged.find({
        'client.client_id': clientUserId
      }).select('_id name location assigned_employees').lean();

      if (!projects || projects.length === 0) {
        return res.json({ staffs: [], total: 0 });
      }

      const projectIds = projects.map(p => p._id.toString());

      // Get all employees assigned to these projects
      const employees = await EmployeeMerged.find({
        'project_assignments.project_id': { $in: projectIds },
        'project_assignments.status': 'active'
      }).lean();

      // Create a map of project IDs to project names
      const projectMap = new Map(projects.map(p => [p._id.toString(), { name: p.name, location: p.location }]));

      // Format the response
      const staffs = [];
      employees.forEach(employee => {
        const activeAssignments = employee.project_assignments?.filter(
          assignment => assignment.status === 'active' && projectIds.includes(assignment.project_id)
        ) || [];

        if (activeAssignments.length > 0) {
          activeAssignments.forEach(assignment => {
            const project = projectMap.get(assignment.project_id);
            staffs.push({
              id: employee._id.toString(),
              name: employee.name,
              email: employee.email,
              phone: employee.phone,
              role: employee.role,
              project_id: assignment.project_id,
              project_name: project?.name || 'No Project',
              project_location: project?.location || null,
              created_at: employee.created_at,
            });
          });
        } else {
          // Employee with no active project assignments
          staffs.push({
            id: employee._id.toString(),
            name: employee.name,
            email: employee.email,
            phone: employee.phone,
            role: employee.role,
            project_id: null,
            project_name: 'Unassigned',
            project_location: null,
            created_at: employee.created_at,
          });
        }
      });

      // Sort by name
      staffs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      return res.json({ 
        staffs: staffs,
        total: staffs.length
      });
  } catch (err) {
    console.error('Get client staffs error', err);
    return res.status(500).json({ message: 'Error fetching staff' });
  }
});

module.exports = router;

