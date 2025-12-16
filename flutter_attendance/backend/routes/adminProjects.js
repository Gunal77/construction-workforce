const express = require('express');
const { supabase } = require('../config/supabaseClient');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');

const router = express.Router();

// All routes require admin authentication
router.use(adminAuthMiddleware);

// GET /admin/projects - Fetch all projects with enriched data
router.get('/', async (req, res) => {
  try {
    // Get all projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (projectsError) {
      return res.status(500).json({ message: projectsError.message || 'Failed to fetch projects' });
    }

    if (!projects || projects.length === 0) {
      return res.json({ projects: [] });
    }

    // Enrich projects with client names, staff counts, and supervisors
    const enrichedProjects = await Promise.all(
      projects.map(async (project) => {
        // Get client name
        let clientName = null;
        if (project.client_user_id) {
          const { data: clientUser } = await supabase
            .from('users')
            .select('name')
            .eq('id', project.client_user_id)
            .maybeSingle();
          clientName = clientUser?.name || null;
        }

        // Get staff count
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
        let supervisorUserId = null;
        if (supervisorRelation?.supervisor_id) {
          const { data: supervisor } = await supabase
            .from('supervisors')
            .select('name, user_id')
            .eq('id', supervisorRelation.supervisor_id)
            .maybeSingle();
          supervisorName = supervisor?.name || null;
          supervisorUserId = supervisor?.user_id || null;
        }

        return {
          ...project,
          client_name: clientName,
          staff_count: staffCount || 0,
          supervisor_name: supervisorName,
          supervisor_id: supervisorUserId || null, // Use user_id from supervisors table
        };
      })
    );

    return res.json({ projects: enrichedProjects });
  } catch (err) {
    console.error('Get projects error', err);
    return res.status(500).json({ message: 'Error fetching projects' });
  }
});

// GET /admin/projects/:id - Get project by ID with supervisors
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (projectError) {
      return res.status(500).json({ message: projectError.message || 'Failed to fetch project' });
    }

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Get assigned supervisors
    // First, get the relation records
    const { data: supervisorRelations, error: relationsError } = await supabase
      .from('supervisor_projects_relation')
      .select('supervisor_id, assigned_at')
      .eq('project_id', id);

    if (relationsError) {
      console.error('Error fetching supervisor relations:', relationsError);
      return res.json({ 
        project,
        supervisors: []
      });
    }

    // If no relations, return empty supervisors array
    if (!supervisorRelations || supervisorRelations.length === 0) {
      return res.json({ 
        project,
        supervisors: []
      });
    }

    // Get supervisor IDs
    const supervisorIds = supervisorRelations.map(rel => rel.supervisor_id);

    // Fetch supervisor details
    const { data: supervisorsData, error: supervisorsError } = await supabase
      .from('supervisors')
      .select('id, name, email, phone')
      .in('id', supervisorIds);

    if (supervisorsError) {
      console.error('Error fetching supervisors:', supervisorsError);
      return res.json({ 
        project,
        supervisors: []
      });
    }

    // Combine supervisor data with assigned_at from relations
    const supervisors = (supervisorsData || []).map(supervisor => {
      const relation = supervisorRelations.find(rel => rel.supervisor_id === supervisor.id);
      return {
        ...supervisor,
        assignedAt: relation?.assigned_at || null,
      };
    });

    return res.json({ 
      project,
      supervisors: supervisors || []
    });
  } catch (err) {
    console.error('Get project error', err);
    return res.status(500).json({ message: 'Error fetching project' });
  }
});

// POST /admin/projects - Add new project
router.post('/', async (req, res) => {
  try {
    const { name, location, start_date, end_date, description, budget, client_user_id } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    // Client is mandatory
    if (!client_user_id) {
      return res.status(400).json({ message: 'Client is required. Each project must be linked to a client.' });
    }

    // Verify client exists
    const { data: clientUser, error: clientError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', client_user_id)
      .eq('role', 'client')
      .maybeSingle();

    if (clientError || !clientUser) {
      return res.status(400).json({ message: 'Invalid client. Client not found or is not a valid client user.' });
    }

    const projectData = {
      name: name.trim(),
      location: location?.trim() || null,
      start_date: start_date || null,
      end_date: end_date || null,
      description: description?.trim() || null,
      budget: budget != null ? (typeof budget === 'string' ? parseFloat(budget) : budget) : null,
      client_user_id: client_user_id,
    };

    const { data, error } = await supabase
      .from('projects')
      .insert([projectData])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ message: error.message || 'Failed to create project' });
    }

    return res.status(201).json({ project: data, message: 'Project created successfully' });
  } catch (err) {
    console.error('Create project error', err);
    return res.status(500).json({ message: 'Error creating project' });
  }
});

