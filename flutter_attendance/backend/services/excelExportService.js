const ExcelJS = require('exceljs');
const db = require('../config/db');

/**
 * Generate Excel for Monthly Summary
 */
async function generateMonthlySummaryExcel(summaryId) {
  try {
    // Fetch summary with all related data
    const result = await db.query(
      `SELECT 
        ms.*,
        e.name as employee_name,
        e.email as employee_email,
        e.role as employee_role,
        a.name as admin_name,
        a.email as admin_email,
        p.name as project_name,
        c.name as client_name
      FROM monthly_summaries ms
      LEFT JOIN employees e ON e.id = ms.employee_id
      LEFT JOIN admins a ON a.id = ms.admin_approved_by
      LEFT JOIN projects p ON p.id = e.project_id
      LEFT JOIN users c ON c.id = p.client_user_id
      WHERE ms.id = $1 AND ms.status = 'APPROVED'`,
      [summaryId]
    );

    if (result.rows.length === 0) {
      throw new Error('Monthly summary not found or not approved');
    }

    const summary = result.rows[0];
    
    // Parse project_breakdown JSON
    let projectBreakdown = [];
    if (summary.project_breakdown) {
      try {
        if (typeof summary.project_breakdown === 'string') {
          projectBreakdown = JSON.parse(summary.project_breakdown);
        } else if (Array.isArray(summary.project_breakdown)) {
          projectBreakdown = summary.project_breakdown;
        }
      } catch (e) {
        console.error('Error parsing project_breakdown:', e);
      }
    }
    summary.project_breakdown = projectBreakdown;
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Monthly Summary');

    // Header
    worksheet.mergeCells('A1:D1');
    worksheet.getCell('A1').value = 'Monthly Summary Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    
    worksheet.getCell('A2').value = `Generated: ${new Date().toLocaleDateString()}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };
    worksheet.getRow(2).height = 20;

    // Employee Information
    let row = 4;
    worksheet.getCell(`A${row}`).value = 'Employee Information';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;

    worksheet.getCell(`A${row}`).value = 'Name:';
    worksheet.getCell(`B${row}`).value = summary.employee_name || 'N/A';
    row++;
    worksheet.getCell(`A${row}`).value = 'Email:';
    worksheet.getCell(`B${row}`).value = summary.employee_email || 'N/A';
    row++;
    worksheet.getCell(`A${row}`).value = 'Employee ID:';
    worksheet.getCell(`B${row}`).value = summary.employee_id || 'N/A';
    row++;
    if (summary.client_name) {
      worksheet.getCell(`A${row}`).value = 'Client:';
      worksheet.getCell(`B${row}`).value = summary.client_name;
      row++;
    }
    if (summary.project_name) {
      worksheet.getCell(`A${row}`).value = 'Project:';
      worksheet.getCell(`B${row}`).value = summary.project_name;
      row++;
    }

    // Period
    row++;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    worksheet.getCell(`A${row}`).value = 'Period';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;
    worksheet.getCell(`A${row}`).value = 'Month:';
    worksheet.getCell(`B${row}`).value = monthNames[summary.month - 1] || summary.month;
    row++;
    worksheet.getCell(`A${row}`).value = 'Year:';
    worksheet.getCell(`B${row}`).value = summary.year;
    row++;

    // Summary Metrics
    row++;
    worksheet.getCell(`A${row}`).value = 'Summary';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;
    worksheet.getCell(`A${row}`).value = 'Total Working Days:';
    worksheet.getCell(`B${row}`).value = summary.total_working_days || 0;
    row++;
    worksheet.getCell(`A${row}`).value = 'Total Worked Hours:';
    worksheet.getCell(`B${row}`).value = parseFloat(summary.total_worked_hours || 0).toFixed(2);
    row++;
    worksheet.getCell(`A${row}`).value = 'Total OT Hours:';
    worksheet.getCell(`B${row}`).value = parseFloat(summary.total_ot_hours || 0).toFixed(2);
    row++;
    worksheet.getCell(`A${row}`).value = 'Approved Leaves:';
    worksheet.getCell(`B${row}`).value = parseFloat(summary.approved_leaves || 0).toFixed(2);
    row++;
    worksheet.getCell(`A${row}`).value = 'Absent Days:';
    worksheet.getCell(`B${row}`).value = summary.absent_days || 0;
    row++;

    // Project Breakdown
    if (summary.project_breakdown && Array.isArray(summary.project_breakdown) && summary.project_breakdown.length > 0) {
      row += 2;
      worksheet.getCell(`A${row}`).value = 'Project Breakdown';
      worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
      row++;
      
      // Table header
      worksheet.getCell(`A${row}`).value = 'Project';
      worksheet.getCell(`B${row}`).value = 'Days';
      worksheet.getCell(`C${row}`).value = 'Hours';
      worksheet.getCell(`D${row}`).value = 'OT Hours';
      worksheet.getRow(row).font = { bold: true };
      row++;

      summary.project_breakdown.forEach(project => {
        worksheet.getCell(`A${row}`).value = project.project_name || 'N/A';
        worksheet.getCell(`B${row}`).value = project.days_worked || 0;
        worksheet.getCell(`C${row}`).value = parseFloat(project.total_hours || 0).toFixed(2);
        worksheet.getCell(`D${row}`).value = parseFloat(project.ot_hours || 0).toFixed(2);
        row++;
      });
    }

    // Signatures
    row += 2;
    worksheet.getCell(`A${row}`).value = 'Signatures';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;
    
    if (summary.staff_signature) {
      worksheet.getCell(`A${row}`).value = 'Staff Signature:';
      worksheet.getCell(`B${row}`).value = '✓ Signed';
      if (summary.staff_signed_at) {
        worksheet.getCell(`C${row}`).value = `Date: ${new Date(summary.staff_signed_at).toLocaleDateString()}`;
      }
      row++;
    }

    if (summary.admin_signature) {
      worksheet.getCell(`A${row}`).value = 'Admin Signature:';
      worksheet.getCell(`B${row}`).value = '✓ Approved';
      if (summary.admin_approved_at) {
        worksheet.getCell(`C${row}`).value = `Date: ${new Date(summary.admin_approved_at).toLocaleDateString()}`;
      }
      if (summary.admin_name) {
        worksheet.getCell(`D${row}`).value = `Approved by: ${summary.admin_name}`;
      }
      row++;
    }

    // Auto-size columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    throw error;
  }
}

/**
 * Generate Excel for Attendance Report
 */
async function generateAttendanceReportExcel(attendanceRecords, filters = {}) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    // Header
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'Attendance Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    
    if (filters.startDate && filters.endDate) {
      worksheet.getCell('A2').value = `Period: ${filters.startDate} to ${filters.endDate}`;
      worksheet.getCell('A2').alignment = { horizontal: 'center' };
    }
    worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleDateString()}`;
    worksheet.getCell('A3').alignment = { horizontal: 'center' };

    // Table header
    const headerRow = 5;
    worksheet.getCell(`A${headerRow}`).value = 'Date';
    worksheet.getCell(`B${headerRow}`).value = 'Employee';
    worksheet.getCell(`C${headerRow}`).value = 'Check-In Time';
    worksheet.getCell(`D${headerRow}`).value = 'Check-Out Time';
    worksheet.getCell(`E${headerRow}`).value = 'Working Hours';
    worksheet.getCell(`F${headerRow}`).value = 'Status';
    
    worksheet.getRow(headerRow).font = { bold: true };
    worksheet.getRow(headerRow).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Data rows
    let row = headerRow + 1;
    attendanceRecords.forEach(record => {
      const checkIn = record.check_in_time ? new Date(record.check_in_time) : null;
      const checkOut = record.check_out_time ? new Date(record.check_out_time) : null;
      
      let hours = 0;
      if (checkIn && checkOut) {
        hours = (checkOut - checkIn) / (1000 * 60 * 60);
      }

      worksheet.getCell(`A${row}`).value = checkIn ? checkIn : null;
      if (checkIn) {
        worksheet.getCell(`A${row}`).numFmt = 'mm/dd/yyyy';
      }
      worksheet.getCell(`B${row}`).value = record.employee_name || record.user_email || 'N/A';
      worksheet.getCell(`C${row}`).value = checkIn ? checkIn : null;
      if (checkIn) {
        worksheet.getCell(`C${row}`).numFmt = 'hh:mm:ss AM/PM';
      }
      worksheet.getCell(`D${row}`).value = checkOut ? checkOut : null;
      if (checkOut) {
        worksheet.getCell(`D${row}`).numFmt = 'hh:mm:ss AM/PM';
      }
      worksheet.getCell(`E${row}`).value = hours > 0 ? hours.toFixed(2) : 'N/A';
      worksheet.getCell(`F${row}`).value = checkOut ? 'Completed' : 'Active';
      
      row++;
    });

    // Auto-size columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    throw error;
  }
}

