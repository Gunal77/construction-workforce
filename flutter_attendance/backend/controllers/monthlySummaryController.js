const db = require('../config/db');
const { supabase } = require('../config/supabaseClient');
const emailService = require('../services/emailService');

/**
 * Filter financial fields from summary based on user role
 * Admin: full access to all financial fields
 * Supervisor: hide all payment and tax fields
 * Staff: no access to invoice or tax data
 */
function filterFinancialFields(summary, userRole) {
  if (!summary) return summary;

  // Admin has full access
  if (userRole === 'admin') {
    return summary;
  }

  // Supervisor: hide all payment and tax fields
  if (userRole === 'supervisor') {
    const filtered = { ...summary };
    delete filtered.subtotal;
    delete filtered.payment_type;
    delete filtered.tax_percentage;
    delete filtered.tax_amount;
    delete filtered.total_amount;
    delete filtered.invoice_number;
    return filtered;
  }

  // Staff: no access to invoice or tax data
  if (userRole === 'staff' || !userRole) {
    const filtered = { ...summary };
    delete filtered.subtotal;
    delete filtered.payment_type;
    delete filtered.tax_percentage;
    delete filtered.tax_amount;
    delete filtered.total_amount;
    delete filtered.invoice_number;
    return filtered;
  }

  // Default: hide financial fields for unknown roles
  const filtered = { ...summary };
  delete filtered.subtotal;
  delete filtered.payment_type;
  delete filtered.tax_percentage;
  delete filtered.tax_amount;
  delete filtered.total_amount;
  delete filtered.invoice_number;
  return filtered;
}

/**
 * Filter financial fields from array of summaries
 */
function filterFinancialFieldsFromArray(summaries, userRole) {
  if (!Array.isArray(summaries)) return summaries;
  return summaries.map(summary => filterFinancialFields(summary, userRole));
}

/**
 * Generate unique invoice number for a given month/year
 * Format: INV-YYYY-MM-#### (e.g., INV-2024-01-0001)
 */
async function generateInvoiceNumber(month, year) {
  // Get the highest invoice number for this month/year
  const result = await db.query(
    `SELECT invoice_number 
     FROM monthly_summaries 
     WHERE month = $1 AND year = $2 AND invoice_number IS NOT NULL
     ORDER BY invoice_number DESC 
     LIMIT 1`,
    [month, year]
  );

  let sequenceNumber = 1;
  
  if (result.rows.length > 0) {
    // Extract sequence number from existing invoice (e.g., INV-2024-01-0001 -> 1)
    const lastInvoice = result.rows[0].invoice_number;
    const match = lastInvoice.match(/INV-\d{4}-\d{2}-(\d+)$/);
    if (match) {
      sequenceNumber = parseInt(match[1], 10) + 1;
    }
  }

  // Format: INV-YYYY-MM-####
  const monthStr = String(month).padStart(2, '0');
  const sequenceStr = String(sequenceNumber).padStart(4, '0');
  return `INV-${year}-${monthStr}-${sequenceStr}`;
}

/**
 * Safely parse project_breakdown JSON
 * Handles null, empty strings, and already-parsed objects
 */
function parseProjectBreakdown(projectBreakdown) {
  if (!projectBreakdown) {
    return [];
  }
  if (typeof projectBreakdown === 'object') {
    return projectBreakdown;
  }
  if (typeof projectBreakdown === 'string') {
    try {
      const parsed = JSON.parse(projectBreakdown);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error parsing project_breakdown:', error);
      return [];
    }
  }
  return [];
}

/**
 * Generate monthly summary for a single employee (helper function)
 * This is extracted for reuse in bulk generation
 * @param {string} employeeId - Employee ID
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @param {string} adminId - Admin ID creating the summary
 * @param {number} [taxPercentage] - Optional tax percentage (defaults to 0 or env var)
 */
