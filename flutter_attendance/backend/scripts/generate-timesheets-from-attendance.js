/**
 * Generate Timesheets from Attendance Data (MongoDB)
 * 
 * This script reads attendance records and creates corresponding timesheet entries
 * in the timesheets collection.
 */

const mongoose = require('mongoose');
const env = require('../config/env');
const AttendanceMerged = require('../models/AttendanceMerged');
const Timesheet = require('../models/Timesheet');
const EmployeeMerged = require('../models/EmployeeMerged');
const ProjectMerged = require('../models/ProjectMerged');
const { v4: uuidv4 } = require('uuid');

async function generateTimesheetsFromAttendance() {
  console.log('🚀 Starting timesheet generation from attendance data...');
  console.log(`\n📊 Database Provider: ${env.dbProvider.toUpperCase()}`);

  if (env.dbProvider !== 'mongodb') {
    console.error('This script is designed for MongoDB. Please set DB_PROVIDER=mongodb in your .env file.');
    return;
  }

  try {
    await mongoose.connect(env.mongodbUri);
    console.log('✅ Connected to MongoDB');

    // Fetch all attendance records with check-out (completed attendance)
    const attendanceRecords = await AttendanceMerged.find({
      check_out_time: { $ne: null },
      check_out: { $ne: null },
    })
      .select('_id user_id staff_id work_date check_in_time check_in check_out_time check_out project_id total_hours overtime_hours status')
      .lean();

    console.log(`\n📋 Found ${attendanceRecords.length} attendance records with check-out`);

    if (attendanceRecords.length === 0) {
      console.log('⚠️  No attendance records found. Please ensure attendance data exists.');
      return;
    }

    // Get employee IDs to map user_id to staff_id
    const userIds = [...new Set(attendanceRecords.map(a => a.user_id).filter(Boolean))];
    const employees = await EmployeeMerged.find({
      $or: [
        { _id: { $in: userIds } },
        { user_id: { $in: userIds } },
      ],
    })
      .select('_id user_id email')
      .lean();

    const userToEmployeeMap = new Map();
    employees.forEach(emp => {
      if (emp.user_id) {
        userToEmployeeMap.set(emp.user_id.toString(), emp._id.toString());
      }
      // Also map by _id in case user_id is the same as _id
      userToEmployeeMap.set(emp._id.toString(), emp._id.toString());
    });

    // Get project IDs to validate project assignments
    const projectIds = [...new Set(attendanceRecords.map(a => a.project_id).filter(Boolean))];
    const projects = await ProjectMerged.find({ _id: { $in: projectIds } })
      .select('_id name assigned_employees')
      .lean();

    const projectMap = new Map(projects.map(p => [p._id.toString(), p]));

    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const attendance of attendanceRecords) {
      try {
        // Get staff_id from user_id
        const staffId = attendance.staff_id || userToEmployeeMap.get(attendance.user_id?.toString()) || attendance.user_id;

        if (!staffId) {
          console.log(`⚠️  Skipping attendance ${attendance._id}: No staff_id found`);
          skippedCount++;
          continue;
        }

        // Use work_date or derive from check_in_time
        const workDate = attendance.work_date 
          ? new Date(attendance.work_date)
          : new Date(attendance.check_in_time || attendance.check_in);

        // Normalize work_date to start of day
        workDate.setHours(0, 0, 0, 0);

        // Check if timesheet already exists for this staff and date
        const existing = await Timesheet.findOne({
          staff_id: staffId.toString(),
          work_date: workDate,
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        // Calculate total hours
        const checkIn = new Date(attendance.check_in_time || attendance.check_in);
        const checkOut = new Date(attendance.check_out_time || attendance.check_out);
        const hoursDiff = (checkOut - checkIn) / (1000 * 60 * 60); // Convert to hours
        const totalHours = Math.max(0, hoursDiff);

        // Calculate overtime (hours over 8)
        const regularHours = 8;
        const overtimeHours = Math.max(0, totalHours - regularHours);

        // Get project_id if available
        let projectId = attendance.project_id;
        
        // If no project_id in attendance, try to find from employee's project assignments
        if (!projectId) {
          const employee = employees.find(e => 
            e._id.toString() === staffId.toString() || 
            e.user_id?.toString() === attendance.user_id?.toString()
          );
          
          if (employee) {
            // Try to find active project assignment
            for (const project of projects) {
              if (project.assigned_employees && Array.isArray(project.assigned_employees)) {
                const assignment = project.assigned_employees.find(
                  a => a.employee_id?.toString() === staffId.toString() && a.status === 'active'
                );
                if (assignment) {
                  projectId = project._id.toString();
                  break;
                }
              }
            }
          }
        }

        // Create timesheet document
        const timesheetId = uuidv4();
        const timesheetData = {
          _id: timesheetId,
          staff_id: staffId.toString(),
          work_date: workDate,
          check_in: checkIn,
          check_out: checkOut,
          total_hours: mongoose.Types.Decimal128.fromString(totalHours.toFixed(2)),
          overtime_hours: mongoose.Types.Decimal128.fromString(overtimeHours.toFixed(2)),
          project_id: projectId || null,
          status: attendance.status || 'Present',
          approval_status: 'Draft',
          ot_approval_status: overtimeHours > 0 ? 'Pending' : null,
          created_at: attendance.created_at || new Date(),
          updated_at: new Date(),
        };

        await Timesheet.create(timesheetData);
        createdCount++;

        if (createdCount % 50 === 0) {
          console.log(`   ✅ Created ${createdCount} timesheets...`);
        }
      } catch (error) {
        console.error(`   ❌ Error creating timesheet for attendance ${attendance._id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Timesheet Generation Summary:');
    console.log(`   ✅ Successfully created: ${createdCount}`);
    console.log(`   ⏭️  Skipped (already exists): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
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
  generateTimesheetsFromAttendance()
    .then(() => {
      console.log('\n✨ Timesheet generation process completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = generateTimesheetsFromAttendance;

