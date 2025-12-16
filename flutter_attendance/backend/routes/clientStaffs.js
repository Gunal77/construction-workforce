const express = require('express');
const { supabase } = require('../config/supabaseClient');
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

    if (decoded.role !== 'client') {
      return res.status(403).json({ message: 'Client privileges required' });
    }

    req.client = {
      id: decoded.id,
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

    // First, get all project IDs for this client
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id')
      .eq('client_user_id', clientUserId);

    if (projectsError) {
      console.error('Error fetching client projects:', projectsError);
      return res.status(500).json({ message: 'Failed to fetch client projects' });
    }

    if (!projects || projects.length === 0) {
      return res.json({ staffs: [], total: 0 });
    }

    const projectIds = projects.map(p => p.id);

    // Get all employees assigned to these projects
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select(`
        id,
        name,
        email,
        phone,
        role,
        project_id,
        created_at,
        projects:project_id (
          id,
          name,
          location
        )
      `)
      .in('project_id', projectIds)
      .order('name', { ascending: true });

    if (employeesError) {
      console.error('Error fetching staff:', employeesError);
      return res.status(500).json({ message: 'Failed to fetch staff' });
    }

    // Format the response
    const staffs = (employees || []).map(employee => ({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
      project_id: employee.project_id,
      project_name: employee.projects?.name || 'No Project',
      project_location: employee.projects?.location || null,
      created_at: employee.created_at,
    }));

    return res.json({ 
      staffs: staffs || [],
      total: staffs.length
    });
  } catch (err) {
    console.error('Get client staffs error', err);
    return res.status(500).json({ message: 'Error fetching staff' });
  }
});

module.exports = router;