async function generateSummaryForEmployee(employeeId, month, year, adminId, taxPercentage = null) {
  // Get employee email and payment info to find user_id
  const employeeResult = await db.query(
    `SELECT email, payment_type, hourly_rate, daily_rate, monthly_rate, contract_rate FROM employees WHERE id = $1`,
    [employeeId]
  );

  if (employeeResult.rows.length === 0) {
    throw new Error('Employee not found');
  }

  const employee = employeeResult.rows[0];
  const employeeEmail = employee.email;
  if (!employeeEmail) {
    throw new Error('Employee email not found');
  }
  
  const paymentType = employee.payment_type;
  const hourlyRate = employee.hourly_rate ? parseFloat(employee.hourly_rate) : null;
  const dailyRate = employee.daily_rate ? parseFloat(employee.daily_rate) : null;
  const monthlyRate = employee.monthly_rate ? parseFloat(employee.monthly_rate) : null;
  const contractRate = employee.contract_rate ? parseFloat(employee.contract_rate) : null;

  // Get user_id from users table
  const userResult = await db.query(
    `SELECT id FROM users WHERE email = $1`,
    [employeeEmail]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found for employee');
  }

  const userId = userResult.rows[0].id;

  // Calculate date range for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // 1. Calculate total working days (days with check-in)
  const attendanceResult = await db.query(
    `SELECT COUNT(DISTINCT DATE(check_in_time)) as working_days
     FROM attendance_logs
     WHERE user_id = $1 
       AND DATE(check_in_time) >= $2 
       AND DATE(check_in_time) <= $3`,
    [userId, startDateStr, endDateStr]
  );
  const totalWorkingDays = parseInt(attendanceResult.rows[0]?.working_days || 0);

  // 2. Calculate total worked hours from timesheets
  const timesheetsResult = await db.query(
    `SELECT 
       COALESCE(SUM(total_hours), 0) as total_hours,
       COALESCE(SUM(CASE WHEN ot_approval_status = 'Approved' THEN overtime_hours ELSE 0 END), 0) as ot_hours
     FROM timesheets
     WHERE staff_id = $1 
       AND work_date >= $2 
       AND work_date <= $3
       AND approval_status = 'Approved'`,
    [employeeId, startDateStr, endDateStr]
  );
  const totalWorkedHours = parseFloat(timesheetsResult.rows[0]?.total_hours || 0);
  const totalOtHours = parseFloat(timesheetsResult.rows[0]?.ot_hours || 0);

  // 3. Calculate approved leaves
  const leaveResult = await db.query(
    `SELECT COALESCE(SUM(number_of_days), 0) as total_leaves
     FROM leave_requests
     WHERE employee_id = $1 
       AND status = 'approved'
       AND (
         (start_date >= $2 AND start_date <= $3) OR
         (end_date >= $2 AND end_date <= $3) OR
         (start_date <= $2 AND end_date >= $3)
       )`,
    [employeeId, startDateStr, endDateStr]
  );
  const approvedLeaves = parseFloat(leaveResult.rows[0]?.total_leaves || 0);

  // 4. Calculate absent days
  const daysInMonth = endDate.getDate();
  let weekendDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendDays++;
    }
  }
  const workingDaysInMonth = daysInMonth - weekendDays;
  const absentDays = Math.max(0, workingDaysInMonth - totalWorkingDays - Math.floor(approvedLeaves));

  // 5. Calculate project-wise breakdown
  const projectBreakdownResult = await db.query(
    `SELECT 
       p.id as project_id,
       p.name as project_name,
       COUNT(DISTINCT t.work_date) as days_worked,
       COALESCE(SUM(t.total_hours), 0) as total_hours,
       COALESCE(SUM(CASE WHEN t.ot_approval_status = 'Approved' THEN t.overtime_hours ELSE 0 END), 0) as ot_hours
     FROM timesheets t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.staff_id = $1 
       AND t.work_date >= $2 
       AND t.work_date <= $3
       AND t.approval_status = 'Approved'
     GROUP BY p.id, p.name
     ORDER BY total_hours DESC`,
    [employeeId, startDateStr, endDateStr]
  );

  const projectBreakdown = projectBreakdownResult.rows.map(row => ({
    project_id: row.project_id,
    project_name: row.project_name || 'Unassigned',
    days_worked: parseInt(row.days_worked || 0),
    total_hours: parseFloat(row.total_hours || 0),
    ot_hours: parseFloat(row.ot_hours || 0),
  }));

  // Calculate subtotal based on payment type
  let subtotal = 0;
  if (paymentType === 'hourly' && hourlyRate !== null) {
    // For hourly: (total_worked_hours * hourly_rate) + (ot_hours * hourly_rate * 1.5)
    subtotal = (totalWorkedHours * hourlyRate) + (totalOtHours * hourlyRate * 1.5);
  } else if (paymentType === 'daily' && dailyRate !== null) {
    // For daily: total_working_days * daily_rate
    subtotal = totalWorkingDays * dailyRate;
  } else if (paymentType === 'monthly' && monthlyRate !== null) {
    // For monthly: monthly_rate (pro-rated if needed, but typically full month)
    // Calculate working days in month for pro-rating
    const daysInMonth = endDate.getDate();
    let weekendDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendDays++;
      }
    }
    const workingDaysInMonth = daysInMonth - weekendDays;
    // Pro-rate based on actual working days vs expected working days
    const proratedRate = workingDaysInMonth > 0 ? (totalWorkingDays / workingDaysInMonth) * monthlyRate : 0;
    subtotal = proratedRate;
  } else if (paymentType === 'contract' && contractRate !== null) {
    // For contract: contract_rate (fixed amount)
    subtotal = contractRate;
  }
  // If payment_type is null or rate is null, subtotal remains 0 (backward compatible)

  // Calculate tax (use decimals, no rounding until final total)
  // Use provided taxPercentage or default from env var or 0
  const finalTaxPercentage = taxPercentage !== null && taxPercentage !== undefined 
    ? parseFloat(taxPercentage) 
    : parseFloat(process.env.DEFAULT_TAX_PERCENTAGE || '0');
  
  // Calculate tax amount using decimal precision (no rounding)
  const taxAmount = subtotal > 0 ? (subtotal * finalTaxPercentage / 100) : 0;
  
  // Calculate total amount - round only at the end
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

  // Generate invoice number only if subtotal > 0
  let invoiceNumber = null;
  if (subtotal > 0) {
    invoiceNumber = await generateInvoiceNumber(month, year);
  }

  // Insert or update monthly summary
  const summaryResult = await db.query(
    `INSERT INTO monthly_summaries (
      employee_id, month, year,
      total_working_days, total_worked_hours, total_ot_hours,
      approved_leaves, absent_days, project_breakdown,
      subtotal, tax_percentage, tax_amount, total_amount, invoice_number,
      status, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'DRAFT', $15)
    ON CONFLICT (employee_id, month, year) 
    DO UPDATE SET
      total_working_days = EXCLUDED.total_working_days,
      total_worked_hours = EXCLUDED.total_worked_hours,
      total_ot_hours = EXCLUDED.total_ot_hours,
      approved_leaves = EXCLUDED.approved_leaves,
      absent_days = EXCLUDED.absent_days,
      project_breakdown = EXCLUDED.project_breakdown,
      subtotal = EXCLUDED.subtotal,
      tax_percentage = EXCLUDED.tax_percentage,
      tax_amount = EXCLUDED.tax_amount,
      total_amount = EXCLUDED.total_amount,
      invoice_number = CASE 
        WHEN EXCLUDED.invoice_number IS NOT NULL THEN EXCLUDED.invoice_number
        WHEN monthly_summaries.invoice_number IS NULL AND EXCLUDED.subtotal > 0 THEN EXCLUDED.invoice_number
        ELSE monthly_summaries.invoice_number
      END,
      status = CASE 
        WHEN monthly_summaries.status = 'APPROVED' THEN 'APPROVED'
        ELSE 'DRAFT'
      END,
      updated_at = NOW()
    RETURNING *`,
    [
      employeeId, month, year,
      totalWorkingDays, totalWorkedHours, totalOtHours,
      approvedLeaves, absentDays, JSON.stringify(projectBreakdown),
      subtotal, finalTaxPercentage, taxAmount, totalAmount, invoiceNumber,
      adminId
    ]
  );

  const summary = summaryResult.rows[0];
  summary.project_breakdown = parseProjectBreakdown(summary.project_breakdown);

  return summary;
}

