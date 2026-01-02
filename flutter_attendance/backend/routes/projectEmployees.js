const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/authorizeRoles');
const ProjectMerged = require('../models/ProjectMerged');
const EmployeeMerged = require('../models/EmployeeMerged');
const User = require('../models/User');

const router = express.Router();

// All routes require authentication and ADMIN role
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN'));

// GET /api/admin/projects/:projectId/employees - Get assigned employees for a project
router.get('/:projectId/employees', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Get project with assigned employees
    const project = await ProjectMerged.findById(projectId).lean();

      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Get active assigned employees from embedded array
      const activeAssignments = (project.assigned_employees || []).filter(
        emp => emp.status === 'active'
      );

      // Fetch employee details for each assignment
      const employeeIds = activeAssignments.map(a => a.employee_id);
      const employees = await EmployeeMerged.find({ _id: { $in: employeeIds } })
        .select('_id name email phone role created_at')
        .lean();

      // Create a map for quick lookup
      const employeeMap = new Map();
      employees.forEach(emp => {
        employeeMap.set(emp._id.toString(), emp);
      });

      // Combine assignment data with employee details
      const assignedEmployees = activeAssignments.map(assignment => {
        const employee = employeeMap.get(assignment.employee_id);
        return {
          id: `${projectId}_${assignment.employee_id}`, // Generate unique ID
          employee_id: assignment.employee_id,
          assigned_at: assignment.assigned_at,
          revoked_at: assignment.revoked_at || null,
          assignment_start_date: assignment.assignment_start_date || null,
          assignment_end_date: assignment.assignment_end_date || null,
          status: assignment.status,
          assigned_by: assignment.assigned_by || null,
          revoked_by: assignment.revoked_by || null,
          notes: assignment.notes || null,
          employee_name: employee?.name || assignment.employee_name || null,
          employee_email: employee?.email || assignment.employee_email || null,
          employee_phone: employee?.phone || null,
          employee_role: employee?.role || null,
          employee_created_at: employee?.created_at || employee?.createdAt || null,
        };
      });

      // Sort by assigned_at descending
      assignedEmployees.sort((a, b) => {
        const dateA = a.assigned_at ? new Date(a.assigned_at) : new Date(0);
        const dateB = b.assigned_at ? new Date(b.assigned_at) : new Date(0);
        return dateB - dateA;
      });

      return res.json({ 
        employees: assignedEmployees,
        total: assignedEmployees.length 
      });
  } catch (err) {
    console.error('Get project employees error:', err);
    return res.status(500).json({ message: 'Error fetching assigned employees' });
  }
});

