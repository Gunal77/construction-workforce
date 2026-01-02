const ExcelJS = require('exceljs');

/**
 * Generate Excel for Monthly Summary
 */
async function generateMonthlySummaryExcel(summaryId) {
  try {
    let summary;

    // MongoDB: Fetch summary using Mongoose models
    const mongoose = require('mongoose');
      const MonthlySummary = require('../models/MonthlySummary');
      const EmployeeMerged = require('../models/EmployeeMerged');
      const User = require('../models/User');
      const ProjectMerged = require('../models/ProjectMerged');

      // Try multiple ID formats since MongoDB might store _id as ObjectId or String
      let summaryDoc = null;

      // Method 1: Try with ObjectId
      if (mongoose.Types.ObjectId.isValid(summaryId)) {
        const objectId = new mongoose.Types.ObjectId(summaryId);
        summaryDoc = await MonthlySummary.findOne({ _id: objectId }).lean();
      }

      // Method 2: Try with string ID
      if (!summaryDoc) {
        summaryDoc = await MonthlySummary.findOne({ _id: summaryId }).lean();
      }

      // Method 3: Try with native collection (bypasses Mongoose type conversion)
      if (!summaryDoc && mongoose.Types.ObjectId.isValid(summaryId)) {
        const objectId = new mongoose.Types.ObjectId(summaryId);
        summaryDoc = await MonthlySummary.collection.findOne({ _id: objectId });
        if (summaryDoc) {
          // Convert to plain object
          summaryDoc = JSON.parse(JSON.stringify(summaryDoc));
        }
      }

      // Method 4: Try finding by string ID in native collection
      if (!summaryDoc) {
        const allSummaries = await MonthlySummary.collection.find({}).toArray();
        summaryDoc = allSummaries.find(s => s._id.toString() === summaryId);
        if (summaryDoc) {
          summaryDoc = JSON.parse(JSON.stringify(summaryDoc));
        }
      }

      if (!summaryDoc) {
        console.error(`[ERROR] Summary not found with ID: ${summaryId}`);
        throw new Error('Monthly summary not found');
      }

      // Log status but don't block export (admin can export any status)
      console.log(`[INFO] Exporting summary with status: ${summaryDoc.status}`);

      // Get employee - handle both ObjectId and string formats
      let employee = null;
      if (summaryDoc.employee_id) {
        if (mongoose.Types.ObjectId.isValid(summaryDoc.employee_id)) {
          employee = await EmployeeMerged.findById(summaryDoc.employee_id).lean();
        }
        if (!employee) {
          employee = await EmployeeMerged.findOne({ _id: summaryDoc.employee_id }).lean();
        }
        if (!employee) {
          // Try with native collection
          const employeeDoc = await EmployeeMerged.collection.findOne({
            _id: mongoose.Types.ObjectId.isValid(summaryDoc.employee_id) 
              ? new mongoose.Types.ObjectId(summaryDoc.employee_id)
              : summaryDoc.employee_id
          });
          if (employeeDoc) {
            employee = JSON.parse(JSON.stringify(employeeDoc));
          }
        }
      }
      
      // Get admin - handle both ObjectId and string formats
      let admin = null;
      if (summaryDoc.admin_approved_by) {
        if (mongoose.Types.ObjectId.isValid(summaryDoc.admin_approved_by)) {
          admin = await User.findById(summaryDoc.admin_approved_by).lean();
        }
        if (!admin) {
          admin = await User.findOne({ _id: summaryDoc.admin_approved_by }).lean();
        }
      }

      // Get project (from employee's project assignments)
      let project = null;
      let client = null;
      if (employee?.project_assignments && employee.project_assignments.length > 0) {
        const projectId = employee.project_assignments[0].project_id;
        if (mongoose.Types.ObjectId.isValid(projectId)) {
          project = await ProjectMerged.findById(projectId).lean();
        }
        if (!project) {
          project = await ProjectMerged.findOne({ _id: projectId }).lean();
        }
        if (project?.client_user_id) {
          if (mongoose.Types.ObjectId.isValid(project.client_user_id)) {
            client = await User.findById(project.client_user_id).lean();
          }
          if (!client) {
            client = await User.findOne({ _id: project.client_user_id }).lean();
          }
        }
      }

      // Format summary to match PostgreSQL structure
      summary = {
        id: summaryDoc._id.toString(),
        employee_id: summaryDoc.employee_id,
        month: summaryDoc.month,
        year: summaryDoc.year,
        total_working_days: summaryDoc.total_working_days || 0,
        total_worked_hours: summaryDoc.total_worked_hours ? parseFloat(summaryDoc.total_worked_hours.toString()) : 0,
        total_ot_hours: summaryDoc.total_ot_hours ? parseFloat(summaryDoc.total_ot_hours.toString()) : 0,
        approved_leaves: summaryDoc.approved_leaves ? parseFloat(summaryDoc.approved_leaves.toString()) : 0,
        absent_days: summaryDoc.absent_days || 0,
        project_breakdown: summaryDoc.project_breakdown || [],
        subtotal: summaryDoc.subtotal ? parseFloat(summaryDoc.subtotal.toString()) : 0,
        tax_percentage: summaryDoc.tax_percentage || 0,
        tax_amount: summaryDoc.tax_amount ? parseFloat(summaryDoc.tax_amount.toString()) : 0,
        total_amount: summaryDoc.total_amount ? parseFloat(summaryDoc.total_amount.toString()) : 0,
        invoice_number: summaryDoc.invoice_number,
        status: summaryDoc.status,
        employee_name: employee?.name || 'Unknown',
        employee_email: employee?.email || null,
        employee_role: employee?.role || null,
        admin_name: admin?.name || null,
        admin_email: admin?.email || null,
        project_name: project?.name || null,
        client_name: client?.name || null,
      };
    
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

/**
 * Generate Excel for Multiple Monthly Summaries (Bulk Export)
 */
async function generateBulkMonthlySummariesExcel(summaryIds) {
  try {
    const mongoose = require('mongoose');
    const MonthlySummary = require('../models/MonthlySummary');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const User = require('../models/User');
    const ProjectMerged = require('../models/ProjectMerged');

    // Fetch all summaries
    const summaries = [];
    for (const summaryId of summaryIds) {
      let summaryDoc = null;

      // Try multiple ID formats
      if (mongoose.Types.ObjectId.isValid(summaryId)) {
        const objectId = new mongoose.Types.ObjectId(summaryId);
        summaryDoc = await MonthlySummary.findOne({ _id: objectId }).lean();
      }

      if (!summaryDoc) {
        summaryDoc = await MonthlySummary.findOne({ _id: summaryId }).lean();
      }

      if (!summaryDoc && mongoose.Types.ObjectId.isValid(summaryId)) {
        const objectId = new mongoose.Types.ObjectId(summaryId);
        summaryDoc = await MonthlySummary.collection.findOne({ _id: objectId });
        if (summaryDoc) {
          summaryDoc = JSON.parse(JSON.stringify(summaryDoc));
        }
      }

      if (!summaryDoc) {
        const allSummaries = await MonthlySummary.collection.find({}).toArray();
        summaryDoc = allSummaries.find(s => s._id.toString() === summaryId);
        if (summaryDoc) {
          summaryDoc = JSON.parse(JSON.stringify(summaryDoc));
        }
      }

      if (summaryDoc) {
        // Get employee details
        let employee = null;
        if (summaryDoc.employee_id) {
          if (mongoose.Types.ObjectId.isValid(summaryDoc.employee_id)) {
            const employeeObjectId = new mongoose.Types.ObjectId(summaryDoc.employee_id);
            employee = await EmployeeMerged.findById(employeeObjectId).lean();
          }
          if (!employee) {
            employee = await EmployeeMerged.findOne({ _id: summaryDoc.employee_id.toString() }).lean();
          }
        }

        // Get admin details
        let admin = null;
        if (summaryDoc.admin_approved_by) {
          if (mongoose.Types.ObjectId.isValid(summaryDoc.admin_approved_by)) {
            admin = await User.findById(summaryDoc.admin_approved_by).lean();
          }
          if (!admin) {
            admin = await User.findOne({ _id: summaryDoc.admin_approved_by }).lean();
          }
        }

        // Get project details
        let project = null;
        let client = null;
        if (employee?.project_assignments && employee.project_assignments.length > 0) {
          const projectId = employee.project_assignments[0].project_id;
          if (mongoose.Types.ObjectId.isValid(projectId)) {
            project = await ProjectMerged.findById(projectId).lean();
          }
          if (!project) {
            project = await ProjectMerged.findOne({ _id: projectId }).lean();
          }
          if (project?.client_user_id) {
            if (mongoose.Types.ObjectId.isValid(project.client_user_id)) {
              client = await User.findById(project.client_user_id).lean();
            }
            if (!client) {
              client = await User.findOne({ _id: project.client_user_id }).lean();
            }
          }
        }

        // Parse project_breakdown
        let projectBreakdown = [];
        if (summaryDoc.project_breakdown) {
          try {
            if (typeof summaryDoc.project_breakdown === 'string') {
              projectBreakdown = JSON.parse(summaryDoc.project_breakdown);
            } else if (Array.isArray(summaryDoc.project_breakdown)) {
              projectBreakdown = summaryDoc.project_breakdown;
            }
          } catch (e) {
            console.error('Error parsing project_breakdown:', e);
          }
        }

        summaries.push({
          id: summaryDoc._id.toString(),
          employee_id: summaryDoc.employee_id,
          month: summaryDoc.month,
          year: summaryDoc.year,
          total_working_days: summaryDoc.total_working_days || 0,
          total_worked_hours: summaryDoc.total_worked_hours ? parseFloat(summaryDoc.total_worked_hours.toString()) : 0,
          total_ot_hours: summaryDoc.total_ot_hours ? parseFloat(summaryDoc.total_ot_hours.toString()) : 0,
          approved_leaves: summaryDoc.approved_leaves ? parseFloat(summaryDoc.approved_leaves.toString()) : 0,
          absent_days: summaryDoc.absent_days || 0,
          project_breakdown: projectBreakdown,
          subtotal: summaryDoc.subtotal ? parseFloat(summaryDoc.subtotal.toString()) : 0,
          tax_percentage: summaryDoc.tax_percentage || 0,
          tax_amount: summaryDoc.tax_amount ? parseFloat(summaryDoc.tax_amount.toString()) : 0,
          total_amount: summaryDoc.total_amount ? parseFloat(summaryDoc.total_amount.toString()) : 0,
          invoice_number: summaryDoc.invoice_number,
          status: summaryDoc.status,
          employee_name: employee?.name || 'Unknown',
          employee_email: employee?.email || null,
          employee_role: employee?.role || null,
          admin_name: admin?.name || null,
          admin_email: admin?.email || null,
          project_name: project?.name || null,
          client_name: client?.name || null,
        });
      }
    }

    if (summaries.length === 0) {
      throw new Error('No summaries found to export');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Monthly Summaries');

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    // Header row
    worksheet.mergeCells('A1:O1');
    worksheet.getCell('A1').value = 'Monthly Summaries Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    
    worksheet.getCell('A2').value = `Generated: ${new Date().toLocaleDateString()}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };
    worksheet.getRow(2).height = 20;

    // Column headers
    const headers = [
      'Employee Name', 'Email', 'Employee ID', 'Month', 'Year',
      'Working Days', 'Worked Hours', 'OT Hours', 'Approved Leaves', 'Absent Days',
      'Project', 'Client', 'Status', 'Invoice Number', 'Total Amount'
    ];
    
    let row = 4;
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(row, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    row++;

    // Data rows
    summaries.forEach(summary => {
      worksheet.getCell(row, 1).value = summary.employee_name || 'N/A';
      worksheet.getCell(row, 2).value = summary.employee_email || 'N/A';
      worksheet.getCell(row, 3).value = summary.employee_id || 'N/A';
      worksheet.getCell(row, 4).value = monthNames[summary.month - 1] || summary.month;
      worksheet.getCell(row, 5).value = summary.year;
      worksheet.getCell(row, 6).value = summary.total_working_days || 0;
      worksheet.getCell(row, 7).value = summary.total_worked_hours.toFixed(2);
      worksheet.getCell(row, 8).value = summary.total_ot_hours.toFixed(2);
      worksheet.getCell(row, 9).value = summary.approved_leaves.toFixed(2);
      worksheet.getCell(row, 10).value = summary.absent_days || 0;
      worksheet.getCell(row, 11).value = summary.project_name || 'N/A';
      worksheet.getCell(row, 12).value = summary.client_name || 'N/A';
      worksheet.getCell(row, 13).value = summary.status || 'N/A';
      worksheet.getCell(row, 14).value = summary.invoice_number || 'N/A';
      worksheet.getCell(row, 15).value = summary.total_amount.toFixed(2);
      
      // Add borders to all cells in the row
      for (let col = 1; col <= 15; col++) {
        worksheet.getCell(row, col).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
      
      row++;
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        if (cell.value) {
          const cellLength = cell.value.toString().length;
          if (cellLength > maxLength) {
            maxLength = cellLength;
          }
        }
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  generateMonthlySummaryExcel,
  generateBulkMonthlySummariesExcel,
  generateAttendanceReportExcel,
  generateLeaveReportExcel,
  generateTimesheetReportExcel,
};

