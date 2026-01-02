/**
 * Comprehensive Migration Script: Supabase to MongoDB
 * 
 * Merges related tables into document-based MongoDB collections:
 * - users: merge users, admins, supervisors
 * - employees: merge employees, staffs, worker_supervisor, project_employees
 * - projects: merge projects, clients, project_employees, supervisor_projects
 * - attendance: merge attendance_logs, timesheets
 * - leaves: merge leave_requests, leave_balances, leave_types
 * - tasks: migrate worker_tasks
 * 
 * DO NOT MIGRATE:
 * - monthly_summary
 * - notifications
 * - user_auth_view
 * - any SQL views
 * 
 * Usage:
 *   node scripts/migrateAllSupabaseToMongo.js                    # Migrate all data
 *   node scripts/migrateAllSupabaseToMongo.js --dry-run          # Test without inserting
 *   node scripts/migrateAllSupabaseToMongo.js --seed            # Clear and seed fresh data
 */

const db = require('../config/db');
const { connectMongoDB, disconnectMongoDB, mongoose } = require('../config/mongodb');
const User = require('../models/User');
const Employee = require('../models/EmployeeMerged');
const Project = require('../models/ProjectMerged');
const Attendance = require('../models/AttendanceMerged');
const { LeaveRequest, LeaveType, LeaveBalance } = require('../models/LeaveMerged');
const Task = require('../models/Task');
const Timesheet = require('../models/Timesheet');
const MonthlySummary = require('../models/MonthlySummary');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isSeedMode = args.includes('--seed') || process.env.SEED_MODE === 'true';

// Migration statistics
const stats = {
  users: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  employees: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  projects: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  attendance: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  leaveTypes: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  leaveBalances: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  leaveRequests: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  tasks: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  timesheets: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  monthlySummaries: { total: 0, migrated: 0, skipped: 0, errors: 0 },
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
    
    await User.deleteMany({});
    await Employee.deleteMany({});
    await Project.deleteMany({});
    await Attendance.deleteMany({});
    await LeaveRequest.deleteMany({});
    await LeaveType.deleteMany({});
    await LeaveBalance.deleteMany({});
    await Task.deleteMany({});
    await Timesheet.deleteMany({});
    await MonthlySummary.deleteMany({});
    
    console.log('   ✅ All collections cleared');
  } catch (error) {
    console.error('   ❌ Error clearing collections:', error.message);
    throw error;
  }
}

/**
 * Migrate Users (merge users, admins, supervisors)
 */
