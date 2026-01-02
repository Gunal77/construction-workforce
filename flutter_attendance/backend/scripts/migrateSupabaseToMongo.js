/**
 * Stage 3: Comprehensive Migration Script
 * Supabase (PostgreSQL) to MongoDB Sample Data Migration
 * 
 * This script migrates all sample data from Supabase to MongoDB
 * with seed mode support and comprehensive logging
 * 
 * Usage:
 *   node scripts/migrateSupabaseToMongo.js                    # Migrate all data
 *   node scripts/migrateSupabaseToMongo.js --dry-run          # Test without inserting
 *   node scripts/migrateSupabaseToMongo.js --seed             # Clear and seed fresh data
 *   node scripts/migrateSupabaseToMongo.js --table=employees  # Migrate specific table
 */

const db = require('../config/db');
const { connectMongoDB, disconnectMongoDB, mongoose } = require('../config/mongodb');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/Leave');
const Project = require('../models/Project');
const env = require('../config/env');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isSeedMode = args.includes('--seed') || process.env.SEED_MODE === 'true';
const tableArg = args.find(arg => arg.startsWith('--table='));
const targetTable = tableArg ? tableArg.split('=')[1] : null;

// Migration statistics
const stats = {
  projects: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  employees: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  attendance: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  leaveRequests: { total: 0, migrated: 0, skipped: 0, errors: 0 },
};

/**
 * Clear MongoDB collections (seed mode)
 */
async function clearCollections() {
  if (!isSeedMode) return;
  
  console.log('\n🗑️  Clearing MongoDB collections (SEED MODE)...');
  
  try {
    if (isDryRun) {
      console.log('   [DRY RUN] Would clear all collections');
      return;
    }
    
    await Project.collection.deleteMany({});
    console.log('   ✅ Cleared projects');
    
    await Employee.collection.deleteMany({});
    console.log('   ✅ Cleared employees');
    
    await Attendance.collection.deleteMany({});
    console.log('   ✅ Cleared attendance_logs');
    
    await LeaveRequest.collection.deleteMany({});
    console.log('   ✅ Cleared leave_requests');
    
    console.log('   ✅ All collections cleared\n');
  } catch (error) {
    console.error('   ❌ Error clearing collections:', error.message);
    throw error;
  }
}

/**
 * Migrate Projects from Supabase
 */
