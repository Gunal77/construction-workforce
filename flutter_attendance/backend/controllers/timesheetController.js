const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

// Get all timesheets with filters
const getTimesheets = async (req, res) => {
  try {
    const { staffId, projectId, status, approvalStatus, otApprovalStatus, startDate, endDate, view } = req.query;
    
    const Timesheet = require('../models/Timesheet');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const ProjectMerged = require('../models/ProjectMerged');
    const User = require('../models/User');
      
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
      
      if (otApprovalStatus) {
        query.ot_approval_status = otApprovalStatus;
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
      
      // Set limit
      let limit = 500;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (daysDiff > 90) {
          limit = 1000;
        } else {
          limit = null; // No limit for smaller ranges
        }
      }
      
      let timesheetsQuery = Timesheet.find(query)
        .sort({ work_date: -1, created_at: -1 });
      
      if (limit) {
        timesheetsQuery = timesheetsQuery.limit(limit);
      }
      
      const timesheets = await timesheetsQuery.lean();
      
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
      
      // Create multiple maps for flexible lookup
      const employeeMap = new Map();
      employees.forEach(e => {
        employeeMap.set(e._id.toString(), e);
        if (e.user_id) {
          employeeMap.set(e.user_id.toString(), e);
        }
      });
      
      const projectMap = new Map(projects.map(p => [p._id.toString(), p]));
      const adminMap = new Map(admins.map(a => [a._id.toString(), a]));
      
      // If we still have timesheets with missing staff, try to find them via User email lookup
      const timesheetsWithMissingStaff = timesheets.filter(t => {
        const staffId = t.staff_id?.toString();
        return staffId && !employeeMap.has(staffId);
      });

      if (timesheetsWithMissingStaff.length > 0) {
        // Try to find employees by matching user_id from User collection
        const missingStaffIds = [...new Set(timesheetsWithMissingStaff.map(t => t.staff_id?.toString()).filter(Boolean))];
        const users = await User.find({ _id: { $in: missingStaffIds } })
          .select('_id email')
          .lean();

        users.forEach(user => {
          // Find employee by email
          const employee = employees.find(e => 
            e.email?.toLowerCase() === user.email?.toLowerCase()
          );
          if (employee) {
            employeeMap.set(user._id.toString(), employee);
          }
        });
      }

      const enrichedTimesheets = timesheets.map(t => {
        let employee = employeeMap.get(t.staff_id?.toString());
        
        // If still not found, try direct lookup in employees array
        if (!employee && t.staff_id) {
          employee = employees.find(e => 
            e._id.toString() === t.staff_id.toString() ||
            e.user_id?.toString() === t.staff_id.toString()
          );
        }

        const project = projectMap.get(t.project_id?.toString());
        const approvedBy = adminMap.get(t.approved_by?.toString());
        const otApprovedBy = adminMap.get(t.ot_approved_by?.toString());
        
        // Convert Decimal128 to number
        const totalHours = t.total_hours ? parseFloat(t.total_hours.toString()) : 0;
        const overtimeHours = t.overtime_hours ? parseFloat(t.overtime_hours.toString()) : 0;
        
        return {
          ...t,
          id: t._id,
          staff_id: t.staff_id?.toString() || null,
          staff_name: employee?.name || 'Unknown Staff',
          staff_email: employee?.email || null,
          staff_role: employee?.role || null,
          project_id: t.project_id?.toString() || null,
          project_name: project?.name || 'N/A',
          total_hours: totalHours,
          overtime_hours: overtimeHours,
          approval_status: t.approval_status || 'Draft',
          ot_approval_status: t.ot_approval_status || null,
          status: t.status || 'Present',
          approved_by_name: approvedBy?.name || null,
          ot_approved_by_name: otApprovedBy?.name || null,
          check_in: t.check_in ? new Date(t.check_in).toISOString() : null,
          check_out: t.check_out ? new Date(t.check_out).toISOString() : null,
          work_date: t.work_date ? new Date(t.work_date).toISOString().split('T')[0] : null,
        };
      });
      
      return res.json({ timesheets: enrichedTimesheets });
  } catch (error) {
    console.error('Get timesheets error', error);
    return res.status(500).json({ message: 'Failed to fetch timesheets', error: error.message });
  }
};

