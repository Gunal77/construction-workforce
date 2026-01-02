const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/authorizeRoles');
const employeeRepository = require('../repositories/employeeRepository');

const router = express.Router();

// All routes require authentication and ADMIN role
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN'));

// GET /admin/employees - Fetch all employees (with project info if available)
router.get('/', async (req, res) => {
  try {
    const employees = await employeeRepository.findAll({ orderBy: 'created_at desc' });
    return res.json({ employees });
  } catch (err) {
    console.error('Get employees error', err);
    return res.status(500).json({ message: 'Error fetching employees' });
  }
});

// POST /admin/employees - Add new employee
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, role, project_id, payment_type, hourly_rate, daily_rate, monthly_rate, contract_rate } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Employee name is required' });
    }

    // Validate email format if provided
    if (email && (!email.includes('@') || email.trim().length === 0)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validate payment_type if provided
    if (payment_type && !['hourly', 'daily', 'monthly', 'contract'].includes(payment_type)) {
      return res.status(400).json({ message: 'Invalid payment_type. Must be hourly, daily, monthly, or contract' });
    }

    // Validate rate based on payment_type
    if (payment_type === 'hourly' && (!hourly_rate || hourly_rate < 0)) {
      return res.status(400).json({ message: 'hourly_rate is required and must be >= 0 for hourly payment type' });
    }
    if (payment_type === 'daily' && (!daily_rate || daily_rate < 0)) {
      return res.status(400).json({ message: 'daily_rate is required and must be >= 0 for daily payment type' });
    }
    if (payment_type === 'monthly' && (!monthly_rate || monthly_rate < 0)) {
      return res.status(400).json({ message: 'monthly_rate is required and must be >= 0 for monthly payment type' });
    }
    if (payment_type === 'contract' && (!contract_rate || contract_rate < 0)) {
      return res.status(400).json({ message: 'contract_rate is required and must be >= 0 for contract payment type' });
    }

    // Note: project_id validation removed (was Supabase-only)
    // MongoDB handles this via foreign key constraints or application logic

    const employeeData = {
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      role: role?.trim() || null,
      project_id: project_id || null,
      payment_type: payment_type || null,
      hourly_rate: payment_type === 'hourly' ? parseFloat(hourly_rate) : null,
      daily_rate: payment_type === 'daily' ? parseFloat(daily_rate) : null,
      monthly_rate: payment_type === 'monthly' ? parseFloat(monthly_rate) : null,
      contract_rate: payment_type === 'contract' ? parseFloat(contract_rate) : null,
    };

    try {
      const employee = await employeeRepository.create(employeeData);
      return res.status(201).json({ employee, message: 'Employee created successfully' });
    } catch (error) {
      if (error.code === '23505' || error.code === 11000) {
        return res.status(409).json({ message: 'Employee with this email already exists' });
      }
      return res.status(400).json({ message: error.message || 'Failed to create employee' });
    }
  } catch (err) {
    console.error('Create employee error', err);
    return res.status(500).json({ message: 'Error creating employee' });
  }
});

