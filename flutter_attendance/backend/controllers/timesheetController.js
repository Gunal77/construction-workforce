const db = require('../config/db');

// Get all timesheets with filters
const getTimesheets = async (req, res) => {
  try {
    const { staffId, projectId, status, approvalStatus, otApprovalStatus, startDate, endDate, view } = req.query;
    
    let query = `
      SELECT 
        t.*,
        e.name AS staff_name,
        e.email AS staff_email,
        e.role AS staff_role,
        p.name AS project_name,
        a.name AS approved_by_name,
        ot_admin.name AS ot_approved_by_name
      FROM timesheets t
      JOIN employees e ON e.id = t.staff_id
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN admins a ON a.id = t.approved_by
      LEFT JOIN admins ot_admin ON ot_admin.id = t.ot_approved_by
      WHERE 1=1
    `;
    
    const conditions = [];
    const values = [];
    let paramIndex = 1;
    
    if (staffId) {
      conditions.push(`t.staff_id = $${paramIndex}`);
      values.push(staffId);
      paramIndex += 1;
    }
    
    if (projectId) {
      conditions.push(`t.project_id = $${paramIndex}`);
      values.push(projectId);
      paramIndex += 1;
    }
    
    if (status) {
      conditions.push(`t.status = $${paramIndex}`);
      values.push(status);
      paramIndex += 1;
    }
    
    if (approvalStatus) {
      conditions.push(`t.approval_status = $${paramIndex}`);
      values.push(approvalStatus);
      paramIndex += 1;
    }
    
    if (otApprovalStatus) {
      conditions.push(`t.ot_approval_status = $${paramIndex}`);
      values.push(otApprovalStatus);
      paramIndex += 1;
    }
    
    // Only add date filters if both startDate and endDate are provided
    // If only one is provided, we still filter, but if neither is provided, show all
    if (startDate && endDate) {
      conditions.push(`t.work_date >= $${paramIndex}`);
      values.push(startDate);
      paramIndex += 1;
      conditions.push(`t.work_date <= $${paramIndex}`);
      values.push(endDate);
      paramIndex += 1;
    } else if (startDate) {
      conditions.push(`t.work_date >= $${paramIndex}`);
      values.push(startDate);
      paramIndex += 1;
    } else if (endDate) {
      conditions.push(`t.work_date <= $${paramIndex}`);
      values.push(endDate);
      paramIndex += 1;
    }
    
    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }
    
    // Order by date descending
    query += ' ORDER BY t.work_date DESC, t.created_at DESC';
    
    const { rows } = await db.query(query, values);
    
    return res.json({ timesheets: rows });
  } catch (error) {
    console.error('Get timesheets error', error);
    return res.status(500).json({ message: 'Failed to fetch timesheets', error: error.message });
  }
};

// Get single timesheet by ID
const getTimesheetById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await db.query(
      `SELECT 
        t.*,
        e.name AS staff_name,
        e.email AS staff_email,
        e.role AS staff_role,
        p.name AS project_name,
        a.name AS approved_by_name,
        ot_admin.name AS ot_approved_by_name
      FROM timesheets t
      JOIN employees e ON e.id = t.staff_id
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN admins a ON a.id = t.approved_by
      LEFT JOIN admins ot_admin ON ot_admin.id = t.ot_approved_by
      WHERE t.id = $1`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Timesheet not found' });
    }
    
    return res.json({ timesheet: rows[0] });
  } catch (error) {
    console.error('Get timesheet by ID error', error);
    return res.status(500).json({ message: 'Failed to fetch timesheet', error: error.message });
  }
};

