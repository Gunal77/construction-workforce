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

// GET /api/client/supervisors - Fetch all supervisors assigned to projects belonging to the authenticated client
router.get('/', async (req, res) => {
  try {
    const clientUserId = req.client.id;

    const ProjectMerged = require('../models/ProjectMerged');
    const User = require('../models/User');

    // Get all projects for this client
    const projects = await ProjectMerged.find({
      'client.client_id': clientUserId
    }).select('_id name location assigned_supervisors').lean();

    if (!projects || projects.length === 0) {
      return res.json({ supervisors: [], total: 0 });
    }

    // Collect all unique supervisor IDs from all projects
    const supervisorIds = new Set();
    const supervisorProjectMap = new Map(); // supervisorId -> [{projectId, projectName, projectLocation, assignedAt}]

    projects.forEach(project => {
      if (project.assigned_supervisors && project.assigned_supervisors.length > 0) {
        project.assigned_supervisors.forEach(sup => {
          if (sup.status === 'active' && sup.supervisor_id) {
            supervisorIds.add(sup.supervisor_id);
            
            if (!supervisorProjectMap.has(sup.supervisor_id)) {
              supervisorProjectMap.set(sup.supervisor_id, []);
            }
            
            supervisorProjectMap.get(sup.supervisor_id).push({
              projectId: project._id.toString(),
              projectName: project.name,
              projectLocation: project.location,
              assignedAt: sup.assigned_at || sup.created_at,
            });
          }
        });
      }
    });

    if (supervisorIds.size === 0) {
      return res.json({ supervisors: [], total: 0 });
    }

    // Fetch supervisor details from User collection
    const supervisors = await User.find({
      _id: { $in: Array.from(supervisorIds) },
      role: 'SUPERVISOR'
    }).lean();

    // Format the response - create a flat list with one entry per supervisor-project combination
    const result = [];
    supervisors.forEach(supervisor => {
      const projects = supervisorProjectMap.get(supervisor._id.toString()) || [];
      
      if (projects.length > 0) {
        projects.forEach(project => {
          result.push({
            id: supervisor._id.toString(),
            name: supervisor.name,
            email: supervisor.email,
            phone: null, // User model doesn't have phone
            project_id: project.projectId,
            project_name: project.projectName,
            project_location: project.projectLocation,
            assigned_at: project.assignedAt,
            created_at: supervisor.createdAt,
          });
        });
      } else {
        result.push({
          id: supervisor._id.toString(),
          name: supervisor.name,
          email: supervisor.email,
          phone: null,
          project_id: null,
          project_name: 'Unassigned',
          project_location: null,
          assigned_at: supervisor.createdAt,
          created_at: supervisor.createdAt,
        });
      }
    });

    return res.json({ 
      supervisors: result,
      total: result.length
    });
  } catch (err) {
    console.error('Get client supervisors error', err);
    return res.status(500).json({ message: 'Error fetching supervisors' });
  }
});

module.exports = router;