/**
 * Generate monthly summary for an employee
 * Calculates totals from attendance, timesheets, OT, and leave data
 */
const generateMonthlySummary = async (req, res) => {
  try {
    const { employeeId, month, year, tax_percentage } = req.body;
    const adminId = req.user?.id; // Admin creating the summary

    if (!employeeId || !month || !year) {
      return res.status(400).json({ 
        message: 'employeeId, month, and year are required' 
      });
    }

    // Validate month and year
    if (month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month. Must be 1-12' });
    }
    if (year < 2020 || year > 2100) {
      return res.status(400).json({ message: 'Invalid year' });
    }

    // Validate tax_percentage if provided
    if (tax_percentage !== undefined && tax_percentage !== null) {
      const taxPercent = parseFloat(tax_percentage);
      if (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100) {
        return res.status(400).json({ message: 'Invalid tax_percentage. Must be between 0 and 100' });
      }
    }

    // Check if summary already exists
    const existingCheck = await db.query(
      `SELECT id, status FROM monthly_summaries 
       WHERE employee_id = $1 AND month = $2 AND year = $3`,
      [employeeId, month, year]
    );

    if (existingCheck.rows.length > 0) {
      const existing = existingCheck.rows[0];
      if (existing.status === 'APPROVED') {
        return res.status(400).json({ 
          message: 'Monthly summary already approved. Cannot regenerate.' 
        });
      }
      // If DRAFT or REJECTED, we can regenerate
    }

    // Generate summary using helper function
    const summary = await generateSummaryForEmployee(employeeId, month, year, adminId, tax_percentage);

    return res.status(201).json({
      message: 'Monthly summary generated successfully',
      summary
    });
  } catch (error) {
    console.error('Error generating monthly summary:', error);
    return res.status(500).json({ 
      message: 'Failed to generate monthly summary',
      error: error.message 
    });
  }
};