// Create new timesheet
const createTimesheet = async (req, res) => {
  try {
    const {
      staffId,
      staff_id,
      workDate,
      work_date,
      checkIn,
      check_in,
      checkOut,
      check_out,
      projectId,
      project_id,
      taskType,
      task_type,
      status,
      remarks,
    } = req.body;
    
    // Support both camelCase and snake_case
    const finalStaffId = staffId || staff_id;
    const finalWorkDate = workDate || work_date;
    const finalCheckIn = checkIn || check_in;
    const finalCheckOut = checkOut || check_out;
    const finalProjectId = projectId || project_id;
    const finalTaskType = taskType || task_type;
    
    if (!finalStaffId || !finalWorkDate || !finalCheckIn) {
      return res.status(400).json({ message: 'staffId, workDate, and checkIn are required' });
    }
    
    // Validate work date is not in future
    const workDateObj = new Date(finalWorkDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (workDateObj > today) {
      return res.status(400).json({ message: 'Cannot create timesheet for future dates' });
    }
    
    const adminId = req.admin?.id;
    
    const { rows } = await db.query(
      `INSERT INTO timesheets (
        staff_id, work_date, check_in, check_out, project_id, task_type, status, remarks, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        finalStaffId,
        finalWorkDate,
        finalCheckIn,
        finalCheckOut || null,
        finalProjectId || null,
        finalTaskType || null,
        status || 'Present',
        remarks || null,
        adminId || null,
      ]
    );
    
    // Fetch with joins for response
    const { rows: fullRows } = await db.query(
      `SELECT 
        t.*,
        e.name AS staff_name,
        e.email AS staff_email,
        e.role AS staff_role,
        p.name AS project_name
      FROM timesheets t
      JOIN employees e ON e.id = t.staff_id
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.id = $1`,
      [rows[0].id]
    );
    
    return res.status(201).json({ timesheet: fullRows[0] });
  } catch (error) {
    console.error('Create timesheet error', error);
    if (error.message.includes('overlapping') || 
        error.message.includes('future') ||
        error.message.includes('Maximum') ||
        error.message.includes('Check-out')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ message: 'Timesheet already exists for this staff on this date' });
    }
    return res.status(500).json({ message: 'Failed to create timesheet', error: error.message });
  }
};

// Update timesheet
const updateTimesheet = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      workDate,
      work_date,
      checkIn,
      check_in,
      checkOut,
      check_out,
      projectId,
      project_id,
      taskType,
      task_type,
      status,
      remarks,
    } = req.body;
    
    // Support both camelCase and snake_case
    const finalWorkDate = workDate || work_date;
    const finalCheckIn = checkIn || check_in;
    const finalCheckOut = checkOut || check_out;
    const finalProjectId = projectId || project_id;
    const finalTaskType = taskType || task_type;
    
    // Check if timesheet exists and is not approved
    const { rows: existing } = await db.query(
      'SELECT approval_status FROM timesheets WHERE id = $1',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Timesheet not found' });
    }
    
    if (existing[0].approval_status === 'Approved') {
      return res.status(400).json({ message: 'Cannot edit approved timesheet' });
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (finalWorkDate !== undefined) {
      updates.push(`work_date = $${paramIndex}`);
      values.push(finalWorkDate);
      paramIndex += 1;
    }
    
    if (finalCheckIn !== undefined) {
      updates.push(`check_in = $${paramIndex}`);
      values.push(finalCheckIn);
      paramIndex += 1;
    }
    
    if (finalCheckOut !== undefined) {
      updates.push(`check_out = $${paramIndex}`);
      values.push(finalCheckOut);
      paramIndex += 1;
    }
    
    if (finalProjectId !== undefined) {
      updates.push(`project_id = $${paramIndex}`);
      values.push(finalProjectId || null);
      paramIndex += 1;
    }
    
    if (finalTaskType !== undefined) {
      updates.push(`task_type = $${paramIndex}`);
      values.push(finalTaskType || null);
      paramIndex += 1;
    }
    
    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex += 1;
    }
    
    if (remarks !== undefined) {
      updates.push(`remarks = $${paramIndex}`);
      values.push(remarks || null);
      paramIndex += 1;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }
    
    values.push(id);
    
    const { rows } = await db.query(
      `UPDATE timesheets 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    
    // Fetch with joins for response
    const { rows: fullRows } = await db.query(
      `SELECT 
        t.*,
        e.name AS staff_name,
        e.email AS staff_email,
        e.role AS staff_role,
        p.name AS project_name
      FROM timesheets t
      JOIN employees e ON e.id = t.staff_id
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.id = $1`,
      [rows[0].id]
    );
    
    return res.json({ timesheet: fullRows[0] });
  } catch (error) {
    console.error('Update timesheet error', error);
    if (error.message.includes('overlapping') || 
        error.message.includes('future') ||
        error.message.includes('Maximum') ||
        error.message.includes('Check-out') ||
        error.message.includes('approved')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to update timesheet', error: error.message });
  }
};

// Submit timesheet for approval
const submitTimesheet = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows: existing } = await db.query(
      'SELECT approval_status FROM timesheets WHERE id = $1',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Timesheet not found' });
    }
    
    if (existing[0].approval_status === 'Approved') {
      return res.status(400).json({ message: 'Timesheet is already approved' });
    }
    
    const { rows } = await db.query(
      `UPDATE timesheets 
       SET approval_status = 'Submitted', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    
    return res.json({ timesheet: rows[0], message: 'Timesheet submitted for approval' });
  } catch (error) {
    console.error('Submit timesheet error', error);
    return res.status(500).json({ message: 'Failed to submit timesheet', error: error.message });
  }
};

// Approve timesheet
const approveTimesheet = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin?.id;
    
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const { rows: existing } = await db.query(
      'SELECT approval_status FROM timesheets WHERE id = $1',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Timesheet not found' });
    }
    
    if (existing[0].approval_status === 'Approved') {
      return res.status(400).json({ message: 'Timesheet is already approved' });
    }
    
    const { rows } = await db.query(
      `UPDATE timesheets 
       SET approval_status = 'Approved', 
           approved_by = $1,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [adminId, id]
    );
    
    return res.json({ timesheet: rows[0], message: 'Timesheet approved successfully' });
  } catch (error) {
    console.error('Approve timesheet error', error);
    return res.status(500).json({ message: 'Failed to approve timesheet', error: error.message });
  }
};

