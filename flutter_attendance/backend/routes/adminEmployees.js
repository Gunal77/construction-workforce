const express = require('express');
const { supabase } = require('../config/supabaseClient');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');

const router = express.Router();

// All routes require admin authentication
router.use(adminAuthMiddleware);

// GET /admin/employees - Fetch all employees (with project info if available)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select(`
        *,
        projects (
          id,
          name,
          location
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ message: error.message || 'Failed to fetch employees' });
    }

    return res.json({ employees: data || [] });
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

    // If project_id is provided, verify it exists
    if (project_id) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', project_id)
        .single();

      if (projectError || !project) {
        return res.status(400).json({ message: 'Invalid project ID' });
      }
    }

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

    const { data, error } = await supabase
      .from('employees')
      .insert([employeeData])
      .select(`
        *,
        projects (
          id,
          name,
          location
        )
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'Employee with this email already exists' });
      }
      return res.status(400).json({ message: error.message || 'Failed to create employee' });
    }

    return res.status(201).json({ employee: data, message: 'Employee created successfully' });
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
    if (project_id !== undefined) {
      // If project_id is provided, verify it exists
      if (project_id) {
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('id')
          .eq('id', project_id)
          .single();

        if (projectError || !project) {
          return res.status(400).json({ message: 'Invalid project ID' });
        }
      }
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

    const { data, error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        projects (
          id,
          name,
          location
        )
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ message: 'Employee not found' });
      }
      if (error.code === '23505') {
        return res.status(409).json({ message: 'Employee with this email already exists' });
      }
      return res.status(400).json({ message: error.message || 'Failed to update employee' });
    }

    if (!data) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    return res.json({ employee: data, message: 'Employee updated successfully' });
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

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ message: error.message || 'Failed to delete employee' });
    }

    return res.json({ message: 'Employee deleted successfully' });
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

    // Get projects from project_employees table where employee is actively assigned
    const { data: assignments, error } = await supabase
      .from('project_employees')
      .select(`
        project_id,
        assignment_start_date,
        assignment_end_date,
        status,
        projects:project_id (
          id,
          name,
          location,
          start_date,
          end_date
        )
      `)
      .eq('employee_id', id)
      .eq('status', 'active')
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('Error fetching employee projects:', error);
      return res.status(500).json({ message: 'Failed to fetch employee projects' });
    }

    // Transform the data
    const projects = (assignments || [])
      .filter(assignment => assignment.projects !== null)
      .map(assignment => ({
        id: assignment.projects.id,
        name: assignment.projects.name,
        location: assignment.projects.location,
        start_date: assignment.projects.start_date,
        end_date: assignment.projects.end_date,
        assignment_start_date: assignment.assignment_start_date,
        assignment_end_date: assignment.assignment_end_date,
      }));

    // If no projects from project_employees, check direct project_id from employees table
    if (projects.length === 0) {
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select(`
          project_id,
          projects:project_id (
            id,
            name,
            location,
            start_date,
            end_date
          )
        `)
        .eq('id', id)
        .single();

      if (!empError && employee?.project_id && employee.projects) {
        projects.push({
          id: employee.projects.id,
          name: employee.projects.name,
          location: employee.projects.location,
          start_date: employee.projects.start_date,
          end_date: employee.projects.end_date,
        });
      }
    }

    return res.json({ projects });
  } catch (err) {
    console.error('Get employee projects error', err);
    return res.status(500).json({ message: 'Error fetching employee projects' });
  }
});

module.exports = router;