// PUT /admin/employees/:id - Update employee by ID
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, project_id, payment_type, hourly_rate, daily_rate, monthly_rate, contract_rate } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Employee ID is required' });
    }

    const updateData = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: 'Employee name must be a non-empty string' });
      }
      updateData.name = name.trim();
    }
    if (email !== undefined) {
      if (email && (!email.includes('@') || email.trim().length === 0)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      updateData.email = email?.trim() || null;
    }
    if (phone !== undefined) {
      updateData.phone = phone?.trim() || null;
    }
    if (role !== undefined) {
      updateData.role = role?.trim() || null;
    }
    // Note: project_id validation removed (was Supabase-only)
    // MongoDB handles this via foreign key constraints or application logic
    if (project_id !== undefined) {
      updateData.project_id = project_id || null;
    }
    
    // Handle payment_type and rates
    if (payment_type !== undefined) {
      if (payment_type && !['hourly', 'daily', 'monthly', 'contract'].includes(payment_type)) {
        return res.status(400).json({ message: 'Invalid payment_type. Must be hourly, daily, monthly, or contract' });
      }
      updateData.payment_type = payment_type || null;
      
      // Clear rates that don't match the payment type
      if (payment_type === 'hourly') {
        updateData.hourly_rate = hourly_rate !== undefined ? parseFloat(hourly_rate) : null;
        updateData.daily_rate = null;
        updateData.monthly_rate = null;
        updateData.contract_rate = null;
        if (hourly_rate !== undefined && (!hourly_rate || hourly_rate < 0)) {
          return res.status(400).json({ message: 'hourly_rate must be >= 0 for hourly payment type' });
        }
      } else if (payment_type === 'daily') {
        updateData.daily_rate = daily_rate !== undefined ? parseFloat(daily_rate) : null;
        updateData.hourly_rate = null;
        updateData.monthly_rate = null;
        updateData.contract_rate = null;
        if (daily_rate !== undefined && (!daily_rate || daily_rate < 0)) {
          return res.status(400).json({ message: 'daily_rate must be >= 0 for daily payment type' });
        }
      } else if (payment_type === 'monthly') {
        updateData.monthly_rate = monthly_rate !== undefined ? parseFloat(monthly_rate) : null;
        updateData.hourly_rate = null;
        updateData.daily_rate = null;
        updateData.contract_rate = null;
        if (monthly_rate !== undefined && (!monthly_rate || monthly_rate < 0)) {
          return res.status(400).json({ message: 'monthly_rate must be >= 0 for monthly payment type' });
        }
      } else if (payment_type === 'contract') {
        updateData.contract_rate = contract_rate !== undefined ? parseFloat(contract_rate) : null;
        updateData.hourly_rate = null;
        updateData.daily_rate = null;
        updateData.monthly_rate = null;
        if (contract_rate !== undefined && (!contract_rate || contract_rate < 0)) {
          return res.status(400).json({ message: 'contract_rate must be >= 0 for contract payment type' });
        }
      } else {
        // payment_type is null/empty, clear all rates
        updateData.hourly_rate = null;
        updateData.daily_rate = null;
        updateData.monthly_rate = null;
        updateData.contract_rate = null;
      }
    } else {
      // If payment_type is not being updated, allow individual rate updates
      if (hourly_rate !== undefined) {
        updateData.hourly_rate = hourly_rate ? parseFloat(hourly_rate) : null;
      }
      if (daily_rate !== undefined) {
        updateData.daily_rate = daily_rate ? parseFloat(daily_rate) : null;
      }
      if (monthly_rate !== undefined) {
        updateData.monthly_rate = monthly_rate ? parseFloat(monthly_rate) : null;
      }
      if (contract_rate !== undefined) {
        updateData.contract_rate = contract_rate ? parseFloat(contract_rate) : null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    try {
      const employee = await employeeRepository.update(id, updateData);
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      return res.json({ employee, message: 'Employee updated successfully' });
    } catch (error) {
      if (error.code === '23505' || error.code === 11000) {
        return res.status(409).json({ message: 'Employee with this email already exists' });
      }
      return res.status(400).json({ message: error.message || 'Failed to update employee' });
    }
  } catch (err) {
    console.error('Update employee error', err);
    return res.status(500).json({ message: 'Error updating employee' });
  }
});

// DELETE /admin/employees/:id - Delete employee by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Employee ID is required' });
    }

    try {
      const deleted = await employeeRepository.delete(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      return res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'Failed to delete employee' });
    }
  } catch (err) {
    console.error('Delete employee error', err);
    return res.status(500).json({ message: 'Error deleting employee' });
  }
});

// GET /admin/employees/:id/projects - Get assigned projects for an employee
router.get('/:id/projects', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Employee ID is required' });
    }

    // MongoDB: Get projects where employee is actively assigned
    const ProjectMerged = require('../models/ProjectMerged');
    
    const projects = await ProjectMerged.find({
      'assigned_employees.employee_id': id,
      'assigned_employees.status': 'active'
    })
    .select('_id name location start_date end_date assigned_employees')
    .lean();

    // Transform to match expected format
    const formattedProjects = projects
      .map(project => {
        const assignment = project.assigned_employees.find(
          emp => emp.employee_id?.toString() === id && emp.status === 'active'
        );
        
        if (!assignment) return null;
        
        return {
          id: project._id.toString(),
          name: project.name,
          location: project.location || null,
          start_date: project.start_date || null,
          end_date: project.end_date || null,
          assignment_start_date: assignment.assignment_start_date || null,
          assignment_end_date: assignment.assignment_end_date || null,
        };
      })
      .filter(Boolean);

    return res.json({ projects: formattedProjects });
  } catch (err) {
    console.error('Get employee projects error', err);
    return res.status(500).json({ message: 'Error fetching employee projects' });
  }
});

module.exports = router;

