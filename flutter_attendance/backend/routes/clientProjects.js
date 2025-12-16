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

// GET /api/client/projects - Fetch projects for the authenticated client
router.get('/', async (req, res) => {
  try {
    const clientUserId = req.client.id;

    // Fetch only projects assigned to this client
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('client_user_id', clientUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching client projects:', error);
      return res.status(500).json({ message: error.message || 'Failed to fetch projects' });
    }

    if (!projects || projects.length === 0) {
      return res.json({ 
        projects: [],
        total: 0
      });
    }

    // Enrich projects with staff counts and supervisor names
    const enrichedProjects = await Promise.all(
      projects.map(async (project) => {
        // Get staff count for this project
        const { count: staffCount } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id);

        // Get assigned supervisor (one per project)
        const { data: supervisorRelation } = await supabase
          .from('supervisor_projects_relation')
          .select('supervisor_id')
          .eq('project_id', project.id)
          .limit(1)
          .maybeSingle();

        let supervisorName = null;
        if (supervisorRelation?.supervisor_id) {
          const { data: supervisor } = await supabase
            .from('supervisors')
            .select('name')
            .eq('id', supervisorRelation.supervisor_id)
            .maybeSingle();
          supervisorName = supervisor?.name || null;
        }

        return {
          ...project,
          staff_count: staffCount || 0,
          supervisor_name: supervisorName,
        };
      })
    );

    return res.json({ 
      projects: enrichedProjects,
      total: enrichedProjects.length
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

    // Fetch all projects for this client
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('client_user_id', clientUserId);

    if (error) {
      console.error('Supabase error fetching client project stats:', error);
      return res.status(500).json({ message: error.message || 'Failed to fetch project stats' });
    }

    const projects = data || [];
    const totalProjects = projects.length;
    const activeProjects = projects.filter(
      (project) => !project.end_date || new Date(project.end_date) > new Date()
    ).length;
    const completedProjects = projects.filter(
      (project) => project.end_date && new Date(project.end_date) <= new Date()
    ).length;
    const totalBudget = projects.reduce(
      (sum, project) => sum + (project.budget || 0),
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

