const db = require('../config/db');
const { uploadLeaveDocument } = require('../services/uploadService');
const emailService = require('../services/emailService');

// Get all leave types
const getLeaveTypes = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM leave_types ORDER BY name');
    return res.json({ leaveTypes: rows });
  } catch (error) {
    console.error('Get leave types error', error);
    return res.status(500).json({ message: 'Failed to fetch leave types' });
  }
};

// Get leave balance for an employee
const getLeaveBalance = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { year } = req.query;
    const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
    
    const { rows } = await db.query(
      `SELECT 
        lb.*,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code
       FROM leave_balances lb
       JOIN leave_types lt ON lt.id = lb.leave_type_id
       WHERE lb.employee_id = $1 AND lb.year = $2
       ORDER BY lt.name`,
      [employeeId, currentYear]
    );
    
    return res.json({ balances: rows });
  } catch (error) {
    console.error('Get leave balance error', error);
    return res.status(500).json({ message: 'Failed to fetch leave balance' });
  }
};

// Get all leave requests
const getLeaveRequests = async (req, res) => {
  try {
    const { employeeId, status, year, month } = req.query;
    
    let query = `
      SELECT 
        lr.*,
        e.name AS employee_name,
        e.email AS employee_email,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        a.name AS approved_by_name,
        stand_in.name AS stand_in_employee_name,
        stand_in.email AS stand_in_employee_email,
        COALESCE(
          lr.project_id,
          (SELECT pe.project_id FROM project_employees pe 
           WHERE pe.employee_id = lr.employee_id 
           AND pe.status = 'active' 
           AND (pe.assignment_end_date IS NULL OR pe.assignment_end_date >= CURRENT_DATE)
           ORDER BY pe.assigned_at DESC LIMIT 1),
          e.project_id
        ) AS project_id,
        COALESCE(
          p.name,
          (SELECT pr.name FROM project_employees pe 
           JOIN projects pr ON pr.id = pe.project_id
           WHERE pe.employee_id = lr.employee_id 
           AND pe.status = 'active' 
           AND (pe.assignment_end_date IS NULL OR pe.assignment_end_date >= CURRENT_DATE)
           ORDER BY pe.assigned_at DESC LIMIT 1),
          ep.name
        ) AS project_name
      FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      LEFT JOIN admins a ON a.id = lr.approved_by
      LEFT JOIN projects p ON p.id = lr.project_id
      LEFT JOIN projects ep ON ep.id = e.project_id
      LEFT JOIN employees stand_in ON stand_in.id = lr.stand_in_employee_id
      WHERE 1=1
    `;
    
    const conditions = [];
    const values = [];
    let paramIndex = 1;
    
    if (employeeId) {
      conditions.push(`lr.employee_id = $${paramIndex}`);
      values.push(employeeId);
      paramIndex += 1;
    }
    
    if (status) {
      conditions.push(`lr.status = $${paramIndex}`);
      values.push(status);
      paramIndex += 1;
    }
    
    if (year) {
      conditions.push(`EXTRACT(YEAR FROM lr.start_date) = $${paramIndex}`);
      values.push(parseInt(year, 10));
      paramIndex += 1;
    }
    
    if (month) {
      conditions.push(`EXTRACT(MONTH FROM lr.start_date) = $${paramIndex}`);
      values.push(parseInt(month, 10));
      paramIndex += 1;
    }
    
    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY lr.created_at DESC';
    
    const { rows } = await db.query(query, values);
    
    return res.json({ requests: rows });
  } catch (error) {
    console.error('Get leave requests error', error);
    return res.status(500).json({ message: 'Failed to fetch leave requests' });
  }
};