/**
 * Generate monthly summaries for all staff
 */
const generateMonthlySummariesForAllStaff = async (req, res) => {
  try {
    const { month, year, tax_percentage } = req.body;
    const adminId = req.user?.id; // Admin creating the summaries

    if (!month || !year) {
      return res.status(400).json({ 
        message: 'month and year are required' 
      });
    }

    // Validate month and year
    if (month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month. Must be 1-12' });
    }
    if (year < 2020 || year > 2100) {
      return res.status(400).json({ message: 'Invalid year' });
    }

    // Validate tax_percentage if provided
    if (tax_percentage !== undefined && tax_percentage !== null) {
      const taxPercent = parseFloat(tax_percentage);
      if (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100) {
        return res.status(400).json({ message: 'Invalid tax_percentage. Must be between 0 and 100' });
      }
    }

    // Get all employees
    const employeesResult = await db.query(
      `SELECT id, name, email FROM employees WHERE email IS NOT NULL`
    );

    if (employeesResult.rows.length === 0) {
      return res.status(404).json({ message: 'No employees found' });
    }

    const employees = employeesResult.rows;
    const results = {
      total: employees.length,
      success: [],
      failed: [],
    };

    // Generate summary for each employee
    for (const employee of employees) {
      try {
        // Check if summary already exists and is approved
        const existingCheck = await db.query(
          `SELECT id, status FROM monthly_summaries 
           WHERE employee_id = $1 AND month = $2 AND year = $3`,
          [employee.id, month, year]
        );

        if (existingCheck.rows.length > 0 && existingCheck.rows[0].status === 'APPROVED') {
          results.failed.push({
            employee_id: employee.id,
            employee_name: employee.name,
            employee_email: employee.email,
            reason: 'Summary already approved. Cannot regenerate.',
          });
          continue;
        }

        // Generate summary
        const summary = await generateSummaryForEmployee(employee.id, month, year, adminId, tax_percentage);
        
        results.success.push({
          employee_id: employee.id,
          employee_name: employee.name,
          employee_email: employee.email,
          summary_id: summary.id,
        });
      } catch (error) {
        console.error(`Error generating summary for ${employee.name} (${employee.email}):`, error);
        results.failed.push({
          employee_id: employee.id,
          employee_name: employee.name,
          employee_email: employee.email,
          reason: error.message || 'Failed to generate summary',
        });
      }
    }

    return res.json({
      message: `Generated monthly summaries for ${results.success.length} out of ${results.total} employees`,
      results,
    });
  } catch (error) {
    console.error('Error generating monthly summaries for all staff:', error);
    return res.status(500).json({ 
      message: 'Failed to generate monthly summaries',
      error: error.message 
    });
  }
};