// PUT /admin/projects/:id - Update project by ID
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, start_date, end_date, description, budget, client_user_id } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    const updateData = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: 'Project name must be a non-empty string' });
      }
      updateData.name = name.trim();
    }
    if (location !== undefined) {
      updateData.location = location?.trim() || null;
    }
    if (start_date !== undefined) {
      updateData.start_date = start_date || null;
    }
    if (end_date !== undefined) {
      updateData.end_date = end_date || null;
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }
    if (budget !== undefined) {
      updateData.budget = budget != null ? (typeof budget === 'string' ? parseFloat(budget) : budget) : null;
    }
    if (client_user_id !== undefined) {
      updateData.client_user_id = client_user_id || null;
    }
    if (req.body.status !== undefined) {
      updateData.status = req.body.status || null;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ message: 'Project not found' });
      }
      return res.status(400).json({ message: error.message || 'Failed to update project' });
    }

    if (!data) {
      return res.status(404).json({ message: 'Project not found' });
    }

    return res.json({ project: data, message: 'Project updated successfully' });
  } catch (err) {
    console.error('Update project error', err);
    return res.status(500).json({ message: 'Error updating project' });
  }
});

// DELETE /admin/projects/:id - Delete project by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ message: error.message || 'Failed to delete project' });
    }

    return res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Delete project error', err);
    return res.status(500).json({ message: 'Error deleting project' });
  }
});

// POST /admin/projects/:id/assign-supervisor - Assign supervisor to project
router.post('/:id/assign-supervisor', async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { supervisor_id } = req.body;

    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    // If supervisor_id is null or empty, remove supervisor
    if (!supervisor_id) {
      // Remove all supervisor assignments for this project
      const { error: deleteError } = await supabase
        .from('supervisor_projects_relation')
        .delete()
        .eq('project_id', projectId);

      if (deleteError) {
        return res.status(500).json({ message: deleteError.message || 'Failed to remove supervisor from project' });
      }

      return res.json({ 
        message: 'Supervisor removed from project successfully' 
      });
    }

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Verify supervisor exists (check in users table with role='supervisor')
    const { data: supervisorUser, error: supervisorError } = await supabase
      .from('users')
      .select('id')
      .eq('id', supervisor_id)
      .eq('role', 'supervisor')
      .eq('is_active', true)
      .maybeSingle();

    if (supervisorError || !supervisorUser) {
      return res.status(404).json({ message: 'Supervisor not found or inactive' });
    }

    // Remove existing supervisor assignments for this project (only one supervisor per project)
    await supabase
      .from('supervisor_projects_relation')
      .delete()
      .eq('project_id', projectId);

    // Get supervisor profile id from supervisors table
    const { data: supervisorProfile, error: profileError } = await supabase
      .from('supervisors')
      .select('id')
      .eq('user_id', supervisor_id)
      .maybeSingle();

    if (profileError || !supervisorProfile) {
      return res.status(404).json({ message: 'Supervisor profile not found' });
    }

    // Assign new supervisor to project
    const { data, error } = await supabase
      .from('supervisor_projects_relation')
      .insert({
        supervisor_id: supervisorProfile.id,
        project_id: projectId,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ message: error.message || 'Failed to assign supervisor to project' });
    }

    return res.json({ 
      relation: data, 
      message: 'Supervisor assigned to project successfully' 
    });
  } catch (err) {
    console.error('Assign supervisor error', err);
    return res.status(500).json({ message: 'Error assigning supervisor to project' });
  }
});