// Create leave request
const createLeaveRequest = async (req, res) => {
  try {
    // Support both camelCase and snake_case for flexibility
    // Also check req.employeeId from staffMiddleware
    const employeeId = req.body.employeeId || req.body.employee_id || req.employeeId;
    const leaveTypeId = req.body.leaveTypeId || req.body.leave_type_id;
    const projectId = req.body.projectId || req.body.project_id;
    const startDate = req.body.startDate || req.body.start_date;
    const endDate = req.body.endDate || req.body.end_date;
    const reason = req.body.reason;
    const standInEmployeeId = req.body.standInEmployeeId || req.body.stand_in_employee_id;
    
    console.log('Create leave request - received data:', {
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      reason,
      standInEmployeeId,
      hasFile: !!req.file
    });
    
    if (!employeeId || !leaveTypeId || !startDate || !endDate) {
      return res.status(400).json({ 
        message: `Missing required fields. employeeId: ${!!employeeId}, leaveTypeId: ${!!leaveTypeId}, startDate: ${!!startDate}, endDate: ${!!endDate}` 
      });
    }
    
    // Calculate number of days
    const { rows: daysResult } = await db.query(
      'SELECT calculate_working_days($1, $2) AS days',
      [startDate, endDate]
    );
    const numberOfDays = parseFloat(daysResult[0].days);
    
    if (numberOfDays <= 0) {
      return res.status(400).json({ message: 'Invalid date range' });
    }
    
    // Get leave type code
    const { rows: leaveTypeResult } = await db.query(
      'SELECT code FROM leave_types WHERE id = $1',
      [leaveTypeId]
    );
    
    if (leaveTypeResult.length === 0) {
      return res.status(400).json({ message: 'Invalid leave type' });
    }
    
    const leaveTypeCode = leaveTypeResult[0].code;
    
    // Handle MC document upload for Medical Leave (optional)
    let mcDocumentUrl = null;
    if ((leaveTypeCode === 'SICK' || leaveTypeCode === 'MC') && req.file) {
      // MC document is optional - only upload if provided
      try {
        mcDocumentUrl = await uploadLeaveDocument(req.file, employeeId);
      } catch (uploadError) {
        console.error('MC document upload error:', uploadError);
        return res.status(500).json({ 
          message: 'Failed to upload medical certificate document' 
        });
      }
    }
    
    // Check if annual leave balance is sufficient
    if (leaveTypeCode === 'ANNUAL') {
      const currentYear = new Date(startDate).getFullYear();
      const { rows: balanceResult } = await db.query(
        `SELECT remaining_days FROM leave_balances 
         WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`,
        [employeeId, leaveTypeId, currentYear]
      );
      
      if (balanceResult.length === 0 || parseFloat(balanceResult[0].remaining_days) < numberOfDays) {
        return res.status(400).json({ 
          message: 'Insufficient annual leave balance' 
        });
      }
    }
    
    // Validate stand-in employee exists if provided
    if (standInEmployeeId) {
      const { rows: standInResult } = await db.query(
        'SELECT id FROM employees WHERE id = $1',
        [standInEmployeeId]
      );
      
      if (standInResult.length === 0) {
        return res.status(400).json({ message: 'Invalid stand-in employee' });
      }
    }
    
    // Create leave request
    const { rows } = await db.query(
      `INSERT INTO leave_requests 
       (employee_id, leave_type_id, project_id, start_date, end_date, number_of_days, reason, 
        mc_document_url, stand_in_employee_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING *`,
      [
        employeeId, 
        leaveTypeId, 
        projectId || null, 
        startDate, 
        endDate, 
        numberOfDays, 
        reason || null,
        mcDocumentUrl,
        standInEmployeeId || null
      ]
    );
    
    const leaveRequest = rows[0];
    
    // Send email notification to admin (async, don't wait)
    (async () => {
      try {
        // Get employee and leave type details
        const { rows: empRows } = await db.query(
          'SELECT name, email FROM employees WHERE id = $1',
          [employeeId]
        );
        const { rows: leaveTypeRows } = await db.query(
          'SELECT name FROM leave_types WHERE id = $1',
          [leaveTypeId]
        );
        
        let standInName = null;
        if (standInEmployeeId) {
          const { rows: standInRows } = await db.query(
            'SELECT name FROM employees WHERE id = $1',
            [standInEmployeeId]
          );
          standInName = standInRows[0]?.name;
        }
        
        if (empRows.length > 0 && leaveTypeRows.length > 0) {
          const employee = empRows[0];
          const leaveTypeName = leaveTypeRows[0].name;
          
          await emailService.sendLeaveRequestNotification({
            ...leaveRequest,
            leave_type_name: leaveTypeName,
            stand_in_employee_name: standInName,
          }, employee);
        }
      } catch (emailError) {
        console.error('Failed to send leave request email notification:', emailError);
        // Don't fail the request if email fails
      }
    })();
    
    return res.status(201).json({ request: leaveRequest });
  } catch (error) {
    console.error('Create leave request error', error);
    // Return more detailed error message for debugging
    const errorMessage = error.message || 'Failed to create leave request';
    const statusCode = error.code === '23505' ? 409 : 500; // Handle unique constraint violations
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Update leave request status (approve/reject)
const updateLeaveRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, rejectionReason } = req.body;
    // Admin ID from token (set by adminAuthMiddleware)
    const adminId = req.admin?.id || req.user?.id;
    
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Get the leave request first to check current status
    const { rows: existingRequest } = await db.query(
      'SELECT * FROM leave_requests WHERE id = $1',
      [requestId]
    );
    
    if (existingRequest.length === 0) {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    
    const leaveRequest = existingRequest[0];
    
    // If already approved/rejected, don't allow status change (unless cancelling)
    if (leaveRequest.status === 'approved' && status !== 'cancelled') {
      return res.status(400).json({ message: 'Leave request is already approved' });
    }
    if (leaveRequest.status === 'rejected' && status !== 'cancelled') {
      return res.status(400).json({ message: 'Leave request is already rejected' });
    }
    
    const updateData = {
      status,
      updated_at: new Date().toISOString(),
    };
    
    if (status === 'approved') {
      updateData.approved_by = adminId;
      updateData.approved_at = new Date().toISOString();
      updateData.rejection_reason = null;
      
      // Note: AL balance deduction is handled by database trigger (deduct_annual_leave_on_approval)
      // Approved leaves are automatically included in monthly summary calculations
      // No need to create attendance_logs records - monthly summary queries leave_requests directly
    } else if (status === 'rejected') {
      updateData.rejection_reason = rejectionReason || null;
      updateData.approved_by = adminId;
      updateData.approved_at = new Date().toISOString();
    }
    
    const setClause = Object.keys(updateData)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    
    const values = Object.values(updateData);
    values.push(requestId);
    
    const { rows } = await db.query(
      `UPDATE leave_requests 
       SET ${setClause}
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    
    const updatedRequest = rows[0];
    
    // Send email notification to staff (async, don't wait)
    if (status === 'approved' || status === 'rejected') {
      (async () => {
        try {
          // Get employee and admin details
          const { rows: empRows } = await db.query(
            'SELECT name, email FROM employees WHERE id = $1',
            [updatedRequest.employee_id]
          );
          const { rows: adminRows } = await db.query(
            'SELECT name, email FROM admins WHERE id = $1',
            [adminId]
          );
          const { rows: leaveTypeRows } = await db.query(
            'SELECT name FROM leave_types WHERE id = $1',
            [updatedRequest.leave_type_id]
          );
          
          if (empRows.length > 0 && leaveTypeRows.length > 0) {
            const employee = empRows[0];
            const adminName = adminRows[0]?.name || 'Administrator';
            const leaveTypeName = leaveTypeRows[0].name;
            
            await emailService.sendLeaveStatusNotification(
              {
                ...updatedRequest,
                leave_type_name: leaveTypeName,
              },
              employee,
              status,
              adminName,
              updatedRequest.rejection_reason
            );
          }
        } catch (emailError) {
          console.error('Failed to send leave status email notification:', emailError);
          // Don't fail the request if email fails
        }
      })();
    }
    
    return res.json({ 
      request: updatedRequest,
      message: status === 'approved' 
        ? 'Leave request approved. Approved leaves are automatically reflected in attendance and monthly summaries.'
        : status === 'rejected'
        ? 'Leave request rejected.'
        : 'Leave request cancelled.'
    });
  } catch (error) {
    console.error('Update leave request status error', error);
    return res.status(500).json({ message: 'Failed to update leave request status' });
  }
};

// Get leave statistics
const getLeaveStatistics = async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
    
    // Pending requests count
    const { rows: pendingCount } = await db.query(
      "SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending'"
    );
    
    // Leave usage by type
    const { rows: usageByType } = await db.query(
      `SELECT 
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        COUNT(lr.id) AS request_count,
        SUM(lr.number_of_days) AS total_days
       FROM leave_types lt
       LEFT JOIN leave_requests lr ON lr.leave_type_id = lt.id 
         AND EXTRACT(YEAR FROM lr.start_date) = $1
         AND lr.status = 'approved'
       GROUP BY lt.id, lt.name, lt.code
       ORDER BY lt.name`,
      [currentYear]
    );
    
    // Monthly leave usage
    const { rows: monthlyUsage } = await db.query(
      `SELECT 
        EXTRACT(MONTH FROM lr.start_date) AS month,
        COUNT(lr.id) AS request_count,
        SUM(lr.number_of_days) AS total_days
       FROM leave_requests lr
       WHERE EXTRACT(YEAR FROM lr.start_date) = $1
         AND lr.status = 'approved'
       GROUP BY EXTRACT(MONTH FROM lr.start_date)
       ORDER BY month`,
      [currentYear]
    );
    
    return res.json({
      pendingCount: parseInt(pendingCount[0].count, 10),
      usageByType,
      monthlyUsage,
    });
  } catch (error) {
    console.error('Get leave statistics error', error);
    return res.status(500).json({ message: 'Failed to fetch leave statistics' });
  }
};

// Initialize leave balances for all employees
const initializeLeaveBalances = async (req, res) => {
  try {
    await db.query('SELECT initialize_leave_balances_for_current_year()');
    return res.json({ message: 'Leave balances initialized successfully' });
  } catch (error) {
    console.error('Initialize leave balances error', error);
    return res.status(500).json({ message: 'Failed to initialize leave balances' });
  }
};

// Bulk approve leave requests
const bulkApproveLeaveRequests = async (req, res) => {
  try {
    const { requestIds } = req.body;
    const adminId = req.admin?.id || req.user?.id;

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({ message: 'Request IDs array is required' });
    }

    // Validate all requests exist and are pending
    const { rows: existingRequests } = await db.query(
      `SELECT id, status, employee_id, leave_type_id FROM leave_requests WHERE id = ANY($1::uuid[])`,
      [requestIds]
    );

    if (existingRequests.length !== requestIds.length) {
      return res.status(400).json({ message: 'One or more leave requests not found' });
    }

    // Check all are pending
    const nonPendingRequests = existingRequests.filter(req => req.status !== 'pending');
    if (nonPendingRequests.length > 0) {
      return res.status(400).json({ 
        message: `Cannot approve ${nonPendingRequests.length} request(s) that are not pending` 
      });
    }

    // Bulk update all requests
    const updateResult = await db.query(
      `UPDATE leave_requests 
       SET 
         status = 'approved',
         approved_by = $1,
         approved_at = NOW(),
         rejection_reason = NULL,
         updated_at = NOW()
       WHERE id = ANY($2::uuid[]) AND status = 'pending'
       RETURNING *`,
      [adminId, requestIds]
    );

    const approvedRequests = updateResult.rows;

    // Send email notifications (async, don't wait)
    (async () => {
      for (const leaveRequest of approvedRequests) {
        try {
          // Get employee and admin details
          const { rows: empRows } = await db.query(
            'SELECT name, email FROM employees WHERE id = $1',
            [leaveRequest.employee_id]
          );
          const { rows: adminRows } = await db.query(
            'SELECT name, email FROM admins WHERE id = $1',
            [adminId]
          );
          const { rows: leaveTypeRows } = await db.query(
            'SELECT name FROM leave_types WHERE id = $1',
            [leaveRequest.leave_type_id]
          );

          if (empRows.length > 0 && leaveTypeRows.length > 0) {
            const employee = empRows[0];
            const adminName = adminRows[0]?.name || 'Administrator';
            const leaveTypeName = leaveTypeRows[0].name;

            await emailService.sendLeaveStatusNotification(
              {
                ...leaveRequest,
                leave_type_name: leaveTypeName,
              },
              employee,
              'approved',
              adminName,
              null
            );
          }
        } catch (emailError) {
          console.error(`Failed to send email notification for leave request ${leaveRequest.id}:`, emailError);
          // Don't fail the bulk operation if email fails
        }
      }
    })();

    return res.json({
      message: `${approvedRequests.length} leave request(s) approved successfully`,
      approvedCount: approvedRequests.length,
      requests: approvedRequests,
    });
  } catch (error) {
    console.error('Bulk approve leave requests error', error);
    return res.status(500).json({ 
      message: 'Failed to bulk approve leave requests',
      error: error.message 
    });
  }
};

module.exports = {
  getLeaveTypes,
  getLeaveBalance,
  getLeaveRequests,
  createLeaveRequest,
  updateLeaveRequestStatus,
  bulkApproveLeaveRequests,
  getLeaveStatistics,
  initializeLeaveBalances,
};