/**
 * Generate Excel for Leave Report
 */
async function generateLeaveReportExcel(leaveRequests, filters = {}) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leave Report');

    // Header
    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = 'Leave Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    
    if (filters.year) {
      worksheet.getCell('A2').value = `Year: ${filters.year}`;
      worksheet.getCell('A2').alignment = { horizontal: 'center' };
    }
    worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleDateString()}`;
    worksheet.getCell('A3').alignment = { horizontal: 'center' };

    // Table header
    const headerRow = 5;
    worksheet.getCell(`A${headerRow}`).value = 'Staff Name';
    worksheet.getCell(`B${headerRow}`).value = 'Leave Type';
    worksheet.getCell(`C${headerRow}`).value = 'From Date';
    worksheet.getCell(`D${headerRow}`).value = 'To Date';
    worksheet.getCell(`E${headerRow}`).value = 'Total Days';
    worksheet.getCell(`F${headerRow}`).value = 'Status';
    worksheet.getCell(`G${headerRow}`).value = 'Approved By';
    
    worksheet.getRow(headerRow).font = { bold: true };
    worksheet.getRow(headerRow).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Data rows
    let row = headerRow + 1;
    leaveRequests.forEach(request => {
      const startDate = request.start_date ? new Date(request.start_date) : null;
      const endDate = request.end_date ? new Date(request.end_date) : null;
      const numberOfDays = parseFloat(request.number_of_days || 0);

      worksheet.getCell(`A${row}`).value = request.employee_name || 'N/A';
      worksheet.getCell(`B${row}`).value = request.leave_type_name || 'N/A';
      worksheet.getCell(`C${row}`).value = startDate;
      if (startDate) {
        worksheet.getCell(`C${row}`).numFmt = 'mm/dd/yyyy';
      }
      worksheet.getCell(`D${row}`).value = endDate;
      if (endDate) {
        worksheet.getCell(`D${row}`).numFmt = 'mm/dd/yyyy';
      }
      worksheet.getCell(`E${row}`).value = numberOfDays.toFixed(1);
      worksheet.getCell(`F${row}`).value = request.status || 'N/A';
      worksheet.getCell(`G${row}`).value = request.approved_by_name || 'N/A';
      
      row++;
    });

    // Auto-size columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    throw error;
  }
}

/**
 * Generate Excel for Timesheet Report
 */
async function generateTimesheetReportExcel(timesheets, filters = {}) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Timesheet Report');

    // Header
    worksheet.mergeCells('A1:I1');
    worksheet.getCell('A1').value = 'Timesheet Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    
    if (filters.startDate && filters.endDate) {
      worksheet.getCell('A2').value = `Period: ${filters.startDate} to ${filters.endDate}`;
      worksheet.getCell('A2').alignment = { horizontal: 'center' };
    }
    worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleDateString()}`;
    worksheet.getCell('A3').alignment = { horizontal: 'center' };

    // Table header
    const headerRow = 5;
    worksheet.getCell(`A${headerRow}`).value = 'Employee';
    worksheet.getCell(`B${headerRow}`).value = 'Date';
    worksheet.getCell(`C${headerRow}`).value = 'Check In';
    worksheet.getCell(`D${headerRow}`).value = 'Check Out';
    worksheet.getCell(`E${headerRow}`).value = 'Total Hours';
    worksheet.getCell(`F${headerRow}`).value = 'OT Hours';
    worksheet.getCell(`G${headerRow}`).value = 'Project';
    worksheet.getCell(`H${headerRow}`).value = 'Status';
    worksheet.getCell(`I${headerRow}`).value = 'Approval Status';
    
    worksheet.getRow(headerRow).font = { bold: true };
    worksheet.getRow(headerRow).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Data rows
    let row = headerRow + 1;
    timesheets.forEach(timesheet => {
      const workDate = timesheet.work_date ? new Date(timesheet.work_date) : null;
      const checkIn = timesheet.check_in ? new Date(timesheet.check_in) : null;
      const checkOut = timesheet.check_out ? new Date(timesheet.check_out) : null;
      const totalHours = parseFloat(timesheet.total_hours || 0);
      const otHours = parseFloat(timesheet.overtime_hours || 0);

      worksheet.getCell(`A${row}`).value = timesheet.staff_name || 'N/A';
      worksheet.getCell(`B${row}`).value = workDate;
      if (workDate) {
        worksheet.getCell(`B${row}`).numFmt = 'mm/dd/yyyy';
      }
      worksheet.getCell(`C${row}`).value = checkIn;
      if (checkIn) {
        worksheet.getCell(`C${row}`).numFmt = 'hh:mm:ss AM/PM';
      }
      worksheet.getCell(`D${row}`).value = checkOut;
      if (checkOut) {
        worksheet.getCell(`D${row}`).numFmt = 'hh:mm:ss AM/PM';
      }
      worksheet.getCell(`E${row}`).value = totalHours.toFixed(2);
      worksheet.getCell(`F${row}`).value = otHours.toFixed(2);
      worksheet.getCell(`G${row}`).value = timesheet.project_name || 'N/A';
      worksheet.getCell(`H${row}`).value = timesheet.status || 'N/A';
      worksheet.getCell(`I${row}`).value = timesheet.approval_status || 'N/A';
      
      row++;
    });

    // Auto-size columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  generateMonthlySummaryExcel,
  generateAttendanceReportExcel,
  generateLeaveReportExcel,
  generateTimesheetReportExcel,
};

