/**
 * Script to assign all employees to projects
 * 
 * This script:
 * 1. Fetches all active employees
 * 2. Fetches all active projects
 * 3. Distributes employees evenly across projects
 * 4. Creates assignments in project_employees table (Supabase) or assigned_employees array (MongoDB)
 * 
 * Usage: node scripts/assign-all-employees-to-projects.js
 */

require('dotenv').config();
const env = require('../config/env');
const db = require('../config/db');
const { supabase } = require('../config/supabaseClient');
const mongoose = require('mongoose');
const ProjectMerged = require('../models/ProjectMerged');
const EmployeeMerged = require('../models/EmployeeMerged');
const User = require('../models/User');

async function assignAllEmployeesToProjects() {
  try {
    console.log('🚀 Starting employee-to-project assignment...\n');
    console.log(`📊 Database Provider: ${env.dbProvider.toUpperCase()}\n`);

    if (env.dbProvider === 'mongodb') {
      // Connect to MongoDB if not already connected
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(env.mongodbUri);
        console.log('✅ Connected to MongoDB\n');
      }

      // MongoDB: Fetch all active employees
      const employees = await EmployeeMerged.find({ status: 'active' })
        .select('_id name email')
        .lean();

      // MongoDB: Fetch all active projects
      const projects = await ProjectMerged.find({})
        .select('_id name')
        .lean();

      if (employees.length === 0) {
        console.log('⚠️  No employees found. Exiting...');
        return;
      }

      if (projects.length === 0) {
        console.log('⚠️  No projects found. Exiting...');
        return;
      }

      console.log(`📋 Found ${employees.length} employees`);
      console.log(`📋 Found ${projects.length} projects\n`);

      let assignedCount = 0;
      let skippedCount = 0;
      const errors = [];

      // Distribute employees evenly across projects
      for (let i = 0; i < employees.length; i++) {
        const employee = employees[i];
        const projectIndex = i % projects.length;
        const project = projects[projectIndex];

        try {
          // Check if employee already has an active assignment in this project
          const existingProject = await ProjectMerged.findOne({
            _id: project._id,
            'assigned_employees.employee_id': employee._id.toString(),
            'assigned_employees.status': 'active'
          }).lean();

          if (existingProject) {
            console.log(`⏭️  Employee ${employee.name} already assigned to project ${project.name}`);
            skippedCount++;
            continue;
          }

          // Add employee to project's assigned_employees array
          await ProjectMerged.updateOne(
            { _id: project._id },
            {
              $push: {
                assigned_employees: {
                  employee_id: employee._id.toString(),
                  employee_name: employee.name,
                  employee_email: employee.email || null,
                  assigned_at: new Date(),
                  assignment_start_date: new Date(),
                  assignment_end_date: null,
                  status: 'active',
                  notes: 'Assigned via bulk assignment script'
                }
              },
              $set: { updated_at: new Date() }
            }
          );

          // Also update employee's project_assignments array
          await EmployeeMerged.updateOne(
            { _id: employee._id },
            {
              $push: {
                project_assignments: {
                  project_id: project._id.toString(),
                  assigned_at: new Date(),
                  assignment_start_date: new Date(),
                  assignment_end_date: null,
                  status: 'active',
                  notes: 'Assigned via bulk assignment script'
                }
              },
              $set: { updated_at: new Date() }
            }
          );

          assignedCount++;
          console.log(`✅ Assigned ${employee.name} to ${project.name}`);
        } catch (error) {
          console.error(`❌ Error assigning ${employee.name} to ${project.name}:`, error.message);
          errors.push({ employee: employee.name, project: project.name, error: error.message });
        }
      }

      console.log('\n📊 Assignment Summary:');
      console.log(`   ✅ Successfully assigned: ${assignedCount}`);
      console.log(`   ⏭️  Skipped (already assigned): ${skippedCount}`);
      console.log(`   ❌ Errors: ${errors.length}`);

      if (errors.length > 0) {
        console.log('\n❌ Errors:');
        errors.forEach(err => {
          console.log(`   - ${err.employee} → ${err.project}: ${err.error}`);
        });
      }

      // Close MongoDB connection
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        console.log('\n✅ MongoDB connection closed');
      }
    } else {
      // Supabase: Check if Supabase client is available
      if (!supabase) {
        throw new Error('Supabase client is not initialized. Please check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
      }

      // Supabase: Fetch all active employees
      // Note: employees table might not have a status field, so we'll fetch all employees
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id, name, email');

      if (employeesError) {
        throw new Error(`Failed to fetch employees: ${employeesError.message}`);
      }

      // Supabase: Fetch all projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name');

      if (projectsError) {
        throw new Error(`Failed to fetch projects: ${projectsError.message}`);
      }

      if (!employees || employees.length === 0) {
        console.log('⚠️  No employees found. Exiting...');
        return;
      }

      if (!projects || projects.length === 0) {
        console.log('⚠️  No projects found. Exiting...');
        return;
      }

      console.log(`📋 Found ${employees.length} employees`);
      console.log(`📋 Found ${projects.length} projects\n`);

      let assignedCount = 0;
      let skippedCount = 0;
      const errors = [];

      // Distribute employees evenly across projects
      for (let i = 0; i < employees.length; i++) {
        const employee = employees[i];
        const projectIndex = i % projects.length;
        const project = projects[projectIndex];

        try {
          // Check if employee already has an active assignment in this project
          const { data: existingAssignment } = await supabase
            .from('project_employees')
            .select('id')
            .eq('project_id', project.id)
            .eq('employee_id', employee.id)
            .eq('status', 'active')
            .maybeSingle();

          if (existingAssignment) {
            console.log(`⏭️  Employee ${employee.name} already assigned to project ${project.name}`);
            skippedCount++;
            continue;
          }

          // Get admin user ID for assigned_by field (use first admin found)
          const { data: adminUser } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'admin')
            .limit(1)
            .maybeSingle();

          // Create assignment in project_employees table
          const { data: assignment, error: insertError } = await supabase
            .from('project_employees')
            .insert({
              project_id: project.id,
              employee_id: employee.id,
              assigned_by: adminUser?.id || null,
              status: 'active',
              assignment_start_date: new Date().toISOString().split('T')[0],
              notes: 'Assigned via bulk assignment script'
            })
            .select()
            .single();

          if (insertError) {
            throw new Error(insertError.message);
          }

          assignedCount++;
          console.log(`✅ Assigned ${employee.name} to ${project.name}`);
        } catch (error) {
          console.error(`❌ Error assigning ${employee.name} to ${project.name}:`, error.message);
          errors.push({ employee: employee.name, project: project.name, error: error.message });
        }
      }

      console.log('\n📊 Assignment Summary:');
      console.log(`   ✅ Successfully assigned: ${assignedCount}`);
      console.log(`   ⏭️  Skipped (already assigned): ${skippedCount}`);
      console.log(`   ❌ Errors: ${errors.length}`);

      if (errors.length > 0) {
        console.log('\n❌ Errors:');
        errors.forEach(err => {
          console.log(`   - ${err.employee} → ${err.project}: ${err.error}`);
        });
      }
    }

    console.log('\n✨ Assignment process completed!');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  assignAllEmployeesToProjects()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { assignAllEmployeesToProjects };

