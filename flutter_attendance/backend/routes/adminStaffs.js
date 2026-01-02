const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/authorizeRoles');

// All routes require authentication and ADMIN role
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN'));

// GET /admin/staffs - Fetch all staffs (with project and client info if available)
router.get('/', async (req, res) => {
  try {
    const { search, projectId, clientId, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
    
    const EmployeeMerged = require('../models/EmployeeMerged');
    const ProjectMerged = require('../models/ProjectMerged');
    const User = require('../models/User');
    
    // Build query
    const query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { role: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Project filter
    if (projectId) {
      query['project_assignments.project_id'] = projectId;
      query['project_assignments.status'] = 'active';
    }
    
    // Client filter - get employees assigned to projects belonging to this client
    if (clientId) {
      const clientProjects = await ProjectMerged.find({
        'client.client_id': clientId
      }).select('_id').lean();
      
      if (clientProjects.length > 0) {
        const projectIds = clientProjects.map(p => p._id.toString());
        query['project_assignments.project_id'] = { $in: projectIds };
        query['project_assignments.status'] = 'active';
      } else {
        // No projects for this client, return empty
        return res.json({
          success: true,
          data: [],
          count: 0
        });
      }
    }
    
    // Build sort
    const allowedSortColumns = ['name', 'email', 'created_at', 'updated_at'];
    const safeSort = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 1 : -1;
    
    const employees = await EmployeeMerged.find(query)
      .sort({ [safeSort]: sortDirection })
      .lean();
    
    // Enrich with project and client information
    const projectIds = [...new Set(
      employees.flatMap(e => 
        (e.project_assignments || [])
          .filter(pa => pa.status === 'active')
          .map(pa => pa.project_id)
      ).filter(Boolean)
    )];
    
    const [projects, clients] = await Promise.all([
      ProjectMerged.find({ _id: { $in: projectIds } })
        .select('_id name location client')
        .lean(),
      clientId ? User.findById(clientId).select('_id name').lean() : null
    ]);
    
    const projectMap = new Map(projects.map(p => [p._id.toString(), p]));
    
    const enrichedStaffs = employees.map(employee => {
      const activeAssignments = (employee.project_assignments || [])
        .filter(pa => pa.status === 'active');
      
      // Get first active project assignment
      const primaryProject = activeAssignments.length > 0
        ? projectMap.get(activeAssignments[0].project_id)
        : null;
      
      return {
        id: employee._id.toString(),
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        role: employee.role,
        project_id: primaryProject?._id?.toString() || null,
        project_name: primaryProject?.name || null,
        project_location: primaryProject?.location || null,
        client_user_id: primaryProject?.client?.client_id || null,
        client_name: primaryProject?.client?.client_name || (clientId && clients ? clients.name : null),
        created_at: employee.created_at,
        updated_at: employee.updated_at
      };
    });
    
    res.json({
      success: true,
      data: enrichedStaffs,
      count: enrichedStaffs.length
    });
  } catch (error) {
    console.error('Error fetching staffs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staffs',
      message: error.message
    });
  }
});

// GET /admin/staffs/:id - Get staff by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const EmployeeMerged = require('../models/EmployeeMerged');
    const ProjectMerged = require('../models/ProjectMerged');
    const User = require('../models/User');
    
    // Convert ID to ObjectId if valid
    let objectId;
    if (mongoose.Types.ObjectId.isValid(id)) {
      objectId = new mongoose.Types.ObjectId(id);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid staff ID format'
      });
    }
    
    const employee = await EmployeeMerged.findById(objectId).lean();
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Staff not found'
      });
    }
    
    // Get project and client info
    const activeAssignments = (employee.project_assignments || [])
      .filter(pa => pa.status === 'active');
    
    let project = null;
    let client = null;
    
    if (activeAssignments.length > 0) {
      const projectId = activeAssignments[0].project_id;
      project = await ProjectMerged.findById(projectId)
        .select('_id name location client')
        .lean();
      
      if (project?.client?.client_id) {
        client = await User.findById(project.client.client_id)
          .select('_id name')
          .lean();
      }
    }
    
    res.json({
      success: true,
      data: {
        id: employee._id.toString(),
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        role: employee.role,
        project_id: project?._id?.toString() || null,
        project_name: project?.name || null,
        project_location: project?.location || null,
        client_user_id: project?.client?.client_id || null,
        client_name: project?.client?.client_name || client?.name || null,
        created_at: employee.created_at,
        updated_at: employee.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staff',
      message: error.message
    });
  }
});