// Get single timesheet by ID
const getTimesheetById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const Timesheet = require('../models/Timesheet');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const ProjectMerged = require('../models/ProjectMerged');
    const User = require('../models/User');
      
      const timesheet = await Timesheet.findById(id).lean();
      
      if (!timesheet) {
        return res.status(404).json({ message: 'Timesheet not found' });
      }
      
      // Enrich with employee, project, and admin names
      const [employee, project, approvedBy, otApprovedBy] = await Promise.all([
        timesheet.staff_id ? EmployeeMerged.findById(timesheet.staff_id).select('name email role').lean() : null,
        timesheet.project_id ? ProjectMerged.findById(timesheet.project_id).select('name').lean() : null,
        timesheet.approved_by ? User.findById(timesheet.approved_by).select('name').lean() : null,
        timesheet.ot_approved_by ? User.findById(timesheet.ot_approved_by).select('name').lean() : null,
      ]);
      
      const totalHours = timesheet.total_hours ? parseFloat(timesheet.total_hours.toString()) : 0;
      const overtimeHours = timesheet.overtime_hours ? parseFloat(timesheet.overtime_hours.toString()) : 0;
      
      const enrichedTimesheet = {
        ...timesheet,
        id: timesheet._id,
        staff_name: employee?.name || null,
        staff_email: employee?.email || null,
        staff_role: employee?.role || null,
        project_name: project?.name || null,
        approved_by_name: approvedBy?.name || null,
        ot_approved_by_name: otApprovedBy?.name || null,
        total_hours: totalHours,
        overtime_hours: overtimeHours,
      };
      
      return res.json({ timesheet: enrichedTimesheet });
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

    const Timesheet = require('../models/Timesheet');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const ProjectMerged = require('../models/ProjectMerged');
    const mongoose = require('mongoose');
      
      // Validate project assignment if project is provided
      if (finalProjectId) {
        const employee = await EmployeeMerged.findById(finalStaffId).lean();
        if (!employee) {
          return res.status(400).json({ message: 'Employee not found' });
        }
        
        // Check if employee is assigned to this project
        const project = await ProjectMerged.findById(finalProjectId).lean();
        if (!project) {
          return res.status(400).json({ message: 'Project not found' });
        }
        
        const isAssigned = project.assigned_employees?.some(
          assignment => assignment.employee_id?.toString() === finalStaffId && assignment.status === 'active'
        ) || employee.project_assignments?.some(
          assignment => assignment.project_id?.toString() === finalProjectId && assignment.status === 'active'
        );
        
        if (!isAssigned) {
          return res.status(400).json({ 
            message: 'Employee is not assigned to this project on the selected date' 
          });
        }
      }
      
      // Check if timesheet already exists for this staff and date
      const workDateNormalized = new Date(finalWorkDate);
      workDateNormalized.setHours(0, 0, 0, 0);
      
      const existing = await Timesheet.findOne({
        staff_id: finalStaffId,
        work_date: workDateNormalized,
      });
      
      if (existing) {
        return res.status(400).json({ message: 'Timesheet already exists for this staff on this date' });
      }
      
      // Calculate hours
      const checkInTime = new Date(finalCheckIn);
      const checkOutTime = finalCheckOut ? new Date(finalCheckOut) : null;
      let totalHours = 0;
      let overtimeHours = 0;
      
      if (checkOutTime) {
        const hoursDiff = (checkOutTime - checkInTime) / (1000 * 60 * 60);
        totalHours = Math.max(0, hoursDiff);
        const regularHours = 8;
        overtimeHours = Math.max(0, totalHours - regularHours);
      }
      
      const adminId = req.user?.userId || req.user?.id;
      const timesheetId = uuidv4();
      
      const newTimesheet = new Timesheet({
        _id: timesheetId,
        staff_id: finalStaffId,
        work_date: workDateNormalized,
        check_in: checkInTime,
        check_out: checkOutTime,
        total_hours: mongoose.Types.Decimal128.fromString(totalHours.toFixed(2)),
        overtime_hours: mongoose.Types.Decimal128.fromString(overtimeHours.toFixed(2)),
        project_id: finalProjectId || null,
        task_type: finalTaskType || null,
        status: status || 'Present',
        approval_status: 'Draft',
        ot_approval_status: overtimeHours > 0 ? 'Pending' : null,
        remarks: remarks || null,
        created_by: adminId || null,
      });
      
      await newTimesheet.save();
      
      // Enrich with employee and project names
      const [employee, project] = await Promise.all([
        EmployeeMerged.findById(finalStaffId).select('name email role').lean(),
        finalProjectId ? ProjectMerged.findById(finalProjectId).select('name').lean() : null,
      ]);
      
      const timesheetData = newTimesheet.toJSON();
      timesheetData.id = timesheetData._id;
      timesheetData.staff_name = employee?.name || null;
      timesheetData.staff_email = employee?.email || null;
      timesheetData.staff_role = employee?.role || null;
      timesheetData.project_name = project?.name || null;
      timesheetData.total_hours = totalHours;
      timesheetData.overtime_hours = overtimeHours;
      
      return res.status(201).json({ timesheet: timesheetData });
  } catch (error) {
    console.error('Create timesheet error', error);
    if (error.message.includes('overlapping') || 
        error.message.includes('future') ||
        error.message.includes('Maximum') ||
        error.message.includes('Check-out')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('UNIQUE') || error.code === 11000) {
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
    
    const Timesheet = require('../models/Timesheet');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const ProjectMerged = require('../models/ProjectMerged');
    const mongoose = require('mongoose');
      
      // Check if timesheet exists and is not approved
      const existing = await Timesheet.findById(id).lean();
      
      if (!existing) {
        return res.status(404).json({ message: 'Timesheet not found' });
      }
      
      if (existing.approval_status === 'Approved') {
        return res.status(400).json({ message: 'Cannot edit approved timesheet' });
      }

      // Validate project assignment if project is provided
      if (finalProjectId !== undefined && finalProjectId) {
        const staffId = existing.staff_id;
        const workDateToCheck = finalWorkDate ? new Date(finalWorkDate) : existing.work_date;
        
        const employee = await EmployeeMerged.findById(staffId).lean();
        if (!employee) {
          return res.status(400).json({ message: 'Employee not found' });
        }
        
        const project = await ProjectMerged.findById(finalProjectId).lean();
        if (!project) {
          return res.status(400).json({ message: 'Project not found' });
        }
        
        const isAssigned = project.assigned_employees?.some(
          assignment => assignment.employee_id?.toString() === staffId.toString() && assignment.status === 'active'
        ) || employee.project_assignments?.some(
          assignment => assignment.project_id?.toString() === finalProjectId && assignment.status === 'active'
        );
        
        if (!isAssigned) {
          return res.status(400).json({ 
            message: 'Employee is not assigned to this project on the selected date' 
          });
        }
      }
      
      // Build update object
      const updateData = {
        updated_at: new Date(),
      };
      
      if (finalWorkDate !== undefined) {
        const workDateNormalized = new Date(finalWorkDate);
        workDateNormalized.setHours(0, 0, 0, 0);
        updateData.work_date = workDateNormalized;
      }
      
      if (finalCheckIn !== undefined) {
        updateData.check_in = new Date(finalCheckIn);
      }
      
      if (finalCheckOut !== undefined) {
        updateData.check_out = finalCheckOut ? new Date(finalCheckOut) : null;
      }
      
      if (finalProjectId !== undefined) {
        updateData.project_id = finalProjectId || null;
      }
      
      if (finalTaskType !== undefined) {
        updateData.task_type = finalTaskType || null;
      }
      
      if (status !== undefined) {
        updateData.status = status;
      }
      
      if (remarks !== undefined) {
        updateData.remarks = remarks || null;
      }
      
      // Recalculate hours if check_in or check_out changed
      if (finalCheckIn !== undefined || finalCheckOut !== undefined) {
        const checkInTime = finalCheckIn ? new Date(finalCheckIn) : new Date(existing.check_in);
        const checkOutTime = finalCheckOut !== undefined 
          ? (finalCheckOut ? new Date(finalCheckOut) : null)
          : (existing.check_out ? new Date(existing.check_out) : null);
        
        if (checkOutTime) {
          const hoursDiff = (checkOutTime - checkInTime) / (1000 * 60 * 60);
          const totalHours = Math.max(0, hoursDiff);
          const regularHours = 8;
          const overtimeHours = Math.max(0, totalHours - regularHours);
          
          updateData.total_hours = mongoose.Types.Decimal128.fromString(totalHours.toFixed(2));
          updateData.overtime_hours = mongoose.Types.Decimal128.fromString(overtimeHours.toFixed(2));
          
          // Update OT approval status if overtime exists
          if (overtimeHours > 0 && !existing.ot_approval_status) {
            updateData.ot_approval_status = 'Pending';
          } else if (overtimeHours === 0) {
            updateData.ot_approval_status = null;
          }
        }
      }
      
      const updated = await Timesheet.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      ).lean();
      
      // Enrich with employee and project names
      const [employee, project] = await Promise.all([
        EmployeeMerged.findById(updated.staff_id).select('name email role').lean(),
        updated.project_id ? ProjectMerged.findById(updated.project_id).select('name').lean() : null,
      ]);
      
      const timesheetData = {
        ...updated,
        id: updated._id,
        staff_name: employee?.name || null,
        staff_email: employee?.email || null,
        staff_role: employee?.role || null,
        project_name: project?.name || null,
        total_hours: updated.total_hours ? parseFloat(updated.total_hours.toString()) : 0,
        overtime_hours: updated.overtime_hours ? parseFloat(updated.overtime_hours.toString()) : 0,
      };
      
      return res.json({ timesheet: timesheetData });
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
    
    const Timesheet = require('../models/Timesheet');
      
      const existing = await Timesheet.findById(id).lean();
      
      if (!existing) {
        return res.status(404).json({ message: 'Timesheet not found' });
      }
      
      if (existing.approval_status === 'Approved') {
        return res.status(400).json({ message: 'Timesheet is already approved' });
      }
      
      const updated = await Timesheet.findByIdAndUpdate(
        id,
        {
          $set: {
            approval_status: 'Submitted',
            updated_at: new Date(),
          }
        },
        { new: true }
      ).lean();
      
      return res.json({ timesheet: updated, message: 'Timesheet submitted for approval' });
  } catch (error) {
    console.error('Submit timesheet error', error);
    return res.status(500).json({ message: 'Failed to submit timesheet', error: error.message });
  }
};

