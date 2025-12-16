const express = require('express');
const { supabase } = require('../config/supabaseClient');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');

const router = express.Router();

// All routes require admin authentication
router.use(adminAuthMiddleware);

// GET /admin/projects - Fetch all projects
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ message: error.message || 'Failed to fetch projects' });
    }

    return res.json({ projects: data || [] });
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

    const projectData = {
      name: name.trim(),
      location: location?.trim() || null,
      start_date: start_date || null,
      end_date: end_date || null,
      description: description?.trim() || null,
      budget: budget != null ? (typeof budget === 'string' ? parseFloat(budget) : budget) : null,
      client_user_id: client_user_id || null,
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

    if (!supervisor_id) {
      return res.status(400).json({ message: 'Supervisor ID is required' });
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

    // Verify supervisor exists
    const { data: supervisor, error: supervisorError } = await supabase
      .from('supervisors')
      .select('id')
      .eq('id', supervisor_id)
      .maybeSingle();

    if (supervisorError || !supervisor) {
      return res.status(404).json({ message: 'Supervisor not found' });
    }

    // Assign supervisor to project (using ON CONFLICT to handle duplicates)
    const { data, error } = await supabase
      .from('supervisor_projects_relation')
      .upsert(
        {
          supervisor_id,
          project_id: projectId,
        },
        {
          onConflict: 'supervisor_id,project_id',
        }
      )
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

module.exports = router;

