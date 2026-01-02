/**
 * Migration Script: Supabase (PostgreSQL) to MongoDB
 * 
 * This script migrates data from Supabase PostgreSQL to MongoDB Atlas
 * 
 * Usage:
 *   node scripts/migrate-to-mongodb.js                    # Migrate all tables
 *   node scripts/migrate-to-mongodb.js --table users      # Migrate only users
 *   node scripts/migrate-to-mongodb.js --dry-run          # Test without inserting
 *   node scripts/migrate-to-mongodb.js --skip-users       # Skip user migration
 */

const db = require('../config/db');
const { connectMongoDB, disconnectMongoDB } = require('../config/mongodb');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/Leave');
const bcrypt = require('bcrypt');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const skipUsers = args.includes('--skip-users');
const tableArg = args.find(arg => arg.startsWith('--table='));
const targetTable = tableArg ? tableArg.split('=')[1] : null;

// Migration statistics
const stats = {
  users: { total: 0, migrated: 0, errors: 0 },
  employees: { total: 0, migrated: 0, errors: 0 },
  attendance: { total: 0, migrated: 0, errors: 0 },
  leaveRequests: { total: 0, migrated: 0, errors: 0 },
};

/**
 * Migrate Users from Supabase (users, admins, supervisors tables)
 */