// GET /api/admin/projects/:projectId/available-employees - Get available employees with assignment status
router.get('/:projectId/available-employees', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { search = '', page = 1, limit = 20 } = req.query;

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build search query
    let query = EmployeeMerged.find().select('_id name email phone role created_at');

      // Add search filter if provided
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        query = query.or([
          { name: searchRegex },
          { email: searchRegex },
          { role: searchRegex }
        ]);
      }

      // Get total count
      const total = await EmployeeMerged.countDocuments(
        search ? {
          $or: [
            { name: new RegExp(search, 'i') },
            { email: new RegExp(search, 'i') },
            { role: new RegExp(search, 'i') }
          ]
        } : {}
      );

      // Fetch ALL employees (without pagination) to properly sort by assignment status
      // We'll apply pagination after sorting
      const allEmployees = await query
        .sort({ name: 1 })
        .lean();

      // Get all active project assignments for ALL employees
      const allEmployeeIds = allEmployees.map(emp => emp._id.toString());
      const activeProjects = await ProjectMerged.find({
        'assigned_employees.employee_id': { $in: allEmployeeIds },
        'assigned_employees.status': 'active'
      })
        .select('_id name assigned_employees')
        .lean();

      // Create a map of employee_id -> project assignment
      const assignmentMap = new Map();
      activeProjects.forEach(project => {
        project.assigned_employees.forEach(assignment => {
          if (assignment.status === 'active' && allEmployeeIds.includes(assignment.employee_id)) {
            assignmentMap.set(assignment.employee_id, {
              project_id: project._id.toString(),
              project_name: project.name
            });
          }
        });
      });

      // Enrich employees with assignment status
      const employeesWithStatus = allEmployees.map(employee => {
        const assignment = assignmentMap.get(employee._id.toString());
        const isAssignedToCurrentProject = assignment?.project_id === projectId;

        return {
          id: employee._id,
          name: employee.name,
          email: employee.email,
          phone: employee.phone || null,
          role: employee.role || null,
          created_at: employee.created_at || employee.createdAt,
          is_assigned: !!assignment,
          assigned_project_id: assignment?.project_id || null,
          assigned_project_name: assignment?.project_name || null,
          is_assigned_to_current_project: isAssignedToCurrentProject,
        };
      });

      // Sort: Available employees first (is_assigned: false), then assigned employees (is_assigned: true)
      // Within each group, sort by name alphabetically
      employeesWithStatus.sort((a, b) => {
        // First, sort by assignment status (available first)
        if (a.is_assigned !== b.is_assigned) {
          return a.is_assigned ? 1 : -1; // false (available) comes before true (assigned)
        }
        // Then sort by name alphabetically
        return (a.name || '').localeCompare(b.name || '');
      });

      // Apply pagination AFTER sorting
      const paginatedEmployees = employeesWithStatus.slice(offset, offset + parseInt(limit));

      return res.json({
        employees: paginatedEmployees,
        total: total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      });
  } catch (err) {
    console.error('Get available employees error:', err);
    return res.status(500).json({ message: 'Error fetching available employees' });
  }
});

