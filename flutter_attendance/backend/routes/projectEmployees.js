const express = require('express');
const { supabase } = require('../config/supabaseClient');
const { verifyToken } = require('../utils/jwt');

const router = express.Router();

// Middleware to verify admin authentication
const adminAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (!token || scheme !== 'Bearer') {
    return res.status(401).json({ message: 'Authorization header missing or malformed' });
  }

  try {
    const decoded = verifyToken(token);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin privileges required' });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    return next();
  } catch (error) {
    return res.status(401).json({ 
      message: error.name === 'TokenExpiredError' 
        ? 'Token expired. Please log in again.' 
        : 'Invalid or expired token' 
    });
  }
};

// GET /api/admin/projects/:projectId/employees - Get assigned employees for a project
router.get('/:projectId/employees', adminAuthMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Fetch assigned employees with their details
    const { data: assignments, error } = await supabase
      .from('project_employees')
      .select(`
        id,
        employee_id,
        assigned_at,
        revoked_at,
        assignment_start_date,
        assignment_end_date,
        status,
        assigned_by,
        revoked_by,
        notes,
        employees:employee_id (
          id,
          name,
          email,
          phone,
          role,
          created_at
        )
      `)
      .eq('project_id', projectId)
      .eq('status', 'active')
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('Error fetching project employees:', error);
      return res.status(500).json({ message: 'Failed to fetch assigned employees' });
    }

    // Transform the data to flatten employee details
    const assignedEmployees = (assignments || []).map(assignment => ({
      id: assignment.id,
      employee_id: assignment.employee_id,
      assigned_at: assignment.assigned_at,
      revoked_at: assignment.revoked_at,
      assignment_start_date: assignment.assignment_start_date,
      assignment_end_date: assignment.assignment_end_date,
      status: assignment.status,
      assigned_by: assignment.assigned_by,
      revoked_by: assignment.revoked_by,
      notes: assignment.notes,
      employee_name: assignment.employees?.name,
      employee_email: assignment.employees?.email,
      employee_phone: assignment.employees?.phone,
      employee_role: assignment.employees?.role,
      employee_created_at: assignment.employees?.created_at,
    }));

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
router.get('/:projectId/available-employees', adminAuthMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { search = '', page = 1, limit = 20 } = req.query;

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build search query
    let employeesQuery = supabase
      .from('employees')
      .select('id, name, email, phone, role, created_at', { count: 'exact' });

    // Add search filter if provided
    if (search) {
      employeesQuery = employeesQuery.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,role.ilike.%${search}%`
      );
    }

    // Add pagination
    employeesQuery = employeesQuery
      .order('name', { ascending: true })
      .range(offset, offset + parseInt(limit) - 1);

    const { data: employees, error, count } = await employeesQuery;

    if (error) {
      console.error('Error fetching employees:', error);
      return res.status(500).json({ message: 'Failed to fetch employees' });
    }

    // For each employee, check if they are currently assigned to any active project
    const employeesWithStatus = await Promise.all(
      (employees || []).map(async (employee) => {
        // Check current active assignment
        const { data: activeAssignment } = await supabase
          .from('project_employees')
          .select(`
            project_id,
            projects:project_id (
              id,
              name
            )
          `)
          .eq('employee_id', employee.id)
          .eq('status', 'active')
          .maybeSingle();

        // Check if assigned to the current project
        const isAssignedToCurrentProject = activeAssignment?.project_id === projectId;

        return {
          ...employee,
          is_assigned: !!activeAssignment,
          assigned_project_id: activeAssignment?.project_id || null,
          assigned_project_name: activeAssignment?.projects?.name || null,
          is_assigned_to_current_project: isAssignedToCurrentProject,
        };
      })
    );

    return res.json({
      employees: employeesWithStatus,
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil((count || 0) / parseInt(limit)),
    });
  } catch (err) {
    console.error('Get available employees error:', err);
    return res.status(500).json({ message: 'Error fetching available employees' });
  }
});

// POST /api/admin/projects/:projectId/employees - Assign employees to a project
router.post('/:projectId/employees', adminAuthMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { employee_ids, notes, start_date, end_date } = req.body;

    if (!employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0) {
      return res.status(400).json({ message: 'employee_ids array is required' });
    }

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check each employee's current assignment status
    const employeeChecks = await Promise.all(
      employee_ids.map(async (employeeId) => {
        // Check if employee exists
        const { data: employee, error: empError } = await supabase
          .from('employees')
          .select('id, name')
          .eq('id', employeeId)
          .maybeSingle();

        if (empError || !employee) {
          return { employeeId, error: 'Employee not found', employee: null };
        }

        // Check if employee is already assigned to an active project
        const { data: activeAssignment } = await supabase
          .from('project_employees')
          .select(`
            id,
            project_id,
            projects:project_id (name)
          `)
          .eq('employee_id', employeeId)
          .eq('status', 'active')
          .maybeSingle();

        if (activeAssignment) {
          // If assigned to the current project, skip
          if (activeAssignment.project_id === projectId) {
            return { 
              employeeId, 
              error: 'Already assigned to this project', 
              employee,
              skip: true 
            };
          }
          
          return { 
            employeeId, 
            error: `Already assigned to project: ${activeAssignment.projects?.name}`, 
            employee 
          };
        }

        return { employeeId, error: null, employee };
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

    // Create assignment records
    const assignments = validEmployees.map(check => ({
      project_id: projectId,
      employee_id: check.employeeId,
      assigned_by: req.user.id,
      status: 'active',
      notes: notes || null,
      assignment_start_date: start_date || null,
      assignment_end_date: end_date || null,
    }));

    const { data: created, error: insertError } = await supabase
      .from('project_employees')
      .insert(assignments)
      .select();

    if (insertError) {
      console.error('Error creating assignments:', insertError);
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
      assignments: created,
    });
  } catch (err) {
    console.error('Assign employees error:', err);
    return res.status(500).json({ message: 'Error assigning employees' });
  }
});

// POST /api/admin/projects/:projectId/employees/:employeeId/revoke - Revoke employee from project
router.post('/:projectId/employees/:employeeId/revoke', adminAuthMiddleware, async (req, res) => {
  try {
    const { projectId, employeeId } = req.params;
    const { notes } = req.body;

    // Find active assignment
    const { data: assignment, error: findError } = await supabase
      .from('project_employees')
      .select('*')
      .eq('project_id', projectId)
      .eq('employee_id', employeeId)
      .eq('status', 'active')
      .maybeSingle();

    if (findError) {
      console.error('Error finding assignment:', findError);
      return res.status(500).json({ message: 'Failed to find assignment' });
    }

    if (!assignment) {
      return res.status(404).json({ message: 'Employee is not assigned to this project' });
    }

    // Update assignment to revoked (soft delete)
    const { data: updated, error: updateError } = await supabase
      .from('project_employees')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: req.user.id,
        notes: notes || assignment.notes,
      })
      .eq('id', assignment.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error revoking assignment:', updateError);
      return res.status(500).json({ message: 'Failed to revoke employee' });
    }

    return res.json({ 
      message: 'Employee revoked successfully',
      assignment: updated,
    });
  } catch (err) {
    console.error('Revoke employee error:', err);
    return res.status(500).json({ message: 'Error revoking employee' });
  }
});

// POST /api/admin/projects/:projectId/employees/:employeeId/reassign - Reassign employee to another project
router.post('/:projectId/employees/:employeeId/reassign', adminAuthMiddleware, async (req, res) => {
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
    const { data: newProject, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', new_project_id)
      .maybeSingle();

    if (projectError || !newProject) {
      return res.status(404).json({ message: 'New project not found' });
    }

    // Verify employee exists
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, name')
      .eq('id', employeeId)
      .maybeSingle();

    if (empError || !employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Find current active assignment
    const { data: currentAssignment, error: findError } = await supabase
      .from('project_employees')
      .select('*')
      .eq('project_id', projectId)
      .eq('employee_id', employeeId)
      .eq('status', 'active')
      .maybeSingle();

    if (findError) {
      console.error('Error finding current assignment:', findError);
      return res.status(500).json({ message: 'Failed to find current assignment' });
    }

    if (!currentAssignment) {
      return res.status(404).json({ message: 'Employee is not currently assigned to this project' });
    }

    // Check if employee is already assigned to the new project
    const { data: existingAssignment } = await supabase
      .from('project_employees')
      .select('id')
      .eq('project_id', new_project_id)
      .eq('employee_id', employeeId)
      .eq('status', 'active')
      .maybeSingle();

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

    // Update current assignment to end before new start date
    const { error: updateError } = await supabase
      .from('project_employees')
      .update({
        assignment_end_date: currentEndDate.toISOString().split('T')[0],
        status: 'revoked',
        revoked_at: currentEndDate.toISOString(),
        revoked_by: req.user.id,
        notes: `Reassigned to project: ${newProject.name}`,
      })
      .eq('id', currentAssignment.id);

    if (updateError) {
      console.error('Error updating current assignment:', updateError);
      return res.status(500).json({ message: 'Failed to end current assignment' });
    }

    // Calculate end date for new assignment (optional - can be null for open-ended)
    // For now, we'll leave it null unless specified
    const newEndDate = null;

    // Create new assignment
    const { data: newAssignment, error: createError } = await supabase
      .from('project_employees')
      .insert({
        project_id: new_project_id,
        employee_id: employeeId,
        assignment_start_date: new_start_date,
        assignment_end_date: newEndDate,
        assigned_by: req.user.id,
        status: 'active',
        notes: `Reassigned from project: ${currentAssignment.project_id}`,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating new assignment:', createError);
      // Try to restore current assignment
      await supabase
        .from('project_employees')
        .update({
          assignment_end_date: currentAssignment.assignment_end_date,
          status: 'active',
          revoked_at: null,
          revoked_by: null,
        })
        .eq('id', currentAssignment.id);
      
      return res.status(500).json({ message: 'Failed to create new assignment' });
    }

    return res.json({ 
      message: `Employee successfully reassigned to ${newProject.name}`,
      previous_assignment: {
        ...currentAssignment,
        assignment_end_date: currentEndDate.toISOString().split('T')[0],
        status: 'revoked',
      },
      new_assignment: newAssignment,
    });
  } catch (err) {
    console.error('Reassign employee error:', err);
    return res.status(500).json({ message: 'Error reassigning employee' });
  }
});

// GET /api/admin/projects/:projectId/employees/history - Get assignment history for a project
router.get('/:projectId/employees/history', adminAuthMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Fetch all assignments (active and revoked) with employee details
    const { data: assignments, error } = await supabase
      .from('project_employees')
      .select(`
        id,
        employee_id,
        assigned_at,
        revoked_at,
        status,
        assigned_by,
        revoked_by,
        notes,
        employees:employee_id (
          id,
          name,
          email,
          role
        ),
        assigned_by_user:assigned_by (
          name,
          email
        ),
        revoked_by_user:revoked_by (
          name,
          email
        )
      `)
      .eq('project_id', projectId)
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('Error fetching assignment history:', error);
      return res.status(500).json({ message: 'Failed to fetch assignment history' });
    }

    return res.json({ 
      history: assignments || [],
      total: assignments?.length || 0 
    });
  } catch (err) {
    console.error('Get assignment history error:', err);
    return res.status(500).json({ message: 'Error fetching assignment history' });
  }
});

// GET /api/admin/projects/assignments/all - Get all active project assignments
router.get('/assignments/all', adminAuthMiddleware, async (req, res) => {
  try {
    // Fetch all active project assignments with employee details
    const { data: assignments, error } = await supabase
      .from('project_employees')
      .select(`
        project_id,
        employee_id,
        assignment_start_date,
        assignment_end_date,
        status,
        employees:employee_id (
          id,
          email
        )
      `)
      .eq('status', 'active')
      .is('revoked_at', null);

    if (error) {
      console.error('Error fetching all project assignments:', error);
      return res.status(500).json({ message: 'Failed to fetch project assignments' });
    }

    // Transform to a simpler structure
    const assignmentsMap = (assignments || []).map(assignment => ({
      project_id: assignment.project_id,
      employee_id: assignment.employee_id,
      employee_email: assignment.employees?.email,
      assignment_start_date: assignment.assignment_start_date,
      assignment_end_date: assignment.assignment_end_date,
    }));

    return res.json({ assignments: assignmentsMap });
  } catch (err) {
    console.error('Get all assignments error:', err);
    return res.status(500).json({ message: 'Error fetching project assignments' });
  }
});

module.exports = router;