/**
 * Get monthly summaries (list view for admin)
 */
const getMonthlySummaries = async (req, res) => {
  try {
    const { employeeId, month, year, status } = req.query;
    // Get user role from req.user (set by auth middleware)
    const userRole = req.user?.role || req.admin?.role || 'admin';

    let query = `
      SELECT 
        ms.*,
        e.name as employee_name,
        e.email as employee_email,
        e.payment_type,
        ms.tax_percentage,
        ms.tax_amount,
        ms.total_amount,
        ms.invoice_number,
        u.id as user_id,
        a.name as admin_name,
        a.email as admin_email
      FROM monthly_summaries ms
      LEFT JOIN employees e ON e.id = ms.employee_id
      LEFT JOIN users u ON u.email = e.email
      LEFT JOIN admins a ON a.id = ms.admin_approved_by
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Add status filter if provided
    if (status) {
      query += ` AND ms.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (employeeId) {
      query += ` AND ms.employee_id = $${paramIndex}`;
      params.push(employeeId);
      paramIndex++;
    }

    if (month) {
      query += ` AND ms.month = $${paramIndex}`;
      params.push(parseInt(month));
      paramIndex++;
    }

    if (year) {
      query += ` AND ms.year = $${paramIndex}`;
      params.push(parseInt(year));
      paramIndex++;
    }

    query += ` ORDER BY ms.year DESC, ms.month DESC, e.name ASC`;

    const result = await db.query(query, params);

    const summaries = result.rows.map(row => ({
      ...row,
      project_breakdown: parseProjectBreakdown(row.project_breakdown),
    }));

    // Filter financial fields based on user role
    const filteredSummaries = filterFinancialFieldsFromArray(summaries, userRole);

    return res.json({ summaries: filteredSummaries });
  } catch (error) {
    console.error('Error fetching monthly summaries:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch monthly summaries',
      error: error.message 
    });
  }
};

/**
 * Get single monthly summary by ID
 */
