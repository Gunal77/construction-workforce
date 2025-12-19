const pdfExportService = require('../services/pdfExportService');
const excelExportService = require('../services/excelExportService');
const db = require('../config/db');

/**
 * Export Monthly Summary as PDF
 */
const exportMonthlySummaryPDF = async (req, res) => {
  try {
    const { id } = req.params;

    const pdfBuffer = await pdfExportService.generateMonthlySummaryPDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="monthly-summary-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exporting monthly summary PDF:', error);
    return res.status(500).json({
      message: 'Failed to export monthly summary PDF',
      error: error.message,
    });
  }
};

/**
 * Export Monthly Summary as Excel
 */
const exportMonthlySummaryExcel = async (req, res) => {
  try {
    const { id } = req.params;

    const excelBuffer = await excelExportService.generateMonthlySummaryExcel(id);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="monthly-summary-${id}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error exporting monthly summary Excel:', error);
    return res.status(500).json({
      message: 'Failed to export monthly summary Excel',
      error: error.message,
    });
  }
};

/**
 * Export Attendance Report as PDF
 */
const exportAttendanceReportPDF = async (req, res) => {
  try {
    const filters = req.query;
    
    // Build query similar to getAllAttendance
    const { conditions, values } = buildAdminFilters(filters);
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        al.id,
        al.user_id,
        al.check_in_time,
        al.check_out_time,
        u.email AS user_email,
        e.name AS employee_name
      FROM attendance_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN employees e ON e.email = u.email
      ${whereClause}
      ORDER BY al.check_in_time DESC
    `;

    const { rows } = await db.query(query, values);

    const pdfBuffer = await pdfExportService.generateAttendanceReportPDF(rows, filters);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${Date.now()}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exporting attendance report PDF:', error);
    return res.status(500).json({
      message: 'Failed to export attendance report PDF',
      error: error.message,
    });
  }
};

/**
 * Export Attendance Report as Excel
 */
const exportAttendanceReportExcel = async (req, res) => {
  try {
    const filters = req.query;
    
    // Build query similar to getAllAttendance
    const { conditions, values } = buildAdminFilters(filters);
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        al.id,
        al.user_id,
        al.check_in_time,
        al.check_out_time,
        u.email AS user_email,
        e.name AS employee_name
      FROM attendance_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN employees e ON e.email = u.email
      ${whereClause}
      ORDER BY al.check_in_time DESC
    `;

    const { rows } = await db.query(query, values);

    const excelBuffer = await excelExportService.generateAttendanceReportExcel(rows, filters);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${Date.now()}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error exporting attendance report Excel:', error);
    return res.status(500).json({
      message: 'Failed to export attendance report Excel',
      error: error.message,
    });
  }
};

/**
 * Export Leave Report as PDF
 */
const exportLeaveReportPDF = async (req, res) => {
  try {
    const filters = req.query;
    
    let query = `
      SELECT 
        lr.*,
        e.name as employee_name,
        lt.name as leave_type_name,
        a.name as approved_by_name
      FROM leave_requests lr
      LEFT JOIN employees e ON e.id = lr.employee_id
      LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
      LEFT JOIN admins a ON a.id = lr.approved_by
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND lr.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.year) {
      query += ` AND EXTRACT(YEAR FROM lr.start_date) = $${paramIndex}`;
      params.push(parseInt(filters.year));
      paramIndex++;
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND lr.start_date >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
      query += ` AND lr.end_date <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    query += ` ORDER BY lr.start_date DESC`;

    const { rows } = await db.query(query, params);

    const pdfBuffer = await pdfExportService.generateLeaveReportPDF(rows, filters);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="leave-report-${Date.now()}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exporting leave report PDF:', error);
    return res.status(500).json({
      message: 'Failed to export leave report PDF',
      error: error.message,
    });
  }
};

/**
 * Export Leave Report as Excel
 */
const exportLeaveReportExcel = async (req, res) => {
  try {
    const filters = req.query;
    
    let query = `
      SELECT 
        lr.*,
        e.name as employee_name,
        lt.name as leave_type_name,
        a.name as approved_by_name
      FROM leave_requests lr
      LEFT JOIN employees e ON e.id = lr.employee_id
      LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
      LEFT JOIN admins a ON a.id = lr.approved_by
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND lr.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.year) {
      query += ` AND EXTRACT(YEAR FROM lr.start_date) = $${paramIndex}`;
      params.push(parseInt(filters.year));
      paramIndex++;
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND lr.start_date >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
      query += ` AND lr.end_date <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    query += ` ORDER BY lr.start_date DESC`;

    const { rows } = await db.query(query, params);

    const excelBuffer = await excelExportService.generateLeaveReportExcel(rows, filters);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="leave-report-${Date.now()}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error exporting leave report Excel:', error);
    return res.status(500).json({
      message: 'Failed to export leave report Excel',
      error: error.message,
    });
  }
};

