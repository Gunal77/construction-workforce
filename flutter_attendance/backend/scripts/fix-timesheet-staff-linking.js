/**
 * Fix Timesheet Staff Linking (MongoDB)
 * 
 * This script fixes timesheet staff_id to properly link to EmployeeMerged records
 */

const mongoose = require('mongoose');
const env = require('../config/env');
const Timesheet = require('../models/Timesheet');
const EmployeeMerged = require('../models/EmployeeMerged');
const AttendanceMerged = require('../models/AttendanceMerged');
const User = require('../models/User');

async function fixTimesheetStaffLinking() {
  console.log('🚀 Starting timesheet staff linking fix...');
  console.log(`\n📊 Database Provider: ${env.dbProvider.toUpperCase()}`);

  if (env.dbProvider !== 'mongodb') {
    console.error('This script is designed for MongoDB. Please set DB_PROVIDER=mongodb in your .env file.');
    return;
  }

  try {
    await mongoose.connect(env.mongodbUri);
    console.log('✅ Connected to MongoDB');

    // Get all employees with their user_id if available
    const employees = await EmployeeMerged.find({})
      .select('_id name email user_id')
      .lean();

    console.log(`\n📋 Found ${employees.length} employees`);

    // Get all users to map email to user_id
    const users = await User.find({})
      .select('_id email')
      .lean();

    console.log(`📋 Found ${users.length} users`);

    // Create maps for lookup
    const employeeByIdMap = new Map(employees.map(e => [e._id.toString(), e]));
    const employeeByUserIdMap = new Map();
    const userByEmailMap = new Map(users.map(u => [u.email?.toLowerCase(), u]));
    
    employees.forEach(emp => {
      if (emp.user_id) {
        employeeByUserIdMap.set(emp.user_id.toString(), emp);
      }
      if (emp.email) {
        const user = userByEmailMap.get(emp.email.toLowerCase());
        if (user) {
          employeeByUserIdMap.set(user._id.toString(), emp);
        }
      }
    });

    // Get all timesheets
    const timesheets = await Timesheet.find({})
      .select('_id staff_id')
      .lean();

    console.log(`\n📋 Found ${timesheets.length} timesheets to check`);

    // Get sample timesheets to understand the data structure
    const sampleTimesheets = await Timesheet.find({})
      .select('_id staff_id work_date')
      .limit(5)
      .lean();
    
    console.log('\n📋 Sample timesheet staff_ids:');
    sampleTimesheets.forEach(ts => {
      console.log(`   Timesheet ${ts._id}: staff_id = ${ts.staff_id}`);
    });

    // Get all attendance records to map user_id/staff_id to employee
    const attendanceRecords = await AttendanceMerged.find({})
      .select('_id user_id staff_id')
      .lean();

    console.log(`\n📋 Found ${attendanceRecords.length} attendance records`);

    // Create a map from attendance user_id/staff_id to employee
    const attendanceToEmployeeMap = new Map();
    attendanceRecords.forEach(att => {
      if (att.user_id) {
        const emp = employeeByUserIdMap.get(att.user_id.toString()) ||
                   employees.find(e => e.user_id?.toString() === att.user_id.toString());
        if (emp) {
          attendanceToEmployeeMap.set(att.user_id.toString(), emp._id.toString());
        }
      }
      if (att.staff_id) {
        const emp = employeeByIdMap.get(att.staff_id.toString()) ||
                   employeeByUserIdMap.get(att.staff_id.toString());
        if (emp) {
          attendanceToEmployeeMap.set(att.staff_id.toString(), emp._id.toString());
        }
      }
    });

    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const unfixedStaffIds = new Set();
    const staffIdStats = new Map();

    for (const timesheet of timesheets) {
      try {
        const currentStaffId = timesheet.staff_id?.toString();
        
        // Track staff_id usage
        if (currentStaffId) {
          staffIdStats.set(currentStaffId, (staffIdStats.get(currentStaffId) || 0) + 1);
        }

        // Check if current staff_id matches an employee directly
        let employee = currentStaffId ? (
          employeeByIdMap.get(currentStaffId) ||
          employeeByUserIdMap.get(currentStaffId)
        ) : null;

        if (!employee && currentStaffId) {
          // Try to find via attendance mapping
          const mappedEmployeeId = attendanceToEmployeeMap.get(currentStaffId);
          if (mappedEmployeeId) {
            employee = employeeByIdMap.get(mappedEmployeeId);
          }
        }

        if (!employee && currentStaffId) {
          // Try to find employee by checking if staff_id is a user_id
          const user = users.find(u => u._id.toString() === currentStaffId);
          if (user && user.email) {
            employee = employees.find(e => 
              e.email?.toLowerCase() === user.email?.toLowerCase()
            );
          }
        }

        if (!employee) {
          // Try to find from attendance records by matching work_date
          const workDate = timesheet.work_date;
          if (workDate) {
            const attendance = await AttendanceMerged.findOne({
              work_date: workDate,
            })
              .select('staff_id user_id')
              .sort({ created_at: -1 })
              .lean();

            if (attendance) {
              const staffIdFromAttendance = attendance.staff_id?.toString() || attendance.user_id?.toString();
              if (staffIdFromAttendance) {
                employee = employeeByIdMap.get(staffIdFromAttendance) ||
                         employeeByUserIdMap.get(staffIdFromAttendance) ||
                         employees.find(e => e._id.toString() === staffIdFromAttendance);
              }
            }
          }
        }

        if (employee) {
          // Update if different
          if (timesheet.staff_id?.toString() !== employee._id.toString()) {
            await Timesheet.updateOne(
              { _id: timesheet._id },
              { $set: { staff_id: employee._id.toString() } }
            );
            fixedCount++;
            if (fixedCount % 100 === 0) {
              console.log(`   ✅ Fixed ${fixedCount} timesheets...`);
            }
          } else {
            skippedCount++;
          }
        } else {
          if (currentStaffId) {
            unfixedStaffIds.add(currentStaffId);
          }
          skippedCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error fixing timesheet ${timesheet._id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Staff Linking Fix Summary:');
    console.log(`   ✅ Successfully fixed: ${fixedCount}`);
    console.log(`   ⏭️  Skipped (already correct or no match): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    if (unfixedStaffIds.size > 0) {
      console.log(`\n⚠️  Found ${unfixedStaffIds.size} unique staff IDs that could not be matched:`);
      const sampleIds = Array.from(unfixedStaffIds).slice(0, 10);
      sampleIds.forEach(id => {
        const count = staffIdStats.get(id) || 0;
        console.log(`   - ${id} (used in ${count} timesheets)`);
      });
      if (unfixedStaffIds.size > 10) {
        console.log(`   ... and ${unfixedStaffIds.size - 10} more`);
      }
    }

    // Show top staff_id usage stats
    console.log('\n📊 Top staff_id usage:');
    const sortedStats = Array.from(staffIdStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    sortedStats.forEach(([id, count]) => {
      const isEmployee = employeeByIdMap.has(id) || employeeByUserIdMap.has(id);
      console.log(`   - ${id}: ${count} timesheets ${isEmployee ? '✅' : '❌ (not found)'}`);
    });

    console.log('\n✅ Script completed successfully');
  } catch (error) {
    console.error('💥 Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ MongoDB connection closed');
  }
}

// Run the script
if (require.main === module) {
  fixTimesheetStaffLinking()
    .then(() => {
      console.log('\n✨ Staff linking fix process completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = fixTimesheetStaffLinking;