// POST /api/admin/projects/:projectId/employees - Assign employees to a project
router.post('/:projectId/employees', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { employee_ids, notes, start_date, end_date } = req.body;
    const mongoose = require('mongoose');

    if (!employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0) {
      return res.status(400).json({ message: 'employee_ids array is required' });
    }

    // Verify project exists - handle both UUID strings and MongoDB ObjectIds
    let project = await ProjectMerged.findById(projectId).lean();
    if (!project && mongoose.Types.ObjectId.isValid(projectId) && projectId.length === 24) {
      try {
        const objectId = new mongoose.Types.ObjectId(projectId);
        const ProjectCollection = ProjectMerged.collection;
        const doc = await ProjectCollection.findOne({ _id: objectId });
        if (doc) project = ProjectMerged.hydrate(doc).toObject();
      } catch (err) {
        console.error('Error finding project by ObjectId:', err);
      }
    }
    // Also try finding by _id as string (for UUIDs)
    if (!project) {
      project = await ProjectMerged.findOne({ _id: projectId }).lean();
    }
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

      // Check each employee's current assignment status
      const employeeChecks = await Promise.all(
        employee_ids.map(async (employeeId) => {
          // Normalize employeeId to string
          const employeeIdStr = String(employeeId);
          
          // Check if employee exists - handle both UUID strings and MongoDB ObjectIds
          let employee = await EmployeeMerged.findById(employeeIdStr)
            .select('_id name')
            .lean();

          if (!employee && mongoose.Types.ObjectId.isValid(employeeIdStr) && employeeIdStr.length === 24) {
            try {
              const objectId = new mongoose.Types.ObjectId(employeeIdStr);
              const EmployeeCollection = EmployeeMerged.collection;
              const doc = await EmployeeCollection.findOne({ _id: objectId });
              if (doc) employee = EmployeeMerged.hydrate(doc).toObject();
            } catch (err) {
              console.error('Error finding employee by ObjectId:', err);
            }
          }
          // Also try finding by _id as string (for UUIDs)
          if (!employee) {
            employee = await EmployeeMerged.findOne({ _id: employeeIdStr })
              .select('_id name')
              .lean();
          }

          if (!employee) {
            return { employeeId: employeeIdStr, error: 'Employee not found', employee: null };
          }

          const employeeIdForQuery = employee._id.toString();

          // Check if employee is already assigned to an active project
          // Try both string and ObjectId comparison for employee_id
          const activeProject = await ProjectMerged.findOne({
            $and: [
              { 'assigned_employees.status': 'active' },
              {
                $or: [
                  { 'assigned_employees.employee_id': employeeIdForQuery },
                  { 'assigned_employees.employee_id': employee._id }
                ]
              }
            ]
          }).select('_id name').lean();

          if (activeProject) {
            // If assigned to the current project, skip
            const currentProjectId = project._id.toString();
            if (activeProject._id.toString() === currentProjectId) {
              return { 
                employeeId: employeeIdForQuery, 
                error: 'Already assigned to this project', 
                employee,
                skip: true 
              };
            }
            
            return { 
              employeeId: employeeIdForQuery, 
              error: `Already assigned to project: ${activeProject.name}`, 
              employee 
            };
          }

          return { employeeId: employeeIdForQuery, error: null, employee };
        })
      );

      // Filter out errors and skips
      const validEmployees = employeeChecks.filter(check => !check.error);
      const errors = employeeChecks.filter(check => check.error && !check.skip);
      const skipped = employeeChecks.filter(check => check.skip);

      if (validEmployees.length === 0) {
        return res.status(400).json({ 
          message: 'No employees could be assigned',
          errors: errors.map(e => ({ employee_id: e.employeeId, error: e.error })),
          skipped: skipped.map(e => ({ employee_id: e.employeeId, name: e.employee?.name })),
        });
      }

      // Get employee details for assignment
      const employeeIds = validEmployees.map(e => e.employeeId);
      // Convert employeeIds to ObjectIds if needed
      const employeeObjectIds = employeeIds.map(id => {
        if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
          return new mongoose.Types.ObjectId(id);
        }
        return id;
      });
      
      const employees = await EmployeeMerged.find({ _id: { $in: employeeObjectIds } })
        .select('_id name email')
        .lean();

      const employeeMap = new Map();
      employees.forEach(emp => {
        employeeMap.set(emp._id.toString(), emp);
      });

      // Prepare new assignments
      const newAssignments = validEmployees.map(check => {
        const employee = employeeMap.get(check.employeeId);
        return {
          employee_id: check.employeeId,
          employee_name: employee?.name || null,
          employee_email: employee?.email || null,
          assigned_at: new Date(),
          assignment_start_date: start_date ? new Date(start_date) : null,
          assignment_end_date: end_date ? new Date(end_date) : null,
          status: 'active',
          assigned_by: req.user.userId || req.user.id || null,
          notes: notes || null,
        };
      });

      // Add assignments to project's assigned_employees array
      // Use the actual project _id from the found document
      const projectObjectId = project._id;
      const updatedProject = await ProjectMerged.findByIdAndUpdate(
        projectObjectId,
        {
          $push: {
            assigned_employees: { $each: newAssignments }
          },
          $set: { updated_at: new Date() }
        },
        { new: true }
      ).lean();

      if (!updatedProject) {
        return res.status(500).json({ message: 'Failed to assign employees' });
      }

      return res.json({ 
        message: `Successfully assigned ${validEmployees.length} employee(s)`,
        assigned: validEmployees.length,
        errors: errors.length > 0 ? errors.map(e => ({ 
          employee_id: e.employeeId, 
          name: e.employee?.name,
          error: e.error 
        })) : undefined,
        skipped: skipped.length > 0 ? skipped.map(e => ({ 
          employee_id: e.employeeId, 
          name: e.employee?.name 
        })) : undefined,
        assignments: newAssignments,
      });
  } catch (err) {
    console.error('Assign employees error:', err);
    console.error('Error details:', {
      projectId: req.params.projectId,
      employee_ids: req.body.employee_ids,
      error: err.message,
      stack: err.stack
    });
    return res.status(500).json({ 
      message: 'Error assigning employees',
      error: err.message 
    });
  }
});

