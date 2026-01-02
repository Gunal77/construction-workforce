/**
 * Update Timesheets with Sample Data (MongoDB)
 * 
 * This script updates existing timesheets to include:
 * - Proper staff_id linking
 * - Project assignments
 * - Realistic overtime hours
 */

const mongoose = require('mongoose');
const env = require('../config/env');
const Timesheet = require('../models/Timesheet');
const EmployeeMerged = require('../models/EmployeeMerged');
const ProjectMerged = require('../models/ProjectMerged');
const AttendanceMerged = require('../models/AttendanceMerged');

async function updateTimesheetsWithSampleData() {
  console.log('🚀 Starting timesheet update with sample data...');
  console.log(`\n📊 Database Provider: ${env.dbProvider.toUpperCase()}`);

  if (env.dbProvider !== 'mongodb') {
    console.error('This script is designed for MongoDB. Please set DB_PROVIDER=mongodb in your .env file.');
    return;
  }

  try {
    await mongoose.connect(env.mongodbUri);
    console.log('✅ Connected to MongoDB');

    // Get all employees
    const employees = await EmployeeMerged.find({})
      .select('_id name email project_assignments')
      .lean();

    console.log(`\n📋 Found ${employees.length} employees`);

    // Get all projects
    const projects = await ProjectMerged.find({})
      .select('_id name assigned_employees')
      .lean();

    console.log(`📋 Found ${projects.length} projects`);

    if (employees.length === 0 || projects.length === 0) {
      console.log('⚠️  No employees or projects found. Please ensure data exists.');
      return;
    }

    // Create a map of employee_id to their active project assignments
    const employeeProjectMap = new Map();
    const now = new Date();

    // First, check project_assignments in EmployeeMerged
    employees.forEach(employee => {
      if (employee.project_assignments && Array.isArray(employee.project_assignments)) {
        employee.project_assignments.forEach(assignment => {
          if (assignment.status === 'active') {
            let isActive = true;
            if (assignment.assignment_end_date) {
              const endDate = new Date(assignment.assignment_end_date);
              if (endDate < now) {
                isActive = false;
              }
            }
            if (isActive) {
              employeeProjectMap.set(employee._id.toString(), assignment.project_id?.toString());
            }
          }
        });
      }
    });

    // Also check assigned_employees in ProjectMerged
    projects.forEach(project => {
      if (project.assigned_employees && Array.isArray(project.assigned_employees)) {
        project.assigned_employees.forEach(assignment => {
          if (assignment.employee_id && assignment.status === 'active') {
            let isActive = true;
            if (assignment.assignment_end_date) {
              const endDate = new Date(assignment.assignment_end_date);
              if (endDate < now) {
                isActive = false;
              }
            }
            if (isActive) {
              employeeProjectMap.set(assignment.employee_id.toString(), project._id.toString());
            }
          }
        });
      }
    });

    console.log(`\n📋 Mapped ${employeeProjectMap.size} employee-project assignments`);

    // Get all timesheets
    const timesheets = await Timesheet.find({})
      .select('_id staff_id work_date check_in check_out total_hours overtime_hours project_id')
      .lean();

    console.log(`\n📋 Found ${timesheets.length} timesheets to update`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const timesheet of timesheets) {
      try {
        const updateData = {};
        let needsUpdate = false;

        // 1. Ensure staff_id is valid (use employee _id)
        if (timesheet.staff_id) {
          const employee = employees.find(e => 
            e._id.toString() === timesheet.staff_id.toString() ||
            e.email === timesheet.staff_id.toString()
          );
          
          if (employee) {
            if (timesheet.staff_id.toString() !== employee._id.toString()) {
              updateData.staff_id = employee._id.toString();
              needsUpdate = true;
            }
          } else {
            // If staff_id doesn't match any employee, try to find by matching with attendance
            const attendance = await AttendanceMerged.findOne({
              $or: [
                { staff_id: timesheet.staff_id },
                { user_id: timesheet.staff_id },
              ],
            }).select('staff_id user_id').lean();

            if (attendance) {
              const foundEmployee = employees.find(e =>
                e._id.toString() === attendance.staff_id?.toString() ||
                e._id.toString() === attendance.user_id?.toString()
              );
              
              if (foundEmployee) {
                updateData.staff_id = foundEmployee._id.toString();
                needsUpdate = true;
              }
            }
          }
        }

        // 2. Assign project if not already assigned
        if (!timesheet.project_id || timesheet.project_id === 'null' || timesheet.project_id === null) {
          const staffId = updateData.staff_id || timesheet.staff_id;
          if (staffId) {
            const projectId = employeeProjectMap.get(staffId.toString());
            if (projectId) {
              updateData.project_id = projectId;
              needsUpdate = true;
            } else {
              // Assign to a random project if no assignment found
              const randomProject = projects[Math.floor(Math.random() * projects.length)];
              if (randomProject) {
                updateData.project_id = randomProject._id.toString();
                needsUpdate = true;
              }
            }
          }
        }

        // 3. Recalculate hours and overtime if check_in and check_out exist
        if (timesheet.check_in && timesheet.check_out) {
          const checkIn = new Date(timesheet.check_in);
          const checkOut = new Date(timesheet.check_out);
          const hoursDiff = (checkOut - checkIn) / (1000 * 60 * 60);
          const totalHours = Math.max(0, hoursDiff);
          
          // Regular hours: 8 hours
          const regularHours = 8;
          const overtimeHours = Math.max(0, totalHours - regularHours);

          // Only update if hours are zero or significantly different
          const currentTotalHours = timesheet.total_hours 
            ? parseFloat(timesheet.total_hours.toString()) 
            : 0;
          const currentOvertimeHours = timesheet.overtime_hours 
            ? parseFloat(timesheet.overtime_hours.toString()) 
            : 0;

          if (Math.abs(currentTotalHours - totalHours) > 0.01 || 
              Math.abs(currentOvertimeHours - overtimeHours) > 0.01) {
            updateData.total_hours = mongoose.Types.Decimal128.fromString(totalHours.toFixed(2));
            updateData.overtime_hours = mongoose.Types.Decimal128.fromString(overtimeHours.toFixed(2));
            
            // Update OT approval status if overtime exists
            if (overtimeHours > 0 && !timesheet.ot_approval_status) {
              updateData.ot_approval_status = 'Pending';
            }
            
            needsUpdate = true;
          }
        } else {
          // If no check_in/check_out, set realistic sample hours (8-10 hours with some OT)
          const totalHours = 8 + Math.random() * 2; // 8-10 hours
          const overtimeHours = Math.max(0, totalHours - 8);
          
          updateData.total_hours = mongoose.Types.Decimal128.fromString(totalHours.toFixed(2));
          updateData.overtime_hours = mongoose.Types.Decimal128.fromString(overtimeHours.toFixed(2));
          
          if (overtimeHours > 0) {
            updateData.ot_approval_status = 'Pending';
          }
          
          needsUpdate = true;
        }

        if (needsUpdate) {
          updateData.updated_at = new Date();
          await Timesheet.updateOne(
            { _id: timesheet._id },
            { $set: updateData }
          );
          updatedCount++;

          if (updatedCount % 100 === 0) {
            console.log(`   ✅ Updated ${updatedCount} timesheets...`);
          }
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error updating timesheet ${timesheet._id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Timesheet Update Summary:');
    console.log(`   ✅ Successfully updated: ${updatedCount}`);
    console.log(`   ⏭️  Skipped (no changes needed): ${skippedCount}`);
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
  updateTimesheetsWithSampleData()
    .then(() => {
      console.log('\n✨ Timesheet update process completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = updateTimesheetsWithSampleData;

