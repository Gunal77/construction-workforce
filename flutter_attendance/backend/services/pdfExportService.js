const PDFDocument = require('pdfkit');

/**
 * Generate PDF for Monthly Summary
 */
async function generateMonthlySummaryPDF(summaryId) {
  return new Promise(async (resolve, reject) => {
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
          return reject(new Error('Monthly summary not found'));
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
      
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('Monthly Summary Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(1);

      // Employee Information
      doc.fontSize(14).font('Helvetica-Bold').text('Employee Information', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Name: ${summary.employee_name || 'N/A'}`);
      doc.text(`Email: ${summary.employee_email || 'N/A'}`);
      doc.text(`Employee ID: ${summary.employee_id || 'N/A'}`);
      if (summary.client_name) {
        doc.text(`Client: ${summary.client_name}`);
      }
      if (summary.project_name) {
        doc.text(`Project: ${summary.project_name}`);
      }
      doc.moveDown(0.5);

      // Period
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      doc.fontSize(14).font('Helvetica-Bold').text('Period', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Month: ${monthNames[summary.month - 1] || summary.month}`);
      doc.text(`Year: ${summary.year}`);
      doc.moveDown(0.5);

      // Summary Metrics
      doc.fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Total Working Days: ${summary.total_working_days || 0}`);
      doc.text(`Total Worked Hours: ${parseFloat(summary.total_worked_hours || 0).toFixed(2)}`);
      doc.text(`Total OT Hours: ${parseFloat(summary.total_ot_hours || 0).toFixed(2)}`);
      doc.text(`Approved Leaves: ${parseFloat(summary.approved_leaves || 0).toFixed(2)}`);
      doc.text(`Absent Days: ${summary.absent_days || 0}`);
      doc.moveDown(0.5);

      // Project Breakdown
      if (summary.project_breakdown && Array.isArray(summary.project_breakdown) && summary.project_breakdown.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('Project Breakdown', { underline: true });
        doc.moveDown(0.3);
        
        // Table header
        const tableTop = doc.y;
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Project', 50, tableTop);
        doc.text('Days', 250, tableTop);
        doc.text('Hours', 300, tableTop);
        doc.text('OT Hours', 400, tableTop);
        
        let currentY = tableTop + 15;
        doc.fontSize(9).font('Helvetica');
        
        summary.project_breakdown.forEach(project => {
          doc.text(project.project_name || 'N/A', 50, currentY);
          doc.text(String(project.days_worked || 0), 250, currentY);
          doc.text(parseFloat(project.total_hours || 0).toFixed(2), 300, currentY);
          doc.text(parseFloat(project.ot_hours || 0).toFixed(2), 400, currentY);
          currentY += 15;
        });
        
        doc.y = currentY + 10;
      }

      // Signatures
      doc.moveDown(1);
      doc.fontSize(14).font('Helvetica-Bold').text('Signatures', { underline: true });
      doc.moveDown(0.5);
      
      if (summary.staff_signature) {
        doc.fontSize(10).font('Helvetica').text('Staff Signature:', 50);
        doc.moveDown(0.2);
        // Note: In production, you'd decode and embed the base64 signature image here
        doc.fontSize(9).text('✓ Signed', 50);
        if (summary.staff_signed_at) {
          doc.text(`Date: ${new Date(summary.staff_signed_at).toLocaleDateString()}`, 50);
        }
        doc.moveDown(0.5);
      }

      if (summary.admin_signature) {
        doc.fontSize(10).font('Helvetica').text('Admin Signature:', 50);
        doc.moveDown(0.2);
        doc.fontSize(9).text('✓ Approved', 50);
        if (summary.admin_approved_at) {
          doc.text(`Date: ${new Date(summary.admin_approved_at).toLocaleDateString()}`, 50);
        }
        if (summary.admin_name) {
          doc.text(`Approved by: ${summary.admin_name}`, 50);
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate PDF for Attendance Report
 */
async function generateAttendanceReportPDF(attendanceRecords, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text('Attendance Report', { align: 'center' });
      doc.moveDown(0.3);
      if (filters.startDate && filters.endDate) {
        doc.fontSize(10).font('Helvetica').text(
          `Period: ${filters.startDate} to ${filters.endDate}`,
          { align: 'center' }
        );
      }
      doc.fontSize(10).font('Helvetica').text(
        `Generated: ${new Date().toLocaleDateString()}`,
        { align: 'center' }
      );
      doc.moveDown(1);

      // Table
      const tableTop = doc.y;
      const colWidths = [80, 100, 100, 80, 80, 60];
      const startX = 50;
      
      // Header row
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Date', startX, tableTop);
      doc.text('Employee', startX + colWidths[0], tableTop);
      doc.text('Check-In', startX + colWidths[0] + colWidths[1], tableTop);
      doc.text('Check-Out', startX + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
      doc.text('Hours', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);
      doc.text('Status', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], tableTop);

      let currentY = tableTop + 20;
      doc.fontSize(9).font('Helvetica');

      attendanceRecords.forEach(record => {
        const checkIn = record.check_in_time ? new Date(record.check_in_time) : null;
        const checkOut = record.check_out_time ? new Date(record.check_out_time) : null;
        
        let hours = 0;
        if (checkIn && checkOut) {
          hours = (checkOut - checkIn) / (1000 * 60 * 60);
        }

        doc.text(
          checkIn ? checkIn.toLocaleDateString() : 'N/A',
          startX,
          currentY
        );
        doc.text(
          record.employee_name || record.user_email || 'N/A',
          startX + colWidths[0],
          currentY
        );
        doc.text(
          checkIn ? checkIn.toLocaleTimeString() : 'N/A',
          startX + colWidths[0] + colWidths[1],
          currentY
        );
        doc.text(
          checkOut ? checkOut.toLocaleTimeString() : 'Active',
          startX + colWidths[0] + colWidths[1] + colWidths[2],
          currentY
        );
        doc.text(
          hours > 0 ? hours.toFixed(2) : 'N/A',
          startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
          currentY
        );
        doc.text(
          checkOut ? 'Completed' : 'Active',
          startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4],
          currentY
        );
        
        currentY += 15;
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate PDF for Leave Report
 */
async function generateLeaveReportPDF(leaveRequests, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text('Leave Report', { align: 'center' });
      doc.moveDown(0.3);
      if (filters.year) {
        doc.fontSize(10).font('Helvetica').text(`Year: ${filters.year}`, { align: 'center' });
      }
      doc.fontSize(10).font('Helvetica').text(
        `Generated: ${new Date().toLocaleDateString()}`,
        { align: 'center' }
      );
      doc.moveDown(1);

      // Table
      const tableTop = doc.y;
      const colWidths = [120, 80, 100, 100, 60, 80, 100];
      const startX = 50;
      
      // Header row
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Staff Name', startX, tableTop);
      doc.text('Leave Type', startX + colWidths[0], tableTop);
      doc.text('From Date', startX + colWidths[0] + colWidths[1], tableTop);
      doc.text('To Date', startX + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
      doc.text('Days', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);
      doc.text('Status', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], tableTop);
      doc.text('Approved By', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5], tableTop);

      let currentY = tableTop + 20;
      doc.fontSize(9).font('Helvetica');

      leaveRequests.forEach(request => {
        const startDate = request.start_date ? new Date(request.start_date) : null;
        const endDate = request.end_date ? new Date(request.end_date) : null;
        const numberOfDays = parseFloat(request.number_of_days || 0);

        doc.text(
          request.employee_name || 'N/A',
          startX,
          currentY
        );
        doc.text(
          request.leave_type_name || 'N/A',
          startX + colWidths[0],
          currentY
        );
        doc.text(
          startDate ? startDate.toLocaleDateString() : 'N/A',
          startX + colWidths[0] + colWidths[1],
          currentY
        );
        doc.text(
          endDate ? endDate.toLocaleDateString() : 'N/A',
          startX + colWidths[0] + colWidths[1] + colWidths[2],
          currentY
        );
        doc.text(
          numberOfDays.toFixed(1),
          startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
          currentY
        );
        doc.text(
          request.status || 'N/A',
          startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4],
          currentY
        );
        doc.text(
          request.approved_by_name || 'N/A',
          startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5],
          currentY
        );
        
        currentY += 15;
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate PDF for Timesheet Report
 */
async function generateTimesheetReportPDF(timesheets, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text('Timesheet Report', { align: 'center' });
      doc.moveDown(0.3);
      if (filters.startDate && filters.endDate) {
        doc.fontSize(10).font('Helvetica').text(
          `Period: ${filters.startDate} to ${filters.endDate}`,
          { align: 'center' }
        );
      }
      doc.fontSize(10).font('Helvetica').text(
        `Generated: ${new Date().toLocaleDateString()}`,
        { align: 'center' }
      );
      doc.moveDown(1);

      // Table
      const tableTop = doc.y;
      const colWidths = [100, 80, 80, 80, 60, 80, 60, 60, 80];
      const startX = 50;
      
      // Header row
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Employee', startX, tableTop);
      doc.text('Date', startX + colWidths[0], tableTop);
      doc.text('Check In', startX + colWidths[0] + colWidths[1], tableTop);
      doc.text('Check Out', startX + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
      doc.text('Hours', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);
      doc.text('OT Hours', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], tableTop);
      doc.text('Project', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5], tableTop);
      doc.text('Status', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6], tableTop);
      doc.text('Approval', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7], tableTop);

      let currentY = tableTop + 20;
      doc.fontSize(9).font('Helvetica');

      timesheets.forEach(timesheet => {
        const workDate = timesheet.work_date ? new Date(timesheet.work_date) : null;
        const checkIn = timesheet.check_in ? new Date(timesheet.check_in) : null;
        const checkOut = timesheet.check_out ? new Date(timesheet.check_out) : null;
        const totalHours = parseFloat(timesheet.total_hours || 0);
        const otHours = parseFloat(timesheet.overtime_hours || 0);

        doc.text(
          timesheet.staff_name || 'N/A',
          startX,
          currentY,
          { width: colWidths[0] - 5 }
        );
        doc.text(
          workDate ? workDate.toLocaleDateString() : 'N/A',
          startX + colWidths[0],
          currentY
        );
        doc.text(
          checkIn ? checkIn.toLocaleTimeString() : 'N/A',
          startX + colWidths[0] + colWidths[1],
          currentY
        );
        doc.text(
          checkOut ? checkOut.toLocaleTimeString() : 'N/A',
          startX + colWidths[0] + colWidths[1] + colWidths[2],
          currentY
        );
        doc.text(
          totalHours.toFixed(2),
          startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
          currentY
        );
        doc.text(
          otHours.toFixed(2),
          startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4],
          currentY
        );
        doc.text(
          timesheet.project_name || 'N/A',
          startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5],
          currentY,
          { width: colWidths[6] - 5 }
        );
        doc.text(
          timesheet.status || 'N/A',
          startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6],
          currentY
        );
        doc.text(
          timesheet.approval_status || 'N/A',
          startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7],
          currentY
        );
        
        currentY += 15;
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate PDF for Multiple Monthly Summaries (Bulk Export)
 */
async function generateBulkMonthlySummariesPDF(summaryIds) {
  return new Promise(async (resolve, reject) => {
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
            staff_signature: summaryDoc.staff_signature,
            staff_signed_at: summaryDoc.staff_signed_at,
            admin_signature: summaryDoc.admin_signature,
            admin_approved_at: summaryDoc.admin_approved_at,
          });
        }
      }

      if (summaries.length === 0) {
        return reject(new Error('No summaries found to export'));
      }

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

      // Generate a page for each summary
      summaries.forEach((summary, index) => {
        if (index > 0) {
          doc.addPage();
        }

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text('Monthly Summary Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown(1);

        // Employee Information
        doc.fontSize(14).font('Helvetica-Bold').text('Employee Information', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11).font('Helvetica');
        doc.text(`Name: ${summary.employee_name || 'N/A'}`);
        doc.text(`Email: ${summary.employee_email || 'N/A'}`);
        doc.text(`Employee ID: ${summary.employee_id || 'N/A'}`);
        if (summary.client_name) {
          doc.text(`Client: ${summary.client_name}`);
        }
        if (summary.project_name) {
          doc.text(`Project: ${summary.project_name}`);
        }
        doc.moveDown(0.5);

        // Period
        doc.fontSize(14).font('Helvetica-Bold').text('Period', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11).font('Helvetica');
        doc.text(`Month: ${monthNames[summary.month - 1] || summary.month}`);
        doc.text(`Year: ${summary.year}`);
        doc.moveDown(0.5);

        // Summary Metrics
        doc.fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11).font('Helvetica');
        doc.text(`Total Working Days: ${summary.total_working_days || 0}`);
        doc.text(`Total Worked Hours: ${summary.total_worked_hours.toFixed(2)}`);
        doc.text(`Total OT Hours: ${summary.total_ot_hours.toFixed(2)}`);
        doc.text(`Approved Leaves: ${summary.approved_leaves.toFixed(2)}`);
        doc.text(`Absent Days: ${summary.absent_days || 0}`);
        doc.moveDown(0.5);

        // Project Breakdown
        if (summary.project_breakdown && Array.isArray(summary.project_breakdown) && summary.project_breakdown.length > 0) {
          doc.fontSize(14).font('Helvetica-Bold').text('Project Breakdown', { underline: true });
          doc.moveDown(0.3);
          
          const tableTop = doc.y;
          doc.fontSize(10).font('Helvetica-Bold');
          doc.text('Project', 50, tableTop);
          doc.text('Days', 250, tableTop);
          doc.text('Hours', 300, tableTop);
          doc.text('OT Hours', 400, tableTop);
          
          let currentY = tableTop + 15;
          doc.fontSize(9).font('Helvetica');
          
          summary.project_breakdown.forEach(project => {
            doc.text(project.project_name || 'N/A', 50, currentY);
            doc.text(String(project.days_worked || 0), 250, currentY);
            doc.text(parseFloat(project.total_hours || 0).toFixed(2), 300, currentY);
            doc.text(parseFloat(project.ot_hours || 0).toFixed(2), 400, currentY);
            currentY += 15;
          });
          
          doc.y = currentY + 10;
        }

        // Signatures
        doc.moveDown(1);
        doc.fontSize(14).font('Helvetica-Bold').text('Signatures', { underline: true });
        doc.moveDown(0.5);
        
        if (summary.staff_signature) {
          doc.fontSize(10).font('Helvetica').text('Staff Signature:', 50);
          doc.moveDown(0.2);
          doc.fontSize(9).text('✓ Signed', 50);
          if (summary.staff_signed_at) {
            doc.text(`Date: ${new Date(summary.staff_signed_at).toLocaleDateString()}`, 50);
          }
          doc.moveDown(0.5);
        }

        if (summary.admin_signature) {
          doc.fontSize(10).font('Helvetica').text('Admin Signature:', 50);
          doc.moveDown(0.2);
          doc.fontSize(9).text('✓ Approved', 50);
          if (summary.admin_approved_at) {
            doc.text(`Date: ${new Date(summary.admin_approved_at).toLocaleDateString()}`, 50);
          }
          if (summary.admin_name) {
            doc.text(`Approved by: ${summary.admin_name}`, 50);
          }
        }
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateMonthlySummaryPDF,
  generateBulkMonthlySummariesPDF,
  generateAttendanceReportPDF,
  generateLeaveReportPDF,
  generateTimesheetReportPDF,
};