async function migrateUsers() {
  console.log('\n📦 Migrating Users...');
  
  try {
    // Fetch all users from different tables
    const usersResult = await db.query(`
      SELECT id, name, email, password_hash, 'WORKER' as role, created_at, updated_at
      FROM users
      WHERE email IS NOT NULL
    `);
    
    const adminsResult = await db.query(`
      SELECT id, name, email, password_hash, 'ADMIN' as role, created_at, updated_at
      FROM admins
      WHERE email IS NOT NULL AND status = 'active'
    `);
    
    const supervisorsResult = await db.query(`
      SELECT id, name, email, password_hash, 'SUPERVISOR' as role, created_at, updated_at
      FROM supervisors
      WHERE email IS NOT NULL
    `);
    
    const usersRows = usersResult.rows || [];
    const adminsRows = adminsResult.rows || [];
    const supervisorsRows = supervisorsResult.rows || [];
    
    const allUsers = [...usersRows, ...adminsRows, ...supervisorsRows];
    stats.users.total = allUsers.length;
    
    console.log(`   Found ${allUsers.length} users to migrate`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', allUsers.map(u => ({ id: u.id, email: u.email, role: u.role })));
      return;
    }
    
    // Migrate each user
    for (const user of allUsers) {
      try {
        const normalizedEmail = user.email.toLowerCase().trim();
        
        // Check if user already exists by ID or email (to avoid duplicates)
        const existingById = await User.findById(user.id);
        const existingByEmail = await User.findOne({ email: normalizedEmail });
        
        if (existingById || existingByEmail) {
          console.log(`   ⏭️  User ${user.email} already exists, skipping`);
          stats.users.migrated++;
          continue;
        }
        
        // If password is already hashed (bcrypt format), save directly to avoid re-hashing
        if (user.password_hash && user.password_hash.startsWith('$2')) {
          // Save directly to database bypassing pre-save hook
          await User.collection.insertOne({
            _id: user.id,
            name: user.name || 'Unknown',
            email: normalizedEmail,
            password: user.password_hash,
            role: user.role || 'WORKER',
            isActive: true,
            createdAt: user.created_at || new Date(),
            updatedAt: user.updated_at || new Date(),
          });
          stats.users.migrated++;
          console.log(`   ✅ Migrated user: ${user.email} (${user.role})`);
          continue;
        }
        
        // Create user document (for non-hashed passwords - should not happen)
        const userDoc = new User({
          _id: user.id,
          name: user.name || 'Unknown',
          email: normalizedEmail,
          password: user.password_hash || 'changeme123', // Will be hashed by pre-save hook
          role: user.role || 'WORKER',
          isActive: true,
          createdAt: user.created_at || new Date(),
          updatedAt: user.updated_at || new Date(),
        });
        
        await userDoc.save();
        stats.users.migrated++;
        console.log(`   ✅ Migrated user: ${user.email} (${user.role})`);
      } catch (error) {
        // Check if it's a duplicate key error
        if (error.code === 11000 || error.message.includes('duplicate key')) {
          console.log(`   ⏭️  User ${user.email} already exists (duplicate), skipping`);
          stats.users.migrated++;
        } else {
          stats.users.errors++;
          console.error(`   ❌ Error migrating user ${user.email}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('   ❌ Error fetching users:', error);
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
      console.log('   [DRY RUN] Would migrate:', rows.map(e => ({ id: e.id, name: e.name, email: e.email })));
      return;
    }
    
    for (const emp of rows) {
      try {
        // Check if employee already exists
        const existing = await Employee.findById(emp.id);
        if (existing) {
          console.log(`   ⏭️  Employee ${emp.name} already exists, skipping`);
          stats.employees.migrated++;
          continue;
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
          updated_at: emp.created_at || new Date(), // Employees table doesn't have updated_at, use created_at
        });
        
        await employeeDoc.save();
        stats.employees.migrated++;
        if (stats.employees.migrated % 10 === 0) {
          console.log(`   ✅ Migrated ${stats.employees.migrated}/${stats.employees.total} employees...`);
        }
      } catch (error) {
        stats.employees.errors++;
        console.error(`   ❌ Error migrating employee ${emp.id}:`, error.message);
      }
    }
    
    console.log(`   ✅ Completed: ${stats.employees.migrated}/${stats.employees.total} employees migrated`);
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
          stats.attendance.migrated++;
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
          console.log(`   ✅ Migrated ${stats.attendance.migrated}/${stats.attendance.total} attendance records...`);
        }
      } catch (error) {
        stats.attendance.errors++;
        console.error(`   ❌ Error migrating attendance ${att.id}:`, error.message);
      }
    }
    
    console.log(`   ✅ Completed: ${stats.attendance.migrated}/${stats.attendance.total} attendance records migrated`);
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
          stats.leaveRequests.migrated++;
          continue;
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
          console.log(`   ✅ Migrated ${stats.leaveRequests.migrated}/${stats.leaveRequests.total} leave requests...`);
        }
      } catch (error) {
        stats.leaveRequests.errors++;
        console.error(`   ❌ Error migrating leave request ${leave.id}:`, error.message);
      }
    }
    
    console.log(`   ✅ Completed: ${stats.leaveRequests.migrated}/${stats.leaveRequests.total} leave requests migrated`);
  } catch (error) {
    console.error('   ❌ Error fetching leave requests:', error);
    throw error;
  }
}

/**
 * Print migration statistics
 */
function printStats() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Statistics');
  console.log('='.repeat(60));
  
  const tables = [
    { name: 'Users', stats: stats.users },
    { name: 'Employees', stats: stats.employees },
    { name: 'Attendance', stats: stats.attendance },
    { name: 'Leave Requests', stats: stats.leaveRequests },
  ];
  
  tables.forEach(({ name, stats: s }) => {
    if (s.total > 0) {
      console.log(`\n${name}:`);
      console.log(`   Total: ${s.total}`);
      console.log(`   Migrated: ${s.migrated}`);
      console.log(`   Errors: ${s.errors}`);
      console.log(`   Success Rate: ${((s.migrated / s.total) * 100).toFixed(2)}%`);
    }
  });
  
  const totalRecords = Object.values(stats).reduce((sum, s) => sum + s.total, 0);
  const totalMigrated = Object.values(stats).reduce((sum, s) => sum + s.migrated, 0);
  const totalErrors = Object.values(stats).reduce((sum, s) => sum + s.errors, 0);
  
  console.log('\n' + '-'.repeat(60));
  console.log(`Total Records: ${totalRecords}`);
  console.log(`Total Migrated: ${totalMigrated}`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log(`Overall Success Rate: ${totalRecords > 0 ? ((totalMigrated / totalRecords) * 100).toFixed(2) : 0}%`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('\n🚀 Starting MongoDB Migration');
  console.log('='.repeat(60));
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be inserted');
  }
  
  try {
    // Connect to MongoDB
    console.log('\n📡 Connecting to MongoDB...');
    await connectMongoDB();
    console.log('✅ MongoDB connected');
    
    // Connect to Supabase (PostgreSQL)
    console.log('\n📡 Connecting to Supabase (PostgreSQL)...');
    await db.getClient(); // Test connection
    console.log('✅ Supabase connected');
    
    // Run migrations based on arguments
    if (targetTable) {
      // Migrate specific table
      switch (targetTable.toLowerCase()) {
        case 'users':
          await migrateUsers();
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
          console.log('Available tables: users, employees, attendance, leave');
          process.exit(1);
      }
    } else {
      // Migrate all tables
      if (!skipUsers) {
        await migrateUsers();
      }
      await migrateEmployees();
      await migrateAttendance();
      await migrateLeaveRequests();
    }
    
    // Print statistics
    printStats();
    
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