// POST /api/admin/projects/:projectId/employees/:employeeId/revoke - Revoke employee from project
router.post('/:projectId/employees/:employeeId/revoke', async (req, res) => {
  try {
    const { projectId, employeeId } = req.params;
    const { notes } = req.body;

    // Find project with active assignment
    const project = await ProjectMerged.findById(projectId).lean();
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Find active assignment in assigned_employees array
      const assignment = (project.assigned_employees || []).find(
        emp => emp.employee_id === employeeId && emp.status === 'active'
      );

      if (!assignment) {
        return res.status(404).json({ message: 'Employee is not assigned to this project' });
      }

      // Update assignment to revoked status
      const updatedProject = await ProjectMerged.findOneAndUpdate(
        {
          _id: projectId,
          'assigned_employees.employee_id': employeeId,
          'assigned_employees.status': 'active'
        },
        {
          $set: {
            'assigned_employees.$.status': 'revoked',
            'assigned_employees.$.revoked_at': new Date(),
            'assigned_employees.$.revoked_by': req.user.userId || null,
            'assigned_employees.$.notes': notes || assignment.notes || null,
            updated_at: new Date()
          }
        },
        { new: true }
      ).lean();

      if (!updatedProject) {
        return res.status(500).json({ message: 'Failed to revoke employee' });
      }

      // Find the updated assignment
      const updatedAssignment = updatedProject.assigned_employees.find(
        emp => emp.employee_id === employeeId
      );

      return res.json({ 
        message: 'Employee revoked successfully',
        assignment: updatedAssignment,
      });
  } catch (err) {
    console.error('Revoke employee error:', err);
    return res.status(500).json({ message: 'Error revoking employee' });
  }
});