// Reject timesheet
const rejectTimesheet = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.admin?.id;
    
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const { rows: existing } = await db.query(
      'SELECT approval_status FROM timesheets WHERE id = $1',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Timesheet not found' });
    }
    
    if (existing[0].approval_status === 'Approved') {
      return res.status(400).json({ message: 'Cannot reject an approved timesheet' });
    }
    
    const { rows } = await db.query(
      `UPDATE timesheets 
       SET approval_status = 'Rejected',
           remarks = COALESCE($1, remarks),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason || null, id]
    );
    
    return res.json({ timesheet: rows[0], message: 'Timesheet rejected' });
  } catch (error) {
    console.error('Reject timesheet error', error);
    return res.status(500).json({ message: 'Failed to reject timesheet', error: error.message });
  }
};

// Approve OT
const approveOT = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin?.id;
    
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const { rows: existing } = await db.query(
      'SELECT ot_approval_status, overtime_hours FROM timesheets WHERE id = $1',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Timesheet not found' });
    }
    
    if (existing[0].overtime_hours <= 0) {
      return res.status(400).json({ message: 'No overtime hours to approve' });
    }
    
    if (existing[0].ot_approval_status === 'Approved') {
      return res.status(400).json({ message: 'OT is already approved' });
    }
    
    const { rows } = await db.query(
      `UPDATE timesheets 
       SET ot_approval_status = 'Approved',
           ot_approved_by = $1,
           ot_approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [adminId, id]
    );
    
    return res.json({ timesheet: rows[0], message: 'Overtime approved successfully' });
  } catch (error) {
    console.error('Approve OT error', error);
    return res.status(500).json({ message: 'Failed to approve overtime', error: error.message });
  }
};

