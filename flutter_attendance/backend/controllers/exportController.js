const pdfExportService = require('../services/pdfExportService');
const excelExportService = require('../services/excelExportService');
const env = require('../config/env');

/**
 * Export Monthly Summary as PDF
 */
const exportMonthlySummaryPDF = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[EXPORT PDF] Requested summary ID: ${id}`);

    const pdfBuffer = await pdfExportService.generateMonthlySummaryPDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="monthly-summary-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[EXPORT PDF] Error exporting monthly summary PDF:', error);
    console.error('[EXPORT PDF] Error stack:', error.stack);
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
    console.log(`[EXPORT EXCEL] Requested summary ID: ${id}`);

    const excelBuffer = await excelExportService.generateMonthlySummaryExcel(id);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="monthly-summary-${id}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('[EXPORT EXCEL] Error exporting monthly summary Excel:', error);
    console.error('[EXPORT EXCEL] Error stack:', error.stack);
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
    
    // MongoDB: Fetch attendance records with filters
    const AttendanceMerged = require('../models/AttendanceMerged');
    const User = require('../models/User');
    const EmployeeMerged = require('../models/EmployeeMerged');
    
    // Build MongoDB query
    const query = {};
    
    // User filter
    if (filters.user) {
      const user = await User.findOne({ email: filters.user.trim().toLowerCase() }).lean();
      if (user) {
        query.user_id = user._id.toString();
      } else {
        // No user found, return empty result
        const pdfBuffer = await pdfExportService.generateAttendanceReportPDF([], filters);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${Date.now()}.pdf"`);
        return res.send(pdfBuffer);
      }
    }
    
    // Date range filter
    if (filters.from && filters.to) {
      const fromDate = new Date(filters.from);
      const toDate = new Date(filters.to);
      if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999); // End of day
        query.check_in_time = {
          $gte: fromDate,
          $lte: toDate
        };
      }
    } else if (filters.date) {
      const selectedDate = new Date(filters.date);
      if (!Number.isNaN(selectedDate.getTime())) {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        query.check_in_time = {
          $gte: startOfDay,
          $lte: endOfDay
        };
      }
    }
    
    // Month filter
    if (filters.month) {
      const monthValue = parseInt(filters.month, 10);
      if (!isNaN(monthValue)) {
        if (!query.check_in_time) query.check_in_time = {};
        query.$expr = {
          $eq: [{ $month: '$check_in_time' }, monthValue]
        };
      }
    }
    
    // Year filter
    if (filters.year) {
      const yearValue = parseInt(filters.year, 10);
      if (!isNaN(yearValue)) {
        if (!query.check_in_time) query.check_in_time = {};
        if (!query.$expr) {
          query.$expr = { $eq: [{ $year: '$check_in_time' }, yearValue] };
        } else {
          query.$expr = {
            $and: [
              query.$expr,
              { $eq: [{ $year: '$check_in_time' }, yearValue] }
            ]
          };
        }
      }
    }
    
    // Fetch attendance records
    const attendanceRecords = await AttendanceMerged.find(query)
      .sort({ check_in_time: -1 })
      .lean();
    
    // Fetch user emails and employee names
    const userIds = [...new Set(attendanceRecords.map(r => r.user_id))];
    const users = await User.find({ _id: { $in: userIds } }).select('_id email').lean();
    const userEmailMap = new Map(users.map(u => [u._id.toString(), u.email]));
    
    // Get employee emails for name lookup
    const userEmails = Array.from(userEmailMap.values());
    const employees = await EmployeeMerged.find({ email: { $in: userEmails } }).select('email name').lean();
    const employeeNameMap = new Map(employees.map(e => [e.email?.toLowerCase(), e.name]));
    
    // Format records
    const rows = attendanceRecords.map(record => ({
      id: record._id.toString(),
      user_id: record.user_id,
      check_in_time: record.check_in_time,
      check_out_time: record.check_out_time,
      user_email: userEmailMap.get(record.user_id) || null,
      employee_name: employeeNameMap.get(userEmailMap.get(record.user_id)?.toLowerCase()) || null
    }));

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
    
    // MongoDB: Fetch attendance records with filters (same logic as PDF)
    const AttendanceMerged = require('../models/AttendanceMerged');
    const User = require('../models/User');
    const EmployeeMerged = require('../models/EmployeeMerged');
    
    // Build MongoDB query
    const query = {};
    
    // User filter
    if (filters.user) {
      const user = await User.findOne({ email: filters.user.trim().toLowerCase() }).lean();
      if (user) {
        query.user_id = user._id.toString();
      } else {
        // No user found, return empty result
        const excelBuffer = await excelExportService.generateAttendanceReportExcel([], filters);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${Date.now()}.xlsx"`);
        return res.send(excelBuffer);
      }
    }
    
    // Date range filter
    if (filters.from && filters.to) {
      const fromDate = new Date(filters.from);
      const toDate = new Date(filters.to);
      if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        query.check_in_time = {
          $gte: fromDate,
          $lte: toDate
        };
      }
    } else if (filters.date) {
      const selectedDate = new Date(filters.date);
      if (!Number.isNaN(selectedDate.getTime())) {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        query.check_in_time = {
          $gte: startOfDay,
          $lte: endOfDay
        };
      }
    }
    
    // Month filter
    if (filters.month) {
      const monthValue = parseInt(filters.month, 10);
      if (!isNaN(monthValue)) {
        if (!query.$expr) query.$expr = {};
        query.$expr = {
          $eq: [{ $month: '$check_in_time' }, monthValue]
        };
      }
    }
    
    // Year filter
    if (filters.year) {
      const yearValue = parseInt(filters.year, 10);
      if (!isNaN(yearValue)) {
        if (!query.$expr) {
          query.$expr = { $eq: [{ $year: '$check_in_time' }, yearValue] };
        } else {
          query.$expr = {
            $and: [
              query.$expr,
              { $eq: [{ $year: '$check_in_time' }, yearValue] }
            ]
          };
        }
      }
    }
    
    // Fetch attendance records
    const attendanceRecords = await AttendanceMerged.find(query)
      .sort({ check_in_time: -1 })
      .lean();
    
    // Fetch user emails and employee names
    const userIds = [...new Set(attendanceRecords.map(r => r.user_id))];
    const users = await User.find({ _id: { $in: userIds } }).select('_id email').lean();
    const userEmailMap = new Map(users.map(u => [u._id.toString(), u.email]));
    
    // Get employee emails for name lookup
    const userEmails = Array.from(userEmailMap.values());
    const employees = await EmployeeMerged.find({ email: { $in: userEmails } }).select('email name').lean();
    const employeeNameMap = new Map(employees.map(e => [e.email?.toLowerCase(), e.name]));
    
    // Format records
    const rows = attendanceRecords.map(record => ({
      id: record._id.toString(),
      user_id: record.user_id,
      check_in_time: record.check_in_time,
      check_out_time: record.check_out_time,
      user_email: userEmailMap.get(record.user_id) || null,
      employee_name: employeeNameMap.get(userEmailMap.get(record.user_id)?.toLowerCase()) || null
    }));

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
    
    // MongoDB: Fetch leave requests with filters
    const { LeaveRequest } = require('../models/LeaveMerged');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const User = require('../models/User');
    
    // Build MongoDB query
    const query = {};
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.year) {
      const yearValue = parseInt(filters.year, 10);
      if (!isNaN(yearValue)) {
        const startDate = new Date(yearValue, 0, 1);
        const endDate = new Date(yearValue, 11, 31, 23, 59, 59, 999);
        query.start_date = {
          $gte: startDate,
          $lte: endDate
        };
      }
    }
    
    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
        endDate.setHours(23, 59, 59, 999);
        query.start_date = {
          $gte: startDate,
          $lte: endDate
        };
      }
    }
    
    // Fetch leave requests
    const leaveRequests = await LeaveRequest.find(query)
      .sort({ start_date: -1 })
      .lean();
    
    // Fetch employee details
    const employeeIds = [...new Set(leaveRequests.map(lr => lr.employee_id).filter(Boolean))];
    const employees = await EmployeeMerged.find({ _id: { $in: employeeIds } })
      .select('_id name email')
      .lean();
    const employeeMap = new Map(employees.map(e => [e._id.toString(), e]));
    
    // Fetch leave types (if stored separately, otherwise use leave_type from request)
    // For now, we'll use the leave_type field from the request
    
    // Fetch admin names (approved_by)
    const adminIds = [...new Set(leaveRequests.map(lr => lr.approved_by).filter(Boolean))];
    const admins = await User.find({ _id: { $in: adminIds }, role: { $in: ['ADMIN', 'admin'] } })
      .select('_id name email')
      .lean();
    const adminMap = new Map(admins.map(a => [a._id.toString(), a]));
    
    // Format records
    const rows = leaveRequests.map(lr => {
      const employee = employeeMap.get(lr.employee_id?.toString());
      const admin = adminMap.get(lr.approved_by?.toString());
      
      return {
        ...lr,
        id: lr._id.toString(),
        employee_name: employee?.name || null,
        leave_type_name: lr.leave_type || lr.leave_type_name || null,
        approved_by_name: admin?.name || null
      };
    });

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
    
    // MongoDB: Fetch leave requests with filters (same logic as PDF)
    const { LeaveRequest } = require('../models/LeaveMerged');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const User = require('../models/User');
    
    // Build MongoDB query
    const query = {};
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.year) {
      const yearValue = parseInt(filters.year, 10);
      if (!isNaN(yearValue)) {
        const startDate = new Date(yearValue, 0, 1);
        const endDate = new Date(yearValue, 11, 31, 23, 59, 59, 999);
        query.start_date = {
          $gte: startDate,
          $lte: endDate
        };
      }
    }
    
    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
        endDate.setHours(23, 59, 59, 999);
        query.start_date = {
          $gte: startDate,
          $lte: endDate
        };
      }
    }
    
    // Fetch leave requests
    const leaveRequests = await LeaveRequest.find(query)
      .sort({ start_date: -1 })
      .lean();
    
    // Fetch employee details
    const employeeIds = [...new Set(leaveRequests.map(lr => lr.employee_id).filter(Boolean))];
    // Convert employeeIds to ObjectIds if they're valid ObjectId strings, otherwise keep as strings
    const mongoose = require('mongoose');
    const employeeObjectIds = employeeIds.map(id => {
      if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
        return new mongoose.Types.ObjectId(id);
      }
      return id;
    });
    const employees = await EmployeeMerged.find({ 
      $or: [
        { _id: { $in: employeeObjectIds } },
        { _id: { $in: employeeIds } }
      ]
    })
      .select('_id name email')
      .lean();
    const employeeMap = new Map(employees.map(e => [e._id.toString(), e]));
    
    // Fetch admin names (approved_by)
    const adminIds = [...new Set(leaveRequests.map(lr => lr.approved_by).filter(Boolean))];
    // Convert adminIds to ObjectIds if they're valid ObjectId strings, otherwise keep as strings
    const adminObjectIds = adminIds.map(id => {
      if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
        return new mongoose.Types.ObjectId(id);
      }
      return id;
    });
    const admins = await User.find({ 
      $or: [
        { _id: { $in: adminObjectIds } },
        { _id: { $in: adminIds } }
      ],
      role: { $in: ['ADMIN', 'admin'] } 
    })
      .select('_id name email')
      .lean();
    const adminMap = new Map(admins.map(a => [a._id.toString(), a]));
    
    // Format records
    const rows = leaveRequests.map(lr => {
      const employee = employeeMap.get(lr.employee_id?.toString());
      const admin = adminMap.get(lr.approved_by?.toString());
      
      return {
        ...lr,
        id: lr._id.toString(),
        employee_name: employee?.name || null,
        leave_type_name: lr.leave_type || lr.leave_type_name || null,
        approved_by_name: admin?.name || null
      };
    });

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