// POST /api/admin/projects/:projectId/employees/:employeeId/reassign - Reassign employee to another project
router.post('/:projectId/employees/:employeeId/reassign', async (req, res) => {
  try {
    const { projectId, employeeId } = req.params;
    const { new_project_id, new_start_date } = req.body;

    if (!new_project_id || !new_start_date) {
      return res.status(400).json({ message: 'new_project_id and new_start_date are required' });
    }

    // Prevent reassignment to same project
    if (new_project_id === projectId) {
      return res.status(400).json({ message: 'Cannot reassign to the same project' });
    }

    // Verify new project exists
    const newProject = await ProjectMerged.findById(new_project_id)
      .select('_id name')
      .lean();

    if (!newProject) {
      return res.status(404).json({ message: 'New project not found' });
    }

    // Verify employee exists
    const employee = await EmployeeMerged.findById(employeeId)
      .select('_id name')
      .lean();

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Find current project with active assignment
    const currentProject = await ProjectMerged.findById(projectId).lean();
    
    if (!currentProject) {
      return res.status(404).json({ message: 'Current project not found' });
    }

    // Find current active assignment
    const currentAssignment = (currentProject.assigned_employees || []).find(
      emp => emp.employee_id === employeeId && emp.status === 'active'
    );

    if (!currentAssignment) {
      return res.status(404).json({ message: 'Employee is not currently assigned to this project' });
    }

    // Check if employee is already assigned to the new project
    const newProjectCheck = await ProjectMerged.findById(new_project_id).lean();
    const existingAssignment = (newProjectCheck?.assigned_employees || []).find(
      emp => emp.employee_id === employeeId && emp.status === 'active'
    );

    if (existingAssignment) {
      return res.status(400).json({ 
        message: `Employee is already assigned to project: ${newProject.name}` 
      });
    }

    // Calculate end date for current assignment (one day before new start date)
    const newStartDate = new Date(new_start_date);
    const currentEndDate = new Date(newStartDate);
    currentEndDate.setDate(currentEndDate.getDate() - 1);

    // Validate dates
    if (newStartDate < new Date()) {
      return res.status(400).json({ message: 'New start date cannot be in the past' });
    }

    // Update current assignment to revoked status
    const updatedCurrentProject = await ProjectMerged.findOneAndUpdate(
      {
        _id: projectId,
        'assigned_employees.employee_id': employeeId,
        'assigned_employees.status': 'active'
      },
      {
        $set: {
          'assigned_employees.$.status': 'revoked',
          'assigned_employees.$.revoked_at': currentEndDate,
          'assigned_employees.$.revoked_by': req.user.userId || null,
          'assigned_employees.$.assignment_end_date': currentEndDate,
          'assigned_employees.$.notes': `Reassigned to project: ${newProject.name}`,
          updated_at: new Date()
        }
      },
      { new: true }
    ).lean();

    if (!updatedCurrentProject) {
      return res.status(500).json({ message: 'Failed to end current assignment' });
    }

    // Find the updated assignment
    const updatedAssignment = updatedCurrentProject.assigned_employees.find(
      emp => emp.employee_id === employeeId
    );

    // Create new assignment in the new project
    const newAssignmentData = {
      employee_id: employeeId,
      assignment_date: newStartDate,
      assignment_start_date: newStartDate,
      assignment_end_date: null,
      status: 'active',
      assigned_by: req.user.userId || null,
      notes: `Reassigned from project: ${projectId}`,
    };

    const updatedNewProject = await ProjectMerged.findByIdAndUpdate(
      new_project_id,
      {
        $push: {
          assigned_employees: newAssignmentData
        },
        $set: {
          updated_at: new Date()
        }
      },
      { new: true }
    ).lean();

    if (!updatedNewProject) {
      // Try to restore current assignment
      await ProjectMerged.findOneAndUpdate(
        {
          _id: projectId,
          'assigned_employees.employee_id': employeeId
        },
        {
          $set: {
            'assigned_employees.$.status': 'active',
            'assigned_employees.$.revoked_at': null,
            'assigned_employees.$.revoked_by': null,
            'assigned_employees.$.assignment_end_date': currentAssignment.assignment_end_date || null,
            updated_at: new Date()
          }
        }
      );
      
      return res.status(500).json({ message: 'Failed to create new assignment' });
    }

    // Find the new assignment
    const newAssignment = updatedNewProject.assigned_employees.find(
      emp => emp.employee_id === employeeId && emp.status === 'active'
    );

    return res.json({ 
      message: `Employee successfully reassigned to ${newProject.name}`,
      previous_assignment: {
        ...updatedAssignment,
        assignment_end_date: currentEndDate.toISOString().split('T')[0],
        status: 'revoked',
      },
      new_assignment: {
        ...newAssignment,
        assignment_start_date: newAssignment.assignment_start_date ? new Date(newAssignment.assignment_start_date).toISOString().split('T')[0] : null,
      },
    });
  } catch (err) {
    console.error('Reassign employee error:', err);
    return res.status(500).json({ message: 'Error reassigning employee' });
  }
});