// Reject OT
const rejectOT = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.admin?.id;
    
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const { rows: existing } = await db.query(
      'SELECT ot_approval_status FROM timesheets WHERE id = $1',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Timesheet not found' });
    }
    
    if (existing[0].ot_approval_status === 'Approved') {
      return res.status(400).json({ message: 'Cannot reject approved OT' });
    }
    
    const { rows } = await db.query(
      `UPDATE timesheets 
       SET ot_approval_status = 'Rejected',
           ot_justification = COALESCE($1, ot_justification),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason || null, id]
    );
    
    return res.json({ timesheet: rows[0], message: 'Overtime rejected' });
  } catch (error) {
    console.error('Reject OT error', error);
    return res.status(500).json({ message: 'Failed to reject overtime', error: error.message });
  }
};

// Get timesheet statistics for dashboard
const getTimesheetStats = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Today's total OT hours
    const { rows: otRows } = await db.query(
      `SELECT COALESCE(SUM(overtime_hours), 0) AS total_ot
       FROM timesheets
       WHERE work_date = $1 AND ot_approval_status = 'Approved'`,
      [targetDate]
    );
    
    // Pending timesheet approvals
    const { rows: pendingRows } = await db.query(
      `SELECT COUNT(*) AS count
       FROM timesheets
       WHERE approval_status = 'Submitted'`,
    );
    
    // Pending OT approvals
    const { rows: pendingOTRows } = await db.query(
      `SELECT COUNT(*) AS count
       FROM timesheets
       WHERE ot_approval_status = 'Pending' AND overtime_hours > 0`,
    );
    
    return res.json({
      todayTotalOT: parseFloat(otRows[0].total_ot) || 0,
      pendingTimesheetApprovals: parseInt(pendingRows[0].count, 10) || 0,
      pendingOTApprovals: parseInt(pendingOTRows[0].count, 10) || 0,
    });
  } catch (error) {
    console.error('Get timesheet stats error', error);
    return res.status(500).json({ message: 'Failed to fetch timesheet statistics', error: error.message });
  }
};

// Get timesheet reports
const getTimesheetReports = async (req, res) => {
  try {
    const { type, staffId, projectId, startDate, endDate, month, year } = req.query;
    
    let query;
    let values = [];
    let paramIndex = 1;
    
    if (type === 'individual') {
      // Individual timesheet report
      query = `
        SELECT 
          t.*,
          e.name AS staff_name,
          e.email AS staff_email,
          p.name AS project_name
        FROM timesheets t
        JOIN employees e ON e.id = t.staff_id
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE 1=1
      `;
      
      if (staffId) {
        query += ` AND t.staff_id = $${paramIndex}`;
        values.push(staffId);
        paramIndex += 1;
      }
      
      if (startDate) {
        query += ` AND t.work_date >= $${paramIndex}`;
        values.push(startDate);
        paramIndex += 1;
      }
      
      if (endDate) {
        query += ` AND t.work_date <= $${paramIndex}`;
        values.push(endDate);
        paramIndex += 1;
      }
      
      query += ' ORDER BY t.work_date DESC';
      
    } else if (type === 'monthly_ot') {
      // Monthly OT summary
      const targetMonth = month ? parseInt(month, 10) : new Date().getMonth() + 1;
      const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
      
      query = `
        SELECT 
          e.id AS staff_id,
          e.name AS staff_name,
          e.email AS staff_email,
          SUM(t.overtime_hours) AS total_ot_hours,
          COUNT(*) AS ot_days
        FROM timesheets t
        JOIN employees e ON e.id = t.staff_id
        WHERE EXTRACT(MONTH FROM t.work_date) = $1
          AND EXTRACT(YEAR FROM t.work_date) = $2
          AND t.ot_approval_status = 'Approved'
          AND t.overtime_hours > 0
      `;
      
      values = [targetMonth, targetYear];
      paramIndex = 3;
      
      if (staffId) {
        query += ` AND t.staff_id = $${paramIndex}`;
        values.push(staffId);
        paramIndex += 1;
      }
      
      query += ' GROUP BY e.id, e.name, e.email ORDER BY total_ot_hours DESC';
      
    } else if (type === 'project_ot_cost') {
      // Project-wise OT cost report
      query = `
        SELECT 
          p.id AS project_id,
          p.name AS project_name,
          COUNT(DISTINCT t.staff_id) AS staff_count,
          SUM(t.overtime_hours) AS total_ot_hours,
          COUNT(*) AS ot_days
        FROM timesheets t
        JOIN projects p ON p.id = t.project_id
        WHERE t.ot_approval_status = 'Approved'
          AND t.overtime_hours > 0
      `;
      
      if (startDate) {
        query += ` AND t.work_date >= $${paramIndex}`;
        values.push(startDate);
        paramIndex += 1;
      }
      
      if (endDate) {
        query += ` AND t.work_date <= $${paramIndex}`;
        values.push(endDate);
        paramIndex += 1;
      }
      
      if (projectId) {
        query += ` AND t.project_id = $${paramIndex}`;
        values.push(projectId);
        paramIndex += 1;
      }
      
      query += ' GROUP BY p.id, p.name ORDER BY total_ot_hours DESC';
    } else {
      return res.status(400).json({ message: 'Invalid report type' });
    }
    
    const { rows } = await db.query(query, values);
    
    return res.json({ reports: rows });
  } catch (error) {
    console.error('Get timesheet reports error', error);
    return res.status(500).json({ message: 'Failed to fetch reports', error: error.message });
  }
};

module.exports = {
  getTimesheets,
  getTimesheetById,
  createTimesheet,
  updateTimesheet,
  submitTimesheet,
  approveTimesheet,
  rejectTimesheet,
  approveOT,
  rejectOT,
  getTimesheetStats,
  getTimesheetReports,
};