/**
 * Helper function to build admin filters (reused from attendanceController)
 */
function buildAdminFilters(query) {
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (query.user) {
    conditions.push(`LOWER(u.email) = LOWER($${paramIndex})`);
    values.push(query.user.trim().toLowerCase());
    paramIndex += 1;
  }

  if (query.from && query.to) {
    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);
    if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];
      conditions.push(`DATE(al.check_in_time AT TIME ZONE 'UTC') >= $${paramIndex}`);
      values.push(fromDateStr);
      paramIndex += 1;
      conditions.push(`DATE(al.check_in_time AT TIME ZONE 'UTC') <= $${paramIndex}`);
      values.push(toDateStr);
      paramIndex += 1;
    }
  } else if (query.date) {
    const selectedDate = new Date(query.date);
    if (!Number.isNaN(selectedDate.getTime())) {
      conditions.push(`DATE(al.check_in_time AT TIME ZONE 'UTC') = $${paramIndex}`);
      values.push(selectedDate.toISOString().split('T')[0]);
      paramIndex += 1;
    }
  }

  if (query.month) {
    const monthValue = Number.parseInt(query.month, 10);
    if (!Number.isNaN(monthValue)) {
      conditions.push(`EXTRACT(MONTH FROM al.check_in_time) = $${paramIndex}`);
      values.push(monthValue);
      paramIndex += 1;
    }
  }

  if (query.year) {
    const yearValue = Number.parseInt(query.year, 10);
    if (!Number.isNaN(yearValue)) {
      conditions.push(`EXTRACT(YEAR FROM al.check_in_time) = $${paramIndex}`);
      values.push(yearValue);
      paramIndex += 1;
    }
  }

  return { conditions, values };
}

/**
 * Export Timesheet Report as PDF
 */
const exportTimesheetReportPDF = async (req, res) => {
  try {
    const filters = req.query;
    
    // Use the same query logic as getTimesheets
    const { staffId, projectId, status, approvalStatus, startDate, endDate } = filters;
    
    let query = `
      SELECT 
        t.*,
        e.name AS staff_name,
        e.email AS staff_email,
        e.role AS staff_role,
        p.name AS project_name,
        a.name AS approved_by_name
      FROM timesheets t
      JOIN employees e ON e.id = t.staff_id
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN admins a ON a.id = t.approved_by
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
    
    query += ' ORDER BY t.work_date DESC, t.created_at DESC';

    const { rows } = await db.query(query, values);

    const pdfBuffer = await pdfExportService.generateTimesheetReportPDF(rows, filters);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="timesheet-report-${Date.now()}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exporting timesheet report PDF:', error);
    return res.status(500).json({
      message: 'Failed to export timesheet report PDF',
      error: error.message,
    });
  }
};

/**
 * Export Timesheet Report as Excel
 */
const exportTimesheetReportExcel = async (req, res) => {
  try {
    const filters = req.query;
    
    // Use the same query logic as getTimesheets
    const { staffId, projectId, status, approvalStatus, startDate, endDate } = filters;
    
    let query = `
      SELECT 
        t.*,
        e.name AS staff_name,
        e.email AS staff_email,
        e.role AS staff_role,
        p.name AS project_name,
        a.name AS approved_by_name
      FROM timesheets t
      JOIN employees e ON e.id = t.staff_id
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN admins a ON a.id = t.approved_by
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
    
    query += ' ORDER BY t.work_date DESC, t.created_at DESC';

    const { rows } = await db.query(query, values);

    const excelBuffer = await excelExportService.generateTimesheetReportExcel(rows, filters);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="timesheet-report-${Date.now()}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error exporting timesheet report Excel:', error);
    return res.status(500).json({
      message: 'Failed to export timesheet report Excel',
      error: error.message,
    });
  }
};

module.exports = {
  exportMonthlySummaryPDF,
  exportMonthlySummaryExcel,
  exportAttendanceReportPDF,
  exportAttendanceReportExcel,
  exportLeaveReportPDF,
  exportLeaveReportExcel,
  exportTimesheetReportPDF,
  exportTimesheetReportExcel,
};