// Helper function removed - no longer needed as we use MongoDB queries directly

/**
 * Export Timesheet Report as PDF
 */
const exportTimesheetReportPDF = async (req, res) => {
  try {
    const filters = req.query;
    
    // MongoDB: Fetch timesheets with filters (same logic as getTimesheets)
    const Timesheet = require('../models/Timesheet');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const ProjectMerged = require('../models/ProjectMerged');
    const User = require('../models/User');
    
    const { staffId, projectId, status, approvalStatus, startDate, endDate } = filters;
    
    // Build MongoDB query
    const query = {};
    
    if (staffId) {
      query.staff_id = staffId;
    }
    
    if (projectId) {
      query.project_id = projectId;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (approvalStatus) {
      query.approval_status = approvalStatus;
    }
    
    // Date filters
    if (startDate || endDate) {
      query.work_date = {};
      if (startDate) {
        query.work_date.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        query.work_date.$lte = endDateObj;
      }
    }
    
    // Fetch timesheets
    const timesheets = await Timesheet.find(query)
      .sort({ work_date: -1, created_at: -1 })
      .lean();
    
    // Enrich with employee, project, and admin names
    const employeeIds = [...new Set(timesheets.map(t => t.staff_id).filter(Boolean))];
    const projectIds = [...new Set(timesheets.map(t => t.project_id).filter(Boolean))];
    const adminIds = [
      ...new Set([
        ...timesheets.map(t => t.approved_by).filter(Boolean),
        ...timesheets.map(t => t.ot_approved_by).filter(Boolean),
      ])
    ];
    
    // Fetch employees - try both _id and user_id matches
    const [employees, projects, admins] = await Promise.all([
      EmployeeMerged.find({
        $or: [
          { _id: { $in: employeeIds } },
          { user_id: { $in: employeeIds } },
        ]
      }).select('_id user_id name email role').lean(),
      ProjectMerged.find({ _id: { $in: projectIds } }).select('_id name').lean(),
      User.find({ _id: { $in: adminIds }, role: 'ADMIN' }).select('_id name').lean(),
    ]);
    
    // Create maps for lookup
    const employeeMap = new Map();
    employees.forEach(e => {
      employeeMap.set(e._id.toString(), e);
      if (e.user_id) {
        employeeMap.set(e.user_id.toString(), e);
      }
    });
    
    const projectMap = new Map(projects.map(p => [p._id.toString(), p]));
    const adminMap = new Map(admins.map(a => [a._id.toString(), a]));
    
    // Format records
    const rows = timesheets.map(t => {
      const employee = employeeMap.get(t.staff_id?.toString());
      const project = projectMap.get(t.project_id?.toString());
      const approvedBy = adminMap.get(t.approved_by?.toString());
      
      // Convert Decimal128 to number
      const totalHours = t.total_hours ? parseFloat(t.total_hours.toString()) : 0;
      const overtimeHours = t.overtime_hours ? parseFloat(t.overtime_hours.toString()) : 0;
      
      return {
        ...t,
        id: t._id.toString(),
        staff_id: t.staff_id?.toString() || null,
        staff_name: employee?.name || 'Unknown Staff',
        staff_email: employee?.email || null,
        staff_role: employee?.role || null,
        project_id: t.project_id?.toString() || null,
        project_name: project?.name || 'N/A',
        total_hours: totalHours,
        overtime_hours: overtimeHours,
        approved_by_name: approvedBy?.name || null,
      };
    });

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
    
    // MongoDB: Fetch timesheets with filters (same logic as PDF)
    const Timesheet = require('../models/Timesheet');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const ProjectMerged = require('../models/ProjectMerged');
    const User = require('../models/User');
    
    const { staffId, projectId, status, approvalStatus, startDate, endDate } = filters;
    
    // Build MongoDB query
    const query = {};
    
    if (staffId) {
      query.staff_id = staffId;
    }
    
    if (projectId) {
      query.project_id = projectId;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (approvalStatus) {
      query.approval_status = approvalStatus;
    }
    
    // Date filters
    if (startDate || endDate) {
      query.work_date = {};
      if (startDate) {
        query.work_date.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        query.work_date.$lte = endDateObj;
      }
    }
    
    // Fetch timesheets
    const timesheets = await Timesheet.find(query)
      .sort({ work_date: -1, created_at: -1 })
      .lean();
    
    // Enrich with employee, project, and admin names
    const employeeIds = [...new Set(timesheets.map(t => t.staff_id).filter(Boolean))];
    const projectIds = [...new Set(timesheets.map(t => t.project_id).filter(Boolean))];
    const adminIds = [
      ...new Set([
        ...timesheets.map(t => t.approved_by).filter(Boolean),
        ...timesheets.map(t => t.ot_approved_by).filter(Boolean),
      ])
    ];
    
    // Fetch employees - try both _id and user_id matches
    const [employees, projects, admins] = await Promise.all([
      EmployeeMerged.find({
        $or: [
          { _id: { $in: employeeIds } },
          { user_id: { $in: employeeIds } },
        ]
      }).select('_id user_id name email role').lean(),
      ProjectMerged.find({ _id: { $in: projectIds } }).select('_id name').lean(),
      User.find({ _id: { $in: adminIds }, role: 'ADMIN' }).select('_id name').lean(),
    ]);
    
    // Create maps for lookup
    const employeeMap = new Map();
    employees.forEach(e => {
      employeeMap.set(e._id.toString(), e);
      if (e.user_id) {
        employeeMap.set(e.user_id.toString(), e);
      }
    });
    
    const projectMap = new Map(projects.map(p => [p._id.toString(), p]));
    const adminMap = new Map(admins.map(a => [a._id.toString(), a]));
    
    // Format records
    const rows = timesheets.map(t => {
      const employee = employeeMap.get(t.staff_id?.toString());
      const project = projectMap.get(t.project_id?.toString());
      const approvedBy = adminMap.get(t.approved_by?.toString());
      
      // Convert Decimal128 to number
      const totalHours = t.total_hours ? parseFloat(t.total_hours.toString()) : 0;
      const overtimeHours = t.overtime_hours ? parseFloat(t.overtime_hours.toString()) : 0;
      
      return {
        ...t,
        id: t._id.toString(),
        staff_id: t.staff_id?.toString() || null,
        staff_name: employee?.name || 'Unknown Staff',
        staff_email: employee?.email || null,
        staff_role: employee?.role || null,
        project_id: t.project_id?.toString() || null,
        project_name: project?.name || 'N/A',
        total_hours: totalHours,
        overtime_hours: overtimeHours,
        approved_by_name: approvedBy?.name || null,
      };
    });

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

/**
 * Export Bulk Monthly Summaries as PDF (all summaries in one PDF)
 */
const exportBulkMonthlySummariesPDF = async (req, res) => {
  try {
    const { summaryIds } = req.body;
    console.log(`[EXPORT PDF BULK] Requested ${summaryIds?.length || 0} summary IDs`);

    if (!summaryIds || !Array.isArray(summaryIds) || summaryIds.length === 0) {
      return res.status(400).json({
        message: 'summaryIds array is required',
      });
    }

    const pdfBuffer = await pdfExportService.generateBulkMonthlySummariesPDF(summaryIds);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="monthly-summaries-bulk-${Date.now()}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[EXPORT PDF BULK] Error exporting bulk monthly summaries PDF:', error);
    console.error('[EXPORT PDF BULK] Error stack:', error.stack);
    return res.status(500).json({
      message: 'Failed to export bulk monthly summaries PDF',
      error: error.message,
    });
  }
};

/**
 * Export Bulk Monthly Summaries as Excel (all summaries in one Excel file)
 */
const exportBulkMonthlySummariesExcel = async (req, res) => {
  try {
    const { summaryIds } = req.body;
    console.log(`[EXPORT EXCEL BULK] Requested ${summaryIds?.length || 0} summary IDs`);

    if (!summaryIds || !Array.isArray(summaryIds) || summaryIds.length === 0) {
      return res.status(400).json({
        message: 'summaryIds array is required',
      });
    }

    const excelBuffer = await excelExportService.generateBulkMonthlySummariesExcel(summaryIds);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="monthly-summaries-bulk-${Date.now()}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('[EXPORT EXCEL BULK] Error exporting bulk monthly summaries Excel:', error);
    console.error('[EXPORT EXCEL BULK] Error stack:', error.stack);
    return res.status(500).json({
      message: 'Failed to export bulk monthly summaries Excel',
      error: error.message,
    });
  }
};

module.exports = {
  exportMonthlySummaryPDF,
  exportMonthlySummaryExcel,
  exportBulkMonthlySummariesPDF,
  exportBulkMonthlySummariesExcel,
  exportAttendanceReportPDF,
  exportAttendanceReportExcel,
  exportLeaveReportPDF,
  exportLeaveReportExcel,
  exportTimesheetReportPDF,
  exportTimesheetReportExcel,
};