// GET /api/admin/projects/:projectId/employees/history - Get assignment history for a project
router.get('/:projectId/employees/history', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Get project with all assignments (active and revoked)
    const project = await ProjectMerged.findById(projectId)
      .select('_id assigned_employees')
      .lean();

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const assignments = project.assigned_employees || [];

    // Get unique employee IDs and admin IDs
    const employeeIds = [...new Set(assignments.map(a => a.employee_id).filter(Boolean))];
    const adminIds = [
      ...new Set([
        ...assignments.map(a => a.assigned_by).filter(Boolean),
        ...assignments.map(a => a.revoked_by).filter(Boolean),
      ])
    ];

    // Fetch employee and admin details
    const [employees, admins] = await Promise.all([
      EmployeeMerged.find({ _id: { $in: employeeIds } })
        .select('_id name email role')
        .lean(),
      adminIds.length > 0 ? User.find({ _id: { $in: adminIds } })
        .select('_id name email')
        .lean() : []
    ]);

    // Create maps for quick lookup
    const employeeMap = new Map(employees.map(e => [e._id.toString(), e]));
    const adminMap = new Map(admins.map(a => [a._id.toString(), a]));

    // Enrich assignments with employee and admin details
    const history = assignments.map(assignment => {
      const employee = employeeMap.get(assignment.employee_id?.toString());
      const assignedByUser = assignment.assigned_by ? adminMap.get(assignment.assigned_by.toString()) : null;
      const revokedByUser = assignment.revoked_by ? adminMap.get(assignment.revoked_by.toString()) : null;

      return {
        id: `${projectId}_${assignment.employee_id}_${assignment.assignment_date || assignment.assigned_at}`,
        employee_id: assignment.employee_id?.toString() || null,
        assigned_at: assignment.assignment_date || assignment.assigned_at ? new Date(assignment.assignment_date || assignment.assigned_at).toISOString() : null,
        revoked_at: assignment.revoked_at ? new Date(assignment.revoked_at).toISOString() : null,
        status: assignment.status || 'active',
        assigned_by: assignment.assigned_by?.toString() || null,
        revoked_by: assignment.revoked_by?.toString() || null,
        notes: assignment.notes || null,
        employees: employee ? {
          id: employee._id.toString(),
          name: employee.name,
          email: employee.email,
          role: employee.role
        } : null,
        assigned_by_user: assignedByUser ? {
          name: assignedByUser.name,
          email: assignedByUser.email
        } : null,
        revoked_by_user: revokedByUser ? {
          name: revokedByUser.name,
          email: revokedByUser.email
        } : null,
      };
    }).sort((a, b) => {
      // Sort by assigned_at descending
      const dateA = a.assigned_at ? new Date(a.assigned_at).getTime() : 0;
      const dateB = b.assigned_at ? new Date(b.assigned_at).getTime() : 0;
      return dateB - dateA;
    });

    return res.json({ 
      history: history,
      total: history.length 
    });
  } catch (err) {
    console.error('Get assignment history error:', err);
    return res.status(500).json({ message: 'Error fetching assignment history' });
  }
});

// GET /api/admin/projects/assignments/all - Get all active project assignments
router.get('/assignments/all', async (req, res) => {
  try {
    // MongoDB implementation
    const projects = await ProjectMerged.find({})
      .select('_id assigned_employees')
      .lean();

      const assignmentsMap = [];
      const employeeIds = new Set();

      projects.forEach(project => {
        if (project.assigned_employees && Array.isArray(project.assigned_employees)) {
          project.assigned_employees.forEach(assignment => {
            if (assignment.status === 'active' && !assignment.revoked_at) {
              employeeIds.add(assignment.employee_id.toString());
              assignmentsMap.push({
                project_id: project._id.toString(),
                employee_id: assignment.employee_id.toString(),
                employee_email: assignment.employee_email || null,
                assignment_start_date: assignment.assignment_start_date ? new Date(assignment.assignment_start_date).toISOString() : null,
                assignment_end_date: assignment.assignment_end_date ? new Date(assignment.assignment_end_date).toISOString() : null,
              });
            }
          });
        }
      });

      // Fetch employee emails if not already in assignment
      if (employeeIds.size > 0) {
        const employees = await EmployeeMerged.find({
          _id: { $in: Array.from(employeeIds) },
        })
          .select('_id email')
          .lean();

        const employeeEmailMap = new Map();
        employees.forEach(emp => {
          employeeEmailMap.set(emp._id.toString(), emp.email);
        });

        assignmentsMap.forEach(assignment => {
          if (!assignment.employee_email) {
            assignment.employee_email = employeeEmailMap.get(assignment.employee_id) || null;
          }
        });
      }

      return res.json({ assignments: assignmentsMap });
  } catch (err) {
    console.error('Get all assignments error:', err);
    return res.status(500).json({ message: 'Error fetching project assignments' });
  }
});

module.exports = router;

