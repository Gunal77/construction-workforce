const express = require('express');
const { supabase } = require('../config/supabaseClient');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');

const router = express.Router();

// All routes require admin authentication
router.use(adminAuthMiddleware);

// GET /api/admin/supervisors - Get all supervisors with project counts
router.get('/', async (req, res) => {
  try {
    const { data: supervisors, error } = await supabase
      .from('users')
      .select('id, name, email, phone, created_at, is_active')
      .eq('role', 'supervisor')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching supervisors:', error);
      return res.status(500).json({ message: 'Failed to fetch supervisors' });
    }

    // Optimize: Batch fetch all supervisor records and project counts in parallel
    const supervisorUserIds = (supervisors || []).map(s => s.id);
    
    // Fetch all supervisor records in one query
    const { data: supervisorRecords } = await supabase
      .from('supervisors')
      .select('id, user_id')
      .in('user_id', supervisorUserIds);

    const supervisorIdMap = new Map();
    (supervisorRecords || []).forEach(record => {
      supervisorIdMap.set(record.user_id, record.id);
    });

    const supervisorProfileIds = [...supervisorIdMap.values()];

    // Fetch all project counts in parallel
    const projectCountPromises = supervisorProfileIds.map(supervisorId =>
      supabase
        .from('supervisor_projects_relation')
        .select('*', { count: 'exact', head: true })
        .eq('supervisor_id', supervisorId)
    );

    const projectCounts = await Promise.all(projectCountPromises);
    const projectCountMap = new Map();
    supervisorProfileIds.forEach((supervisorId, index) => {
      projectCountMap.set(supervisorId, projectCounts[index].count || 0);
    });

    // Enrich supervisors with project counts (no async operations needed)
    const enrichedSupervisors = (supervisors || []).map((supervisor) => {
      const supervisorProfileId = supervisorIdMap.get(supervisor.id);
      const projectCount = supervisorProfileId ? (projectCountMap.get(supervisorProfileId) || 0) : 0;

      return {
        ...supervisor,
        project_count: projectCount,
      };
    });

    return res.json({ 
      supervisors: enrichedSupervisors,
      total: enrichedSupervisors.length 
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

    // Get supervisor details
    const { data: supervisor, error: supervisorError } = await supabase
      .from('users')
      .select('id, name, email, phone, created_at, is_active')
      .eq('id', id)
      .eq('role', 'supervisor')
      .maybeSingle();

    if (supervisorError) {
      console.error('Error fetching supervisor:', supervisorError);
      return res.status(500).json({ message: 'Failed to fetch supervisor' });
    }

    if (!supervisor) {
      return res.status(404).json({ message: 'Supervisor not found' });
    }

    // Get supervisor record from supervisors table to get the supervisor.id
    const { data: supervisorRecord, error: supervisorRecordError } = await supabase
      .from('supervisors')
      .select('id')
      .eq('user_id', id)
      .maybeSingle();

    if (supervisorRecordError) {
      console.error('Error fetching supervisor record:', supervisorRecordError);
      return res.status(500).json({ message: 'Failed to fetch supervisor record' });
    }

    if (!supervisorRecord) {
      // Supervisor user exists but no supervisor profile record
      return res.json({
        success: true,
        data: {
          ...supervisor,
          assigned_projects: [],
          project_count: 0,
        },
      });
    }

    const supervisorId = supervisorRecord.id;

    // Get assigned projects using supervisor.id (not user.id)
    const { data: projectRelations, error: relationsError } = await supabase
      .from('supervisor_projects_relation')
      .select(`
        project_id,
        assigned_at,
        projects:project_id (
          id,
          name,
          location,
          start_date,
          end_date,
          description,
          budget,
          client_user_id,
          created_at
        )
      `)
      .eq('supervisor_id', supervisorId);

    if (relationsError) {
      console.error('Error fetching assigned projects:', relationsError);
      return res.status(500).json({ message: 'Failed to fetch assigned projects' });
    }

    // Extract projects from relations
    const assignedProjects = (projectRelations || [])
      .map((relation) => relation.projects)
      .filter((project) => project !== null);

    // Optimize: Batch fetch all client names in one query
    const clientUserIds = [...new Set(assignedProjects.map(p => p.client_user_id).filter(Boolean))];
    const { data: clientUsers } = await supabase
      .from('users')
      .select('id, name')
      .in('id', clientUserIds);

    const clientMap = new Map((clientUsers || []).map(c => [c.id, c.name]));

    // Enrich projects with client names (no async operations needed)
    const projectsWithClients = assignedProjects.map((project) => {
      const clientName = project.client_user_id ? (clientMap.get(project.client_user_id) || null) : null;
      return {
        ...project,
        client_name: clientName,
      };
    });

    return res.json({
      success: true,
      data: {
        ...supervisor,
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