async function migrateUsers() {
  console.log('\n📦 Migrating Users (users + admins + supervisors)...');
  
  try {
    // Fetch from all user tables
    const usersResult = await db.query(`
      SELECT id, name, email, password_hash, 'WORKER' as role, created_at, updated_at
      FROM users
      WHERE email IS NOT NULL
    `);
    const usersRows = usersResult.rows || [];
    
    const adminsResult = await db.query(`
      SELECT id, name, email, password_hash, 'ADMIN' as role, created_at, updated_at
      FROM admins
      WHERE email IS NOT NULL AND status = 'active'
    `);
    const adminsRows = adminsResult.rows || [];
    
    const supervisorsResult = await db.query(`
      SELECT id, name, email, password_hash, 'SUPERVISOR' as role, created_at, updated_at
      FROM supervisors
      WHERE email IS NOT NULL
    `);
    const supervisorsRows = supervisorsResult.rows || [];
    
    const allUsers = [...usersRows, ...adminsRows, ...supervisorsRows];
    stats.users.total = allUsers.length;
    
    console.log(`   Found ${allUsers.length} users to migrate (Workers: ${usersRows.length}, Admins: ${adminsRows.length}, Supervisors: ${supervisorsRows.length})`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', allUsers.slice(0, 5).map(u => ({ email: u.email, role: u.role })));
      return;
    }
    
    for (const user of allUsers) {
      try {
        const existing = await User.findById(user.id);
        if (existing) {
          stats.users.skipped++;
          continue;
        }
        
        // Check by email too
        const existingByEmail = await User.findOne({ email: user.email.toLowerCase().trim() });
        if (existingByEmail) {
          stats.users.skipped++;
          continue;
        }
        
        // Always use insertOne to bypass pre-save hook (passwords are already hashed)
        // This avoids the "next is not a function" error from the pre-save hook
        try {
          await User.collection.insertOne({
            _id: user.id,
            name: user.name || 'Unknown',
            email: user.email.toLowerCase().trim(),
            password: user.password_hash || '$2b$10$changeme123', // Default hash if missing
            role: user.role || 'WORKER',
            isActive: true,
            createdAt: user.created_at || new Date(),
            updatedAt: user.updated_at || user.created_at || new Date(),
          });
        } catch (insertError) {
          // If insert fails due to duplicate, skip
          if (insertError.code === 11000) {
            stats.users.skipped++;
            continue;
          }
          throw insertError;
        }
        
        stats.users.migrated++;
        if (stats.users.migrated % 50 === 0) {
          console.log(`   ✅ Migrated ${stats.users.migrated}/${stats.users.total} users...`);
        }
      } catch (error) {
        if (error.code === 11000) {
          stats.users.skipped++;
        } else {
          stats.users.errors++;
          console.error(`   ❌ Error migrating user ${user.email}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Completed: ${stats.users.migrated}/${stats.users.total} users migrated (Skipped: ${stats.users.skipped}, Errors: ${stats.users.errors})`);
  } catch (error) {
    console.error('   ❌ Error fetching users:', error);
    throw error;
  }
}

/**
 * Migrate Projects (merge projects, clients, project_employees, supervisor_projects)
 */
async function migrateProjects() {
  console.log('\n📦 Migrating Projects (projects + clients + project_employees + supervisor_projects)...');
  
  try {
    // Fetch projects - check which column exists (client_id or client_user_id)
    // First try with client_user_id (newer schema)
    let projectsResult;
    let projectsRows;
    let useClientUserId = false;
    
    try {
      projectsResult = await db.query(`
        SELECT id, name, location, start_date, end_date, description, budget, 
               client_user_id, created_at
        FROM projects
        ORDER BY created_at
      `);
      projectsRows = projectsResult.rows || [];
      useClientUserId = true;
    } catch (error) {
      // If client_user_id doesn't exist, try client_id
      if (error.code === '42703') {
        try {
          projectsResult = await db.query(`
            SELECT id, name, location, start_date, end_date, description, budget, 
                   client_id, created_at
            FROM projects
            ORDER BY created_at
          `);
          projectsRows = projectsResult.rows || [];
          useClientUserId = false;
        } catch (err) {
          // If neither exists, just fetch projects without client reference
          projectsResult = await db.query(`
            SELECT id, name, location, start_date, end_date, description, budget, 
                   created_at
            FROM projects
            ORDER BY created_at
          `);
          projectsRows = projectsResult.rows || [];
        }
      } else {
        throw error;
      }
    }
    
    // Fetch clients (if clients table exists)
    let clientsRows = [];
    let clientsMap = new Map();
    try {
      const clientsResult = await db.query(`
        SELECT id, name, email, phone, address, contact_person, is_active, created_at, updated_at
        FROM clients
      `);
      clientsRows = clientsResult.rows || [];
      clientsMap = new Map(clientsRows.map(c => [c.id, c]));
    } catch (error) {
      // Clients table might not exist, continue without it
      console.log('   ⚠️  Clients table not found, continuing without client data');
    }
    
    // If using client_user_id, we need to map it to clients via users table
    // For now, we'll store client_user_id and try to find matching client info
    if (useClientUserId && clientsRows.length > 0) {
      // Try to match client_user_id with clients via users table
      try {
        const clientUsersResult = await db.query(`
          SELECT u.id as user_id, c.id as client_id, c.name, c.email, c.phone, c.address, c.contact_person
          FROM users u
          INNER JOIN clients c ON c.email = u.email
        `);
        const clientUsersMap = new Map(clientUsersResult.rows.map(cu => [cu.user_id, cu]));
        // Update clientsMap to include user_id mapping
        for (const [userId, clientInfo] of clientUsersMap) {
          clientsMap.set(userId, {
            id: clientInfo.client_id,
            name: clientInfo.name,
            email: clientInfo.email,
            phone: clientInfo.phone,
            address: clientInfo.address,
            contact_person: clientInfo.contact_person,
          });
        }
      } catch (error) {
        // If join fails, continue without client mapping
        console.log('   ⚠️  Could not map client_user_id to clients');
      }
    }
    
    // Fetch project_employees
    const projectEmployeesResult = await db.query(`
      SELECT pe.project_id, pe.employee_id, pe.assigned_at, pe.assignment_start_date, 
             pe.assignment_end_date, pe.status, pe.notes,
             e.name as employee_name, e.email as employee_email
      FROM project_employees pe
      LEFT JOIN employees e ON e.id = pe.employee_id
      WHERE pe.status = 'active'
    `);
    const projectEmployeesRows = projectEmployeesResult.rows || [];
    
    // Fetch supervisor_projects - IMPORTANT: Use user.id (not supervisor profile id)
    const supervisorProjectsResult = await db.query(`
      SELECT spr.project_id, spr.supervisor_id, spr.assigned_at,
             u.id as supervisor_user_id, u.name as supervisor_name, u.email as supervisor_email
      FROM supervisor_projects_relation spr
      LEFT JOIN supervisors s ON s.id = spr.supervisor_id
      LEFT JOIN users u ON u.email = s.email
      WHERE u.id IS NOT NULL
    `);
    const supervisorProjectsRows = supervisorProjectsResult.rows || [];
    
    // Group project_employees by project_id
    const projectEmployeesMap = new Map();
    for (const pe of projectEmployeesRows) {
      if (!projectEmployeesMap.has(pe.project_id)) {
        projectEmployeesMap.set(pe.project_id, []);
      }
      projectEmployeesMap.get(pe.project_id).push({
        employee_id: pe.employee_id,
        employee_name: pe.employee_name,
        employee_email: pe.employee_email,
        assigned_at: pe.assigned_at,
        assignment_start_date: pe.assignment_start_date,
        assignment_end_date: pe.assignment_end_date,
        status: pe.status || 'active',
        notes: pe.notes,
      });
    }
    
    // Group supervisor_projects by project_id - Use supervisor_user_id (user.id) not supervisor_id (profile.id)
    const supervisorProjectsMap = new Map();
    for (const sp of supervisorProjectsRows) {
      if (!sp.supervisor_user_id) {
        console.warn(`   ⚠️  Skipping supervisor assignment for project ${sp.project_id} - no user_id found`);
        continue; // Skip if no user_id found
      }
      if (!supervisorProjectsMap.has(sp.project_id)) {
        supervisorProjectsMap.set(sp.project_id, []);
      }
      supervisorProjectsMap.get(sp.project_id).push({
        supervisor_id: sp.supervisor_user_id, // Use user ID, not profile ID
        supervisor_name: sp.supervisor_name,
        supervisor_email: sp.supervisor_email,
        assigned_at: sp.assigned_at,
        status: 'active',
      });
    }
    
    stats.projects.total = projectsRows.length;
    console.log(`   Found ${projectsRows.length} projects to migrate`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', projectsRows.slice(0, 3).map(p => ({ name: p.name, client_id: p.client_id })));
      return;
    }
    
    for (const project of projectsRows) {
      try {
        const existing = await Project.findById(project.id);
        if (existing) {
          stats.projects.skipped++;
          continue;
        }
        
        // Get client information
        const clientId = useClientUserId ? project.client_user_id : project.client_id;
        const client = clientId ? clientsMap.get(clientId) : null;
        
        // Get assigned employees
        const assignedEmployees = projectEmployeesMap.get(project.id) || [];
        
        // Get assigned supervisors
        const assignedSupervisors = supervisorProjectsMap.get(project.id) || [];
        
        const projectDoc = new Project({
          _id: project.id,
          name: project.name,
          location: project.location || null,
          start_date: project.start_date || null,
          end_date: project.end_date || null,
          description: project.description || null,
          budget: project.budget ? mongoose.Types.Decimal128.fromString(project.budget.toString()) : null,
          client: client ? {
            client_id: client.id,
            client_name: client.name,
            client_email: client.email,
            client_phone: client.phone,
            client_address: client.address,
            contact_person: client.contact_person,
          } : null,
          assigned_employees: assignedEmployees,
          assigned_supervisors: assignedSupervisors,
          created_at: project.created_at || new Date(),
          updated_at: project.created_at || new Date(), // Projects table doesn't have updated_at
        });
        
        await projectDoc.save();
        stats.projects.migrated++;
        if (stats.projects.migrated % 20 === 0) {
          console.log(`   ✅ Migrated ${stats.projects.migrated}/${stats.projects.total} projects...`);
        }
      } catch (error) {
        stats.projects.errors++;
        console.error(`   ❌ Error migrating project ${project.name}:`, error.message);
      }
    }
    
    console.log(`   ✅ Completed: ${stats.projects.migrated}/${stats.projects.total} projects migrated (Skipped: ${stats.projects.skipped}, Errors: ${stats.projects.errors})`);
  } catch (error) {
    console.error('   ❌ Error fetching projects:', error);
    throw error;
  }
}

/**
 * Migrate Employees (merge employees, staffs, worker_supervisor, project_employees)
 */
async function migrateEmployees() {
  console.log('\n📦 Migrating Employees (employees + staffs + worker_supervisor + project_employees)...');
  
  try {
    // Fetch employees
    const employeesResult = await db.query(`
      SELECT id, name, email, phone, role, project_id, 
             payment_type, hourly_rate, daily_rate, monthly_rate, contract_rate,
             status, created_at
      FROM employees
      ORDER BY created_at
    `);
    const employeesRows = employeesResult.rows || [];
    
    // Fetch staffs
    const staffsResult = await db.query(`
      SELECT id, name, email, phone, role, project_id, created_at, updated_at
      FROM staffs
    `);
    const staffsRows = staffsResult.rows || [];
    
    // Fetch worker_supervisor relations
    const workerSupervisorResult = await db.query(`
      SELECT wsr.worker_id, wsr.supervisor_id, wsr.assigned_at
      FROM worker_supervisor_relation wsr
    `);
    const workerSupervisorRows = workerSupervisorResult.rows || [];
    
    // Fetch project_employees for employees
    const projectEmployeesResult = await db.query(`
      SELECT pe.employee_id, pe.project_id, pe.assigned_at, pe.assignment_start_date,
             pe.assignment_end_date, pe.status, pe.notes
      FROM project_employees pe
      WHERE pe.status = 'active'
    `);
    const projectEmployeesRows = projectEmployeesResult.rows || [];
    
    // Combine employees and staffs (staffs are also employees)
    const allEmployees = [...employeesRows];
    for (const staff of staffsRows) {
      // Check if staff already exists as employee
      const exists = allEmployees.find(e => e.id === staff.id);
      if (!exists) {
        allEmployees.push({
          ...staff,
          payment_type: null,
          hourly_rate: null,
          daily_rate: null,
          monthly_rate: null,
          contract_rate: null,
          status: 'active',
        });
      }
    }
    
    // Group worker_supervisor by worker_id
    const supervisorsMap = new Map();
    for (const ws of workerSupervisorRows) {
      if (!supervisorsMap.has(ws.worker_id)) {
        supervisorsMap.set(ws.worker_id, []);
      }
      supervisorsMap.get(ws.worker_id).push({
        supervisor_id: ws.supervisor_id,
        assigned_at: ws.assigned_at,
        status: 'active',
      });
    }
    
    // Group project_employees by employee_id
    const projectAssignmentsMap = new Map();
    for (const pe of projectEmployeesRows) {
      if (!projectAssignmentsMap.has(pe.employee_id)) {
        projectAssignmentsMap.set(pe.employee_id, []);
      }
      projectAssignmentsMap.get(pe.employee_id).push({
        project_id: pe.project_id,
        assigned_at: pe.assigned_at,
        assignment_start_date: pe.assignment_start_date,
        assignment_end_date: pe.assignment_end_date,
        status: pe.status || 'active',
        notes: pe.notes,
      });
    }
    
    stats.employees.total = allEmployees.length;
    console.log(`   Found ${allEmployees.length} employees to migrate (from employees: ${employeesRows.length}, from staffs: ${staffsRows.length})`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', allEmployees.slice(0, 5).map(e => ({ name: e.name, email: e.email })));
      return;
    }
    
    for (const emp of allEmployees) {
      try {
        const existing = await Employee.findById(emp.id);
        if (existing) {
          stats.employees.skipped++;
          continue;
        }
        
        // Get supervisors for this employee
        const supervisors = supervisorsMap.get(emp.id) || [];
        
        // Get project assignments for this employee
        const projectAssignments = projectAssignmentsMap.get(emp.id) || [];
        
        const employeeDoc = new Employee({
          _id: emp.id,
          name: emp.name,
          email: emp.email ? emp.email.toLowerCase().trim() : null,
          phone: emp.phone || null,
          role: emp.role || null,
          payment_type: emp.payment_type || null,
          hourly_rate: emp.hourly_rate ? mongoose.Types.Decimal128.fromString(emp.hourly_rate.toString()) : null,
          daily_rate: emp.daily_rate ? mongoose.Types.Decimal128.fromString(emp.daily_rate.toString()) : null,
          monthly_rate: emp.monthly_rate ? mongoose.Types.Decimal128.fromString(emp.monthly_rate.toString()) : null,
          contract_rate: emp.contract_rate ? mongoose.Types.Decimal128.fromString(emp.contract_rate.toString()) : null,
          status: emp.status || 'active',
          project_assignments: projectAssignments,
          supervisors: supervisors,
          created_at: emp.created_at || new Date(),
          updated_at: emp.updated_at || emp.created_at || new Date(),
        });
        
        await employeeDoc.save();
        stats.employees.migrated++;
        if (stats.employees.migrated % 50 === 0) {
          console.log(`   ✅ Migrated ${stats.employees.migrated}/${stats.employees.total} employees...`);
        }
      } catch (error) {
        if (error.code === 11000) {
          stats.employees.skipped++;
        } else {
          stats.employees.errors++;
          console.error(`   ❌ Error migrating employee ${emp.name}:`, error.message);
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
 * Migrate Attendance (merge attendance_logs, timesheets)
 */
async function migrateAttendance() {
  console.log('\n📦 Migrating Attendance (attendance_logs + timesheets)...');
  
  try {
    // Fetch attendance_logs
    const attendanceLogsResult = await db.query(`
      SELECT id, user_id, check_in_time, check_out_time,
             image_url, latitude, longitude,
             checkout_image_url, checkout_latitude, checkout_longitude,
             created_at
      FROM attendance_logs
      ORDER BY created_at
    `);
    const attendanceLogsRows = attendanceLogsResult.rows || [];
    
    // Fetch timesheets
    const timesheetsResult = await db.query(`
      SELECT id, staff_id, work_date, check_in, check_out, total_hours, overtime_hours,
             project_id, task_type, status, approval_status, ot_approval_status,
             remarks, ot_justification, approved_by, approved_at, ot_approved_by, ot_approved_at,
             created_at, updated_at
      FROM timesheets
      ORDER BY created_at
    `);
    const timesheetsRows = timesheetsResult.rows || [];
    
    // Create a map of timesheets by (staff_id, work_date) for merging
    const timesheetsMap = new Map();
    for (const ts of timesheetsRows) {
      const key = `${ts.staff_id}_${ts.work_date}`;
      timesheetsMap.set(key, ts);
    }
    
    // Merge attendance_logs with timesheets
    const allAttendance = [];
    
    // Process attendance_logs
    for (const att of attendanceLogsRows) {
      const workDate = new Date(att.check_in_time);
      workDate.setHours(0, 0, 0, 0);
      const key = `${att.user_id}_${workDate.toISOString().split('T')[0]}`;
      const timesheet = timesheetsMap.get(key);
      
      allAttendance.push({
        _id: att.id,
        user_id: att.user_id,
        staff_id: timesheet?.staff_id || att.user_id,
        work_date: workDate,
        check_in_time: att.check_in_time,
        check_in: timesheet?.check_in || att.check_in_time,
        check_out_time: att.check_out_time,
        check_out: timesheet?.check_out || att.check_out_time,
        total_hours: timesheet?.total_hours || (att.check_out_time ? calculateHours(att.check_in_time, att.check_out_time) : 0),
        overtime_hours: timesheet?.overtime_hours || 0,
        latitude: att.latitude,
        longitude: att.longitude,
        checkout_latitude: att.checkout_latitude,
        checkout_longitude: att.checkout_longitude,
        image_url: att.image_url,
        checkout_image_url: att.checkout_image_url,
        project_id: timesheet?.project_id || null,
        task_type: timesheet?.task_type || null,
        status: timesheet?.status || 'Present',
        approval_status: timesheet?.approval_status || 'Draft',
        ot_approval_status: timesheet?.ot_approval_status || null,
        remarks: timesheet?.remarks || null,
        ot_justification: timesheet?.ot_justification || null,
        approved_by: timesheet?.approved_by || null,
        approved_at: timesheet?.approved_at || null,
        ot_approved_by: timesheet?.ot_approved_by || null,
        ot_approved_at: timesheet?.ot_approved_at || null,
        created_at: att.created_at || new Date(),
        updated_at: timesheet?.updated_at || att.created_at || new Date(),
      });
    }
    
    // Process timesheets that don't have corresponding attendance_logs
    for (const ts of timesheetsRows) {
      const key = `${ts.staff_id}_${ts.work_date}`;
      const exists = attendanceLogsRows.find(att => {
        const workDate = new Date(att.check_in_time);
        workDate.setHours(0, 0, 0, 0);
        return `${att.user_id}_${workDate.toISOString().split('T')[0]}` === key;
      });
      
      if (!exists) {
        allAttendance.push({
          _id: ts.id,
          user_id: ts.staff_id, // Use staff_id as user_id
          staff_id: ts.staff_id,
          work_date: ts.work_date,
          check_in_time: ts.check_in,
          check_in: ts.check_in,
          check_out_time: ts.check_out,
          check_out: ts.check_out,
          total_hours: ts.total_hours || 0,
          overtime_hours: ts.overtime_hours || 0,
          latitude: null,
          longitude: null,
          checkout_latitude: null,
          checkout_longitude: null,
          image_url: null,
          checkout_image_url: null,
          project_id: ts.project_id || null,
          task_type: ts.task_type || null,
          status: ts.status || 'Present',
          approval_status: ts.approval_status || 'Draft',
          ot_approval_status: ts.ot_approval_status || null,
          remarks: ts.remarks || null,
          ot_justification: ts.ot_justification || null,
          approved_by: ts.approved_by || null,
          approved_at: ts.approved_at || null,
          ot_approved_by: ts.ot_approved_by || null,
          ot_approved_at: ts.ot_approved_at || null,
          created_at: ts.created_at || new Date(),
          updated_at: ts.updated_at || new Date(),
        });
      }
    }
    
    stats.attendance.total = allAttendance.length;
    console.log(`   Found ${allAttendance.length} attendance records to migrate (from attendance_logs: ${attendanceLogsRows.length}, from timesheets: ${timesheetsRows.length})`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', allAttendance.slice(0, 5).map(a => ({ id: a._id, work_date: a.work_date })));
      return;
    }
    
    for (const att of allAttendance) {
      try {
        const existing = await Attendance.findById(att._id);
        if (existing) {
          stats.attendance.skipped++;
          continue;
        }
        
        const attendanceDoc = new Attendance({
          ...att,
          total_hours: att.total_hours ? mongoose.Types.Decimal128.fromString(att.total_hours.toString()) : mongoose.Types.Decimal128.fromString('0'),
          overtime_hours: att.overtime_hours ? mongoose.Types.Decimal128.fromString(att.overtime_hours.toString()) : mongoose.Types.Decimal128.fromString('0'),
          latitude: att.latitude ? mongoose.Types.Decimal128.fromString(att.latitude.toString()) : null,
          longitude: att.longitude ? mongoose.Types.Decimal128.fromString(att.longitude.toString()) : null,
          checkout_latitude: att.checkout_latitude ? mongoose.Types.Decimal128.fromString(att.checkout_latitude.toString()) : null,
          checkout_longitude: att.checkout_longitude ? mongoose.Types.Decimal128.fromString(att.checkout_longitude.toString()) : null,
        });
        
        await attendanceDoc.save();
        stats.attendance.migrated++;
        if (stats.attendance.migrated % 100 === 0) {
          console.log(`   ✅ Migrated ${stats.attendance.migrated}/${stats.attendance.total} attendance records...`);
        }
      } catch (error) {
        if (error.code === 11000) {
          stats.attendance.skipped++;
        } else {
          stats.attendance.errors++;
          console.error(`   ❌ Error migrating attendance ${att._id}:`, error.message);
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
 * Helper function to calculate hours between two dates
 */
function calculateHours(start, end) {
  if (!start || !end) return 0;
  const diff = new Date(end) - new Date(start);
  return diff / (1000 * 60 * 60); // Convert to hours
}

/**
 * Migrate Leave Types
 */
async function migrateLeaveTypes() {
  console.log('\n📦 Migrating Leave Types...');
  
  try {
    const result = await db.query(`
      SELECT id, name, code, description, requires_approval, max_days_per_year, auto_reset_annually, created_at
      FROM leave_types
      ORDER BY created_at
    `);
    const rows = result.rows || [];
    
    stats.leaveTypes.total = rows.length;
    console.log(`   Found ${rows.length} leave types to migrate`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', rows.map(lt => ({ name: lt.name, code: lt.code })));
      return;
    }
    
    for (const lt of rows) {
      try {
        const existing = await LeaveType.findById(lt.id);
        if (existing) {
          stats.leaveTypes.skipped++;
          continue;
        }
        
        const leaveTypeDoc = new LeaveType({
          _id: lt.id,
          name: lt.name,
          code: lt.code,
          description: lt.description || null,
          requires_approval: lt.requires_approval !== false,
          max_days_per_year: lt.max_days_per_year || null,
          auto_reset_annually: lt.auto_reset_annually || false,
          created_at: lt.created_at || new Date(),
        });
        
        await leaveTypeDoc.save();
        stats.leaveTypes.migrated++;
      } catch (error) {
        if (error.code === 11000) {
          stats.leaveTypes.skipped++;
        } else {
          stats.leaveTypes.errors++;
          console.error(`   ❌ Error migrating leave type ${lt.name}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Completed: ${stats.leaveTypes.migrated}/${stats.leaveTypes.total} leave types migrated (Skipped: ${stats.leaveTypes.skipped}, Errors: ${stats.leaveTypes.errors})`);
  } catch (error) {
    console.error('   ❌ Error fetching leave types:', error);
    throw error;
  }
}

/**
 * Migrate Leave Balances
 */
async function migrateLeaveBalances() {
  console.log('\n📦 Migrating Leave Balances...');
  
  try {
    const result = await db.query(`
      SELECT id, employee_id, leave_type_id, year, total_days, used_days, remaining_days, last_reset_date, created_at, updated_at
      FROM leave_balances
      ORDER BY created_at
    `);
    const rows = result.rows || [];
    
    stats.leaveBalances.total = rows.length;
    console.log(`   Found ${rows.length} leave balances to migrate`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', rows.slice(0, 5).map(lb => ({ employee_id: lb.employee_id, leave_type_id: lb.leave_type_id, year: lb.year })));
      return;
    }
    
    for (const lb of rows) {
      try {
        const existing = await LeaveBalance.findById(lb.id);
        if (existing) {
          stats.leaveBalances.skipped++;
          continue;
        }
        
        const leaveBalanceDoc = new LeaveBalance({
          _id: lb.id,
          employee_id: lb.employee_id,
          leave_type_id: lb.leave_type_id,
          year: lb.year,
          total_days: lb.total_days ? mongoose.Types.Decimal128.fromString(lb.total_days.toString()) : mongoose.Types.Decimal128.fromString('0'),
          used_days: lb.used_days ? mongoose.Types.Decimal128.fromString(lb.used_days.toString()) : mongoose.Types.Decimal128.fromString('0'),
          remaining_days: lb.remaining_days ? mongoose.Types.Decimal128.fromString(lb.remaining_days.toString()) : mongoose.Types.Decimal128.fromString('0'),
          last_reset_date: lb.last_reset_date || null,
          created_at: lb.created_at || new Date(),
          updated_at: lb.updated_at || new Date(),
        });
        
        await leaveBalanceDoc.save();
        stats.leaveBalances.migrated++;
        if (stats.leaveBalances.migrated % 50 === 0) {
          console.log(`   ✅ Migrated ${stats.leaveBalances.migrated}/${stats.leaveBalances.total} leave balances...`);
        }
      } catch (error) {
        if (error.code === 11000) {
          stats.leaveBalances.skipped++;
        } else {
          stats.leaveBalances.errors++;
          console.error(`   ❌ Error migrating leave balance ${lb.id}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Completed: ${stats.leaveBalances.migrated}/${stats.leaveBalances.total} leave balances migrated (Skipped: ${stats.leaveBalances.skipped}, Errors: ${stats.leaveBalances.errors})`);
  } catch (error) {
    console.error('   ❌ Error fetching leave balances:', error);
    throw error;
  }
}

/**
 * Migrate Leave Requests
 */
async function migrateLeaveRequests() {
  console.log('\n📦 Migrating Leave Requests...');
  
  try {
    // Fetch leave types for embedding
    const leaveTypesResult = await db.query(`
      SELECT id, name, code, description
      FROM leave_types
    `);
    const leaveTypesRows = leaveTypesResult.rows || [];
    const leaveTypesMap = new Map(leaveTypesRows.map(lt => [lt.id, lt]));
    
    const result = await db.query(`
      SELECT id, employee_id, leave_type_id, project_id, start_date, end_date, number_of_days,
             reason, status, approved_by, approved_at, rejection_reason, mc_document_url,
             stand_in_employee_id, created_at, updated_at
      FROM leave_requests
      ORDER BY created_at
    `);
    const rows = result.rows || [];
    
    stats.leaveRequests.total = rows.length;
    console.log(`   Found ${rows.length} leave requests to migrate`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', rows.slice(0, 5).map(lr => ({ id: lr.id, employee_id: lr.employee_id, status: lr.status })));
      return;
    }
    
    for (const lr of rows) {
      try {
        const existing = await LeaveRequest.findById(lr.id);
        if (existing) {
          stats.leaveRequests.skipped++;
          continue;
        }
        
        // Get leave type information
        const leaveType = leaveTypesMap.get(lr.leave_type_id);
        
        const leaveRequestDoc = new LeaveRequest({
          _id: lr.id,
          employee_id: lr.employee_id,
          leave_type_id: lr.leave_type_id,
          leave_type: leaveType ? {
            name: leaveType.name,
            code: leaveType.code,
            description: leaveType.description,
          } : null,
          project_id: lr.project_id || null,
          start_date: lr.start_date,
          end_date: lr.end_date,
          number_of_days: lr.number_of_days ? mongoose.Types.Decimal128.fromString(lr.number_of_days.toString()) : null,
          reason: lr.reason || null,
          status: lr.status || 'pending',
          approved_by: lr.approved_by || null,
          approved_at: lr.approved_at || null,
          rejection_reason: lr.rejection_reason || null,
          mc_document_url: lr.mc_document_url || null,
          stand_in_employee_id: lr.stand_in_employee_id || null,
          created_at: lr.created_at || new Date(),
          updated_at: lr.updated_at || new Date(),
        });
        
        await leaveRequestDoc.save();
        stats.leaveRequests.migrated++;
        if (stats.leaveRequests.migrated % 50 === 0) {
          console.log(`   ✅ Migrated ${stats.leaveRequests.migrated}/${stats.leaveRequests.total} leave requests...`);
        }
      } catch (error) {
        if (error.code === 11000) {
          stats.leaveRequests.skipped++;
        } else {
          stats.leaveRequests.errors++;
          console.error(`   ❌ Error migrating leave request ${lr.id}:`, error.message);
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
 * Migrate Tasks (worker_tasks)
 */
async function migrateTasks() {
  console.log('\n📦 Migrating Tasks (worker_tasks)...');
  
  try {
    const result = await db.query(`
      SELECT id, project_id, worker_id, supervisor_id, title, description, status,
             due_date, assigned_at, completed_at, created_at, updated_at
      FROM worker_tasks
      ORDER BY created_at
    `);
    const rows = result.rows || [];
    
    stats.tasks.total = rows.length;
    console.log(`   Found ${rows.length} tasks to migrate`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', rows.slice(0, 5).map(t => ({ title: t.title, status: t.status })));
      return;
    }
    
    for (const task of rows) {
      try {
        const existing = await Task.findById(task.id);
        if (existing) {
          stats.tasks.skipped++;
          continue;
        }
        
        const taskDoc = new Task({
          _id: task.id,
          project_id: task.project_id,
          worker_id: task.worker_id,
          supervisor_id: task.supervisor_id,
          title: task.title,
          description: task.description || null,
          status: task.status || 'pending',
          due_date: task.due_date || null,
          assigned_at: task.assigned_at || new Date(),
          completed_at: task.completed_at || null,
          created_at: task.created_at || new Date(),
          updated_at: task.updated_at || new Date(),
        });
        
        await taskDoc.save();
        stats.tasks.migrated++;
        if (stats.tasks.migrated % 50 === 0) {
          console.log(`   ✅ Migrated ${stats.tasks.migrated}/${stats.tasks.total} tasks...`);
        }
      } catch (error) {
        if (error.code === 11000) {
          stats.tasks.skipped++;
        } else {
          stats.tasks.errors++;
          console.error(`   ❌ Error migrating task ${task.title}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Completed: ${stats.tasks.migrated}/${stats.tasks.total} tasks migrated (Skipped: ${stats.tasks.skipped}, Errors: ${stats.tasks.errors})`);
  } catch (error) {
    console.error('   ❌ Error fetching tasks:', error);
    throw error;
  }
}

/**
 * Migrate Timesheets
 */
async function migrateTimesheets() {
  console.log('\n📦 Migrating Timesheets...');
  
  try {
    const result = await db.query(`
      SELECT id, staff_id, work_date, check_in, check_out, total_hours, overtime_hours,
             project_id, task_type, status, approval_status, ot_approval_status,
             remarks, ot_justification, approved_by, approved_at, ot_approved_by, ot_approved_at,
             created_by, created_at, updated_at
      FROM timesheets
      ORDER BY work_date DESC, created_at DESC
    `);
    const rows = result.rows || [];
    
    stats.timesheets.total = rows.length;
    console.log(`   Found ${rows.length} timesheets to migrate`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', rows.slice(0, 5).map(t => ({ 
        staff_id: t.staff_id, 
        work_date: t.work_date,
        total_hours: t.total_hours 
      })));
      return;
    }
    
    const mongoose = require('mongoose');
    
    for (const timesheet of rows) {
      try {
        const existing = await Timesheet.findById(timesheet.id);
        if (existing) {
          stats.timesheets.skipped++;
          continue;
        }
        
        // Convert Decimal128 for MongoDB
        const totalHours = timesheet.total_hours 
          ? mongoose.Types.Decimal128.fromString(timesheet.total_hours.toString())
          : mongoose.Types.Decimal128.fromString('0');
        const overtimeHours = timesheet.overtime_hours
          ? mongoose.Types.Decimal128.fromString(timesheet.overtime_hours.toString())
          : mongoose.Types.Decimal128.fromString('0');
        
        const timesheetDoc = new Timesheet({
          _id: timesheet.id,
          staff_id: timesheet.staff_id,
          work_date: timesheet.work_date ? new Date(timesheet.work_date) : null,
          check_in: timesheet.check_in ? new Date(timesheet.check_in) : null,
          check_out: timesheet.check_out ? new Date(timesheet.check_out) : null,
          total_hours: totalHours,
          overtime_hours: overtimeHours,
          project_id: timesheet.project_id || null,
          task_type: timesheet.task_type || null,
          status: timesheet.status || 'Present',
          approval_status: timesheet.approval_status || 'Draft',
          ot_approval_status: timesheet.ot_approval_status || null,
          remarks: timesheet.remarks || null,
          ot_justification: timesheet.ot_justification || null,
          approved_by: timesheet.approved_by || null,
          approved_at: timesheet.approved_at ? new Date(timesheet.approved_at) : null,
          ot_approved_by: timesheet.ot_approved_by || null,
          ot_approved_at: timesheet.ot_approved_at ? new Date(timesheet.ot_approved_at) : null,
          created_by: timesheet.created_by || null,
          created_at: timesheet.created_at ? new Date(timesheet.created_at) : new Date(),
          updated_at: timesheet.updated_at ? new Date(timesheet.updated_at) : new Date(),
        });
        
        await timesheetDoc.save();
        stats.timesheets.migrated++;
        if (stats.timesheets.migrated % 100 === 0) {
          console.log(`   ✅ Migrated ${stats.timesheets.migrated}/${stats.timesheets.total} timesheets...`);
        }
      } catch (error) {
        if (error.code === 11000) {
          stats.timesheets.skipped++;
        } else {
          stats.timesheets.errors++;
          console.error(`   ❌ Error migrating timesheet ${timesheet.id}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Completed: ${stats.timesheets.migrated}/${stats.timesheets.total} timesheets migrated (Skipped: ${stats.timesheets.skipped}, Errors: ${stats.timesheets.errors})`);
  } catch (error) {
    console.error('   ❌ Error fetching timesheets:', error);
    throw error;
  }
}

/**
 * Migrate Monthly Summaries
 */
async function migrateMonthlySummaries() {
  console.log('\n📦 Migrating Monthly Summaries...');
  
  try {
    // Try to get all columns, but handle missing ones gracefully
    let result;
    try {
      result = await db.query(`
        SELECT id, employee_id, month, year, total_working_days, total_worked_hours, total_ot_hours,
               approved_leaves, absent_days, project_breakdown, status, staff_signature, staff_signed_at,
               staff_signed_by, admin_signature, admin_approved_at, admin_approved_by, admin_remarks,
               subtotal, tax_percentage, tax_amount, total_amount, invoice_number,
               created_by, created_at, updated_at
        FROM monthly_summaries
        ORDER BY year DESC, month DESC, created_at DESC
      `);
    } catch (error) {
      // If query fails, try without optional columns
      result = await db.query(`
        SELECT id, employee_id, month, year, total_working_days, total_worked_hours, total_ot_hours,
               approved_leaves, absent_days, project_breakdown, status, staff_signature, staff_signed_at,
               staff_signed_by, admin_signature, admin_approved_at, admin_approved_by, admin_remarks,
               created_by, created_at, updated_at
        FROM monthly_summaries
        ORDER BY year DESC, month DESC, created_at DESC
      `);
    }
    const rows = result.rows || [];
    
    stats.monthlySummaries.total = rows.length;
    console.log(`   Found ${rows.length} monthly summaries to migrate`);
    
    if (isDryRun) {
      console.log('   [DRY RUN] Would migrate:', rows.slice(0, 5).map(s => ({ 
        employee_id: s.employee_id, 
        month: s.month,
        year: s.year,
        status: s.status
      })));
      return;
    }
    
    const mongoose = require('mongoose');
    
    for (const summary of rows) {
      try {
        const existing = await MonthlySummary.findById(summary.id);
        if (existing) {
          stats.monthlySummaries.skipped++;
          continue;
        }
        
        // Convert Decimal128 for MongoDB
        const totalWorkedHours = summary.total_worked_hours
          ? mongoose.Types.Decimal128.fromString(summary.total_worked_hours.toString())
          : mongoose.Types.Decimal128.fromString('0');
        const totalOtHours = summary.total_ot_hours
          ? mongoose.Types.Decimal128.fromString(summary.total_ot_hours.toString())
          : mongoose.Types.Decimal128.fromString('0');
        const approvedLeaves = summary.approved_leaves
          ? mongoose.Types.Decimal128.fromString(summary.approved_leaves.toString())
          : mongoose.Types.Decimal128.fromString('0');
        // Handle optional financial fields (may not exist in older schemas)
        const subtotal = summary.subtotal !== undefined && summary.subtotal !== null
          ? mongoose.Types.Decimal128.fromString(summary.subtotal.toString())
          : mongoose.Types.Decimal128.fromString('0');
        const taxPercentage = summary.tax_percentage !== undefined && summary.tax_percentage !== null
          ? mongoose.Types.Decimal128.fromString(summary.tax_percentage.toString())
          : mongoose.Types.Decimal128.fromString('0');
        const taxAmount = summary.tax_amount !== undefined && summary.tax_amount !== null
          ? mongoose.Types.Decimal128.fromString(summary.tax_amount.toString())
          : mongoose.Types.Decimal128.fromString('0');
        const totalAmount = summary.total_amount !== undefined && summary.total_amount !== null
          ? mongoose.Types.Decimal128.fromString(summary.total_amount.toString())
          : mongoose.Types.Decimal128.fromString('0');
        
        // Parse project_breakdown JSON if it's a string
        let projectBreakdown = [];
        if (summary.project_breakdown) {
          if (typeof summary.project_breakdown === 'string') {
            try {
              projectBreakdown = JSON.parse(summary.project_breakdown);
            } catch (e) {
              console.warn(`   ⚠️  Could not parse project_breakdown for summary ${summary.id}`);
            }
          } else if (Array.isArray(summary.project_breakdown)) {
            projectBreakdown = summary.project_breakdown;
          }
        }
        
        // Convert project breakdown Decimal128 fields
        projectBreakdown = projectBreakdown.map(proj => ({
          project_id: proj.project_id || null,
          project_name: proj.project_name || 'Unassigned',
          days_worked: proj.days_worked || 0,
          total_hours: proj.total_hours
            ? mongoose.Types.Decimal128.fromString(proj.total_hours.toString())
            : mongoose.Types.Decimal128.fromString('0'),
          ot_hours: proj.ot_hours
            ? mongoose.Types.Decimal128.fromString(proj.ot_hours.toString())
            : mongoose.Types.Decimal128.fromString('0'),
        }));
        
        const summaryDoc = new MonthlySummary({
          _id: summary.id,
          employee_id: summary.employee_id,
          month: summary.month,
          year: summary.year,
          total_working_days: summary.total_working_days || 0,
          total_worked_hours: totalWorkedHours,
          total_ot_hours: totalOtHours,
          approved_leaves: approvedLeaves,
          absent_days: summary.absent_days || 0,
          project_breakdown: projectBreakdown,
          status: summary.status || 'DRAFT',
          staff_signature: summary.staff_signature || null,
          staff_signed_at: summary.staff_signed_at ? new Date(summary.staff_signed_at) : null,
          staff_signed_by: summary.staff_signed_by || null,
          admin_signature: summary.admin_signature || null,
          admin_approved_at: summary.admin_approved_at ? new Date(summary.admin_approved_at) : null,
          admin_approved_by: summary.admin_approved_by || null,
          admin_remarks: summary.admin_remarks || null,
          subtotal: subtotal,
          payment_type: summary.payment_type || null, // May not exist in older schemas
          tax_percentage: taxPercentage,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          invoice_number: summary.invoice_number || null,
          created_by: summary.created_by || null,
          created_at: summary.created_at ? new Date(summary.created_at) : new Date(),
          updated_at: summary.updated_at ? new Date(summary.updated_at) : new Date(),
        });
        
        await summaryDoc.save();
        stats.monthlySummaries.migrated++;
        if (stats.monthlySummaries.migrated % 50 === 0) {
          console.log(`   ✅ Migrated ${stats.monthlySummaries.migrated}/${stats.monthlySummaries.total} monthly summaries...`);
        }
      } catch (error) {
        if (error.code === 11000) {
          stats.monthlySummaries.skipped++;
        } else {
          stats.monthlySummaries.errors++;
          console.error(`   ❌ Error migrating monthly summary ${summary.id}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Completed: ${stats.monthlySummaries.migrated}/${stats.monthlySummaries.total} monthly summaries migrated (Skipped: ${stats.monthlySummaries.skipped}, Errors: ${stats.monthlySummaries.errors})`);
  } catch (error) {
    console.error('   ❌ Error fetching monthly summaries:', error);
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
    { name: 'Users', stats: stats.users },
    { name: 'Employees', stats: stats.employees },
    { name: 'Projects', stats: stats.projects },
    { name: 'Attendance', stats: stats.attendance },
    { name: 'Leave Types', stats: stats.leaveTypes },
    { name: 'Leave Balances', stats: stats.leaveBalances },
    { name: 'Leave Requests', stats: stats.leaveRequests },
    { name: 'Tasks', stats: stats.tasks },
    { name: 'Timesheets', stats: stats.timesheets },
    { name: 'Monthly Summaries', stats: stats.monthlySummaries },
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
 * Verify migration
 */
async function verifyMigration() {
  console.log('\n🔍 Verifying Migration...\n');
  
  try {
    const userCount = await User.countDocuments();
    const employeeCount = await Employee.countDocuments();
    const projectCount = await Project.countDocuments();
    const attendanceCount = await Attendance.countDocuments();
    const leaveTypeCount = await LeaveType.countDocuments();
    const leaveBalanceCount = await LeaveBalance.countDocuments();
    const leaveRequestCount = await LeaveRequest.countDocuments();
    const taskCount = await Task.countDocuments();
    const timesheetCount = await Timesheet.countDocuments();
    const monthlySummaryCount = await MonthlySummary.countDocuments();
    
    console.log(`   Users: ${userCount} documents`);
    console.log(`   Employees: ${employeeCount} documents`);
    console.log(`   Projects: ${projectCount} documents`);
    console.log(`   Attendance: ${attendanceCount} documents`);
    console.log(`   Leave Types: ${leaveTypeCount} documents`);
    console.log(`   Leave Balances: ${leaveBalanceCount} documents`);
    console.log(`   Leave Requests: ${leaveRequestCount} documents`);
    console.log(`   Tasks: ${taskCount} documents`);
    console.log(`   Timesheets: ${timesheetCount} documents`);
    console.log(`   Monthly Summaries: ${monthlySummaryCount} documents`);
    
    console.log('\n   ✅ Verification complete\n');
  } catch (error) {
    console.error('   ❌ Verification error:', error.message);
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('\n🚀 Starting Comprehensive Supabase to MongoDB Migration');
  console.log('='.repeat(70));
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be inserted');
  }
  
  if (isSeedMode) {
    console.log('🌱 SEED MODE - Collections will be cleared before migration');
  }
  
  console.log('='.repeat(70) + '\n');
  
  try {
    // Connect to databases
    console.log('📡 Connecting to MongoDB...');
    await connectMongoDB();
    console.log('✅ MongoDB connected\n');
    
    console.log('📡 Connecting to Supabase (PostgreSQL)...');
    await db.getClient();
    console.log('✅ Supabase connected\n');
    
    // Clear collections if seed mode
    await clearCollections();
    
    // Migrate in dependency order
    await migrateUsers();           // 1. Users (no dependencies)
    await migrateLeaveTypes();      // 2. Leave Types (no dependencies)
    await migrateProjects();        // 3. Projects (depends on Users for supervisors)
    await migrateEmployees();       // 4. Employees (depends on Projects, Users)
    await migrateLeaveBalances();   // 5. Leave Balances (depends on Employees, Leave Types)
    await migrateLeaveRequests();   // 6. Leave Requests (depends on Employees, Leave Types, Projects)
    await migrateAttendance();       // 7. Attendance (depends on Users, Employees, Projects)
    await migrateTasks();           // 8. Tasks (depends on Projects, Employees, Users)
    await migrateTimesheets();      // 9. Timesheets (depends on Employees, Projects)
    await migrateMonthlySummaries(); // 10. Monthly Summaries (depends on Employees)
    
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