// POST /admin/staffs - Create new staff
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, role, project_id, client_user_id } = req.body;
    
    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Staff name is required'
      });
    }
    
    // Validate email format if provided
    if (email && (!email.includes('@') || email.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }
    
    const EmployeeMerged = require('../models/EmployeeMerged');
    const ProjectMerged = require('../models/ProjectMerged');
    const User = require('../models/User');
    
    // If project_id is provided, verify it exists
    if (project_id) {
      const project = await ProjectMerged.findById(project_id).lean();
      if (!project) {
        return res.status(400).json({
          success: false,
          error: 'Invalid project ID'
        });
      }
    }
    
    // If client_user_id is provided, verify it exists and is a client
    if (client_user_id) {
      const client = await User.findOne({
        _id: client_user_id,
        role: { $in: ['CLIENT', 'client'] }
      }).lean();
      
      if (!client) {
        return res.status(400).json({
          success: false,
          error: 'Invalid client ID'
        });
      }
    }
    
    // Check if email already exists
    if (email) {
      const existing = await EmployeeMerged.findOne({ email: email.toLowerCase() }).lean();
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Staff with this email already exists'
        });
      }
    }
    
    // Create new employee
    const newEmployee = new EmployeeMerged({
      _id: new mongoose.Types.ObjectId(),
      name: name.trim(),
      email: email?.trim().toLowerCase() || null,
      phone: phone?.trim() || null,
      role: role?.trim() || null,
      client_user_id: client_user_id || null,
      project_assignments: project_id ? [{
        project_id: project_id,
        assignment_date: new Date(),
        status: 'active'
      }] : [],
      created_at: new Date(),
      updated_at: new Date()
    });
    
    await newEmployee.save();
    
    // Enrich with project and client info
    let project = null;
    let client = null;
    
    if (project_id) {
      project = await ProjectMerged.findById(project_id)
        .select('_id name location client')
        .lean();
      
      if (project?.client?.client_id) {
        client = await User.findById(project.client.client_id)
          .select('_id name')
          .lean();
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Staff created successfully',
      data: {
        id: newEmployee._id.toString(),
        name: newEmployee.name,
        email: newEmployee.email,
        phone: newEmployee.phone,
        role: newEmployee.role,
        project_id: project?._id?.toString() || null,
        project_name: project?.name || null,
        project_location: project?.location || null,
        client_user_id: project?.client?.client_id || client_user_id || null,
        client_name: project?.client?.client_name || client?.name || null,
        created_at: newEmployee.created_at,
        updated_at: newEmployee.updated_at
      }
    });
  } catch (error) {
    console.error('Error creating staff:', error);
    if (error.code === 11000) { // MongoDB duplicate key error
      return res.status(409).json({
        success: false,
        error: 'Staff with this email already exists'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create staff',
      message: error.message
    });
  }
});