// Approve timesheet
const approveTimesheet = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.userId || req.user?.id;
    
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const Timesheet = require('../models/Timesheet');
      
      const existing = await Timesheet.findById(id).lean();
      
      if (!existing) {
        return res.status(404).json({ message: 'Timesheet not found' });
      }
      
      if (existing.approval_status === 'Approved') {
        return res.status(400).json({ message: 'Timesheet is already approved' });
      }
      
      const updated = await Timesheet.findByIdAndUpdate(
        id,
        {
          $set: {
            approval_status: 'Approved',
            approved_by: adminId.toString(),
            approved_at: new Date(),
            updated_at: new Date(),
          }
        },
        { new: true }
      ).lean();
      
      return res.json({ timesheet: updated, message: 'Timesheet approved successfully' });
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
    const adminId = req.user?.userId || req.user?.id;
    
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const Timesheet = require('../models/Timesheet');
      
      const existing = await Timesheet.findById(id).lean();
      
      if (!existing) {
        return res.status(404).json({ message: 'Timesheet not found' });
      }
      
      if (existing.approval_status === 'Approved') {
        return res.status(400).json({ message: 'Cannot reject an approved timesheet' });
      }
      
      const updateData = {
        approval_status: 'Rejected',
        updated_at: new Date(),
      };
      
      if (reason) {
        updateData.remarks = reason;
      }
      
      const updated = await Timesheet.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      ).lean();
      
      return res.json({ timesheet: updated, message: 'Timesheet rejected' });
  } catch (error) {
    console.error('Reject timesheet error', error);
    return res.status(500).json({ message: 'Failed to reject timesheet', error: error.message });
  }
};

