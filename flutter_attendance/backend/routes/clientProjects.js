const express = require('express');
const mongoose = require('mongoose');
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
    // The token from unifiedLogin has both 'id' and 'userId' fields
    let clientId = decoded.id || decoded.userId;
    
    // Convert to string if it's an ObjectId
    if (clientId && typeof clientId === 'object') {
      clientId = clientId.toString();
    }
    if (clientId) {
      clientId = String(clientId);
    }

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

// GET /api/client/projects - Fetch projects for the authenticated client
router.get('/', async (req, res) => {
  try {
    const clientUserId = req.client.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;

    const ProjectMerged = require('../models/ProjectMerged');
    const User = require('../models/User');

    // Convert clientUserId to string for comparison
    const clientIdString = String(clientUserId);

    // Get total count for pagination
    const totalCount = await ProjectMerged.countDocuments({
      'client.client_id': clientIdString
    });

    // Fetch projects with pagination
    const projects = await ProjectMerged.find({
      'client.client_id': clientIdString
    })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    if (!projects || projects.length === 0) {
      return res.json({ 
        projects: [],
        total: 0,
        page: 1,
        totalPages: 0,
        limit
      });
    }

    // Get client name
    const clientUser = await User.findById(clientUserId).select('name').lean();
    const clientName = clientUser?.name || null;

    // Enrich projects with staff counts and supervisor names
    const enrichedProjects = projects.map((project) => {
      const staffCount = project.assigned_employees?.filter(emp => emp.status === 'active').length || 0;
      const supervisorName = project.assigned_supervisors?.find(sup => sup.status === 'active')?.supervisor_name || null;

      return {
        id: project._id,
        name: project.name,
        location: project.location,
        start_date: project.start_date,
        end_date: project.end_date,
        description: project.description,
        budget: project.budget ? parseFloat(project.budget.toString()) : null,
        created_at: project.created_at,
        staff_count: staffCount,
        supervisor_name: supervisorName,
        client_name: clientName,
        client_user_id: clientUserId,
      };
    });

    const totalPages = Math.ceil(totalCount / limit);

    return res.json({ 
      projects: enrichedProjects,
      total: totalCount,
      page,
      totalPages,
      limit
    });
  } catch (err) {
    console.error('Get client projects error', err);
    return res.status(500).json({ message: 'Error fetching projects' });
  }
});

// GET /api/client/projects/stats - Get project statistics for the authenticated client
router.get('/stats', async (req, res) => {
  try {
    const clientUserId = req.client.id;

    const ProjectMerged = require('../models/ProjectMerged');

    // Fetch all projects for this client
    // Convert clientUserId to string for comparison
    const clientIdString = String(clientUserId);
    const projects = await ProjectMerged.find({
      'client.client_id': clientIdString
    }).lean();

    const totalProjects = projects.length;
    const now = new Date();
    const activeProjects = projects.filter(
      (project) => !project.end_date || new Date(project.end_date) > now
    ).length;
    const completedProjects = projects.filter(
      (project) => project.end_date && new Date(project.end_date) <= now
    ).length;
    const totalBudget = projects.reduce(
      (sum, project) => {
        const budget = project.budget ? parseFloat(project.budget.toString()) : 0;
        return sum + budget;
      },
      0
    );

    return res.json({
      totalProjects,
      activeProjects,
      completedProjects,
      totalBudget,
    });
  } catch (err) {
    console.error('Get client project stats error', err);
    return res.status(500).json({ message: 'Error fetching project stats' });
  }
});

module.exports = router;

