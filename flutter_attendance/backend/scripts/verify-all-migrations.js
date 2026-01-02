/**
 * Verify All Migrations from Supabase to MongoDB
 * 
 * This script checks if all data was successfully migrated to MongoDB
 * Usage: node scripts/verify-all-migrations.js
 */

const { connectMongoDB, disconnectMongoDB } = require('../config/mongodb');
const User = require('../models/User');
const EmployeeMerged = require('../models/EmployeeMerged');
const ProjectMerged = require('../models/ProjectMerged');
const AttendanceMerged = require('../models/AttendanceMerged');
// Import leave models correctly
const leaveModels = require('../models/LeaveMerged');
// LeaveMerged exports { LeaveRequest, LeaveType, LeaveBalance }
const LeaveRequest = leaveModels.LeaveRequest;
const LeaveType = leaveModels.LeaveType;
const LeaveBalance = leaveModels.LeaveBalance;
const Task = require('../models/Task');
const Timesheet = require('../models/Timesheet');
const MonthlySummary = require('../models/MonthlySummary');

async function verifyAllMigrations() {
  console.log('\n🔍 Verifying All MongoDB Migrations...\n');
  console.log('='.repeat(80));
  
  try {
    await connectMongoDB();
    console.log('✅ Connected to MongoDB\n');

    const results = {
      users: { count: 0, sample: null },
      employees: { count: 0, sample: null },
      projects: { count: 0, sample: null },
      attendance: { count: 0, sample: null },
      leaveTypes: { count: 0, sample: null },
      leaveBalances: { count: 0, sample: null },
      leaveRequests: { count: 0, sample: null },
      tasks: { count: 0, sample: null },
      timesheets: { count: 0, sample: null },
      monthlySummaries: { count: 0, sample: null },
    };

    // Check Users
    console.log('📊 Checking Users...');
    results.users.count = await User.countDocuments();
    results.users.sample = await User.findOne().select('_id name email role').lean();
    console.log(`   ✅ Users: ${results.users.count}`);
    if (results.users.sample) {
      console.log(`   Sample: ${results.users.sample.name} (${results.users.sample.email}) - ${results.users.sample.role}`);
    }

    // Check Employees
    console.log('\n📊 Checking Employees...');
    results.employees.count = await EmployeeMerged.countDocuments();
    results.employees.sample = await EmployeeMerged.findOne().select('_id name email role').lean();
    console.log(`   ✅ Employees: ${results.employees.count}`);
    if (results.employees.sample) {
      console.log(`   Sample: ${results.employees.sample.name} (${results.employees.sample.email || 'no email'})`);
    }

    // Check Projects
    console.log('\n📊 Checking Projects...');
    results.projects.count = await ProjectMerged.countDocuments();
    results.projects.sample = await ProjectMerged.findOne().select('_id name location').lean();
    console.log(`   ✅ Projects: ${results.projects.count}`);
    if (results.projects.sample) {
      console.log(`   Sample: ${results.projects.sample.name} (${results.projects.sample.location || 'no location'})`);
    }

    // Check Attendance
    console.log('\n📊 Checking Attendance...');
    results.attendance.count = await AttendanceMerged.countDocuments();
    results.attendance.sample = await AttendanceMerged.findOne().select('_id user_id check_in_time').lean();
    console.log(`   ✅ Attendance Records: ${results.attendance.count}`);
    if (results.attendance.sample) {
      console.log(`   Sample: User ${results.attendance.sample.user_id} - ${results.attendance.sample.check_in_time || 'no check-in'}`);
    }

    // Check Leave Types
    console.log('\n📊 Checking Leave Types...');
    results.leaveTypes.count = await LeaveType.countDocuments();
    results.leaveTypes.sample = await LeaveType.findOne().select('_id name code').lean();
    console.log(`   ✅ Leave Types: ${results.leaveTypes.count}`);
    if (results.leaveTypes.sample) {
      console.log(`   Sample: ${results.leaveTypes.sample.name} (${results.leaveTypes.sample.code})`);
    }

    // Check Leave Balances
    console.log('\n📊 Checking Leave Balances...');
    results.leaveBalances.count = await LeaveBalance.countDocuments();
    results.leaveBalances.sample = await LeaveBalance.findOne().select('_id employee_id leave_type_id').lean();
    console.log(`   ✅ Leave Balances: ${results.leaveBalances.count}`);
    if (results.leaveBalances.sample) {
      console.log(`   Sample: Employee ${results.leaveBalances.sample.employee_id} - Type ${results.leaveBalances.sample.leave_type_id}`);
    }

    // Check Leave Requests
    console.log('\n📊 Checking Leave Requests...');
    results.leaveRequests.count = await LeaveRequest.countDocuments();
    results.leaveRequests.sample = await LeaveRequest.findOne().select('_id employee_id status').lean();
    console.log(`   ✅ Leave Requests: ${results.leaveRequests.count}`);
    if (results.leaveRequests.sample) {
      console.log(`   Sample: Employee ${results.leaveRequests.sample.employee_id} - Status: ${results.leaveRequests.sample.status}`);
    }

    // Check Tasks
    console.log('\n📊 Checking Tasks...');
    results.tasks.count = await Task.countDocuments();
    results.tasks.sample = await Task.findOne().select('_id title status').lean();
    console.log(`   ✅ Tasks: ${results.tasks.count}`);
    if (results.tasks.sample) {
      console.log(`   Sample: ${results.tasks.sample.title} - Status: ${results.tasks.sample.status}`);
    }

    // Check Timesheets
    console.log('\n📊 Checking Timesheets...');
    results.timesheets.count = await Timesheet.countDocuments();
    results.timesheets.sample = await Timesheet.findOne().select('_id staff_id work_date total_hours').lean();
    console.log(`   ✅ Timesheets: ${results.timesheets.count}`);
    if (results.timesheets.sample) {
      const totalHours = results.timesheets.sample.total_hours ? parseFloat(results.timesheets.sample.total_hours.toString()) : 0;
      console.log(`   Sample: Staff ${results.timesheets.sample.staff_id} - Date: ${results.timesheets.sample.work_date} - Hours: ${totalHours}`);
    }

    // Check Monthly Summaries
    console.log('\n📊 Checking Monthly Summaries...');
    results.monthlySummaries.count = await MonthlySummary.countDocuments();
    results.monthlySummaries.sample = await MonthlySummary.findOne().select('_id employee_id month year status').lean();
    console.log(`   ✅ Monthly Summaries: ${results.monthlySummaries.count}`);
    if (results.monthlySummaries.sample) {
      console.log(`   Sample: Employee ${results.monthlySummaries.sample.employee_id} - ${results.monthlySummaries.sample.month}/${results.monthlySummaries.sample.year} - Status: ${results.monthlySummaries.sample.status}`);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📋 Migration Summary:');
    console.log('='.repeat(80));
    console.log(`Users:           ${results.users.count}`);
    console.log(`Employees:       ${results.employees.count}`);
    console.log(`Projects:        ${results.projects.count}`);
    console.log(`Attendance:      ${results.attendance.count}`);
    console.log(`Leave Types:     ${results.leaveTypes.count}`);
    console.log(`Leave Balances:   ${results.leaveBalances.count}`);
    console.log(`Leave Requests:   ${results.leaveRequests.count}`);
    console.log(`Tasks:           ${results.tasks.count}`);
    console.log(`Timesheets:      ${results.timesheets.count}`);
    console.log(`Monthly Summaries: ${results.monthlySummaries.count}`);
    console.log('='.repeat(80));

    // Check if critical data exists
    const criticalDataExists = 
      results.users.count > 0 &&
      results.employees.count > 0 &&
      results.projects.count > 0;

    if (criticalDataExists) {
      console.log('\n✅ Critical data migrated successfully!');
      console.log('   - Users, Employees, and Projects are present');
    } else {
      console.log('\n⚠️  Warning: Some critical data is missing!');
      if (results.users.count === 0) console.log('   - No users found');
      if (results.employees.count === 0) console.log('   - No employees found');
      if (results.projects.count === 0) console.log('   - No projects found');
    }

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await disconnectMongoDB();
    console.log('\nMongoDB disconnected');
  }
}

if (require.main === module) {
  verifyAllMigrations();
}

module.exports = { verifyAllMigrations };

