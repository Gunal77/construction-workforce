/**
 * Quick script to verify MongoDB data after migration
 * 
 * Usage: node scripts/verify-mongodb-data.js
 */

const { connectMongoDB, disconnectMongoDB } = require('../config/mongodb');
const User = require('../models/User');
const Employee = require('../models/EmployeeMerged');
const Project = require('../models/ProjectMerged');
const Attendance = require('../models/AttendanceMerged');
const { LeaveRequest, LeaveType, LeaveBalance } = require('../models/LeaveMerged');
const Task = require('../models/Task');

async function verifyData() {
  try {
    console.log('\n🔍 Verifying MongoDB Data...\n');
    
    await connectMongoDB();
    console.log('✅ Connected to MongoDB\n');
    
    // Count documents in each collection
    const userCount = await User.countDocuments();
    const employeeCount = await Employee.countDocuments();
    const projectCount = await Project.countDocuments();
    const attendanceCount = await Attendance.countDocuments();
    const leaveTypeCount = await LeaveType.countDocuments();
    const leaveBalanceCount = await LeaveBalance.countDocuments();
    const leaveRequestCount = await LeaveRequest.countDocuments();
    const taskCount = await Task.countDocuments();
    
    console.log('📊 Document Counts:');
    console.log('='.repeat(50));
    console.log(`Users:           ${userCount}`);
    console.log(`Employees:        ${employeeCount}`);
    console.log(`Projects:         ${projectCount}`);
    console.log(`Attendance:       ${attendanceCount}`);
    console.log(`Leave Types:      ${leaveTypeCount}`);
    console.log(`Leave Balances:   ${leaveBalanceCount}`);
    console.log(`Leave Requests:   ${leaveRequestCount}`);
    console.log(`Tasks:            ${taskCount}`);
    console.log('='.repeat(50));
    
    // Sample data
    if (userCount > 0) {
      const sampleUser = await User.findOne().select('name email role');
      console.log(`\n📝 Sample User:`, sampleUser?.toJSON());
    }
    
    if (employeeCount > 0) {
      const sampleEmployee = await Employee.findOne().select('name email role');
      console.log(`📝 Sample Employee:`, sampleEmployee?.toJSON());
    }
    
    if (projectCount > 0) {
      const sampleProject = await Project.findOne().select('name location');
      console.log(`📝 Sample Project:`, sampleProject?.toJSON());
    }
    
    if (attendanceCount > 0) {
      const sampleAttendance = await Attendance.findOne().select('user_id work_date check_in_time');
      console.log(`📝 Sample Attendance:`, sampleAttendance?.toJSON());
    }
    
    console.log('\n✅ Verification complete!\n');
    
  } catch (error) {
    console.error('❌ Verification error:', error);
    process.exit(1);
  } finally {
    await disconnectMongoDB();
  }
}

verifyData();