// Approve OT
const approveOT = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.userId || req.user?.id;
    
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const Timesheet = require('../models/Timesheet');
      
      const existing = await Timesheet.findById(id).lean();
      
      if (!existing) {
        return res.status(404).json({ message: 'Timesheet not found' });
      }
      
      const overtimeHours = existing.overtime_hours 
        ? parseFloat(existing.overtime_hours.toString()) 
        : 0;
      
      if (overtimeHours <= 0) {
        return res.status(400).json({ message: 'No overtime hours to approve' });
      }
      
      if (existing.ot_approval_status === 'Approved') {
        return res.status(400).json({ message: 'OT is already approved' });
      }
      
      const updated = await Timesheet.findByIdAndUpdate(
        id,
        {
          $set: {
            ot_approval_status: 'Approved',
            ot_approved_by: adminId.toString(),
            ot_approved_at: new Date(),
            updated_at: new Date(),
          }
        },
        { new: true }
      ).lean();
      
      return res.json({ timesheet: updated, message: 'Overtime approved successfully' });
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
    const adminId = req.user?.userId || req.user?.id;
    
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const Timesheet = require('../models/Timesheet');
      
      const existing = await Timesheet.findById(id).lean();
      
      if (!existing) {
        return res.status(404).json({ message: 'Timesheet not found' });
      }
      
      if (existing.ot_approval_status === 'Approved') {
        return res.status(400).json({ message: 'Cannot reject approved OT' });
      }
      
      const updateData = {
        ot_approval_status: 'Rejected',
        updated_at: new Date(),
      };
      
      if (reason) {
        updateData.ot_justification = reason;
      }
      
      const updated = await Timesheet.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      ).lean();
      
      return res.json({ timesheet: updated, message: 'Overtime rejected' });
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
    
    const Timesheet = require('../models/Timesheet');
      
      // Parse target date
      const targetDateObj = new Date(targetDate);
      const startOfDay = new Date(targetDateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDateObj);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Today's total OT hours (approved OT for today)
      const otRecords = await Timesheet.find({
        work_date: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
        ot_approval_status: 'Approved',
      }).select('overtime_hours').lean();
      
      const todayTotalOT = otRecords.reduce((sum, record) => {
        const otHours = record.overtime_hours;
        if (otHours) {
          return sum + parseFloat(otHours.toString());
        }
        return sum;
      }, 0);
      
      // Pending timesheet approvals
      // Count timesheets that need approval:
      // - 'Submitted': explicitly submitted and waiting for approval
      // - 'Draft': created but not yet submitted (also need approval eventually)
      const pendingCount = await Timesheet.countDocuments({
        approval_status: { $in: ['Draft', 'Submitted'] },
      });
      
      // Pending OT approvals
      // Use aggregation to properly handle Decimal128 and filter correctly
      // Count timesheets where:
      // 1. ot_approval_status = 'Pending'
      // 2. overtime_hours > 0 (convert Decimal128 to number for comparison)
      // 3. approval_status is not 'Rejected' (can't approve OT for rejected timesheets)
      const pendingOTResult = await Timesheet.aggregate([
        {
          $match: {
            ot_approval_status: 'Pending',
            approval_status: { $ne: 'Rejected' },
          }
        },
        {
          $addFields: {
            otHoursNum: {
              $cond: {
                if: { $eq: [{ $type: '$overtime_hours' }, 'decimal'] },
                then: { $toDouble: '$overtime_hours' },
                else: { $ifNull: ['$overtime_hours', 0] }
              }
            }
          }
        },
        {
          $match: {
            otHoursNum: { $gt: 0 }
          }
        },
        {
          $count: 'count'
        }
      ]);
      
      const pendingOTCount = pendingOTResult.length > 0 ? pendingOTResult[0].count : 0;
      
      return res.json({
        todayTotalOT: todayTotalOT || 0,
        pendingTimesheetApprovals: pendingCount || 0,
        pendingOTApprovals: pendingOTCount || 0,
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
    
    const Timesheet = require('../models/Timesheet');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const ProjectMerged = require('../models/ProjectMerged');
    
    if (type === 'individual') {
      // Individual timesheet report
      const query = {};
      
      if (staffId) {
        query.staff_id = staffId;
      }
      
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
      
      const timesheets = await Timesheet.find(query)
        .sort({ work_date: -1 })
        .lean();
      
      // Enrich with employee and project names
      const employeeIds = [...new Set(timesheets.map(t => t.staff_id).filter(Boolean))];
      const projectIds = [...new Set(timesheets.map(t => t.project_id).filter(Boolean))];
      
      const [employees, projects] = await Promise.all([
        EmployeeMerged.find({
          $or: [
            { _id: { $in: employeeIds } },
            { user_id: { $in: employeeIds } },
          ]
        }).select('_id user_id name email').lean(),
        ProjectMerged.find({ _id: { $in: projectIds } }).select('_id name').lean(),
      ]);
      
      const employeeMap = new Map();
      employees.forEach(e => {
        employeeMap.set(e._id.toString(), e);
        if (e.user_id) {
          employeeMap.set(e.user_id.toString(), e);
        }
      });
      const projectMap = new Map(projects.map(p => [p._id.toString(), p]));
      
      const reports = timesheets.map(t => {
        const employee = employeeMap.get(t.staff_id?.toString());
        const project = projectMap.get(t.project_id?.toString());
        
        return {
          ...t,
          id: t._id,
          staff_id: t.staff_id?.toString() || null,
          staff_name: employee?.name || null,
          staff_email: employee?.email || null,
          project_id: t.project_id?.toString() || null,
          project_name: project?.name || null,
          total_hours: t.total_hours ? parseFloat(t.total_hours.toString()) : 0,
          overtime_hours: t.overtime_hours ? parseFloat(t.overtime_hours.toString()) : 0,
        };
      });
      
      return res.json({ reports });
      
    } else if (type === 'monthly_ot') {
      // Monthly OT summary
      const targetMonth = month ? parseInt(month, 10) : new Date().getMonth() + 1;
      const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
      
      const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
      const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
      
      const matchQuery = {
        work_date: {
          $gte: startOfMonth,
          $lte: endOfMonth,
        },
        ot_approval_status: 'Approved',
      };
      
      if (staffId) {
        matchQuery.staff_id = staffId;
      }
      
      const reports = await Timesheet.aggregate([
        {
          $match: matchQuery
        },
        {
          $addFields: {
            otHoursNum: {
              $cond: {
                if: { $eq: [{ $type: '$overtime_hours' }, 'decimal'] },
                then: { $toDouble: '$overtime_hours' },
                else: { $ifNull: ['$overtime_hours', 0] }
              }
            }
          }
        },
        {
          $match: {
            otHoursNum: { $gt: 0 }
          }
        },
        {
          $group: {
            _id: '$staff_id',
            total_ot_hours: { $sum: '$otHoursNum' },
            ot_days: { $sum: 1 }
          }
        },
        {
          $sort: { total_ot_hours: -1 }
        }
      ]);
      
      // Enrich with employee names
      const staffIds = reports.map(r => r._id).filter(Boolean);
      const employees = await EmployeeMerged.find({
        $or: [
          { _id: { $in: staffIds } },
          { user_id: { $in: staffIds } },
        ]
      }).select('_id user_id name email').lean();
      
      const employeeMap = new Map();
      employees.forEach(e => {
        employeeMap.set(e._id.toString(), e);
        if (e.user_id) {
          employeeMap.set(e.user_id.toString(), e);
        }
      });
      
      const enrichedReports = reports.map(r => {
        const employee = employeeMap.get(r._id?.toString());
        return {
          staff_id: r._id?.toString() || null,
          staff_name: employee?.name || null,
          staff_email: employee?.email || null,
          total_ot_hours: r.total_ot_hours || 0,
          ot_days: r.ot_days || 0,
        };
      });
      
      return res.json({ reports: enrichedReports });
      
    } else if (type === 'project_ot_cost') {
      // Project-wise OT cost report
      const matchQuery = {
        ot_approval_status: 'Approved',
      };
      
      if (startDate || endDate) {
        matchQuery.work_date = {};
        if (startDate) {
          matchQuery.work_date.$gte = new Date(startDate);
        }
        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999);
          matchQuery.work_date.$lte = endDateObj;
        }
      }
      
      if (projectId) {
        matchQuery.project_id = projectId;
      }
      
      const reports = await Timesheet.aggregate([
        {
          $match: matchQuery
        },
        {
          $addFields: {
            otHoursNum: {
              $cond: {
                if: { $eq: [{ $type: '$overtime_hours' }, 'decimal'] },
                then: { $toDouble: '$overtime_hours' },
                else: { $ifNull: ['$overtime_hours', 0] }
              }
            }
          }
        },
        {
          $match: {
            otHoursNum: { $gt: 0 }
          }
        },
        {
          $group: {
            _id: '$project_id',
            staff_count: { $addToSet: '$staff_id' },
            total_ot_hours: { $sum: '$otHoursNum' },
            ot_days: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 1,
            project_id: '$_id',
            staff_count: { $size: '$staff_count' },
            total_ot_hours: 1,
            ot_days: 1
          }
        },
        {
          $sort: { total_ot_hours: -1 }
        }
      ]);
      
      // Enrich with project names
      const projectIds = reports.map(r => r.project_id).filter(Boolean);
      const projects = await ProjectMerged.find({ _id: { $in: projectIds } })
        .select('_id name')
        .lean();
      
      const projectMap = new Map(projects.map(p => [p._id.toString(), p]));
      
      const enrichedReports = reports.map(r => {
        const project = projectMap.get(r.project_id?.toString());
        return {
          project_id: r.project_id?.toString() || null,
          project_name: project?.name || null,
          staff_count: r.staff_count || 0,
          total_ot_hours: r.total_ot_hours || 0,
          ot_days: r.ot_days || 0,
        };
      });
      
      return res.json({ reports: enrichedReports });
      
    } else {
      return res.status(400).json({ message: 'Invalid report type' });
    }
  } catch (error) {
    console.error('Get timesheet reports error', error);
    return res.status(500).json({ message: 'Failed to fetch reports', error: error.message });
  }
};