const getMonthlySummaryById = async (req, res) => {
  try {
    const { id } = req.params;
    // Get user role from req.user (set by auth middleware)
    const userRole = req.user?.role || req.admin?.role || 'admin';

    const result = await db.query(
      `SELECT 
        ms.*,
        e.name as employee_name,
        e.email as employee_email,
        e.role as employee_role,
        e.payment_type,
        u.id as user_id,
        a.name as admin_name,
        a.email as admin_email,
        staff_user.email as staff_user_email
      FROM monthly_summaries ms
      LEFT JOIN employees e ON e.id = ms.employee_id
      LEFT JOIN users u ON u.email = e.email
      LEFT JOIN admins a ON a.id = ms.admin_approved_by
      LEFT JOIN users staff_user ON staff_user.id = ms.staff_signed_by
      WHERE ms.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Monthly summary not found' });
    }

    const summary = result.rows[0];
    summary.project_breakdown = parseProjectBreakdown(summary.project_breakdown);

    // Filter financial fields based on user role
    const filteredSummary = filterFinancialFields(summary, userRole);

    return res.json({ summary: filteredSummary });
  } catch (error) {
    console.error('Error fetching monthly summary:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch monthly summary',
      error: error.message 
    });
  }
};

/**
 * Staff sign-off on monthly summary
 */
const staffSignOff = async (req, res) => {
  try {
    const { id } = req.params;
    const { signature } = req.body; // Base64 encoded signature image
    const userId = req.user?.id;

    if (!signature) {
      return res.status(400).json({ message: 'Signature is required' });
    }

    // Get summary and verify it's in DRAFT status
    const summaryResult = await db.query(
      `SELECT ms.*, e.email as employee_email
       FROM monthly_summaries ms
       LEFT JOIN employees e ON e.id = ms.employee_id
       WHERE ms.id = $1`,
      [id]
    );

    if (summaryResult.rows.length === 0) {
      return res.status(404).json({ message: 'Monthly summary not found' });
    }

    const summary = summaryResult.rows[0];

    // Verify user is the employee
    const userResult = await db.query(
      `SELECT email FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].email !== summary.employee_email) {
      return res.status(403).json({ message: 'Unauthorized. You can only sign your own summary.' });
    }

    // Staff can sign if status is DRAFT or REJECTED (to allow re-signing after rejection)
    if (summary.status !== 'DRAFT' && summary.status !== 'REJECTED') {
      return res.status(400).json({ 
        message: `Cannot sign summary. Current status: ${summary.status}. Only DRAFT or REJECTED summaries can be signed.` 
      });
    }
    
    // If status is REJECTED, change to SIGNED_BY_STAFF after signing
    // If status is DRAFT, change to SIGNED_BY_STAFF after signing

    // Update summary with staff signature
    // If status is REJECTED, change to SIGNED_BY_STAFF (re-signing after rejection)
    // If status is DRAFT, change to SIGNED_BY_STAFF (first time signing)
    const updateResult = await db.query(
      `UPDATE monthly_summaries
       SET 
         staff_signature = $1,
         staff_signed_at = NOW(),
         staff_signed_by = $2,
         status = 'SIGNED_BY_STAFF',
         updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [signature, userId, id]
    );

    const updatedSummary = updateResult.rows[0];
    updatedSummary.project_breakdown = parseProjectBreakdown(updatedSummary.project_breakdown);

    // Send email notification to admin (async, don't wait)
    (async () => {
      try {
        // Get employee details
        const { rows: empRows } = await db.query(
          'SELECT name, email FROM employees WHERE id = $1',
          [updatedSummary.employee_id]
        );
        
        if (empRows.length > 0) {
          const employee = empRows[0];
          await emailService.sendMonthlySummarySignNotification(updatedSummary, employee);
        }
      } catch (emailError) {
        console.error('Failed to send monthly summary sign email notification:', emailError);
        // Don't fail the request if email fails
      }
    })();

    return res.json({
      message: 'Monthly summary signed successfully',
      summary: updatedSummary
    });
  } catch (error) {
    console.error('Error in staff sign-off:', error);
    return res.status(500).json({ 
      message: 'Failed to sign monthly summary',
      error: error.message 
    });
  }
};

/**
 * Admin approval/rejection of monthly summary
 */
const adminApproveReject = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, signature, remarks } = req.body; // action: 'approve' or 'reject'
    const adminId = req.user?.id;

    if (!action || !['approve', 'reject'].includes(action.toLowerCase())) {
      return res.status(400).json({ message: 'Action must be "approve" or "reject"' });
    }

    const isApprove = action.toLowerCase() === 'approve';
    
    // Only approve requires signature, reject only needs remarks
    if (isApprove && !signature) {
      return res.status(400).json({ message: 'Admin signature is required for approval' });
    }
    
    if (!isApprove && !remarks) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    // Get summary and verify it's in SIGNED_BY_STAFF status
    const summaryResult = await db.query(
      `SELECT * FROM monthly_summaries WHERE id = $1`,
      [id]
    );

    if (summaryResult.rows.length === 0) {
      return res.status(404).json({ message: 'Monthly summary not found' });
    }

    const summary = summaryResult.rows[0];

    if (summary.status !== 'SIGNED_BY_STAFF') {
      return res.status(400).json({ 
        message: `Cannot ${action} summary. Current status: ${summary.status}` 
      });
    }

    const newStatus = isApprove ? 'APPROVED' : 'REJECTED'; // Reject sets status to REJECTED, staff can re-sign

    // Update summary with admin signature and status
    let updateResult;
    if (isApprove) {
      updateResult = await db.query(
        `UPDATE monthly_summaries
         SET 
           admin_signature = $1,
           admin_approved_at = NOW(),
           admin_approved_by = $2,
           admin_remarks = $3,
           status = $4,
           updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [signature, adminId, remarks || null, newStatus, id]
      );
    } else {
      // For rejection, set status to REJECTED with remarks
      // No signature required for rejection, but save rejected_at timestamp
      updateResult = await db.query(
        `UPDATE monthly_summaries
         SET 
           admin_signature = NULL,
           admin_approved_at = NOW(), -- Save rejection timestamp
           admin_approved_by = $1, -- Save admin who rejected
           admin_remarks = $2,
           status = $3,
           updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [adminId, remarks, newStatus, id]
      );
    }

    const updatedSummary = updateResult.rows[0];
    updatedSummary.project_breakdown = parseProjectBreakdown(updatedSummary.project_breakdown);

    // Send email notification to staff (async, don't wait)
    (async () => {
      try {
        // Get employee and admin details
        const { rows: empRows } = await db.query(
          'SELECT name, email FROM employees WHERE id = $1',
          [updatedSummary.employee_id]
        );
        const { rows: adminRows } = await db.query(
          'SELECT name, email FROM admins WHERE id = $1',
          [adminId]
        );
        
        if (empRows.length > 0) {
          const employee = empRows[0];
          const adminName = adminRows[0]?.name || 'Administrator';
          
          await emailService.sendMonthlySummaryStatusNotification(
            updatedSummary,
            employee,
            newStatus,
            adminName,
            updatedSummary.admin_remarks
          );
        }
      } catch (emailError) {
        console.error('Failed to send monthly summary status email notification:', emailError);
        // Don't fail the request if email fails
      }
    })();

    return res.json({
      message: `Monthly summary ${action}d successfully`,
      summary: updatedSummary
    });
  } catch (error) {
    console.error('Error in admin approval/rejection:', error);
    return res.status(500).json({ 
      message: `Failed to ${req.body.action} monthly summary`,
      error: error.message 
    });
  }
};

/**
 * Get monthly summaries for staff (mobile app)
 */
const getStaffMonthlySummaries = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { month, year } = req.query;

    // Get employee email from user
    const userResult = await db.query(
      `SELECT email FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userEmail = userResult.rows[0].email;

    // Get employee ID
    const employeeResult = await db.query(
      `SELECT id FROM employees WHERE email = $1`,
      [userEmail]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const employeeId = employeeResult.rows[0].id;

    let query = `
      SELECT ms.*
      FROM monthly_summaries ms
      WHERE ms.employee_id = $1
    `;
    const params = [employeeId];
    let paramIndex = 2;

    if (month) {
      query += ` AND ms.month = $${paramIndex}`;
      params.push(parseInt(month));
      paramIndex++;
    }

    if (year) {
      query += ` AND ms.year = $${paramIndex}`;
      params.push(parseInt(year));
      paramIndex++;
    }

    query += ` ORDER BY ms.year DESC, ms.month DESC`;

    const result = await db.query(query, params);

    const summaries = result.rows.map(row => ({
      ...row,
      project_breakdown: parseProjectBreakdown(row.project_breakdown),
    }));

    return res.json({ summaries });
  } catch (error) {
    console.error('Error fetching staff monthly summaries:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch monthly summaries',
      error: error.message 
    });
  }
};

