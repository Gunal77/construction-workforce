const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/authorizeRoles');
const projectRepository = require('../repositories/projectRepository');
const Project = require('../models/ProjectMerged');
const User = require('../models/User');

const router = express.Router();

// All routes require authentication and ADMIN role
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN'));

// GET /admin/projects - Fetch all projects with enriched data
router.get('/', async (req, res) => {
  try {
    // MongoDB: Use repository to get projects
    const projects = await projectRepository.findAll({ orderBy: 'created_at desc' });
    
    // Enrich with client names and staff counts from embedded data
    const enrichedProjects = projects.map((project) => {
      const clientName = project.client?.client_name || null;
      const staffCount = project.assigned_employees?.length || 0;
      const supervisorCount = project.assigned_supervisors?.length || 0;
      
      return {
        ...project,
        client_name: clientName,
        staff_count: staffCount,
        supervisor_count: supervisorCount,
      };
    });
    
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

    // MongoDB implementation
    const project = await projectRepository.findById(id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Get supervisors from embedded assigned_supervisors array
    const supervisorAssignments = project.assigned_supervisors || [];
    
    if (supervisorAssignments.length === 0) {
      return res.json({
        project: {
          ...project,
          supervisor_id: null,
        },
        supervisors: [],
      });
    }

    // Fetch supervisor user details
    const supervisorIds = supervisorAssignments.map(assignment => assignment.supervisor_id);
    const supervisors = await User.find({ 
      _id: { $in: supervisorIds },
      role: 'SUPERVISOR'
    })
      .select('_id name email phone')
      .lean();

    // Combine supervisor data with assigned_at from embedded data
    const supervisorsWithAssignment = supervisors.map(supervisor => {
      const supervisorId = supervisor._id || supervisor.id;
      const assignment = supervisorAssignments.find(
        a => a.supervisor_id === supervisorId
      );
      return {
        id: supervisorId,
        name: supervisor.name,
        email: supervisor.email,
        phone: supervisor.phone || null,
        user_id: supervisorId,
        assignedAt: assignment?.assigned_at || null,
      };
    });

    // Get the first supervisor's user_id (what frontend expects as supervisor_id)
    const firstSupervisor = supervisorsWithAssignment.length > 0 ? supervisorsWithAssignment[0] : null;
    const supervisorUserId = firstSupervisor?.user_id || null;

    return res.json({
      project: {
        ...project,
        supervisor_id: supervisorUserId,
      },
      supervisors: supervisorsWithAssignment,
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
    const clientUser = await User.findById(client_user_id)
      .select('_id role name email')
      .lean();

    if (!clientUser || clientUser.role !== 'CLIENT') {
      return res.status(400).json({ message: 'Invalid client. Client not found or is not a valid client user.' });
    }

    // Prepare project data with embedded client info
    const mongoose = require('mongoose');
    const projectData = {
      name: name.trim(),
      location: location?.trim() || null,
      start_date: start_date || null,
      end_date: end_date || null,
      description: description?.trim() || null,
      budget: budget != null ? mongoose.Types.Decimal128.fromString(budget.toString()) : null,
      client: {
        client_id: client_user_id,
        client_name: clientUser.name || null,
        client_email: clientUser.email || null,
      },
      assigned_employees: [],
      assigned_supervisors: [],
    };

    const project = await projectRepository.create(projectData);

    return res.status(201).json({ project, message: 'Project created successfully' });
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
      const mongoose = require('mongoose');
      updateData.budget = budget != null ? mongoose.Types.Decimal128.fromString(budget.toString()) : null;
    }
    if (client_user_id !== undefined) {
      // Update client info if client_user_id is provided
      if (client_user_id) {
        const clientUser = await User.findById(client_user_id)
          .select('_id role name email')
          .lean();
        
        if (!clientUser || clientUser.role !== 'CLIENT') {
          return res.status(400).json({ message: 'Invalid client. Client not found or is not a valid client user.' });
        }
        
        updateData.client = {
          client_id: client_user_id,
          client_name: clientUser.name || null,
          client_email: clientUser.email || null,
        };
      } else {
        updateData.client = null;
      }
    }
    if (req.body.status !== undefined) {
      updateData.status = req.body.status || null;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const project = await projectRepository.update(id, updateData);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    return res.json({ project, message: 'Project updated successfully' });
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

    const deleted = await projectRepository.delete(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Project not found' });
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

    // Verify project exists
    const project = await Project.findById(projectId).lean();
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // If supervisor_id is null or empty, remove supervisor
    if (!supervisor_id) {
      // Remove all supervisor assignments for this project
      await Project.findByIdAndUpdate(
        projectId,
        { $set: { assigned_supervisors: [] } },
        { new: true }
      );

      return res.json({ 
        message: 'Supervisor removed from project successfully' 
      });
    }

    // Verify supervisor exists (check in users table with role='SUPERVISOR')
    const supervisorUser = await User.findById(supervisor_id)
      .select('_id role name email isActive')
      .lean();

    if (!supervisorUser || supervisorUser.role !== 'SUPERVISOR' || !supervisorUser.isActive) {
      return res.status(404).json({ message: 'Supervisor not found or inactive' });
    }

    // Remove existing supervisor assignments for this project (only one supervisor per project)
    // Then add the new supervisor
    const supervisorAssignment = {
      supervisor_id: supervisor_id,
      supervisor_name: supervisorUser.name || null,
      supervisor_email: supervisorUser.email || null,
      assigned_at: new Date(),
      status: 'active',
    };

    await Project.findByIdAndUpdate(
      projectId,
      { 
        $set: { assigned_supervisors: [supervisorAssignment] }
      },
      { new: true }
    );

    return res.json({ 
      relation: {
        supervisor_id: supervisor_id,
        project_id: projectId,
        assigned_at: supervisorAssignment.assigned_at,
      },
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
    const projects = await Project.find().select('_id').lean();

    if (!projects || projects.length === 0) {
      return res.status(400).json({ message: 'No projects found' });
    }

    // Get all supervisors (users with role='SUPERVISOR')
    const supervisors = await User.find({ 
      role: 'SUPERVISOR',
      isActive: true 
    }).select('_id name email').lean();

    if (!supervisors || supervisors.length === 0) {
      return res.status(400).json({ message: 'No supervisors found' });
    }

    // Assign all supervisors to all projects
    let totalRelations = 0;
    for (const project of projects) {
      const supervisorAssignments = supervisors.map(supervisor => ({
        supervisor_id: supervisor._id.toString(),
        supervisor_name: supervisor.name || null,
        supervisor_email: supervisor.email || null,
        assigned_at: new Date(),
        status: 'active',
      }));

      await Project.findByIdAndUpdate(
        project._id,
        { $set: { assigned_supervisors: supervisorAssignments } }
      );
      totalRelations += supervisorAssignments.length;
    }

    return res.json({ 
      message: `Successfully assigned ${supervisors.length} supervisor(s) to ${projects.length} project(s)`,
      total_relations: totalRelations,
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
    const project = await Project.findById(projectId).lean();
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Get employee details for the staff_ids
    const EmployeeMerged = require('../models/EmployeeMerged');
    const employees = await EmployeeMerged.find({ 
      _id: { $in: staff_ids } 
    }).select('_id name email').lean();

    if (employees.length !== staff_ids.length) {
      return res.status(400).json({ message: 'One or more staff IDs not found' });
    }

    // Get existing assignments
    const existingAssignments = project.assigned_employees || [];
    const existingEmployeeIds = new Set(existingAssignments.map(a => a.employee_id?.toString()));

    // Create new assignments for employees not already assigned
    const newAssignments = employees
      .filter(emp => !existingEmployeeIds.has(emp._id.toString()))
      .map(emp => ({
        employee_id: emp._id.toString(),
        employee_name: emp.name || null,
        employee_email: emp.email || null,
        assigned_at: new Date(),
        status: 'active',
      }));

    // Combine existing and new assignments
    const allAssignments = [...existingAssignments, ...newAssignments];

    // Update project with all assignments
    await Project.findByIdAndUpdate(
      projectId,
      { $set: { assigned_employees: allAssignments } },
      { new: true }
    );

    const staffCount = allAssignments.filter(a => a.status === 'active').length;

    return res.json({ 
      message: `Successfully assigned ${newAssignments.length} staff(s) to project`,
      staff_count: staffCount
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

    // Get project
    const project = await Project.findById(projectId).lean();
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Find and remove the staff assignment
    const assignments = project.assigned_employees || [];
    const updatedAssignments = assignments.filter(
      assignment => assignment.employee_id?.toString() !== staffId
    );

    if (assignments.length === updatedAssignments.length) {
      return res.status(404).json({ message: 'Staff not found or not assigned to this project' });
    }

    // Update project with removed assignment
    await Project.findByIdAndUpdate(
      projectId,
      { $set: { assigned_employees: updatedAssignments } },
      { new: true }
    );

    const staffCount = updatedAssignments.filter(a => a.status === 'active').length;

    return res.json({ 
      message: 'Staff removed from project successfully',
      staff_count: staffCount
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

    // Get project with assigned employees
    const project = await Project.findById(projectId).lean();
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Get active assigned employees from embedded array
    const activeAssignments = (project.assigned_employees || []).filter(
      emp => emp.status === 'active'
    );

    // Fetch employee details
    const EmployeeMerged = require('../models/EmployeeMerged');
    const employeeIds = activeAssignments.map(a => a.employee_id);
    const employees = await EmployeeMerged.find({ 
      _id: { $in: employeeIds } 
    })
      .select('_id name email phone role')
      .sort({ name: 1 })
      .lean();

    // Format response
    const staffs = employees.map(emp => ({
      id: emp._id.toString(),
      name: emp.name,
      email: emp.email,
      phone: emp.phone || null,
      role: emp.role || null,
    }));

    return res.json({ staffs });
  } catch (err) {
    console.error('Get project staffs error', err);
    return res.status(500).json({ message: 'Error fetching project staffs' });
  }
});

// GET /admin/projects/supervisors/list - Get all supervisors (users with role='SUPERVISOR')
router.get('/supervisors/list', async (req, res) => {
  try {
    const supervisors = await User.find({ 
      role: 'SUPERVISOR',
      isActive: true 
    })
      .select('_id name email phone')
      .sort({ name: 1 })
      .lean();

    const formattedSupervisors = supervisors.map(sup => ({
      id: sup._id.toString(),
      name: sup.name,
      email: sup.email,
      phone: sup.phone || null,
    }));

    return res.json({ supervisors: formattedSupervisors });
  } catch (err) {
    console.error('Get supervisors error', err);
    return res.status(500).json({ message: 'Error fetching supervisors' });
  }
});

module.exports = router;