// Bulk approve timesheets
const bulkApproveTimesheets = async (req, res) => {
  try {
    const { ids } = req.body; // Array of timesheet IDs
    const adminId = req.user?.userId || req.user?.id;
    
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Please provide an array of timesheet IDs' });
    }
    
    const Timesheet = require('../models/Timesheet');
      
      // Find all timesheets that can be approved (not already approved)
      const timesheets = await Timesheet.find({
        _id: { $in: ids },
        approval_status: { $ne: 'Approved' }
      }).lean();
      
      if (timesheets.length === 0) {
        return res.status(400).json({ message: 'No timesheets found to approve. They may already be approved.' });
      }
      
      // Update all timesheets
      const result = await Timesheet.updateMany(
        { _id: { $in: timesheets.map(t => t._id) } },
        {
          $set: {
            approval_status: 'Approved',
            approved_by: adminId.toString(),
            approved_at: new Date(),
            updated_at: new Date(),
          }
        }
      );
      
      return res.json({
        success: true,
        message: `Successfully approved ${result.modifiedCount} timesheet(s)`,
        approved: result.modifiedCount,
        total: ids.length,
        skipped: ids.length - result.modifiedCount,
      });
  } catch (error) {
    console.error('Bulk approve timesheets error', error);
    return res.status(500).json({ message: 'Failed to bulk approve timesheets', error: error.message });
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
  bulkApproveTimesheets,
};

