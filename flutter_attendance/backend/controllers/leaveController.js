const { uploadLeaveDocument } = require('../services/uploadService');
const emailService = require('../services/emailService');
const leaveRepository = require('../repositories/leaveRepository');

// Get all leave types
const getLeaveTypes = async (req, res) => {
  try {
    const { LeaveType } = require('../models/LeaveMerged');
    const leaveTypes = await LeaveType.find().sort({ name: 1 }).lean();
    return res.json({ leaveTypes });
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
    
    const EmployeeMerged = require('../models/EmployeeMerged');
    const { LeaveType } = require('../models/LeaveMerged');
      
      // Find employee
      const employee = await EmployeeMerged.findById(employeeId).lean();
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      
      // Get all leave types
      const leaveTypes = await LeaveType.find().lean();
      
      // Get leave balances from employee document
      const balances = [];
      if (employee.leave_balances && Array.isArray(employee.leave_balances)) {
        for (const balance of employee.leave_balances) {
          if (balance.year === currentYear) {
            const leaveType = leaveTypes.find(lt => lt._id === balance.leave_type_id);
            balances.push({
              ...balance,
              leave_type_name: leaveType?.name || null,
              leave_type_code: leaveType?.code || null,
              remaining_days: balance.remaining_days ? parseFloat(balance.remaining_days.toString()) : 0,
              total_days: balance.total_days ? parseFloat(balance.total_days.toString()) : 0,
              used_days: balance.used_days ? parseFloat(balance.used_days.toString()) : 0,
            });
          }
        }
      }
      
      // Sort by leave type name
      balances.sort((a, b) => {
        const nameA = a.leave_type_name || '';
        const nameB = b.leave_type_name || '';
        return nameA.localeCompare(nameB);
      });
      
      return res.json({ balances });
  } catch (error) {
    console.error('Get leave balance error', error);
    return res.status(500).json({ message: 'Failed to fetch leave balance' });
  }
};