/**
 * Bulk approve monthly summaries
 */
const bulkApproveMonthlySummaries = async (req, res) => {
  try {
    const { summaryIds, signature, remarks } = req.body;
    const adminId = req.user?.id;

    if (!summaryIds || !Array.isArray(summaryIds) || summaryIds.length === 0) {
      return res.status(400).json({ message: 'Summary IDs array is required' });
    }

    if (!signature) {
      return res.status(400).json({ message: 'Admin signature is required for bulk approval' });
    }

    // Validate all summaries exist and are SIGNED_BY_STAFF
    const { rows: existingSummaries } = await db.query(
      `SELECT id, status, employee_id FROM monthly_summaries WHERE id = ANY($1::uuid[])`,
      [summaryIds]
    );

    if (existingSummaries.length !== summaryIds.length) {
      return res.status(400).json({ message: 'One or more monthly summaries not found' });
    }

    // Check all are SIGNED_BY_STAFF
    const nonSignedSummaries = existingSummaries.filter(s => s.status !== 'SIGNED_BY_STAFF');
    if (nonSignedSummaries.length > 0) {
      return res.status(400).json({ 
        message: `Cannot approve ${nonSignedSummaries.length} summary/summaries that are not signed by staff` 
      });
    }

    // Bulk update all summaries
    const updateResult = await db.query(
      `UPDATE monthly_summaries 
       SET 
         admin_signature = $1,
         admin_approved_at = NOW(),
         admin_approved_by = $2,
         admin_remarks = $3,
         status = 'APPROVED',
         updated_at = NOW()
       WHERE id = ANY($4::uuid[]) AND status = 'SIGNED_BY_STAFF'
       RETURNING *`,
      [signature, adminId, remarks || null, summaryIds]
    );

    const approvedSummaries = updateResult.rows;

    // Send email notifications (async, don't wait)
    (async () => {
      for (const summary of approvedSummaries) {
        try {
          // Get employee details
          const { rows: empRows } = await db.query(
            'SELECT name, email FROM employees WHERE id = $1',
            [summary.employee_id]
          );
          const { rows: adminRows } = await db.query(
            'SELECT name, email FROM admins WHERE id = $1',
            [adminId]
          );
          
          if (empRows.length > 0) {
            const employee = empRows[0];
            const adminName = adminRows[0]?.name || 'Administrator';
            
            await emailService.sendMonthlySummaryStatusNotification(
              summary,
              employee,
              'APPROVED',
              adminName,
              remarks || null
            );
          }
        } catch (emailError) {
          console.error(`Failed to send email notification for summary ${summary.id}:`, emailError);
          // Don't fail the bulk operation if email fails
        }
      }
    })();

    return res.json({
      message: `${approvedSummaries.length} monthly summary/summaries approved successfully`,
      approvedCount: approvedSummaries.length,
      summaries: approvedSummaries,
    });
  } catch (error) {
    console.error('Bulk approve monthly summaries error', error);
    return res.status(500).json({ 
      message: 'Failed to bulk approve monthly summaries',
      error: error.message 
    });
  }
};

module.exports = {
  generateMonthlySummary,
  generateMonthlySummariesForAllStaff,
  getMonthlySummaries,
  getMonthlySummaryById,
  staffSignOff,
  adminApproveReject,
  bulkApproveMonthlySummaries,
  getStaffMonthlySummaries,
};

