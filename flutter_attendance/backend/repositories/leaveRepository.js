const { LeaveRequest, LeaveType } = require('../models/LeaveMerged');
const EmployeeMerged = require('../models/EmployeeMerged');
const ProjectMerged = require('../models/ProjectMerged');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Helper function to convert MongoDB Decimal128 to number
const convertDecimal128 = (value) => {
  if (!value && value !== 0) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  if (value && typeof value === 'object') {
    // Handle MongoDB Decimal128 format: { $numberDecimal: "123.45" }
    if (value.$numberDecimal) {
      return parseFloat(value.$numberDecimal);
    }
    // Handle Mongoose Decimal128 object
    if (value.toString) {
      return parseFloat(value.toString());
    }
  }
  return null;
};

class LeaveRepository {
  async findAll(filters = {}) {
    const query = {};
    
    if (filters.employeeId) {
      query.employee_id = filters.employeeId;
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.year) {
      query.start_date = {
        $gte: new Date(`${filters.year}-01-01`),
        $lte: new Date(`${filters.year}-12-31`),
      };
    }
    if (filters.month) {
      const year = filters.year || new Date().getFullYear();
      query.start_date = {
        $gte: new Date(`${year}-${filters.month}-01`),
        $lte: new Date(`${year}-${filters.month}-31`),
      };
    }
    
    const leaveRequests = await LeaveRequest.find(query)
      .sort({ created_at: -1 })
      .lean();
    
    // Get unique IDs for batch fetching
    const employeeIds = [...new Set(leaveRequests.map(lr => lr.employee_id).filter(Boolean))];
    const projectIds = [...new Set(leaveRequests.map(lr => lr.project_id).filter(Boolean))];
    const leaveTypeIds = [...new Set(leaveRequests.map(lr => lr.leave_type_id).filter(Boolean))];
    
    // Batch fetch employees, projects (with assigned employees), and leave types
    const [employees, allProjects, leaveTypes] = await Promise.all([
      employeeIds.length > 0 ? EmployeeMerged.find({ _id: { $in: employeeIds } })
        .select('_id name email')
        .lean() : Promise.resolve([]),
      ProjectMerged.find({})
        .select('_id name assigned_employees')
        .lean(),
      leaveTypeIds.length > 0 ? LeaveType.find({ _id: { $in: leaveTypeIds } })
        .select('_id name code')
        .lean() : Promise.resolve([]),
    ]);
    
    // Create lookup maps
    const employeeMap = new Map();
    employees.forEach(emp => {
      employeeMap.set(emp._id.toString(), emp);
    });
    
    const projectMap = new Map();
    allProjects.forEach(proj => {
      projectMap.set(proj._id.toString(), proj);
    });
    
    // Create employee-to-project mapping from project assignments
    const employeeProjectMap = new Map();
    const now = new Date();
    allProjects.forEach(project => {
      if (project.assigned_employees && Array.isArray(project.assigned_employees)) {
        project.assigned_employees.forEach(assignment => {
          if (assignment.employee_id && assignment.status === 'active') {
            // Check if assignment is still active (not expired)
            let isActive = true;
            if (assignment.assignment_end_date) {
              const endDate = new Date(assignment.assignment_end_date);
              if (endDate < now) {
                isActive = false;
              }
            }
            
            if (isActive) {
              // Use the first active project found for each employee
              if (!employeeProjectMap.has(assignment.employee_id.toString())) {
                employeeProjectMap.set(assignment.employee_id.toString(), project._id.toString());
              }
            }
          }
        });
      }
    });
    
    const leaveTypeMap = new Map();
    leaveTypes.forEach(lt => {
      leaveTypeMap.set(lt._id.toString(), lt);
    });
    
    // Helper function to get employee's active project assignment
    const getEmployeeProject = (employeeId) => {
      if (!employeeId) return null;
      return employeeProjectMap.get(employeeId.toString()) || null;
    };
    
    // Enrich leave requests with related data
    return leaveRequests.map(leave => {
      const employee = leave.employee_id ? employeeMap.get(leave.employee_id.toString()) : null;
      
      // Get project: first from leave request, then from employee's active assignment in projects
      let projectId = leave.project_id;
      if (!projectId && leave.employee_id) {
        projectId = getEmployeeProject(leave.employee_id);
      }
      
      const project = projectId ? projectMap.get(projectId.toString()) : null;
      const leaveType = leave.leave_type_id ? leaveTypeMap.get(leave.leave_type_id.toString()) : null;
      
      return {
        ...leave,
        id: leave._id,
        number_of_days: convertDecimal128(leave.number_of_days),
        employee_name: employee?.name || null,
        employee_email: employee?.email || null,
        project_name: project?.name || null,
        project_id: projectId || null,
        leave_type_name: leaveType?.name || leave.leave_type?.name || null,
        leave_type_code: leaveType?.code || leave.leave_type?.code || null,
      };
    });
  }

  async findById(id) {
    const leaveRequest = await LeaveRequest.findById(id).lean();
    if (!leaveRequest) return null;
    
    // Convert Decimal128 fields
    return {
      ...leaveRequest,
      id: leaveRequest._id,
      number_of_days: convertDecimal128(leaveRequest.number_of_days),
    };
  }

  async create(leaveData) {
    const id = leaveData.id || uuidv4();
    const leaveRequest = new LeaveRequest({
      _id: id,
      ...leaveData,
      number_of_days: leaveData.number_of_days ? mongoose.Types.Decimal128.fromString(leaveData.number_of_days.toString()) : null,
    });
    await leaveRequest.save();
    return leaveRequest.toJSON();
  }

  async update(id, updateData) {
    const mongoUpdateData = { ...updateData };
    if (mongoUpdateData.number_of_days !== undefined && mongoUpdateData.number_of_days !== null) {
      mongoUpdateData.number_of_days = mongoose.Types.Decimal128.fromString(mongoUpdateData.number_of_days.toString());
    }
    
    const leaveRequest = await LeaveRequest.findByIdAndUpdate(id, mongoUpdateData, { new: true }).lean();
    if (!leaveRequest) return null;
    
    return {
      ...leaveRequest,
      id: leaveRequest._id,
      number_of_days: convertDecimal128(leaveRequest.number_of_days),
    };
  }

  async delete(id) {
    const result = await LeaveRequest.findByIdAndDelete(id);
    return result !== null;
  }
}

module.exports = new LeaveRepository();
