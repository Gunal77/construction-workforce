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

// GET /api/client/supervisors - Fetch all supervisors assigned to projects belonging to the authenticated client
router.get('/', async (req, res) => {
  try {
    const clientUserId = req.client.id;

    // First, get all project IDs for this client
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, location')
      .eq('client_user_id', clientUserId);

    if (projectsError) {
      console.error('Error fetching client projects:', projectsError);
      return res.status(500).json({ message: 'Failed to fetch client projects' });
    }

    if (!projects || projects.length === 0) {
      return res.json({ supervisors: [], total: 0 });
    }

    const projectIds = projects.map(p => p.id);

    // Get all supervisors assigned to these projects via supervisor_projects_relation
    const { data: supervisorRelations, error: relationsError } = await supabase
      .from('supervisor_projects_relation')
      .select(`
        supervisor_id,
        assigned_at,
        projects:project_id (
          id,
          name,
          location
        ),
        supervisors:supervisor_id (
          id,
          name,
          email,
          phone,
          client_user_id,
          created_at
        )
      `)
      .in('project_id', projectIds);

    if (relationsError) {
      console.error('Error fetching supervisor relations:', relationsError);
      return res.status(500).json({ message: 'Failed to fetch supervisor relations' });
    }

    // Combine supervisors from project relations only
    // Only show supervisors assigned to projects (not all supervisors with client_user_id)
    const supervisorMap = new Map();

    // Add supervisors from project relations
    (supervisorRelations || []).forEach(relation => {
      const supervisor = relation.supervisors;
      const project = relation.projects;
      
      // Double-check: ensure project belongs to this client
      if (supervisor && project && projectIds.includes(project.id)) {
        const supervisorId = supervisor.id;
        if (!supervisorMap.has(supervisorId)) {
          supervisorMap.set(supervisorId, {
            id: supervisor.id,
            name: supervisor.name,
            email: supervisor.email,
            phone: supervisor.phone,
            client_user_id: supervisor.client_user_id,
            created_at: supervisor.created_at,
            projects: [],
          });
        }
        supervisorMap.get(supervisorId).projects.push({
          id: project.id,
          name: project.name,
          location: project.location,
          assigned_at: relation.assigned_at,
        });
      }
    });

    // Format the response - create a flat list with one entry per supervisor-project combination
    const supervisors = [];
    supervisorMap.forEach((supervisor, supervisorId) => {
      if (supervisor.projects.length > 0) {
        // Create one entry per project
        supervisor.projects.forEach(project => {
          supervisors.push({
            id: supervisor.id,
            name: supervisor.name,
            email: supervisor.email,
            phone: supervisor.phone,
            project_id: project.id,
            project_name: project.name,
            project_location: project.location,
            assigned_at: project.assigned_at || supervisor.created_at,
            created_at: supervisor.created_at,
          });
        });
      } else {
        // Supervisor with no projects assigned
        supervisors.push({
          id: supervisor.id,
          name: supervisor.name,
          email: supervisor.email,
          phone: supervisor.phone,
          project_id: null,
          project_name: 'Unassigned',
          project_location: null,
          assigned_at: supervisor.created_at,
          created_at: supervisor.created_at,
        });
      }
    });

    return res.json({ 
      supervisors: supervisors || [],
      total: supervisors.length
    });
  } catch (err) {
    console.error('Get client supervisors error', err);
    return res.status(500).json({ message: 'Error fetching supervisors' });
  }
});

module.exports = router;

