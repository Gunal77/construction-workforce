const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/authorizeRoles');
const User = require('../models/User');
const ProjectMerged = require('../models/ProjectMerged');

const router = express.Router();

// All routes require authentication and ADMIN role
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN'));

// GET /api/admin/supervisors - Get all supervisors with project counts
router.get('/', async (req, res) => {
  try {
    // MongoDB: Get supervisors from users collection
    // Include both active and inactive supervisors, filter by role
    const supervisors = await User.find({ role: 'SUPERVISOR' })
      .select('_id name email phone createdAt isActive')
      .sort({ name: 1 })
      .lean();

    // Get project counts for each supervisor from projects collection
    // Use bulk aggregation for better performance
    const supervisorIds = supervisors.map(s => s._id);
    
    // Aggregate project counts for all supervisors at once
    const projectCounts = await ProjectMerged.aggregate([
      { $unwind: '$assigned_supervisors' },
      { $match: { 'assigned_supervisors.supervisor_id': { $in: supervisorIds } } },
      { $group: { _id: '$assigned_supervisors.supervisor_id', count: { $sum: 1 } } }
    ]);
    
    const projectCountMap = new Map();
    projectCounts.forEach(pc => {
      projectCountMap.set(pc._id.toString(), pc.count);
    });
    
    // Enrich supervisors with project counts
    const enrichedSupervisors = supervisors.map((supervisor) => {
      const projectCount = projectCountMap.get(supervisor._id.toString()) || 0;
      
      return {
        id: supervisor._id,
        name: supervisor.name,
        email: supervisor.email,
        phone: supervisor.phone || null,
        created_at: supervisor.createdAt || supervisor.created_at,
        is_active: supervisor.isActive !== false,
        project_count: projectCount,
      };
    });

    return res.json({
      supervisors: enrichedSupervisors,
      total: enrichedSupervisors.length,
    });
  } catch (err) {
    console.error('Get supervisors error:', err);
    return res.status(500).json({ message: 'Error fetching supervisors' });
  }
});

// GET /api/admin/supervisors/:id - Get supervisor details with assigned projects
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // MongoDB implementation
    const supervisor = await User.findOne({ 
      _id: id, 
      role: 'SUPERVISOR' 
    }).lean();

    if (!supervisor) {
      return res.status(404).json({ message: 'Supervisor not found' });
    }

    // Get assigned projects from projects collection
    const projects = await ProjectMerged.find({
      'assigned_supervisors.supervisor_id': id
    }).lean();

    // Enrich projects with client information
    const projectsWithClients = projects.map(project => ({
      id: project._id,
      name: project.name,
      location: project.location || null,
      start_date: project.start_date || null,
      end_date: project.end_date || null,
      description: project.description || null,
      budget: project.budget ? parseFloat(project.budget.toString()) : null,
      client_user_id: project.client?.client_id || null,
      client_name: project.client?.client_name || null,
      created_at: project.created_at || project.createdAt,
    }));

    return res.json({
      success: true,
      data: {
        id: supervisor._id,
        name: supervisor.name,
        email: supervisor.email,
        phone: supervisor.phone || null,
        created_at: supervisor.createdAt || supervisor.created_at,
        is_active: supervisor.isActive !== false,
        assigned_projects: projectsWithClients,
        project_count: projectsWithClients.length,
      },
    });
  } catch (err) {
    console.error('Get supervisor details error:', err);
    return res.status(500).json({ message: 'Error fetching supervisor details' });
  }
});

module.exports = router;