// POST /admin/projects/assign-all-supervisors - Assign all supervisors to all projects
router.post('/assign-all-supervisors', async (req, res) => {
  try {
    // Get all projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id');

    if (projectsError) {
      return res.status(500).json({ message: 'Failed to fetch projects' });
    }

    // Get all supervisors
    const { data: supervisors, error: supervisorsError } = await supabase
      .from('supervisors')
      .select('id');

    if (supervisorsError) {
      return res.status(500).json({ message: 'Failed to fetch supervisors' });
    }

    if (!projects || projects.length === 0) {
      return res.status(400).json({ message: 'No projects found' });
    }

    if (!supervisors || supervisors.length === 0) {
      return res.status(400).json({ message: 'No supervisors found' });
    }

    // Assign all supervisors to all projects
    const relations = [];
    for (const project of projects) {
      for (const supervisor of supervisors) {
        relations.push({
          supervisor_id: supervisor.id,
          project_id: project.id,
        });
      }
    }

    // Insert all relations (using upsert to handle duplicates)
    const { data: inserted, error: insertError } = await supabase
      .from('supervisor_projects_relation')
      .upsert(relations, {
        onConflict: 'supervisor_id,project_id',
      })
      .select();

    if (insertError) {
      return res.status(500).json({ 
        message: insertError.message || 'Failed to assign supervisors to projects' 
      });
    }

    return res.json({ 
      message: `Successfully assigned ${supervisors.length} supervisor(s) to ${projects.length} project(s)`,
      total_relations: inserted?.length || relations.length,
      supervisors_count: supervisors.length,
      projects_count: projects.length,
    });
  } catch (err) {
    console.error('Assign all supervisors error', err);
    return res.status(500).json({ message: 'Error assigning supervisors to projects' });
  }
});

// POST /admin/projects/:id/assign-staffs - Assign multiple staffs to project
router.post('/:id/assign-staffs', async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { staff_ids } = req.body; // Array of staff IDs

    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    if (!Array.isArray(staff_ids)) {
      return res.status(400).json({ message: 'staff_ids must be an array' });
    }

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Update all selected staff to this project
    if (staff_ids.length > 0) {
      const { error: updateError } = await supabase
        .from('employees')
        .update({ project_id: projectId })
        .in('id', staff_ids);

      if (updateError) {
        return res.status(500).json({ message: updateError.message || 'Failed to assign staffs to project' });
      }
    }

    // Get updated staff count
    const { count: staffCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    return res.json({ 
      message: `Successfully assigned ${staff_ids.length} staff(s) to project`,
      staff_count: staffCount || 0
    });
  } catch (err) {
    console.error('Assign staffs error', err);
    return res.status(500).json({ message: 'Error assigning staffs to project' });
  }
});

// DELETE /admin/projects/:id/remove-staff/:staffId - Remove staff from project
router.delete('/:id/remove-staff/:staffId', async (req, res) => {
  try {
    const { id: projectId, staffId } = req.params;

    if (!projectId || !staffId) {
      return res.status(400).json({ message: 'Project ID and Staff ID are required' });
    }

    // Verify staff is assigned to this project
    const { data: staff, error: staffError } = await supabase
      .from('employees')
      .select('id, project_id')
      .eq('id', staffId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (staffError || !staff) {
      return res.status(404).json({ message: 'Staff not found or not assigned to this project' });
    }

    // Remove staff from project (set project_id to null)
    const { error: updateError } = await supabase
      .from('employees')
      .update({ project_id: null })
      .eq('id', staffId);

    if (updateError) {
      return res.status(500).json({ message: updateError.message || 'Failed to remove staff from project' });
    }

    // Get updated staff count
    const { count: staffCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    return res.json({ 
      message: 'Staff removed from project successfully',
      staff_count: staffCount || 0
    });
  } catch (err) {
    console.error('Remove staff error', err);
    return res.status(500).json({ message: 'Error removing staff from project' });
  }
});

// GET /admin/projects/:id/staffs - Get all staffs assigned to project
router.get('/:id/staffs', async (req, res) => {
  try {
    const { id: projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    const { data, error } = await supabase
      .from('employees')
      .select('id, name, email, phone, role')
      .eq('project_id', projectId)
      .order('name', { ascending: true });

    if (error) {
      return res.status(500).json({ message: error.message || 'Failed to fetch project staffs' });
    }

    return res.json({ staffs: data || [] });
  } catch (err) {
    console.error('Get project staffs error', err);
    return res.status(500).json({ message: 'Error fetching project staffs' });
  }
});

// GET /admin/projects/supervisors/list - Get all supervisors (users with role='supervisor')
router.get('/supervisors/list', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, phone')
      .eq('role', 'supervisor')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      return res.status(500).json({ message: error.message || 'Failed to fetch supervisors' });
    }

    return res.json({ supervisors: data || [] });
  } catch (err) {
    console.error('Get supervisors error', err);
    return res.status(500).json({ message: 'Error fetching supervisors' });
  }
});

module.exports = router;