// PUT /admin/staffs/:id - Update staff by ID
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, project_id, client_user_id } = req.body;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Staff ID is required'
      });
    }
    
    const EmployeeMerged = require('../models/EmployeeMerged');
    const ProjectMerged = require('../models/ProjectMerged');
    const User = require('../models/User');
    
    // Convert ID to ObjectId if valid
    let objectId;
    if (mongoose.Types.ObjectId.isValid(id)) {
      objectId = new mongoose.Types.ObjectId(id);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid staff ID format'
      });
    }
    
    // Check if staff exists
    const existingStaff = await EmployeeMerged.findById(objectId).lean();
    
    if (!existingStaff) {
      return res.status(404).json({
        success: false,
        error: 'Staff not found'
      });
    }
    
    const updateData = {};
    
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Staff name must be a non-empty string'
        });
      }
      updateData.name = name.trim();
    }
    
    if (email !== undefined) {
      if (email && (!email.includes('@') || email.trim().length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }
      
      // Check if email is already taken by another employee
      if (email) {
        const emailLower = email.trim().toLowerCase();
        const existing = await EmployeeMerged.findOne({
          email: emailLower,
          _id: { $ne: objectId }
        }).lean();
        
        if (existing) {
          return res.status(409).json({
            success: false,
            error: 'Staff with this email already exists'
          });
        }
        updateData.email = emailLower;
      } else {
        updateData.email = null;
      }
    }
    
    if (phone !== undefined) {
      updateData.phone = phone?.trim() || null;
    }
    
    if (role !== undefined) {
      updateData.role = role?.trim() || null;
    }
    
    if (project_id !== undefined) {
      if (project_id) {
        const project = await ProjectMerged.findById(project_id).lean();
        if (!project) {
          return res.status(400).json({
            success: false,
            error: 'Invalid project ID'
          });
        }
        
        // Update project assignments
        const existingAssignments = existingStaff.project_assignments || [];
        const hasActiveAssignment = existingAssignments.some(
          pa => pa.project_id === project_id && pa.status === 'active'
        );
        
        if (!hasActiveAssignment) {
          // Add new project assignment
          updateData.$push = {
            project_assignments: {
              project_id: project_id,
              assignment_date: new Date(),
              status: 'active'
            }
          };
        }
      }
    }
    
    if (client_user_id !== undefined) {
      if (client_user_id) {
        const client = await User.findOne({
          _id: client_user_id,
          role: { $in: ['CLIENT', 'client'] }
        }).lean();
        
        if (!client) {
          return res.status(400).json({
            success: false,
            error: 'Invalid client ID'
          });
        }
      }
      updateData.client_user_id = client_user_id || null;
    }
    
    if (Object.keys(updateData).length === 0 && !updateData.$push) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    updateData.updated_at = new Date();
    
    // Build update operation
    const updateOp = { $set: updateData };
    if (updateData.$push) {
      updateOp.$push = updateData.$push;
      delete updateData.$push;
    }
    
    const updated = await EmployeeMerged.findByIdAndUpdate(
      objectId,
      updateOp,
      { new: true }
    ).lean();
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Staff not found'
      });
    }
    
    // Enrich with project and client info
    const activeAssignments = (updated.project_assignments || [])
      .filter(pa => pa.status === 'active');
    
    let project = null;
    let client = null;
    
    if (activeAssignments.length > 0) {
      const projectId = activeAssignments[0].project_id;
      project = await ProjectMerged.findById(projectId)
        .select('_id name location client')
        .lean();
      
      if (project?.client?.client_id) {
        client = await User.findById(project.client.client_id)
          .select('_id name')
          .lean();
      }
    }
    
    res.json({
      success: true,
      message: 'Staff updated successfully',
      data: {
        id: updated._id.toString(),
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        role: updated.role,
        project_id: project?._id?.toString() || null,
        project_name: project?.name || null,
        project_location: project?.location || null,
        client_user_id: project?.client?.client_id || updated.client_user_id || null,
        client_name: project?.client?.client_name || client?.name || null,
        created_at: updated.created_at,
        updated_at: updated.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating staff:', error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Staff with this email already exists'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update staff',
      message: error.message
    });
  }
});

// DELETE /admin/staffs/:id - Delete staff by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Staff ID is required'
      });
    }
    
    const EmployeeMerged = require('../models/EmployeeMerged');
    
    // Convert ID to ObjectId if valid
    let objectId;
    if (mongoose.Types.ObjectId.isValid(id)) {
      objectId = new mongoose.Types.ObjectId(id);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid staff ID format'
      });
    }
    
    const result = await EmployeeMerged.findByIdAndDelete(objectId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Staff not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Staff deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete staff',
      message: error.message
    });
  }
});

module.exports = router;