// Get all leave requests
const getLeaveRequests = async (req, res) => {
  try {
    const { employeeId, status, year, month } = req.query;
    
    const filters = {};
    if (employeeId) filters.employeeId = employeeId;
    if (status) filters.status = status;
    if (year) filters.year = parseInt(year, 10);
    if (month) filters.month = parseInt(month, 10);
    
    const requests = await leaveRepository.findAll(filters);
    return res.json({ requests });
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
    
    // Calculate number of days (working days, excluding weekends)
    let numberOfDays = 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate working days (exclude weekends: Saturday = 6, Sunday = 0)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        numberOfDays++;
      }
    }
    
    if (numberOfDays <= 0) {
      return res.status(400).json({ message: 'Invalid date range' });
    }
    
    // Get leave type code
    const { LeaveType } = require('../models/LeaveMerged');
    const leaveType = await LeaveType.findById(leaveTypeId).lean();
    if (!leaveType) {
      return res.status(400).json({ message: 'Invalid leave type' });
    }
    const leaveTypeCode = leaveType.code;
    
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
      const EmployeeMerged = require('../models/EmployeeMerged');
      const employee = await EmployeeMerged.findById(employeeId).lean();
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      
      // Find leave balance for this year and leave type
      const balance = employee.leave_balances?.find(
        b => b.leave_type_id === leaveTypeId && b.year === currentYear
      );
      
      const remainingDays = balance?.remaining_days 
        ? parseFloat(balance.remaining_days.toString()) 
        : 0;
      
      if (remainingDays < numberOfDays) {
        return res.status(400).json({ 
          message: 'Insufficient annual leave balance' 
        });
      }
    }
    
    // Validate stand-in employee exists if provided
    if (standInEmployeeId) {
      const EmployeeMerged = require('../models/EmployeeMerged');
      const standInEmployee = await EmployeeMerged.findById(standInEmployeeId).lean();
      if (!standInEmployee) {
        return res.status(400).json({ message: 'Invalid stand-in employee' });
      }
    }
    
    // Create leave request using repository
    const leaveRequest = await leaveRepository.create({
      employee_id: employeeId,
      leave_type_id: leaveTypeId,
      project_id: projectId || null,
      start_date: startDate,
      end_date: endDate,
      number_of_days: numberOfDays,
      reason: reason || null,
      mc_document_url: mcDocumentUrl,
      stand_in_employee_id: standInEmployeeId || null,
      status: 'pending',
    });
    
    // Send email notification to admin (async, don't wait)
    (async () => {
      try {
        const EmployeeMerged = require('../models/EmployeeMerged');
        const { LeaveType } = require('../models/LeaveMerged');
        
        const [emp, leaveType, standIn] = await Promise.all([
          EmployeeMerged.findById(employeeId).select('name email').lean(),
          LeaveType.findById(leaveTypeId).select('name').lean(),
          standInEmployeeId 
            ? EmployeeMerged.findById(standInEmployeeId).select('name').lean()
            : Promise.resolve(null)
        ]);
        
        const employee = emp;
        const leaveTypeName = leaveType?.name;
        const standInName = standIn?.name || null;
        
        if (employee && leaveTypeName) {
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
    // User ID from token (set by authMiddleware)
    const adminId = req.user.userId;
    
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Get the leave request first to check current status
    const existingRequest = await leaveRepository.findById(requestId);
    
    if (!existingRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    
    // If already approved/rejected, don't allow status change (unless cancelling)
    if (existingRequest.status === 'approved' && status !== 'cancelled') {
      return res.status(400).json({ message: 'Leave request is already approved' });
    }
    if (existingRequest.status === 'rejected' && status !== 'cancelled') {
      return res.status(400).json({ message: 'Leave request is already rejected' });
    }
    
    const updateData = {
      status,
    };
    
    if (status === 'approved') {
      updateData.approved_by = adminId;
      updateData.approved_at = new Date().toISOString();
      updateData.rejection_reason = null;
      
      // Note: AL balance deduction needs to be handled in application logic
      // Approved leaves are automatically included in monthly summary calculations
      // No need to create attendance_logs records - monthly summary queries leave_requests directly
    } else if (status === 'rejected') {
      updateData.rejection_reason = rejectionReason || null;
      updateData.approved_by = adminId;
      updateData.approved_at = new Date().toISOString();
    }
    
    const updatedRequest = await leaveRepository.update(requestId, updateData);
    
    if (!updatedRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    
    // Send email notification to staff (async, don't wait)
    if (status === 'approved' || status === 'rejected') {
      (async () => {
        try {
          const EmployeeMerged = require('../models/EmployeeMerged');
          const User = require('../models/User');
          const { LeaveType } = require('../models/LeaveMerged');
          
          const [emp, admin, leaveType] = await Promise.all([
            EmployeeMerged.findById(updatedRequest.employee_id).select('name email').lean(),
            User.findById(adminId).select('name email').lean(),
            LeaveType.findById(updatedRequest.leave_type_id).select('name').lean()
          ]);
          
          const employee = emp;
          const adminName = admin?.name || 'Administrator';
          const leaveTypeName = leaveType?.name;
          
          if (employee && leaveTypeName) {
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
    
    // MongoDB implementation
    const { LeaveRequest, LeaveType } = require('../models/LeaveMerged');
      
      // Pending requests count
      const pendingCount = await LeaveRequest.countDocuments({ status: 'pending' });
      
      // Get all leave types
      const leaveTypes = await LeaveType.find().lean();
      
      // Leave usage by type
      const usageByType = await Promise.all(
        leaveTypes.map(async (lt) => {
          const yearStart = new Date(currentYear, 0, 1);
          const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
          
          const approvedLeaves = await LeaveRequest.find({
            'leave_type.leave_type_id': lt._id,
            start_date: { $gte: yearStart, $lte: yearEnd },
            status: 'approved',
          }).lean();
          
          const requestCount = approvedLeaves.length;
          const totalDays = approvedLeaves.reduce((sum, leave) => {
            const days = leave.number_of_days;
            return sum + (days ? parseFloat(days.toString()) : 0);
          }, 0);
          
          return {
            leave_type_name: lt.name,
            leave_type_code: lt.code,
            request_count: requestCount,
            total_days: totalDays,
          };
        })
      );
      
      // Monthly leave usage
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
      
      const approvedLeaves = await LeaveRequest.find({
        start_date: { $gte: yearStart, $lte: yearEnd },
        status: 'approved',
      }).lean();
      
      const monthlyUsageMap = new Map();
      approvedLeaves.forEach((leave) => {
        const month = new Date(leave.start_date).getMonth() + 1; // 1-12
        if (!monthlyUsageMap.has(month)) {
          monthlyUsageMap.set(month, { request_count: 0, total_days: 0 });
        }
        const monthData = monthlyUsageMap.get(month);
        monthData.request_count++;
        const days = leave.number_of_days;
        monthData.total_days += days ? parseFloat(days.toString()) : 0;
      });
      
      const monthlyUsage = Array.from(monthlyUsageMap.entries())
        .map(([month, data]) => ({
          month,
          request_count: data.request_count,
          total_days: data.total_days,
        }))
        .sort((a, b) => a.month - b.month);
      
      return res.json({
        pendingCount: pendingCount || 0,
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
    // MongoDB: This would need to be implemented as application logic
    // For now, return a message indicating it's not implemented
    return res.status(501).json({ 
      message: 'Leave balance initialization for MongoDB is not yet implemented. Please use the admin interface to manage leave balances.' 
    });
  } catch (error) {
    console.error('Initialize leave balances error', error);
    return res.status(500).json({ message: 'Failed to initialize leave balances' });
  }
};

// Bulk approve leave requests
const bulkApproveLeaveRequests = async (req, res) => {
  try {
    const { requestIds } = req.body;
    const adminId = req.user.userId;

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({ message: 'Request IDs array is required' });
    }

    const { LeaveRequest } = require('../models/LeaveMerged');
      
      // Validate all requests exist and are pending
      const existingRequests = await LeaveRequest.find({
        _id: { $in: requestIds }
      }).lean();

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
      const updateResult = await LeaveRequest.updateMany(
        { _id: { $in: requestIds }, status: 'pending' },
        {
          $set: {
            status: 'approved',
            approved_by: adminId,
            approved_at: new Date(),
            rejection_reason: null,
            updated_at: new Date(),
          }
        }
      );

      // Fetch updated requests
      const approvedRequests = await LeaveRequest.find({
        _id: { $in: requestIds }
      }).lean();

      // Send email notifications (async, don't wait)
      (async () => {
        const EmployeeMerged = require('../models/EmployeeMerged');
        const User = require('../models/User');
        const { LeaveType } = require('../models/LeaveMerged');
        
        for (const leaveRequest of approvedRequests) {
          try {
            const [employee, admin, leaveType] = await Promise.all([
              EmployeeMerged.findById(leaveRequest.employee_id).select('name email').lean(),
              User.findById(adminId).select('name email').lean(),
              LeaveType.findById(leaveRequest.leave_type_id).select('name').lean()
            ]);

            if (employee && leaveType) {
              const adminName = admin?.name || 'Administrator';
              await emailService.sendLeaveStatusNotification(
                {
                  ...leaveRequest,
                  leave_type_name: leaveType.name,
                },
                employee,
                'approved',
                adminName,
                null
              );
            }
          } catch (emailError) {
            console.error(`Failed to send email notification for leave request ${leaveRequest._id}:`, emailError);
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

