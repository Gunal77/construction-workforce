/**
 * Comprehensive script to seed client portal with sample data
 * Creates: Clients, Projects, Employees, Supervisors, and links them together
 */

require('dotenv').config();
const env = require('../config/env');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const ProjectMerged = require('../models/ProjectMerged');
const EmployeeMerged = require('../models/EmployeeMerged');
const AttendanceMerged = require('../models/AttendanceMerged');
const User = require('../models/User');

async function seedClientPortalData() {
  try {
    console.log('🚀 Starting client portal data seeding...\n');
    console.log(`📊 Database Provider: ${env.dbProvider.toUpperCase()}\n`);

    if (env.dbProvider !== 'mongodb') {
      console.log('⚠️  This script is for MongoDB only. Current provider:', env.dbProvider);
      return;
    }

    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      console.log('🔌 Connecting to MongoDB...');
      await mongoose.connect(env.mongodbUri);
      console.log('✅ Connected to MongoDB\n');
    } else {
      console.log('✅ Already connected to MongoDB\n');
    }

    // Step 1: Create/Get Clients
    console.log('📋 Step 1: Creating/Checking clients...');
    const clientData = [
      {
        name: 'John Smith',
        email: 'john.smith@example.com',
        password: 'Client123!',
        role: 'CLIENT'
      },
      {
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        password: 'Client123!',
        role: 'CLIENT'
      }
    ];

    const clients = [];
    for (const clientInfo of clientData) {
      let client = await User.findOne({ email: clientInfo.email });
      
      if (!client) {
        // Hash password manually
        const passwordHash = await bcrypt.hash(clientInfo.password, 12);
        const clientId = new mongoose.Types.ObjectId().toString();
        
        // Use native MongoDB insert to bypass pre-save hook
        await User.collection.insertOne({
          _id: clientId,
          name: clientInfo.name,
          email: clientInfo.email,
          password: passwordHash,
          role: clientInfo.role,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`   ✅ Created client: ${clientInfo.name}`);
      } else {
        // Update existing client (without _id)
        const passwordHash = await bcrypt.hash(clientInfo.password, 12);
        await User.updateOne(
          { email: clientInfo.email },
          {
            $set: {
              name: clientInfo.name,
              password: passwordHash,
              role: clientInfo.role,
              isActive: true,
              updatedAt: new Date()
            }
          }
        );
        console.log(`   🔄 Updated client: ${clientInfo.name}`);
      }
      
      // Refresh client object
      client = await User.findOne({ email: clientInfo.email });
      clients.push(client);
    }

    // Step 2: Create/Get Projects
    console.log('\n📋 Step 2: Creating/Checking projects...');
    const projectData = [
      {
        name: 'Residential Building Construction',
        location: '123 Main Street, Singapore',
        start_date: new Date('2024-01-15'),
        end_date: new Date('2024-12-31'),
        description: 'Construction of a 10-story residential building',
        budget: 5000000
      },
      {
        name: 'Office Complex Renovation',
        location: '456 Business Park, Singapore',
        start_date: new Date('2024-02-01'),
        end_date: new Date('2024-11-30'),
        description: 'Complete renovation of office complex',
        budget: 3000000
      },
      {
        name: 'Shopping Mall Expansion',
        location: '789 Commercial Road, Singapore',
        start_date: new Date('2024-03-01'),
        end_date: new Date('2025-02-28'),
        description: 'Expansion of existing shopping mall',
        budget: 8000000
      },
      {
        name: 'Hospital Wing Construction',
        location: '321 Medical Drive, Singapore',
        start_date: new Date('2024-04-01'),
        end_date: new Date('2025-03-31'),
        description: 'New wing construction for hospital',
        budget: 12000000
      }
    ];

    // Get John Smith client specifically
    const johnSmithClient = clients.find(c => c.email === 'john.smith@example.com') || clients[0];
    console.log(`   📌 Using client: ${johnSmithClient.name} (${johnSmithClient.email})\n`);

    const projects = [];
    for (let i = 0; i < projectData.length; i++) {
      const projData = projectData[i];
      let project = await ProjectMerged.findOne({ name: projData.name });
      
      if (!project) {
        const projectId = new mongoose.Types.ObjectId().toString();
        
        project = new ProjectMerged({
          _id: projectId,
          name: projData.name,
          location: projData.location,
          start_date: projData.start_date,
          end_date: projData.end_date,
          description: projData.description,
          budget: mongoose.Types.Decimal128.fromString(projData.budget.toString()),
          client: {
            client_id: johnSmithClient._id.toString(),
            client_name: johnSmithClient.name,
            client_email: johnSmithClient.email,
            client_phone: null,
            client_address: null,
            contact_person: johnSmithClient.name
          },
          assigned_employees: [],
          assigned_supervisors: [],
          created_at: new Date()
        });
        
        await project.save();
        console.log(`   ✅ Created project: ${projData.name} → ${johnSmithClient.name}`);
      } else {
        // Update client to John Smith if not set or different
        if (!project.client?.client_id || project.client.client_id !== johnSmithClient._id.toString()) {
          project.client = {
            client_id: johnSmithClient._id.toString(),
            client_name: johnSmithClient.name,
            client_email: johnSmithClient.email,
            client_phone: null,
            client_address: null,
            contact_person: johnSmithClient.name
          };
          await project.save();
          console.log(`   🔄 Updated project client: ${projData.name} → ${johnSmithClient.name}`);
        } else {
          console.log(`   ⏭️  Project exists: ${projData.name}`);
        }
      }
      
      projects.push(project);
    }

    // Step 3: Create/Get Supervisors
    console.log('\n📋 Step 3: Creating/Checking supervisors...');
    const supervisorData = [
      {
        name: 'John Supervisor',
        email: 'supervisor@example.com',
        password: 'Supervisor123!',
        role: 'SUPERVISOR'
      },
      {
        name: 'Sarah Manager',
        email: 'sarah@example.com',
        password: 'Supervisor123!',
        role: 'SUPERVISOR'
      },
      {
        name: 'Mike Foreman',
        email: 'mike.foreman@example.com',
        password: 'Supervisor123!',
        role: 'SUPERVISOR'
      },
      {
        name: 'David Site Manager',
        email: 'david.manager@example.com',
        password: 'Supervisor123!',
        role: 'SUPERVISOR'
      }
    ];

    const supervisors = [];
    for (const supData of supervisorData) {
      let supervisor = await User.findOne({ email: supData.email });
      
      if (!supervisor) {
        // Hash password manually
        const passwordHash = await bcrypt.hash(supData.password, 12);
        const supervisorId = new mongoose.Types.ObjectId().toString();
        
        // Use native MongoDB insert to bypass pre-save hook
        await User.collection.insertOne({
          _id: supervisorId,
          name: supData.name,
          email: supData.email,
          password: passwordHash,
          role: supData.role,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`   ✅ Created supervisor: ${supData.name}`);
      } else {
        // Update existing supervisor (without _id)
        const passwordHash = await bcrypt.hash(supData.password, 12);
        await User.updateOne(
          { email: supData.email },
          {
            $set: {
              name: supData.name,
              password: passwordHash,
              role: supData.role,
              isActive: true,
              updatedAt: new Date()
            }
          }
        );
        console.log(`   🔄 Updated supervisor: ${supData.name}`);
      }
      
      // Refresh supervisor object
      supervisor = await User.findOne({ email: supData.email });
      supervisors.push(supervisor);
    }

    // Assign supervisors to projects
    console.log('\n📋 Step 4: Assigning supervisors to projects...');
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const supervisor = supervisors[i % supervisors.length];
      
      // Check if supervisor already assigned
      const existingSupervisor = project.assigned_supervisors?.find(
        s => s.supervisor_id === supervisor._id.toString()
      );
      
      if (!existingSupervisor) {
        if (!project.assigned_supervisors) {
          project.assigned_supervisors = [];
        }
        
        project.assigned_supervisors.push({
          supervisor_id: supervisor._id.toString(),
          supervisor_name: supervisor.name,
          supervisor_email: supervisor.email,
          assigned_at: new Date(),
          status: 'active'
        });
        
        await project.save();
        console.log(`   ✅ Assigned ${supervisor.name} to "${project.name}"`);
      }
    }

    // Step 5: Create/Get Employees
    console.log('\n📋 Step 5: Creating/Checking employees...');
    const employeeData = [
      { name: 'Michael Johnson', email: 'michael.j@example.com', phone: '+65-9123-4567', role: 'Carpenter' },
      { name: 'Robert Williams', email: 'robert.w@example.com', phone: '+65-9123-4568', role: 'Electrician' },
      { name: 'James Brown', email: 'james.b@example.com', phone: '+65-9123-4569', role: 'Plumber' },
      { name: 'David Jones', email: 'david.j@example.com', phone: '+65-9123-4570', role: 'Mason' },
      { name: 'William Garcia', email: 'william.g@example.com', phone: '+65-9123-4571', role: 'Painter' },
      { name: 'Richard Miller', email: 'richard.m@example.com', phone: '+65-9123-4572', role: 'Welder' },
      { name: 'Joseph Davis', email: 'joseph.d@example.com', phone: '+65-9123-4573', role: 'Carpenter' },
      { name: 'Thomas Rodriguez', email: 'thomas.r@example.com', phone: '+65-9123-4574', role: 'Laborer' },
      { name: 'Charles Martinez', email: 'charles.m@example.com', phone: '+65-9123-4575', role: 'Electrician' },
      { name: 'Christopher Anderson', email: 'chris.a@example.com', phone: '+65-9123-4576', role: 'Plumber' },
      { name: 'Daniel Taylor', email: 'daniel.t@example.com', phone: '+65-9123-4577', role: 'Mason' },
      { name: 'Matthew Thomas', email: 'matthew.t@example.com', phone: '+65-9123-4578', role: 'Carpenter' }
    ];

    const employees = [];
    for (const empData of employeeData) {
      let user = await User.findOne({ email: empData.email });
      
      if (!user) {
        // Hash password manually
        const passwordHash = await bcrypt.hash('Worker123!', 12);
        const userId = new mongoose.Types.ObjectId().toString();
        
        // Use native MongoDB insert to bypass pre-save hook
        await User.collection.insertOne({
          _id: userId,
          name: empData.name,
          email: empData.email,
          password: passwordHash,
          role: 'WORKER',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        // Refresh user object
        user = await User.findOne({ email: empData.email });
      } else {
        // Update existing user (without _id)
        const passwordHash = await bcrypt.hash('Worker123!', 12);
        await User.updateOne(
          { email: empData.email },
          {
            $set: {
              name: empData.name,
              password: passwordHash,
              role: 'WORKER',
              isActive: true,
              updatedAt: new Date()
            }
          }
        );
        // Refresh user object
        user = await User.findOne({ email: empData.email });
      }

      // Check if employee exists
      let employee = await EmployeeMerged.findOne({ email: empData.email });
      
      if (!employee) {
        const employeeId = new mongoose.Types.ObjectId().toString();
        
        employee = new EmployeeMerged({
          _id: employeeId,
          user_id: user._id.toString(),
          name: empData.name,
          email: empData.email,
          phone: empData.phone,
          role: empData.role,
          project_assignments: [],
          created_at: new Date()
        });
        
        await employee.save();
        console.log(`   ✅ Created employee: ${empData.name}`);
      } else {
        console.log(`   ⏭️  Employee exists: ${empData.name}`);
      }
      
      employees.push(employee);
    }

    // Step 6: Assign employees to projects
    console.log('\n📋 Step 6: Assigning employees to projects...');
    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      const project = projects[i % projects.length];
      
      // Check if already assigned
      const existingAssignment = employee.project_assignments?.find(
        a => a.project_id === project._id.toString() && a.status === 'active'
      );
      
      if (!existingAssignment) {
        if (!employee.project_assignments) {
          employee.project_assignments = [];
        }
        
        employee.project_assignments.push({
          project_id: project._id.toString(),
          assigned_at: new Date(),
          assignment_start_date: new Date(),
          assignment_end_date: null,
          status: 'active',
          notes: null
        });
        
        await employee.save();
        
        // Also add to project's assigned_employees
        if (!project.assigned_employees) {
          project.assigned_employees = [];
        }
        
        const existingInProject = project.assigned_employees.find(
          e => e.employee_id === employee._id.toString()
        );
        
        if (!existingInProject) {
          project.assigned_employees.push({
            employee_id: employee._id.toString(),
            employee_name: employee.name,
            employee_email: employee.email,
            assigned_at: new Date(),
            assignment_start_date: new Date(),
            assignment_end_date: null,
            status: 'active',
            notes: null
          });
          
          await project.save();
        }
        
        console.log(`   ✅ Assigned ${employee.name} to "${project.name}"`);
      }
    }

    // Step 7: Create attendance records for employees
    console.log('\n📋 Step 7: Creating attendance records...');
    let attendanceCount = 0;
    
    // Create attendance for the last 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const workDate = new Date(today);
      workDate.setDate(workDate.getDate() - dayOffset);
      
      // Skip weekends
      if (workDate.getDay() === 0 || workDate.getDay() === 6) {
        continue;
      }
      
      for (const employee of employees) {
        // Get employee's active project
        const activeAssignment = employee.project_assignments?.find(a => a.status === 'active');
        if (!activeAssignment) continue;
        
        const projectId = activeAssignment.project_id;
        
        // Ensure employee has user_id - if not, find user by email
        let userId = employee.user_id;
        if (!userId && employee.email) {
          const user = await User.findOne({ email: employee.email });
          if (user) {
            userId = user._id.toString();
            // Update employee with user_id
            await EmployeeMerged.updateOne(
              { _id: employee._id },
              { $set: { user_id: userId } }
            );
          } else {
            console.log(`   ⚠️  Skipping attendance for ${employee.name}: No user found`);
            continue;
          }
        }
        
        if (!userId) {
          console.log(`   ⚠️  Skipping attendance for ${employee.name}: No user_id`);
          continue;
        }
        
        // Create date boundaries for query
        const dayStart = new Date(workDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(workDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        // Check if attendance already exists for this date
        const existingAttendance = await AttendanceMerged.findOne({
          user_id: userId,
          work_date: {
            $gte: dayStart,
            $lte: dayEnd
          }
        });
        
        if (existingAttendance) {
          continue;
        }
        
        // Create check-in time (between 7 AM and 8 AM)
        const checkInHour = 7 + Math.floor(Math.random() * 2);
        const checkInMinute = Math.floor(Math.random() * 60);
        const checkInTime = new Date(workDate);
        checkInTime.setHours(checkInHour, checkInMinute, 0, 0);
        
        // Create check-out time (between 5 PM and 7 PM)
        const checkOutHour = 17 + Math.floor(Math.random() * 3);
        const checkOutMinute = Math.floor(Math.random() * 60);
        const checkOutTime = new Date(workDate);
        checkOutTime.setHours(checkOutHour, checkOutMinute, 0, 0);
        
        // Calculate hours
        const totalHoursMs = checkOutTime - checkInTime;
        const totalHours = totalHoursMs / (1000 * 60 * 60);
        const regularHours = 8;
        const overtimeHours = Math.max(0, totalHours - regularHours);
        
        const attendanceId = new mongoose.Types.ObjectId().toString();
        const attendance = new AttendanceMerged({
          _id: attendanceId,
          user_id: userId,
          staff_id: employee._id.toString(),
          work_date: workDate,
          check_in_time: checkInTime,
          check_in: checkInTime,
          check_out_time: checkOutTime,
          check_out: checkOutTime,
          total_hours: mongoose.Types.Decimal128.fromString(totalHours.toFixed(2)),
          overtime_hours: mongoose.Types.Decimal128.fromString(overtimeHours.toFixed(2)),
          project_id: projectId,
          latitude: mongoose.Types.Decimal128.fromString('1.3521'), // Singapore coordinates
          longitude: mongoose.Types.Decimal128.fromString('103.8198'),
          checkout_latitude: mongoose.Types.Decimal128.fromString('1.3521'),
          checkout_longitude: mongoose.Types.Decimal128.fromString('103.8198'),
          status: 'Present',
          created_at: new Date()
        });
        
        await attendance.save();
        attendanceCount++;
      }
    }
    
    console.log(`   ✅ Created ${attendanceCount} attendance records`);

    // Final Summary
    console.log('\n📊 Final Summary:');
    console.log(`   - Clients: ${clients.length}`);
    console.log(`   - Projects: ${projects.length}`);
    console.log(`   - Supervisors: ${supervisors.length}`);
    console.log(`   - Employees: ${employees.length}`);
    
    console.log('\n📋 Projects by Client:');
    for (const client of clients) {
      const clientProjects = await ProjectMerged.countDocuments({
        'client.client_id': client._id.toString()
      });
      console.log(`   - ${client.name}: ${clientProjects} project(s)`);
    }
    
    console.log('\n📋 John Smith Client Details:');
    const johnSmithProjects = await ProjectMerged.find({
      'client.client_id': johnSmithClient._id.toString()
    }).lean();
    
    console.log(`   - Total Projects: ${johnSmithProjects.length}`);
    
    let totalEmployees = 0;
    let totalSupervisors = 0;
    for (const project of johnSmithProjects) {
      const empCount = project.assigned_employees?.filter(e => e.status === 'active').length || 0;
      const supCount = project.assigned_supervisors?.filter(s => s.status === 'active').length || 0;
      totalEmployees += empCount;
      totalSupervisors += supCount;
      console.log(`   - "${project.name}": ${empCount} employees, ${supCount} supervisors`);
    }
    
    const johnSmithAttendance = await AttendanceMerged.countDocuments({
      user_id: { $in: employees.map(e => e.user_id) }
    });
    console.log(`   - Total Attendance Records: ${johnSmithAttendance}`);

    console.log('\n✅ Client portal data seeding completed successfully!');
    console.log('\n🔑 Login Credentials:');
    console.log('   Client: john.smith@example.com / Client123!');
    console.log('   Client: jane.doe@example.com / Client123!');
    console.log('   Supervisor: supervisor@example.com / Supervisor123!');

  } catch (error) {
    console.error('❌ Error seeding client portal data:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  seedClientPortalData()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = seedClientPortalData;

