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

    // Get all employees assigned to these projects (from both direct assignment and project_employees table)
    // First, get employees with direct project_id assignment
    const { data: directEmployees, error: directError } = await supabase
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

    if (directError) {
      console.error('Error fetching direct employees:', directError);
    }

    // Get employees from project_employees table
    const { data: projectEmployees, error: projectEmployeesError } = await supabase
      .from('project_employees')
      .select(`
        employee_id,
        project_id,
        assignment_start_date,
        assignment_end_date,
        employees:employee_id (
          id,
          name,
          email,
          phone,
          role,
          created_at
        ),
        projects:project_id (
          id,
          name,
          location
        )
      `)
      .in('project_id', projectIds)
      .eq('status', 'active')
      .order('assignment_start_date', { ascending: false });

    if (projectEmployeesError) {
      console.error('Error fetching project employees:', projectEmployeesError);
    }

    // Combine employees from both sources
    const employeeMap = new Map();

    // Add direct employees
    (directEmployees || []).forEach(employee => {
      if (employee.project_id && projectIds.includes(employee.project_id)) {
        employeeMap.set(`${employee.id}-${employee.project_id}`, {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          phone: employee.phone,
          role: employee.role,
          project_id: employee.project_id,
          project_name: employee.projects?.name || 'No Project',
          project_location: employee.projects?.location || null,
          created_at: employee.created_at,
        });
      }
    });

    // Add employees from project_employees table
    (projectEmployees || []).forEach(relation => {
      const employee = relation.employees;
      const project = relation.projects;
      
      // Double-check: ensure project belongs to this client
      if (employee && project && projectIds.includes(project.id)) {
        const key = `${employee.id}-${project.id}`;
        // Only add if not already added (prefer direct assignment if exists)
        if (!employeeMap.has(key)) {
          employeeMap.set(key, {
            id: employee.id,
            name: employee.name,
            email: employee.email,
            phone: employee.phone,
            role: employee.role,
            project_id: project.id,
            project_name: project.name || 'No Project',
            project_location: project.location || null,
            created_at: employee.created_at,
          });
        }
      }
    });

    // Convert map to array
    const staffs = Array.from(employeeMap.values());

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