async function migrateProjects() {
  console.log('\n📦 Migrating Projects...');
  
  try {
    const result = await db.query(`
      SELECT 
        id, name, location, start_date, end_date, description, budget, created_at
      FROM projects
      ORDER BY created_at
    `);
    
    const rows = result.rows || [];
    stats.projects.total = rows.length;
    console.log(`   Found ${rows.length} projects to migrate`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', rows.slice(0, 5).map(p => ({ id: p.id, name: p.name, location: p.location })));
      return;
    }
    
    for (const proj of rows) {
      try {
        // Check if project already exists
        const existing = await Project.findById(proj.id);
        if (existing) {
          stats.projects.skipped++;
          if (stats.projects.skipped % 10 === 0) {
            console.log(`   ⏭️  Skipped ${stats.projects.skipped}/${stats.projects.total} projects...`);
          }
          continue;
        }
        
        const projectDoc = new Project({
          _id: proj.id,
          name: proj.name,
          location: proj.location || null,
          start_date: proj.start_date || null,
          end_date: proj.end_date || null,
          description: proj.description || null,
          budget: proj.budget ? parseFloat(proj.budget) : null,
          created_at: proj.created_at || new Date(),
        });
        
        await projectDoc.save();
        stats.projects.migrated++;
        if (stats.projects.migrated % 10 === 0) {
          console.log(`   ✅ Migrated ${stats.projects.migrated}/${stats.projects.total} projects...`);
        }
      } catch (error) {
        stats.projects.errors++;
        if (error.code === 11000 || error.message.includes('duplicate key')) {
          stats.projects.skipped++;
          stats.projects.errors--; // Don't count duplicates as errors
        } else {
          console.error(`   ❌ Error migrating project ${proj.id}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Completed: ${stats.projects.migrated}/${stats.projects.total} projects migrated`);
  } catch (error) {
    console.error('   ❌ Error fetching projects:', error);
    throw error;
  }
}

/**
 * Migrate Employees from Supabase
 */
async function migrateEmployees() {
  console.log('\n📦 Migrating Employees...');
  
  try {
    const result = await db.query(`
      SELECT 
        id, name, email, phone, role, project_id, 
        payment_type, hourly_rate, daily_rate, monthly_rate, contract_rate,
        status, created_at
      FROM employees
      ORDER BY created_at
    `);
    
    const rows = result.rows || [];
    stats.employees.total = rows.length;
    console.log(`   Found ${rows.length} employees to migrate`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', rows.slice(0, 5).map(e => ({ id: e.id, name: e.name, email: e.email })));
      return;
    }
    
    for (const emp of rows) {
      try {
        // Check if employee already exists
        const existing = await Employee.findById(emp.id);
        if (existing) {
          stats.employees.skipped++;
          continue;
        }
        
        // Validate project_id exists if provided
        if (emp.project_id) {
          const projectExists = await Project.findById(emp.project_id);
          if (!projectExists) {
            console.log(`   ⚠️  Employee ${emp.name} references non-existent project ${emp.project_id}, setting to null`);
            emp.project_id = null;
          }
        }
        
        const employeeDoc = new Employee({
          _id: emp.id,
          name: emp.name,
          email: emp.email ? emp.email.toLowerCase().trim() : null,
          phone: emp.phone || null,
          role: emp.role || null,
          project_id: emp.project_id || null,
          payment_type: emp.payment_type || null,
          hourly_rate: emp.hourly_rate ? parseFloat(emp.hourly_rate) : null,
          daily_rate: emp.daily_rate ? parseFloat(emp.daily_rate) : null,
          monthly_rate: emp.monthly_rate ? parseFloat(emp.monthly_rate) : null,
          contract_rate: emp.contract_rate ? parseFloat(emp.contract_rate) : null,
          status: emp.status || 'active',
          created_at: emp.created_at || new Date(),
          updated_at: emp.created_at || new Date(), // Employees table doesn't have updated_at
        });
        
        await employeeDoc.save();
        stats.employees.migrated++;
        if (stats.employees.migrated % 50 === 0) {
          console.log(`   ✅ Migrated ${stats.employees.migrated}/${stats.employees.total} employees... (Skipped: ${stats.employees.skipped}, Errors: ${stats.employees.errors})`);
        }
      } catch (error) {
        stats.employees.errors++;
        if (error.code === 11000 || error.message.includes('duplicate key')) {
          stats.employees.skipped++;
          stats.employees.errors--;
        } else {
          console.error(`   ❌ Error migrating employee ${emp.id}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Completed: ${stats.employees.migrated}/${stats.employees.total} employees migrated (Skipped: ${stats.employees.skipped}, Errors: ${stats.employees.errors})`);
  } catch (error) {
    console.error('   ❌ Error fetching employees:', error);
    throw error;
  }
}

/**
 * Migrate Attendance Logs from Supabase
 */
async function migrateAttendance() {
  console.log('\n📦 Migrating Attendance Logs...');
  
  try {
    const result = await db.query(`
      SELECT 
        id, user_id, check_in_time, check_out_time,
        image_url, latitude, longitude,
        checkout_image_url, checkout_latitude, checkout_longitude,
        created_at
      FROM attendance_logs
      ORDER BY created_at
    `);
    
    const rows = result.rows || [];
    stats.attendance.total = rows.length;
    console.log(`   Found ${rows.length} attendance records to migrate`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', rows.slice(0, 5).map(a => ({ id: a.id, user_id: a.user_id, check_in: a.check_in_time })));
      return;
    }
    
    for (const att of rows) {
      try {
        // Check if attendance already exists
        const existing = await Attendance.findById(att.id);
        if (existing) {
          stats.attendance.skipped++;
          continue;
        }
        
        // Validate user_id exists
        const userExists = await User.findById(att.user_id);
        if (!userExists) {
          console.log(`   ⚠️  Attendance ${att.id} references non-existent user ${att.user_id}, skipping`);
          stats.attendance.skipped++;
          continue;
        }
        
        const attendanceDoc = new Attendance({
          _id: att.id,
          user_id: att.user_id,
          check_in_time: att.check_in_time,
          check_out_time: att.check_out_time || null,
          image_url: att.image_url || null,
          latitude: att.latitude ? parseFloat(att.latitude) : null,
          longitude: att.longitude ? parseFloat(att.longitude) : null,
          checkout_image_url: att.checkout_image_url || null,
          checkout_latitude: att.checkout_latitude ? parseFloat(att.checkout_latitude) : null,
          checkout_longitude: att.checkout_longitude ? parseFloat(att.checkout_longitude) : null,
          created_at: att.created_at || new Date(),
        });
        
        await attendanceDoc.save();
        stats.attendance.migrated++;
        if (stats.attendance.migrated % 100 === 0) {
          console.log(`   ✅ Migrated ${stats.attendance.migrated}/${stats.attendance.total} attendance records... (Skipped: ${stats.attendance.skipped}, Errors: ${stats.attendance.errors})`);
        }
      } catch (error) {
        stats.attendance.errors++;
        if (error.code === 11000 || error.message.includes('duplicate key')) {
          stats.attendance.skipped++;
          stats.attendance.errors--;
        } else {
          console.error(`   ❌ Error migrating attendance ${att.id}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Completed: ${stats.attendance.migrated}/${stats.attendance.total} attendance records migrated (Skipped: ${stats.attendance.skipped}, Errors: ${stats.attendance.errors})`);
  } catch (error) {
    console.error('   ❌ Error fetching attendance:', error);
    throw error;
  }
}

/**
 * Migrate Leave Requests from Supabase
 */
async function migrateLeaveRequests() {
  console.log('\n📦 Migrating Leave Requests...');
  
  try {
    const result = await db.query(`
      SELECT 
        id, employee_id, leave_type_id, project_id,
        start_date, end_date, number_of_days,
        reason, status, approved_by, approved_at,
        rejection_reason, mc_document_url, stand_in_employee_id,
        created_at, updated_at
      FROM leave_requests
      ORDER BY created_at
    `);
    
    const rows = result.rows || [];
    stats.leaveRequests.total = rows.length;
    console.log(`   Found ${rows.length} leave requests to migrate`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', rows.slice(0, 5).map(l => ({ id: l.id, employee_id: l.employee_id, status: l.status })));
      return;
    }
    
    for (const leave of rows) {
      try {
        // Check if leave request already exists
        const existing = await LeaveRequest.findById(leave.id);
        if (existing) {
          stats.leaveRequests.skipped++;
          continue;
        }
        
        // Validate employee_id exists
        const employeeExists = await Employee.findById(leave.employee_id);
        if (!employeeExists) {
          console.log(`   ⚠️  Leave request ${leave.id} references non-existent employee ${leave.employee_id}, skipping`);
          stats.leaveRequests.skipped++;
          continue;
        }
        
        // Validate project_id exists if provided
        if (leave.project_id) {
          const projectExists = await Project.findById(leave.project_id);
          if (!projectExists) {
            console.log(`   ⚠️  Leave request ${leave.id} references non-existent project ${leave.project_id}, setting to null`);
            leave.project_id = null;
          }
        }
        
        // Validate stand_in_employee_id exists if provided
        if (leave.stand_in_employee_id) {
          const standInExists = await Employee.findById(leave.stand_in_employee_id);
          if (!standInExists) {
            console.log(`   ⚠️  Leave request ${leave.id} references non-existent stand-in employee ${leave.stand_in_employee_id}, setting to null`);
            leave.stand_in_employee_id = null;
          }
        }
        
        const leaveDoc = new LeaveRequest({
          _id: leave.id,
          employee_id: leave.employee_id,
          leave_type_id: leave.leave_type_id,
          project_id: leave.project_id || null,
          start_date: leave.start_date,
          end_date: leave.end_date,
          number_of_days: leave.number_of_days ? parseFloat(leave.number_of_days) : null,
          reason: leave.reason || null,
          status: leave.status || 'pending',
          approved_by: leave.approved_by || null,
          approved_at: leave.approved_at || null,
          rejection_reason: leave.rejection_reason || null,
          mc_document_url: leave.mc_document_url || null,
          stand_in_employee_id: leave.stand_in_employee_id || null,
          created_at: leave.created_at || new Date(),
          updated_at: leave.updated_at || new Date(),
        });
        
        await leaveDoc.save();
        stats.leaveRequests.migrated++;
        if (stats.leaveRequests.migrated % 50 === 0) {
          console.log(`   ✅ Migrated ${stats.leaveRequests.migrated}/${stats.leaveRequests.total} leave requests... (Skipped: ${stats.leaveRequests.skipped}, Errors: ${stats.leaveRequests.errors})`);
        }
      } catch (error) {
        stats.leaveRequests.errors++;
        if (error.code === 11000 || error.message.includes('duplicate key')) {
          stats.leaveRequests.skipped++;
          stats.leaveRequests.errors--;
        } else if (error.message.includes('end_date must be greater')) {
          console.error(`   ❌ Invalid date range for leave ${leave.id}:`, error.message);
        } else {
          console.error(`   ❌ Error migrating leave request ${leave.id}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Completed: ${stats.leaveRequests.migrated}/${stats.leaveRequests.total} leave requests migrated (Skipped: ${stats.leaveRequests.skipped}, Errors: ${stats.leaveRequests.errors})`);
  } catch (error) {
    console.error('   ❌ Error fetching leave requests:', error);
    throw error;
  }
}

/**
 * Print migration statistics
 */
function printStats() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 Migration Statistics');
  console.log('='.repeat(70));
  
  const tables = [
    { name: 'Projects', stats: stats.projects },
    { name: 'Employees', stats: stats.employees },
    { name: 'Attendance', stats: stats.attendance },
    { name: 'Leave Requests', stats: stats.leaveRequests },
  ];
  
  tables.forEach(({ name, stats: s }) => {
    if (s.total > 0) {
      const successRate = ((s.migrated / s.total) * 100).toFixed(2);
      console.log(`\n${name}:`);
      console.log(`   Total: ${s.total}`);
      console.log(`   ✅ Migrated: ${s.migrated}`);
      console.log(`   ⏭️  Skipped: ${s.skipped}`);
      console.log(`   ❌ Errors: ${s.errors}`);
      console.log(`   Success Rate: ${successRate}%`);
    }
  });
  
  const totalRecords = Object.values(stats).reduce((sum, s) => sum + s.total, 0);
  const totalMigrated = Object.values(stats).reduce((sum, s) => sum + s.migrated, 0);
  const totalSkipped = Object.values(stats).reduce((sum, s) => sum + s.skipped, 0);
  const totalErrors = Object.values(stats).reduce((sum, s) => sum + s.errors, 0);
  
  console.log('\n' + '-'.repeat(70));
  console.log(`Total Records: ${totalRecords}`);
  console.log(`✅ Total Migrated: ${totalMigrated}`);
  console.log(`⏭️  Total Skipped: ${totalSkipped}`);
  console.log(`❌ Total Errors: ${totalErrors}`);
  console.log(`Overall Success Rate: ${totalRecords > 0 ? ((totalMigrated / totalRecords) * 100).toFixed(2) : 0}%`);
  console.log('='.repeat(70) + '\n');
}

/**
 * Verify migration by checking document counts
 */
async function verifyMigration() {
  console.log('\n🔍 Verifying Migration...\n');
  
  try {
    const projectCount = await Project.countDocuments();
    const employeeCount = await Employee.countDocuments();
    const attendanceCount = await Attendance.countDocuments();
    const leaveCount = await LeaveRequest.countDocuments();
    
    console.log(`   Projects: ${projectCount} documents`);
    console.log(`   Employees: ${employeeCount} documents`);
    console.log(`   Attendance: ${attendanceCount} documents`);
    console.log(`   Leave Requests: ${leaveCount} documents`);
    
    // Check relationships
    const employeesWithProjects = await Employee.countDocuments({ project_id: { $ne: null } });
    const attendanceWithUsers = await Attendance.countDocuments();
    const leavesWithEmployees = await LeaveRequest.countDocuments();
    
    console.log(`\n   Relationships:`);
    console.log(`   Employees with projects: ${employeesWithProjects}`);
    console.log(`   Attendance records with users: ${attendanceWithUsers}`);
    console.log(`   Leave requests with employees: ${leavesWithEmployees}`);
    
    console.log('\n   ✅ Verification complete\n');
  } catch (error) {
    console.error('   ❌ Verification error:', error.message);
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('\n🚀 Starting Stage 3: Sample Data Migration');
  console.log('='.repeat(70));
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be inserted');
  }
  
  if (isSeedMode) {
    console.log('🌱 SEED MODE - Collections will be cleared before migration');
  }
  
  try {
    // Connect to MongoDB
    console.log('\n📡 Connecting to MongoDB...');
    await connectMongoDB();
    console.log('✅ MongoDB connected');
    
    // Connect to Supabase (PostgreSQL)
    console.log('\n📡 Connecting to Supabase (PostgreSQL)...');
    await db.getClient();
    console.log('✅ Supabase connected');
    
    // Clear collections if seed mode
    await clearCollections();
    
    // Run migrations based on arguments
    if (targetTable) {
      // Migrate specific table
      switch (targetTable.toLowerCase()) {
        case 'projects':
          await migrateProjects();
          break;
        case 'employees':
          await migrateEmployees();
          break;
        case 'attendance':
          await migrateAttendance();
          break;
        case 'leave':
        case 'leaves':
        case 'leave_requests':
          await migrateLeaveRequests();
          break;
        default:
          console.error(`❌ Unknown table: ${targetTable}`);
          console.log('Available tables: projects, employees, attendance, leave');
          process.exit(1);
      }
    } else {
      // Migrate all tables in order (respecting foreign key dependencies)
      await migrateProjects();      // First: Projects (no dependencies)
      await migrateEmployees();    // Second: Employees (depends on Projects)
      await migrateAttendance();   // Third: Attendance (depends on Users)
      await migrateLeaveRequests(); // Fourth: Leave Requests (depends on Employees, Projects)
    }
    
    // Print statistics
    printStats();
    
    // Verify migration
    if (!isDryRun) {
      await verifyMigration();
    }
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    printStats();
    process.exit(1);
  } finally {
    // Disconnect
    await disconnectMongoDB();
    await db.pool.end();
    console.log('\n👋 Disconnected from databases');
  }
}

// Run migration
if (require.main === module) {
  runMigration().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runMigration };

